import { parseStoryline, type StorylineConfig } from '../../../engine/config';
import type { Copy } from '../../../engine/copy';
import type { Evaluator } from '../../../engine/sim/evaluator';
import type { NpcModel } from '../../../engine/sim/live';
import { playSynthetic, type Probe } from '../../../engine/sim/synthetic';
import type { SyntheticSpeaker } from '../../../engine/sim/syntheticSpeech';
import { aggregate } from './aggregate';
import { configHash } from './hash';
import { playthroughOf, runResultOf } from './extract';
import { CalibrationSettings, PERSONA_KEYS, type CalibrationResults, type CalibrationSettingsInput, type PersonaKey, type Playthrough, type RunResult } from './schema';

/**
 * Runs a calibration (D113): every persona's playthroughs, then the probes, then the aggregation. The same
 * code runs in a Web Worker, in the page (chunked), on the server's job queue and in `npm run synthetic`.
 * Deterministic for a draft, settings and players: playthrough i of each persona plays seed + i, so the
 * personas meet the same team and the same events.
 */

export class CalibrationError extends Error {
  constructor(message: string, readonly code: 'badStoryline' | 'badSettings' | 'cancelled', readonly issues: string[] = []) { super(message); this.name = 'CalibrationError'; }
}

export interface RunDeps {
  speaker?: SyntheticSpeaker;
  evaluator?: Evaluator;
  npc?: NpcModel;
  onProgress?(done: number, total: number): void;
  signal?: AbortSignal;
  ranOn: CalibrationResults['ranOn'];
  /** Which players spoke; left out, AI when a speaker is given, else the offline templates. */
  players?: CalibrationResults['players'];
  /** Words engine copy as English for transcripts (`wordEnglish`, or the app's `wordCopy`); see `PlayOptions.word`. */
  word?: (c: Copy) => string;
  /** Gives the thread back between playthroughs (the page stays responsive). */
  yieldEvery?: () => Promise<void>;
}

/** True for an abort: the signal fired, or a player, model call or fetch threw AbortError. */
export function isAbort(err: unknown, signal?: AbortSignal): boolean {
  return !!signal?.aborted || (typeof err === 'object' && err !== null && (err as { name?: unknown }).name === 'AbortError');
}

export interface CalibrationOutput { results: CalibrationResults; playthroughs: Playthrough[] }


export function parseDraft(draft: unknown): StorylineConfig {
  const p = parseStoryline(draft);
  if (!p.ok) throw new CalibrationError('This draft does not play yet. Fix the issues first.', 'badStoryline', p.issues.slice(0, 20));
  return p.config;
}

/** The playthroughs a calibration will play, in order: each persona's, then the probes. */
export function plan(config: StorylineConfig, s: CalibrationSettings) {
  const runs: Array<{ persona: PersonaKey; index: number; seed: number }> = [];
  for (const persona of PERSONA_KEYS) for (let i = 0; i < (s.personas[persona] ?? 0); i++) runs.push({ persona, index: i, seed: s.seed + i });
  const probes: Array<{ persona: PersonaKey; index: number; seed: number; probe: Probe }> = [];
  if (s.probes) {
    const all: Probe[] = [...config.lens.styles.map(x => ({ kind: 'style' as const, style: x.key })), ...config.actions.map(a => ({ kind: 'action' as const, action: a.key }))];
    for (const probe of all) for (let i = 0; i < 2; i++) probes.push({ persona: probe.kind === 'style' ? 'proficient' : 'developing', index: i, seed: s.seed + 500 + i, probe });
  }
  return { runs, probes };
}

const nextTick = () => new Promise<void>(r => setTimeout(r, 0));

export async function runCalibration(draft: unknown, settingsIn: CalibrationSettingsInput, deps: RunDeps): Promise<CalibrationOutput> {
  const started = Date.now();
  const parsed = CalibrationSettings.safeParse(settingsIn);
  if (!parsed.success) throw new CalibrationError('These settings cannot run.', 'badSettings', parsed.error.issues.map(i => i.message));
  const settings = parsed.data;
  const config = parseDraft(draft);
  const { runs: todo, probes: probing } = plan(config, settings);
  const total = todo.length + probing.length;
  const tick = deps.yieldEvery ?? nextTick;
  const opts = { speaker: deps.speaker, evaluator: deps.evaluator, npc: deps.npc, signal: deps.signal, word: deps.word };
  const runs: RunResult[] = [];
  const probes: RunResult[] = [];
  const playthroughs: Playthrough[] = [];
  let done = 0;
  deps.onProgress?.(0, total);
  const check = () => { if (deps.signal?.aborted) throw new CalibrationError('Cancelled', 'cancelled'); };
  // A cancel mid playthrough throws from inside the player (AbortError); it is a cancel, not a failure.
  const guarded = async <T>(f: () => Promise<T>): Promise<T> => {
    try {
      return await f();
    } catch (err) {
      if (!(err instanceof CalibrationError) && isAbort(err, deps.signal)) throw new CalibrationError('Cancelled', 'cancelled');
      throw err;
    }
  };
  for (const r of todo) {
    check();
    const run = await guarded(() => playSynthetic(config, r.persona, r.seed, { ...opts, describe: settings.describe?.[r.persona] || undefined }));
    runs.push(runResultOf(run, r.index, config));
    playthroughs.push(playthroughOf(run, r.index, config));
    deps.onProgress?.(++done, total);
    await tick();
  }
  for (const p of probing) {
    check();
    // Probes play on the offline templates and evaluator: they test the mechanics, not the words, and cost no model calls.
    const run = await guarded(() => playSynthetic(config, p.persona, p.seed, { probe: p.probe, signal: deps.signal, word: deps.word }));
    probes.push(runResultOf(run, p.index, config));
    deps.onProgress?.(++done, total);
    await tick();
  }
  const results = aggregate(runs, probes, {
    storyline: { id: config.id, name: config.name },
    configHash: configHash(draft),
    lens: { title: config.lens.title, styles: config.lens.styles.map(s => ({ key: s.key, name: s.name })) },
    scale: config.report.scale.map(l => l.name),
    money: { currency: config.money.currency, locale: config.money.locale },
    scoreMax: config.gamification.scale,
    tiers: config.gamification.tiers.map(t => ({ key: t.key, name: t.name, min: t.min })),
    targetTier: settings.targetTier,
    actions: config.actions.map(a => ({ key: a.key, name: a.name })),
    settings: { seed: settings.seed, probes: settings.probes, personas: Object.fromEntries(PERSONA_KEYS.map(k => [k, settings.personas[k] ?? 0])) },
    ranOn: deps.ranOn,
    players: deps.players ?? (deps.speaker ? 'ai' : 'templates'),
    createdAt: new Date(started).toISOString(),
    durationMs: Date.now() - started
  });
  return { results, playthroughs };
}
