import { MAX_DAYS, MAX_WEEKS, MIN_DAYS, MIN_WEEKS, type AuthorDraft, type EventDraft } from './draft';

/**
 * Keeping the draft inside its run (D128). When the run gets shorter or longer, everything placed on a
 * week moves with it, proportionally, so the first week stays the first and the last stays the last;
 * when a week gets fewer days, an event on a day that no longer exists moves to the last day. Nothing is
 * left beyond the run, and the author is told what moved.
 */

export interface Moved { what: string; from: string; to: string }

/** Week `w` of a run of `from` weeks, placed on a run of `to` weeks. */
export function mapWeek(w: number, from: number, to: number): number {
  if (from === to) return Math.min(to, Math.max(1, w));
  if (from <= 1) return 1;
  return Math.min(to, Math.max(1, 1 + Math.round(((w - 1) * (to - 1)) / (from - 1))));
}

/** Sets the run to `weeks` weeks of `days` days, moving events, random windows and actions to fit. */
export function fitRun(d: AuthorDraft, weeks: number, days = d.process.daysPerWeek): Moved[] {
  const to = Math.min(MAX_WEEKS, Math.max(MIN_WEEKS, Math.round(weeks)));
  const perWeek = Math.min(MAX_DAYS, Math.max(MIN_DAYS, Math.round(days)));
  const from = d.process.weeks;
  const moved: Moved[] = [];
  for (const e of d.events) {
    if (e.week !== null) {
      const w = mapWeek(e.week, from, to);
      const day = Math.min(e.day, perWeek);
      if (w !== e.week || day !== e.day) moved.push({ what: e.title, from: `week ${e.week}, day ${e.day}`, to: `week ${w}, day ${day}` });
      e.week = w;
      e.day = day;
    } else if (e.day > perWeek) e.day = perWeek;
    if (e.window) {
      const win = { from: mapWeek(e.window.from, from, to), to: mapWeek(e.window.to, from, to) };
      if (win.from !== e.window.from || win.to !== e.window.to) moved.push({ what: e.title, from: `weeks ${e.window.from} to ${e.window.to}`, to: `weeks ${win.from} to ${win.to}` });
      e.window = { ...e.window, ...win };
    }
  }
  for (const a of d.actions) {
    const w = mapWeek(a.availableFrom, from, to);
    if (w !== a.availableFrom) moved.push({ what: a.name, from: `available from week ${a.availableFrom}`, to: `week ${w}` });
    a.availableFrom = w;
  }
  d.process.weeks = to;
  d.process.daysPerWeek = perWeek;
  return moved;
}

/** One line for the author: what moved, or null when nothing did. */
export function movedNote(moved: Moved[]): string | null {
  if (!moved.length) return null;
  const list = moved.slice(0, 6).map(m => `${m.what}, ${m.from} to ${m.to}`).join('; ');
  return `To fit the new length, ${moved.length} ${moved.length === 1 ? 'item moved' : 'items moved'}: ${list}${moved.length > 6 ? `; and ${moved.length - 6} more` : ''}. Check the Events tab.`;
}

const CONDITION_WORDS: Record<NonNullable<EventDraft['condition']>['kind'], string> = {
  teamMoraleBelow: 'team morale is below',
  teamTrustBelow: 'team trust is below',
  memberMoraleBelow: 'someone\'s morale is below',
  behindPace: 'revenue pace is below'
};
export const CONDITION_LABELS: Record<NonNullable<EventDraft['condition']>['kind'], string> = {
  teamMoraleBelow: 'Team morale falls below',
  teamTrustBelow: 'Team trust falls below',
  memberMoraleBelow: 'One person\'s morale falls below',
  behindPace: 'Revenue pace falls below (percent of target pace)'
};

/** The event's timing in words, from its fields. */
export function timingText(e: EventDraft, weeks: number): string {
  if (e.timing === 'fixed') return `Week ${e.week ?? 1}, day ${e.day}`;
  if (e.timing === 'followup') return 'Only when another event is ignored, or a decision leads to it';
  if (e.timing === 'random') {
    const w = e.window ?? { from: 1, to: weeks, chance: 100 };
    return `Some time in weeks ${w.from} to ${w.to}${w.chance < 100 ? `, ${w.chance} in 100 runs` : ''}`;
  }
  const c = e.condition;
  if (!c) return e.conditions?.length ? 'As soon as Plays only if holds' : 'When something happens';
  return `When ${CONDITION_WORDS[c.kind]} ${c.value}${c.kind === 'behindPace' ? '%' : ''}${c.weeks > 1 ? ` for ${c.weeks} weeks in a row` : ''}`;
}
