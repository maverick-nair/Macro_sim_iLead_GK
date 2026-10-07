import { parseStoryline, type StorylineConfig, type StorylineInput } from './config';
import { EngineView, Intent, IntentResult } from './contract';
import { mockStream } from '../ai/mockStream';
import { EngineError, parse, type EngineClient } from './client';
import { loadEngineCopy } from '../i18n/locales';
import type { Evaluator } from './sim/evaluator';
import { createEngine, IntentError } from './sim/engine';
import salesElevator from './storylines/sales-elevator.json';
import { withSixStyles } from './storylines/sixStyles';
import { neededStyles, play, type Policy } from './sim/policies';

/**
 * The mock engine adapter: the same engine code the server runs, in the browser, on a storyline
 * fixture. Loaded lazily by createDefaultClient so it never weighs on the initial bundle.
 */
/** Where the author chat (`/author`, D74) leaves a drafted storyline for "Play this draft". */
export const DRAFT_KEY = 'ilead.author.draft';

/**
 * `?storyline=draft`: the author chat's draft, from session storage (or local storage, which a new tab
 * shares), checked with the storyline schema. Missing or invalid: Sales Elevator, with a console warning.
 */
export function draftStoryline(storage: Array<Pick<Storage, 'getItem'> | undefined> = [globalThis.sessionStorage, globalThis.localStorage]): StorylineConfig | null {
  let raw: string | null = null;
  for (const s of storage) { try { raw ??= s?.getItem(DRAFT_KEY) ?? null; } catch { /* storage blocked */ } }
  let r: ReturnType<typeof parseStoryline> = { ok: false, issues: ['no draft stored'] };
  try { if (raw) r = parseStoryline(JSON.parse(raw)); } catch { r = { ok: false, issues: ['the draft is not JSON'] }; }
  if (r.ok) return r.config;
  console.warn(`Draft storyline not used, playing Sales Elevator: ${r.issues.slice(0, 3).join('; ')}`);
  return null;
}

export function defaultStoryline(lens?: string | null): StorylineConfig {
  if (new URLSearchParams(globalThis.location?.search ?? '').get('storyline') === 'draft') {
    const draft = draftStoryline();
    if (draft) return draft;
  }
  // `?lens=six_styles` plays Sales Elevator with the Six Leadership Styles test lens (D70), for demos and tests.
  const base = lens === 'six_styles' ? withSixStyles(salesElevator as unknown as StorylineInput) : salesElevator as unknown as StorylineInput;
  // `?purpose=assessment` plays it as an assessment, so the report carries verdicts (D75).
  const purpose = new URLSearchParams(globalThis.location?.search ?? '').get('purpose');
  const r = parseStoryline(purpose === 'assessment' || purpose === 'development' ? { ...base, purpose } : base);
  if (!r.ok) throw new Error(r.issues.join('\n'));
  return r.config;
}

/**
 * Demo and test aid, mock only: opens every profile, then plays the periods before `period` with the
 * needed styles and no actions, so a later period (interviews from week 3, the week 4 sponsor briefing) can be opened.
 */
async function fastForward(engine: ReturnType<typeof createEngine>, config: StorylineConfig, period: number) {
  while (engine.view().clock.period < period && engine.view().phase !== 'ended') {
    if (engine.view().phase === 'style') await engine.dispatch({ type: 'confirmStyles', styles: await neededStyles(engine, config.thresholds.high, config.lens) });
    await engine.dispatch({ type: 'endPeriod' });
    const v = engine.view();
    if (v.pendingReward) await engine.dispatch({ type: 'chooseReward', reward: v.pendingReward[0] });
    if (engine.view().phase === 'periodEnd') await engine.dispatch({ type: 'startNextPeriod' });
  }
}

export function createMockClient(opts: { config?: StorylineConfig; seed?: number; evaluator?: Evaluator; latencyMs?: number; tokensPerSecond?: number; startPeriod?: number; lens?: string | null } = {}): EngineClient {
  const config = opts.config ?? defaultStoryline(opts.lens);
  const engine = createEngine(config, { seed: opts.seed ?? 1, evaluator: opts.evaluator });
  const ready = opts.startPeriod && opts.startPeriod > 1 ? fastForward(engine, config, opts.startPeriod) : Promise.resolve();
  const wait = async () => { await Promise.all([ready, loadEngineCopy()]); if (opts.latencyMs) await new Promise(r => setTimeout(r, opts.latencyMs)); };
  return {
    async view() {
      await wait();
      return parse(EngineView, engine.view());
    },
    async send(intent) {
      const checked = parse(Intent, intent);
      await wait();
      try {
        return parse(IntentResult, await engine.dispatch(checked));
      } catch (e) {
        if (e instanceof IntentError) throw new EngineError(e.message, e.code);
        throw e;
      }
    },
    // The mock engine already has the NPC's words; it streams them at a speaking pace.
    streamTurn: (_id, turn, signal) => mockStream(turn.text, { signal, turnId: turn.id, tokensPerSecond: opts.tokensPerSecond ?? 14 })
  };
}

/**
 * Demo and test aid, mock only: plays a whole run with an automated player, then hands in the end
 * screen's reflection, and returns the ended view with its development report (the `?report=1` dev
 * page and the report stories).
 */
export async function playToEnd(opts: { policy?: Policy; seed?: number; reflection?: string[]; rating?: number | null; config?: StorylineConfig } = {}) {
  const [r] = await Promise.all([play(opts.config ?? defaultStoryline(), opts.policy ?? 'good', opts.seed ?? 3), loadEngineCopy()]);
  if (opts.reflection) await r.engine.dispatch({ type: 'submitReflection', answers: opts.reflection, rating: opts.rating ?? null });
  return parse(EngineView, r.engine.view());
}
