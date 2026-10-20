import type { EngineClient } from '../engine/client';
import type { EngineView, Intent, IntentResult } from '../engine/contract';
import type { Completion, LmsAdapter, Objective, Score, Success } from './scorm';
import type { LmsSettings } from './settings';
import { decodeSnapshot, fitSnapshot } from './snapshot';

/**
 * What the LMS is told about a run (D201, D204), from the engine view only: completion and pass from the
 * package's LMS settings, the Leadership Score on a 0 to 100 scale, progress through the periods, and in
 * SCORM 2004 one objective per skill with the report's skill score.
 */
export interface LmsState { completion: Completion; success: Success; score: Score; progress: number; location: string; objectives: Objective[] | null }

type ReportLike = { summary?: { level?: { index?: number } | null }; skills?: Array<{ key: string; name: string; score: number | null; level: { index: number } | null }> };

export function lmsState(view: Pick<EngineView, 'phase' | 'periods' | 'clock' | 'score' | 'report'>, settings: LmsSettings, skills: Array<{ key: string; name: string }>): LmsState {
  const ended = view.phase === 'ended';
  const done = view.periods.length;
  const total = Math.max(1, view.clock.periods);
  const completed = ended || (settings.completion.kind === 'weeks' && done >= settings.completion.weeks);
  const raw = view.score.max > 0 ? Math.round((100 * view.score.total) / view.score.max) : 0;
  const report = ended ? (view.report as ReportLike | null) : null;
  let success: Success = 'unknown';
  if (completed && settings.pass.kind === 'score') success = raw >= settings.pass.min ? 'passed' : 'failed';
  // The overall level is the report's, so it is known at the end of the run; without enough evidence it is not reached.
  if (ended && settings.pass.kind === 'level') success = (report?.summary?.level?.index ?? -1) >= settings.pass.min ? 'passed' : 'failed';
  const objectives = skills.map(s => {
    const r = report?.skills?.find(x => x.key === s.key);
    const score = r && r.score !== null ? { raw: r.score, min: 0, max: 100, scaled: Math.min(1, Math.max(0, r.score / 100)) } : null;
    const success: Success = !ended || settings.pass.kind !== 'level' ? 'unknown' : (r?.level?.index ?? -1) >= settings.pass.min ? 'passed' : 'failed';
    return { id: s.key, description: s.name, score, completion: ended ? 'completed' : 'incomplete', success } satisfies Objective;
  });
  return {
    completion: completed ? 'completed' : 'incomplete', success,
    score: { raw, min: 0, max: 100, scaled: raw / 100 },
    progress: ended ? 1 : Math.min(1, done / total),
    location: `period:${view.clock.period}`,
    objectives: objectives.length ? objectives : null
  };
}

/** Moments worth a commit (D204): a closed conversation, the end of a period, the end of the run. */
const CLOSES = new Set<Intent['type']>(['submitInteraction', 'endInteraction', 'chooseCandidate', 'submitPlan']);

export interface Tracker {
  /** The intents to replay from the LMS's suspend data, when they belong to this package's storyline. */
  resumeLog(): Intent[];
  /** The run as it stands after replay: statuses, score, location. */
  begin(view: EngineView, replayed: Intent[]): void;
  /** Call after every intent the engine accepted. */
  record(intent: Intent, view: EngineView): void;
  /** Session time, exit, the last suspend data and a commit, then the LMS session ends. Once. */
  finish(): void;
  /** The accepted intents so far, the replayed ones first. */
  readonly log: readonly Intent[];
}

export function createTracker(opts: {
  adapter: LmsAdapter; settings: LmsSettings; hash: string; seed: number; skills: Array<{ key: string; name: string }>;
  now?: () => number;
  /** Called at each checkpoint with the state reported (connected mode posts it, D206). */
  onCheckpoint?: (state: LmsState, view: EngineView) => void;
}): Tracker {
  const { adapter, settings } = opts;
  const now = opts.now ?? (() => Date.now());
  const started = now();
  let log: Intent[] = [];
  let last: EngineView | null = null;
  let dirty = false;
  let finished = false;
  /** Once completed (or passed), a later report never takes it back. */
  let completedOnce = false;

  const writeSuspend = () => {
    const fit = fitSnapshot({ h: opts.hash, s: opts.seed }, log, adapter.suspendLimit);
    adapter.setSuspendData(fit.data);
    dirty = false;
  };
  const report = (view: EngineView) => {
    const s = lmsState(view, settings, opts.skills);
    if (s.completion === 'completed') completedOnce = true;
    adapter.setLocation(s.location);
    adapter.setScore(s.score);
    adapter.setProgress(s.progress);
    adapter.setStatus(completedOnce ? 'completed' : s.completion, s.success);
    if (s.objectives) adapter.setObjectives(s.objectives);
    opts.onCheckpoint?.(s, view);
  };
  const checkpoint = (view: EngineView) => {
    writeSuspend();
    report(view);
    adapter.commit();
  };

  return {
    get log() { return log; },
    resumeLog() {
      const snap = decodeSnapshot(adapter.suspendData());
      return snap && snap.h === opts.hash && snap.s === opts.seed ? snap.i : [];
    },
    begin(view, replayed) {
      log = [...replayed];
      last = view;
      checkpoint(view);
    },
    record(intent, view) {
      if (finished) return;
      log.push(intent);
      dirty = true;
      const wasEnded = last?.phase === 'ended';
      last = view;
      if (intent.type === 'endPeriod' || (view.phase === 'ended' && !wasEnded) || intent.type === 'submitReflection') checkpoint(view);
      else if (CLOSES.has(intent.type)) { writeSuspend(); adapter.commit(); }
    },
    finish() {
      if (finished) return;
      finished = true;
      if (dirty) writeSuspend();
      if (last) report(last);
      adapter.setSessionTime(now() - started);
      // Suspend keeps the suspend data for the next launch, in both versions, finished or not (D204).
      adapter.setExit('suspend');
      adapter.commit();
      adapter.terminate();
    }
  };
}

/**
 * The engine client the package plays on: every accepted intent goes to the tracker. A refused intent
 * changed nothing, so it is not logged.
 */
export function trackedClient(inner: EngineClient, tracker: Pick<Tracker, 'record'>): EngineClient {
  return {
    view: () => inner.view(),
    async send(intent): Promise<IntentResult> {
      const r = await inner.send(intent);
      tracker.record(intent, r.view);
      return r;
    },
    streamTurn: (id, turn, signal) => inner.streamTurn(id, turn, signal)
  };
}
