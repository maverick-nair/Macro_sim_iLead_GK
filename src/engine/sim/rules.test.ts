import { describe, expect, it } from 'vitest';
import { createRng } from './rng';
import { applyEffect, applyTrust, mismatchType, neededStyle, styleDifference, trainingMismatch, trustMultiplier } from './rules';

const freq = (f: () => number, n = 20000) => { const c: Record<number, number> = {}; for (let i = 0; i < n; i++) { const v = f(); c[v] = (c[v] ?? 0) + 1; } return Object.fromEntries(Object.entries(c).map(([k, v]) => [k, v / n])); };

describe('core model (Model doc)', () => {
  it('derives the needed style from skill and morale, High at 70', () => {
    expect(neededStyle({ skill: 30, morale: 22 })).toBe('D');
    expect(neededStyle({ skill: 25, morale: 73 })).toBe('G');
    expect(neededStyle({ skill: 89, morale: 56 })).toBe('P');
    expect(neededStyle({ skill: 92, morale: 85 })).toBe('E');
    expect(neededStyle({ skill: 70, morale: 69 })).toBe('P');
  });

  it('measures style difference on the two axes', () => {
    expect(styleDifference('D', 'D')).toBe(0);
    expect(styleDifference('D', 'G')).toBe(1);
    expect(styleDifference('D', 'P')).toBe(1);
    expect(styleDifference('D', 'E')).toBe(2);
    expect(styleDifference('G', 'P')).toBe(2);
  });

  it('turns a difference into a mismatch 60% of the time', () => {
    const rng = createRng(1);
    expect(freq(() => mismatchType(0, rng))).toEqual({ 0: 1 });
    expect(freq(() => mismatchType(1, rng))[1]).toBeCloseTo(0.6, 1);
    expect(freq(() => mismatchType(2, rng))[2]).toBeCloseTo(0.6, 1);
    expect(freq(() => mismatchType(1, rng, { trust: 20 }))[1]).toBeCloseTo(0.75, 1);
  });

  it('uses the training table', () => {
    const rng = createRng(2);
    const d0 = freq(() => trainingMismatch(0, rng));
    expect(d0[0]).toBeCloseTo(0.8, 1); expect(d0[1]).toBeCloseTo(0.1, 1); expect(d0[2]).toBeCloseTo(0.1, 1);
    const d2 = freq(() => trainingMismatch(2, rng));
    expect(d2[2]).toBeCloseTo(0.6, 1); expect(d2[1]).toBeCloseTo(0.3, 1); expect(d2[0]).toBeCloseTo(0.1, 1);
  });

  it('applies effects within 80 to 120%, scaled by trust when positive, clamped to 0 to 100', () => {
    const rng = createRng(3);
    for (let i = 0; i < 500; i++) {
      const s = { skill: 50, morale: 50, result: 50 };
      const [, m, r] = applyEffect(s, [0, 10, -10], rng, { trust: 100 });
      expect(m).toBeGreaterThanOrEqual(Math.round(10 * 0.8 * 1.2)); expect(m).toBeLessThanOrEqual(Math.round(10 * 1.2 * 1.2));
      expect(r).toBeGreaterThanOrEqual(-12); expect(r).toBeLessThanOrEqual(-8);
    }
    const s = { skill: 98, morale: 2, result: 50 };
    expect(applyEffect(s, [10, -10, 0], createRng(4))).toEqual([2, -2, 0]);
    expect(trustMultiplier(0)).toBeCloseTo(0.8); expect(trustMultiplier(100)).toBeCloseTo(1.2);
  });

  it('caps net trust movement at ±12 per sub-period', () => {
    const m = { trust: 50, trustMovedThisSub: 0 };
    expect(applyTrust(m, 8)).toBe(8);
    expect(applyTrust(m, 8)).toBe(4);
    expect(applyTrust(m, 5)).toBe(0);
    expect(applyTrust(m, -30)).toBe(-24);
    expect(m.trust).toBe(38);
    expect(m.trustMovedThisSub).toBe(-12);
  });

  it('replays exactly from a seed', () => {
    const a = createRng(42), b = createRng(42);
    expect(Array.from({ length: 5 }, () => a.next())).toEqual(Array.from({ length: 5 }, () => b.next()));
  });
});
