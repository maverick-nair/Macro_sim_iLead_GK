import type { Rng } from './rng';

/**
 * The iLead core model (docs/SIMULATION.md sections 2 and 3), as pure functions.
 * Skill, morale, result and trust are 0 to 100. A member's need and the style difference come from the
 * storyline's lens (`../lens`: `needOf`, `fitOf`), not from fixed styles (D70).
 */

/** A lens style key, for example "D" in Readiness Based Leadership. */
export type Style = string;
export type Mismatch = 0 | 1 | 2;
export type Triple = readonly [number, number, number];

export interface Stats { skill: number; morale: number; result: number }

/**
 * Mismatch type with the Model doc's randomness: a difference of 1 or 2 shows up with probability
 * 0.6, otherwise the member responds as if it matched. Low trust makes misreads likelier (3.3).
 */
export function mismatchType(diff: Mismatch, rng: Rng, opts: { trust?: number; lowTrust?: number; lowTrustChance?: number } = {}): Mismatch {
  if (diff === 0) return 0;
  const p = diff === 1 && opts.trust !== undefined && opts.trust < (opts.lowTrust ?? 30) ? opts.lowTrustChance ?? 0.75 : 0.6;
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
export const trustMultiplier = (trust: number, range = { min: 0.8, max: 1.2 }) => range.min + (range.max - range.min) * trust / 100;

export const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));

/**
 * Applies an effect: each part × random 0.8 to 1.2, rounded; positive parts × the trust multiplier
 * (and an optional extra factor, for a Strong conversation). Returns the change actually applied
 * after clamping to 0 to 100.
 */
export function applyEffect(stats: Stats, effect: Triple, rng: Rng, opts: { trust?: number; multiplier?: { min: number; max: number }; boost?: number; scale?: number; gains?: Triple } = {}): Triple {
  const keys = ['skill', 'morale', 'result'] as const;
  const out = keys.map((k, i) => {
    const base = effect[i] * (opts.scale ?? 1);
    if (base === 0) return 0;
    let d = base * rng.range(0.8, 1.2);
    // `gains`: the people dynamics' shares for positive skill, morale and result changes (D135).
    if (d > 0) d *= (opts.trust !== undefined ? trustMultiplier(opts.trust, opts.multiplier) : 1) * (opts.boost ?? 1) * (opts.gains?.[i] ?? 1);
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
