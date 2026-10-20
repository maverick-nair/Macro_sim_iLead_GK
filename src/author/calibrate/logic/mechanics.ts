import type { Check, LevelKey, PersonaStats, RunResult } from './schema';

/**
 * What drives the separation between levels, and how noisy it is (D149). Pure. Both are advisories: they
 * report a mechanic, they do not judge leadership.
 *
 *   mechanics  warns when more than 40% of the gap between two neighbouring levels comes from the streak bonus
 *              (a cliff in the weekly stars), or when Business is capped (revenue past the target) for two levels
 *              or more, so only People and Leadership separate them.
 *   overlap    warns when the score ranges of two neighbouring levels overlap by more than 20%.
 */

export const MECHANICS_THRESHOLDS = { streakShare: 0.4, capped: 0.5, overlap: 0.2 } as const;

const NAMES: Record<LevelKey, string> = { beginner: 'Beginner', developing: 'Developing', proficient: 'Proficient', expert: 'Expert' };
const pct = (x: number) => `${Math.round(x * 100)}%`;
const list = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

/** Population standard deviation. */
export function sd(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / xs.length);
}

/** Mean points per pillar and the share of runs with Business capped, or undefined when the runs carry none. */
export function meanPillars(runs: RunResult[]): PersonaStats['pillars'] {
  const ps = runs.map(r => r.pillars).filter((p): p is NonNullable<RunResult['pillars']> => !!p);
  if (!ps.length) return undefined;
  const m = (f: (p: NonNullable<RunResult['pillars']>) => number) => Math.round((ps.reduce((a, p) => a + f(p), 0) / ps.length) * 10) / 10;
  return { business: m(p => p.business), people: m(p => p.people), leadership: m(p => p.leadership), streak: m(p => p.streak), capped: ps.filter(p => p.capped).length / ps.length };
}

/** How much of the narrower of two score ranges the other one covers, 0 to 1. */
export function rangeOverlap(a: { min: number; max: number }, b: { min: number; max: number }): number {
  const shared = Math.min(a.max, b.max) - Math.max(a.min, b.min);
  if (shared < 0) return 0;
  const narrow = Math.min(a.max - a.min, b.max - b.min);
  return narrow <= 0 ? 1 : Math.min(1, shared / narrow);
}

export function mechanicsChecks(levels: PersonaStats[]): Check[] {
  const out: Check[] = [];
  if (levels.length < 2) return out;
  const pairs = levels.slice(1).map((hi, i) => [levels[i], hi] as const);
  const name = (p: PersonaStats) => NAMES[p.persona as LevelKey] ?? p.persona;

  const notes: string[] = [];
  for (const [lo, hi] of pairs) {
    const gap = hi.score.mean - lo.score.mean;
    if (gap <= 0 || !lo.pillars || !hi.pillars) continue;
    const streak = (hi.pillars.streak - lo.pillars.streak) / gap;
    if (streak > MECHANICS_THRESHOLDS.streakShare) notes.push(`${pct(streak)} of the gap between ${name(lo)} and ${name(hi)} comes from the streak bonus`);
  }
  const capped = levels.filter(p => (p.pillars?.capped ?? 0) >= MECHANICS_THRESHOLDS.capped);
  if (capped.length >= 2) notes.push(`Business is capped for ${list(capped.map(name))}: they pass the revenue target, so revenue beyond it adds nothing and only People and Leadership separate them`);
  if (levels.some(p => p.pillars)) {
    out.push(notes.length
      ? { key: 'mechanics', status: 'warn', title: `A mechanic drives the separation: ${list(notes)}`, detail: 'Each level\'s points by pillar are in the results. A gap made by one mechanic says more about the scoring than about leadership.', fix: `${notes.some(n => n.includes('streak')) ? 'Soften the streak: a longer run of good weeks for a smaller bonus, or fewer stars needed, so one weak week does not cost the whole bonus. ' : ''}${capped.length >= 2 ? 'Raise the revenue target so the strongest levels do not all pass it, or accept that People and Leadership alone tell them apart.' : ''}`.trim() }
      : { key: 'mechanics', status: 'pass', title: 'No single mechanic drives the separation between levels', detail: null, fix: null });
  }

  const overlapping: string[] = [];
  for (const [lo, hi] of pairs) {
    const o = rangeOverlap(lo.score, hi.score);
    if (o > MECHANICS_THRESHOLDS.overlap) overlapping.push(`${name(lo)} and ${name(hi)} (${pct(o)})`);
  }
  out.push(overlapping.length
    ? { key: 'overlap', status: 'warn', title: `Neighbouring levels' scores overlap: ${list(overlapping)}`, detail: 'Where two levels\' score ranges overlap, a participant\'s score says less about their level. More playthroughs show whether it is noise.', fix: 'Make the difference between levels show more consistently: fewer random setbacks, or a larger effect of reading people right.' }
    : { key: 'overlap', status: 'pass', title: 'Neighbouring levels\' scores do not overlap much', detail: levels.map(p => `${name(p)} ${Math.round(p.score.min)} to ${Math.round(p.score.max)}${p.sd !== undefined ? ` (SD ${Math.round(p.sd)})` : ''}`).join(', ') + '.', fix: null });
  return out;
}
