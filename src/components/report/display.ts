import './messages';
import type { FitCell, Tone } from './types';

/**
 * Display mappings for the development report. None of these rates or scores anything: they turn the
 * engine's values into bar segments, chart scales, cell looks, tones and dates.
 */

/** One decimal, as the design's chart coordinates. */
export const round1 = (v: number) => Math.round(v * 10) / 10;

/** Which segments of a level bar are filled: one segment per level of the scale, filled up to the level. Null fills none. */
export function levelSegments(index: number | null, levels: number): boolean[] {
  return Array.from({ length: Math.max(0, levels) }, (_, i) => index !== null && i <= index);
}

/** The top of a chart's value axis: the largest value, never zero, so empty charts still draw. */
export function chartMax(values: number[]): number {
  const m = Math.max(0, ...values.filter(Number.isFinite));
  return m > 0 ? m : 1;
}

/** A cell of the used vs needed grid: its count, its share of the largest cell, and whether it is a match (the diagonal). */
export function gridCell(grid: number[][], row: number, col: number, max: number, fit?: number[][]) {
  const count = grid[row]?.[col] ?? 0;
  // A cell matches when the lens says the style fits the need; without a table, the diagonal.
  return { count, share: max > 0 ? Math.min(1, count / max) : 0, matched: fit ? fit[row]?.[col] === 0 : row === col };
}

/**
 * The vertical scale of a small multiple, as the design draws it: two points of room around the
 * values, or zero to a little above the target when there is a target line.
 */
export function multipleDomain(values: number[], target: number[] | null): [number, number] {
  if (target && target.length) {
    const top = Math.max(...values, ...target);
    return [0, top > 0 ? top * 1.02 : 1];
  }
  if (!values.length) return [0, 1];
  return [Math.min(...values) - 2, Math.max(...values) + 2];
}

/** How a style fit cell looks: matched is filled, one step off is outlined, missed is hatched. */
export function fitClass(cell: FitCell | null): string {
  if (!cell) return 'border border-dashed border-line-default bg-transparent';
  if (cell.fit === 0) return 'border-0 bg-accent-default text-fg-on-accent';
  if (cell.fit === 1) return 'border-2 border-solid border-accent-default bg-transparent text-fg-primary';
  return 'border border-solid border-status-attention bg-(image:--il-report-fit-missed) text-fg-primary';
}

/** The tone of an intent verdict: aligned reads as a gain, a gap needs attention, no evidence is neutral. */
export function intentTone(status: 'aligned' | 'gap' | 'noEvidence'): Tone {
  return status === 'aligned' ? 'gain' : status === 'gap' ? 'attention' : 'neutral';
}

export const TONE_TEXT: Record<Tone, string> = { gain: 'text-status-gain', attention: 'text-status-attention', neutral: 'text-fg-secondary' };

/** The check in date: the report date plus the authored number of days. */
export function checkInDate(reportDate: Date, days: number): Date {
  const d = new Date(reportDate.getTime());
  d.setDate(d.getDate() + days);
  return d;
}

/** Talk ratio as words: the participant's words per word from the other side, one decimal. */
export function talkRatio(ratio: number | null): number | null {
  return ratio === null || !Number.isFinite(ratio) ? null : round1(ratio);
}

/** Whole numbers for funnel counts over a run (the engine keeps fractions of a deal). */
export const wholeCount = (n: number) => Math.round(n);
