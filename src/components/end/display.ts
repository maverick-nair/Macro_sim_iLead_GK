import './messages';
import type { EndTier, SaveState, Tone } from './types';

/**
 * Display mappings for the end screen. None of these decides an outcome: they place engine values on
 * bars, pick words and pick which of the engine's moments fit on one screen.
 */

/** The tier bars, lowest first: each bar grows a step, and the bars up to the tier reached are filled. */
export function tierBars(tiers: EndTier[], current: string): Array<EndTier & { filled: boolean; step: number }> {
  const at = tiers.findIndex(x => x.key === current);
  return tiers.map((x, i) => ({ ...x, filled: at >= 0 && i <= at, step: i }));
}

/** Bar height for a tier bar, in spacing units: 20px for the lowest, 10px more per tier (the design's 20 to 50). */
export const tierBarHeight = (step: number) => 5 + 2.5 * step;

/** Lowest first, by the engine's thresholds (the engine lists them highest first). */
export function tiersAscending<T extends { min: number }>(tiers: T[]): T[] {
  return [...tiers].sort((a, b) => a.min - b.min);
}

/** How much of the target bar fills: the share as a whole percent, 0 to 100. */
export function sharePercent(share: number): number {
  if (!Number.isFinite(share)) return 0;
  return Math.max(0, Math.min(100, Math.round(share * 100)));
}

/** The colour of a change. */
export function toneOf(delta: number): Tone {
  return delta > 0 ? 'gain' : delta < 0 ? 'decline' : 'neutral';
}

export const TONE_TEXT: Record<Tone, string> = { gain: 'text-status-gain', decline: 'text-status-decline', neutral: 'text-fg-secondary' };

/**
 * The moments that fit on the end screen, in the engine's order. When the first `n` are all one kind
 * and the run has the other kind too, the last place goes to the first of the other kind, so the screen
 * shows something to repeat and something to revisit, as the design does. The report shows them all.
 */
export function pickMoments<M extends { kind: 'best' | 'revisit' }>(moments: M[], n = 4): M[] {
  if (moments.length <= n) return moments;
  const head = moments.slice(0, n);
  const kinds = new Set(head.map(m => m.kind));
  if (kinds.size > 1) return head;
  const other = moments.find(m => !kinds.has(m.kind));
  if (!other) return head;
  const picked = [...head.slice(0, n - 1), other];
  return moments.filter(m => picked.includes(m));
}

/** A person's portrait: on the team now, or among everyone who was (people who left keep theirs in the report). */
export function portraitOf(
  memberId: string | null,
  members: Array<{ id: string; img: string | null }>,
  people: Array<{ memberId: string; img: string | null }>,
  fallback: string
): string {
  if (!memberId) return fallback;
  return members.find(m => m.id === memberId)?.img ?? people.find(p => p.memberId === memberId)?.img ?? fallback;
}

/** One answer box per question, filled from what was saved. */
export function answersFor(questions: string[], saved: string[] | undefined): string[] {
  return questions.map((_, i) => saved?.[i] ?? '');
}

/** The reflection as it would be sent, for comparing with what was saved last. */
export const reflectionKey = (answers: string[], rating: number | null) => JSON.stringify([answers.map(a => a.trim()), rating]);

/** What the save line says: unsaved changes win over the last save's outcome. */
export function saveState(dirty: boolean, saving: boolean, last: 'none' | 'saved' | 'error'): SaveState {
  if (saving) return 'saving';
  if (last === 'error') return 'error';
  if (dirty) return 'dirty';
  return last === 'saved' ? 'saved' : 'idle';
}

/** Splits a message around a placeholder, so one part can be styled ("You finished at [Gold]."). */
export function around(text: string, mark: string): [string, string] {
  const i = text.indexOf(mark);
  return i < 0 ? [text, ''] : [text.slice(0, i), text.slice(i + mark.length)];
}
