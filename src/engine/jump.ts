import type { StorylineConfig } from './config';
import { bestStyle, needOf } from './lens';

/**
 * Where a preview from GenieKreator opens (D192): the engine played forward to that point with no actions,
 * the styles that fit each person's need, and the first reward each time one is offered. A test aid for
 * authors only: the mock engine runs it in the browser, the server runs it on a preview storyline's run.
 * It never plays a participant's run.
 *
 * - `onboarding`: nothing played; the participant starts at the welcome.
 * - `styles`: the style setting that opens week `week`.
 * - `board`: the desk of week `week`, styles set.
 * - `weekend`: the end of week `week`, its results waiting.
 * - `end`, `report`: every week played; the end screen (or the report) with the run ended.
 * - `event:<key>`, `action:<key>`: the desk of the week the event is due or the action unlocks.
 */
export type JumpTarget =
  | { to: 'onboarding' | 'end' | 'report' }
  | { to: 'styles' | 'board' | 'weekend'; week: number }
  | { to: 'event' | 'action'; key: string };

export const JUMP_KINDS = ['onboarding', 'styles', 'board', 'weekend', 'end', 'report', 'event', 'action'] as const;

/** `board:3`, `event:price_war`, `end`: the target a URL or a request names, or null when it names none. */
export function parseJump(raw: string | null | undefined): JumpTarget | null {
  if (!raw) return null;
  const [kind, arg = ''] = raw.split(/:(.*)/s);
  switch (kind) {
    case 'onboarding': case 'end': case 'report': return { to: kind };
    case 'styles': case 'board': case 'weekend': {
      const week = arg === '' ? 1 : Number(arg);
      return Number.isInteger(week) && week >= 1 && week <= 10 ? { to: kind, week } : null;
    }
    case 'event': case 'action': return /^[a-z][a-z0-9_]*$/.test(arg) ? { to: kind, key: arg } : null;
    default: return null;
  }
}

export function jumpParam(t: JumpTarget): string {
  if ('week' in t) return `${t.to}:${t.week}`;
  if ('key' in t) return `${t.to}:${t.key}`;
  return t.to;
}

/** The week a target plays to, in this storyline: an event's due week, an action's unlock week, never past the last. */
export function weekOf(t: JumpTarget, config: Pick<StorylineConfig, 'time' | 'events' | 'actions'>): number {
  const last = config.time.period.count;
  let w = 1;
  if ('week' in t) w = t.week;
  else if (t.to === 'event') {
    const e = config.events.find(x => x.key === t.key);
    w = e?.period ?? e?.window?.from ?? 1;
  } else if (t.to === 'action') w = config.actions.find(a => a.key === t.key)?.unlockPeriod ?? 1;
  else if (t.to === 'end' || t.to === 'report') w = last + 1;
  return Math.max(1, Math.min(w, t.to === 'end' || t.to === 'report' ? last + 1 : last));
}

/** What a jump reads of the view. */
export interface JumpView {
  phase: 'style' | 'board' | 'periodEnd' | 'ended';
  clock: { period: number };
  pendingReward: string[] | null;
  members: Array<{ id: string; statsRevealed: boolean; skill: number | null; morale: number | null }>;
}
/** The intents a jump sends: only what a participant could send. */
export type JumpIntent =
  | { type: 'openProfile'; memberId: string }
  | { type: 'confirmStyles'; styles: Record<string, string> }
  | { type: 'endPeriod' }
  | { type: 'chooseReward'; reward: string }
  | { type: 'startNextPeriod' };

/** What a jump needs from an engine: its view and a way to apply an intent (the mock's engine, or a server run). */
export interface JumpDriver {
  view(): JumpView | Promise<JumpView>;
  dispatch(intent: JumpIntent): Promise<unknown>;
}

/** The styles that fit each person's need, after opening every profile not yet read (as the calibration's good player sets them). */
async function fittingStyles(d: JumpDriver, config: Pick<StorylineConfig, 'thresholds' | 'lens'>): Promise<Record<string, string>> {
  for (const m of (await d.view()).members) if (!m.statsRevealed) await d.dispatch({ type: 'openProfile', memberId: m.id });
  const v = await d.view();
  return Object.fromEntries(v.members.map(m => [m.id, bestStyle(config.lens, needOf({ skill: m.skill ?? 0, morale: m.morale ?? 0 }, config.thresholds.high))]));
}

/**
 * Plays the weeks before `period` with no actions (the mock's `?period=N` since D84): ends each week,
 * takes the first reward offered and starts the next, until week `period` opens on its style setting.
 */
export async function fastForward(d: JumpDriver, config: Pick<StorylineConfig, 'thresholds' | 'lens'>, period: number) {
  for (let guard = 0; guard < 50; guard++) {
    const v = await d.view();
    if (v.clock.period >= period || v.phase === 'ended') return;
    if (v.phase === 'style') await d.dispatch({ type: 'confirmStyles', styles: await fittingStyles(d, config) });
    if ((await d.view()).phase === 'board') await d.dispatch({ type: 'endPeriod' });
    const after = await d.view();
    if (after.pendingReward?.length) await d.dispatch({ type: 'chooseReward', reward: after.pendingReward[0] });
    if ((await d.view()).phase === 'periodEnd') await d.dispatch({ type: 'startNextPeriod' });
  }
}

/** Plays the engine forward to a jump target. Onboarding and week 1's style setting need nothing played. */
export async function jumpTo(d: JumpDriver, config: Pick<StorylineConfig, 'thresholds' | 'lens' | 'time' | 'events' | 'actions'>, target: JumpTarget) {
  if (target.to === 'onboarding') return;
  const week = weekOf(target, config);
  await fastForward(d, config, week);
  if (target.to === 'styles') return;
  if ((await d.view()).phase === 'style') await d.dispatch({ type: 'confirmStyles', styles: await fittingStyles(d, config) });
  if (target.to === 'weekend' || target.to === 'end' || target.to === 'report') {
    if ((await d.view()).phase === 'board') await d.dispatch({ type: 'endPeriod' });
  }
}
