import { describe, expect, it } from 'vitest';
import { overallVerdict, skillVerdict } from './verdict';

/** Assessment verdicts (D75, rules in D76). Levels: 0 Novice, 1 Developing, 2 Proficient, 3 Advanced, 4 Role Model. */
const bar = { overall: 2, floor: 1 };

describe('overall verdict against the default bar (Proficient, no skill below Developing)', () => {
  it('needs an overall level', () => expect(overallVerdict(null, [3, 3], bar)).toBeNull());
  it('exceeds: above the bar overall, no skill below the bar level', () => {
    expect(overallVerdict(3, [2, 3, 4, null], bar)).toBe('exceeds');
    expect(overallVerdict(3, [1, 3, 4], bar)).toBe('meets');
  });
  it('meets: at the bar overall and nothing under the floor', () => {
    expect(overallVerdict(2, [1, 2, 3], bar)).toBe('meets');
    expect(overallVerdict(2, [0, 2, 3], bar)).toBe('approaching');
  });
  it('approaching: one level short at most, at most one skill under the floor', () => {
    expect(overallVerdict(1, [1, 2], bar)).toBe('approaching');
    expect(overallVerdict(1, [0, 2], bar)).toBe('approaching');
    expect(overallVerdict(1, [0, 0, 2], bar)).toBe('below');
  });
  it('below: further short', () => expect(overallVerdict(0, [1, 1], bar)).toBe('below'));
  it('follows an authored bar', () => {
    expect(overallVerdict(3, [2, 3], { overall: 3, floor: 2 })).toBe('meets');
    expect(overallVerdict(3, [1, 3], { overall: 3, floor: 2 })).toBe('approaching');
  });
});

describe('skill verdict', () => {
  it('Strength above the bar level, Meets at it, Development need below, none unrated', () => {
    expect([4, 3, 2, 1, 0, null].map(l => skillVerdict(l, bar))).toEqual(['strength', 'strength', 'meets', 'development', 'development', null]);
  });
});
