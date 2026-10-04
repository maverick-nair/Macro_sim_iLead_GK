import type { Rng } from './rng';

/**
 * The iLead core model (docs/SIMULATION.md sections 2 and 3), as pure functions.
 * Skill, morale, result and trust are 0 to 100.
 */

export type Style = 'D' | 'G' | 'P' | 'E';
export type Mismatch = 0 | 1 | 2;
export type Triple = readonly [number, number, number];

export interface Stats { skill: number; morale: number; result: number }

/** Needed style from skill and morale, High at or above `high` (Model doc, section 4 and 5). */
export function neededStyle(s: Pick<Stats, 'skill' | 'morale'>, high = 70): Style {
  const hs = s.skill >= high, hm = s.morale >= high;
  return !hs && !hm ? 'D' : !hs && hm ? 'G' : hs && !hm ? 'P' : 'E';
}

const AXES: Record<Style, [boolean, boolean]> = { D: [false, false], G: [false, true], P: [true, false], E: [true, true] };

/** 0 when both skill and morale ranges match, 1 when one does, 2 when neither does. */
export function styleDifference(a: Style, b: Style): Mismatch {
  const [s1, m1] = AXES[a], [s2, m2] = AXES[b];
  return ((s1 !== s2 ? 1 : 0) + (m1 !== m2 ? 1 : 0)) as Mismatch;
}

/**
 * Mismatch type with the Model doc's randomness: a difference of 1 or 2 shows up with probability
 * 0.6, otherwise the member responds as if it matched. Low trust makes misreads likelier (3.3).
 */
export function mismatchType(diff: Mismatch, rng: Rng, opts: { trust?: number; lowTrust?: number } = {}): Mismatch {
  if (diff === 0) return 0;
  const p = diff === 1 && opts.trust !== undefined && opts.trust < (opts.lowTrust ?? 30) ? 0.75 : 0.6;
  return rng.chance(p) ? diff : 0;
}

/** Training has its own table (Model doc, section 7). */
export function trainingMismatch(diff: Mismatch, rng: Rng): Mismatch {
  const r = rng.next();
  if (diff === 0) return r >= 0.9 ? 2 : r >= 0.8 ? 1 : 0;
  if (diff === 1) return r >= 0.9 ? 0 : r >= 0.6 ? 2 : 1;
  return r >= 0.9 ? 0 : r >= 0.6 ? 1 : 2;
}

/** Trust multiplier on positive changes: 0.8 at trust 0, 1.2 at trust 100 (3.3). */
export const trustMultiplier = (trust: number) => 0.8 + 0.4 * trust / 100;

export const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));

/**
 * Applies an effect: each part × random 0.8 to 1.2, rounded; positive parts × the trust multiplier
 * (and an optional extra factor, for a Strong conversation). Returns the change actually applied
 * after clamping to 0 to 100.
 */
export function applyEffect(stats: Stats, effect: Triple, rng: Rng, opts: { trust?: number; boost?: number; scale?: number } = {}): Triple {
  const keys = ['skill', 'morale', 'result'] as const;
  const out = keys.map((k, i) => {
    const base = effect[i] * (opts.scale ?? 1);
    if (base === 0) return 0;
    let d = base * rng.range(0.8, 1.2);
    if (d > 0) d *= (opts.trust !== undefined ? trustMultiplier(opts.trust) : 1) * (opts.boost ?? 1);
    const next = clamp(stats[k] + Math.round(d));
    const applied = next - stats[k];
    stats[k] = next;
    return applied;
  });
  return out as unknown as Triple;
}

/** Applies a trust change with the per sub-period cap of ±12 (3.2). Returns the applied change. */
export function applyTrust(m: { trust: number; trustMovedThisSub: number }, delta: number, cap = 12): number {
  const room = delta > 0 ? cap - m.trustMovedThisSub : -cap - m.trustMovedThisSub;
  const d = delta > 0 ? Math.min(delta, Math.max(0, room)) : Math.max(delta, Math.min(0, room));
  const next = clamp(m.trust + d);
  const applied = next - m.trust;
  m.trust = next;
  m.trustMovedThisSub += applied;
  return applied;
}
