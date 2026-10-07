import { randomInt, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { Purpose, StorylineConfig } from '../../../src/engine/config';
import type { ReportViewInput } from '../../../src/engine/reportContract';
import { createEngine, IntentError, type Engine, type Intent, type Result } from '../../../src/engine/sim/engine';
import type { Band } from '../../../src/engine/sim/types';
import type { Logger } from '../log';
import type { AiPorts } from '../ports';
import { ConflictError } from '../store/db';
import type { Repository } from '../store';
import type { RunRow } from '../store/repo';
import { Recorder, ReplayError, type AiCall } from './recorder';
import { configOf, type Storylines } from './storylines';

/** The engine build that wrote a run's log: replays are exact on the same engine (docs/SERVER.md "Replay"). */
export const ENGINE_VERSION = (() => {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, '../../../package.json'), 'utf8')) as { version: string };
    return `${pkg.version}${process.env.GIT_SHA ? `+${process.env.GIT_SHA.slice(0, 12)}` : ''}`;
  } catch {
    return 'unknown';
  }
})();

/** Who a run belongs to and what it plays, from the launch (or the cohort). */
export interface RunOwner { participantId: string; cohortId: string | null; storylineId: string | null; purpose: Purpose | null }

interface Live { run: RunRow; engine: Engine; recorder: Recorder; config: StorylineConfig }

/** Intents after which the stored run summary is refreshed: where completion or the report can change. */
const SUMMARY_AFTER = new Set<Intent['type']>(['endPeriod', 'startNextPeriod', 'submitReflection', 'chooseReward']);

/** The report's headline for the history (as the mock's `getHistory` words it). */
export function headlineOf(report: ReportViewInput | null | undefined): string | null {
  if (!report) return null;
  const r = report as { verdict?: { overall?: { label?: string } } | null; summary?: { level?: { name?: string } | null } };
  return r.verdict?.overall?.label ?? r.summary?.level?.name ?? 'Not enough evidence for an overall level';
}

export class RunError extends Error {
  constructor(message: string, readonly code: string, readonly status = 409) { super(message); }
}

/**
 * Runs on the server, authoritative. Each run is a seed, a storyline snapshot and an append only event
 * log (intents and assessor reviews, with the model answers each intent used). The live engine is kept
 * in an LRU cache; any other instance, or this one after a restart, rebuilds it by replaying the log.
 * Intents on one run apply strictly one at a time; across instances, the event's sequence number is the
 * guard (a second writer gets a conflict and the client retries).
 */
export class RunService {
  private readonly cache = new Map<string, Live>();
  private readonly locks = new Map<string, Promise<unknown>>();

  constructor(
    private readonly repo: Repository,
    private readonly storylines: Storylines,
    private readonly ai: AiPorts,
    private readonly log: Logger,
    private readonly cacheSize = 500
  ) {}

  /** Serializes work on one run. */
  private withLock<T>(runId: string, fn: () => Promise<T>): Promise<T> {
    const prev = this.locks.get(runId) ?? Promise.resolve();
    const next = prev.catch(() => undefined).then(fn);
    const tail = next.catch(() => undefined);
    this.locks.set(runId, tail);
    void tail.then(() => { if (this.locks.get(runId) === tail) this.locks.delete(runId); });
    return next;
  }

  /** The participant's current run (their latest attempt at the storyline), started on first launch. */
  async current(owner: RunOwner): Promise<RunRow> {
    const storylineId = owner.storylineId ?? this.storylines.defaultId;
    const runs = await this.repo.listRuns(owner.participantId, storylineId);
    return runs.at(-1) ?? this.start(owner);
  }

  /** A new attempt (the first, or after an earlier one). The earlier attempts stay, for the history. */
  async start(owner: RunOwner): Promise<RunRow> {
    const s = await this.storylines.resolve(owner.storylineId, owner.purpose);
    // A bearer caller may never have launched: the run needs its participant row.
    if (!(await this.repo.getParticipant(owner.participantId))) await this.repo.upsertParticipant({ id: owner.participantId, cohortId: owner.cohortId });
    for (let tries = 0; tries < 3; tries++) {
      const attempt = (await this.repo.listRuns(owner.participantId, s.id)).length + 1;
      try {
        const run = await this.repo.createRun({
          id: randomUUID(), participantId: owner.participantId, cohortId: owner.cohortId, storylineId: s.id, storylineVersion: s.version, lensId: s.config.lens.id,
          purpose: s.config.purpose ?? (s.config.use === 'selection' ? 'assessment' : 'development'), config: s.input, seed: randomInt(1, 2 ** 31), attempt, engineVersion: ENGINE_VERSION
        });
        const live = this.build(run);
        this.remember(live);
        await this.repo.putSummary(run.id, run.lensId, live.engine.summary());
        this.log.info('run started', { runId: run.id, participantId: owner.participantId, storyline: s.id, version: s.version, attempt });
        return run;
      } catch (e) {
        if (!(e instanceof ConflictError)) throw e;
      }
    }
    throw new RunError('Could not start a run', 'conflict');
  }

  private build(run: RunRow): Live {
    const recorder = new Recorder();
    const config = configOf(run.config);
    const engine = createEngine(config, { seed: run.seed, evaluator: recorder.evaluator(this.ai.evaluator), npc: recorder.npc(this.ai.npc) });
    return { run, engine, recorder, config };
  }

  private remember(live: Live) {
    this.cache.delete(live.run.id);
    this.cache.set(live.run.id, live);
    while (this.cache.size > this.cacheSize) this.cache.delete(this.cache.keys().next().value!);
  }

  /** Drops a run's engine from memory, so the next request replays it from the log. */
  forget(runId: string) { this.cache.delete(runId); }

  /** The live engine of a run: from memory, or replayed from its event log. */
  private async load(runId: string): Promise<Live> {
    const hit = this.cache.get(runId);
    if (hit) { this.remember(hit); return hit; }
    const run = await this.repo.getRun(runId);
    if (!run) throw new RunError('No such run', 'unknownRun', 404);
    const started = Date.now();
    const live = this.build(run);
    const events = await this.repo.listEvents(runId);
    for (const ev of events) {
      if (ev.kind === 'intent') {
        live.recorder.replaying(ev.ai as AiCall[]);
        try {
          await live.engine.dispatch(ev.payload as Intent);
        } catch (e) {
          throw new ReplayError(`replay of event ${ev.seq} failed: ${(e as Error).message}`);
        }
        live.recorder.finish();
      } else {
        live.engine.review(ev.payload as { recordId: string; band: Band; skills?: Record<string, Band> });
      }
    }
    live.run = { ...run, eventCount: events.length };
    this.remember(live);
    this.log.debug('run replayed', { runId, events: events.length, ms: Date.now() - started });
    return live;
  }

  getRun(runId: string) { return this.repo.getRun(runId); }

  async view(runId: string) {
    return this.withLock(runId, async () => (await this.load(runId)).engine.view());
  }

  /** Applies one intent: on success it is in the log, on any failure nothing changed (the engine is rebuilt from the log). */
  async dispatch(runId: string, intent: Intent): Promise<Result> {
    return this.withLock(runId, async () => {
      const live = await this.load(runId);
      live.recorder.begin();
      let result: Result;
      try {
        result = await live.engine.dispatch(intent);
      } catch (e) {
        this.forget(runId);
        throw e;
      }
      const ai = live.recorder.take();
      const view = result.view;
      const ended = view.phase === 'ended';
      const summary = ended || SUMMARY_AFTER.has(intent.type) ? live.engine.summary() : undefined;
      const patch: Parameters<Repository['appendEvent']>[2] = {
        status: ended ? 'ended' : 'active', scoreTotal: view.score.total, capability: view.score.capability,
        ...(summary ? { conversions: summary.objectives.conversions } : {}),
        ...(ended ? { headline: headlineOf(view.report), endedAt: live.run.endedAt ?? new Date().toISOString() } : {})
      };
      const seq = live.run.eventCount + 1;
      try {
        await this.repo.appendEvent(runId, { seq, kind: 'intent', payload: intent, ai }, patch, summary ? { lensId: live.run.lensId, summary } : undefined);
      } catch (e) {
        this.forget(runId);
        if (e instanceof ConflictError) throw new RunError('The run moved on in another window. Try again.', 'conflict', 409);
        throw e;
      }
      live.run = { ...live.run, ...patch, eventCount: seq } as RunRow;
      return result;
    });
  }

  /** An assessor's review of one conversation (D67): logged, so replays apply it too. */
  async review(runId: string, input: { recordId: string; band: Band; skills?: Record<string, Band> }, reviewerId: string) {
    return this.withLock(runId, async () => {
      const live = await this.load(runId);
      let view;
      try {
        view = live.engine.review(input);
      } catch (e) {
        this.forget(runId);
        throw e;
      }
      const summary = live.engine.summary();
      const seq = live.run.eventCount + 1;
      try {
        await this.repo.appendEvent(runId, { seq, kind: 'review', payload: input, ai: [] }, { scoreTotal: view.score.total, headline: view.report ? headlineOf(view.report) : undefined }, { lensId: live.run.lensId, summary });
        await this.repo.addReview({ runId, recordId: input.recordId, band: input.band, skills: input.skills, reviewerId });
      } catch (e) {
        this.forget(runId);
        throw e;
      }
      live.run = { ...live.run, eventCount: seq };
      return view;
    });
  }

  async records(runId: string) {
    return this.withLock(runId, async () => (await this.load(runId)).engine.records());
  }

  async summary(runId: string) {
    return this.withLock(runId, async () => (await this.load(runId)).engine.summary());
  }

  /** How many events a run has: the version its cached PDF is keyed by. */
  async version(runId: string) {
    return this.withLock(runId, async () => (await this.load(runId)).run.eventCount);
  }
}

export { IntentError, ReplayError };
