import { describe, expect, it } from 'vitest';
import { checkInDate, chartMax, fitClass, gridCell, intentTone, levelSegments, multipleDomain, round1, talkRatio } from './display';
import { paginate, splitAt } from './paginate';

describe('report display mappings', () => {
  it('fills one bar segment per level of the scale, up to the level', () => {
    expect(levelSegments(2, 5)).toEqual([true, true, true, false, false]);
    expect(levelSegments(0, 4)).toEqual([true, false, false, false]);
    expect(levelSegments(null, 5)).toEqual([false, false, false, false, false]);
    expect(levelSegments(3, 3)).toEqual([true, true, true]);
  });

  it('scales charts to the largest value, never to zero', () => {
    expect(chartMax([3, 9, 4])).toBe(9);
    expect(chartMax([])).toBe(1);
    expect(chartMax([0, 0])).toBe(1);
    expect(chartMax([2, Number.NaN])).toBe(2);
  });

  it('marks the diagonal of the used vs needed grid as matches', () => {
    const grid = [[5, 1, 0, 0], [0, 2, 0, 0], [0, 0, 10, 0], [0, 0, 0, 0]];
    expect(gridCell(grid, 0, 0, 10)).toEqual({ count: 5, share: 0.5, matched: true });
    expect(gridCell(grid, 0, 1, 10)).toEqual({ count: 1, share: 0.1, matched: false });
    expect(gridCell(grid, 3, 2, 10)).toEqual({ count: 0, share: 0, matched: false });
    expect(gridCell(grid, 9, 8, 10).count).toBe(0);
  });

  it('gives small multiples the design scale: two points of room, or zero to the target', () => {
    expect(multipleDomain([57, 60, 71], null)).toEqual([55, 73]);
    expect(multipleDomain([10, 20], [15, 30])).toEqual([0, 30.6]);
    expect(multipleDomain([], null)).toEqual([0, 1]);
  });

  it('draws matched filled, one step off outlined, missed hatched, and no week dashed', () => {
    expect(fitClass({ style: 'D', fit: 0 })).toContain('bg-accent-default');
    expect(fitClass({ style: 'D', fit: 1 })).toContain('border-2');
    expect(fitClass({ style: 'D', fit: 2 })).toContain('report-fit-missed');
    expect(fitClass(null)).toContain('border-dashed');
  });

  it('maps the engine intent status to a tone without judging it', () => {
    expect(intentTone('aligned')).toBe('gain');
    expect(intentTone('gap')).toBe('attention');
    expect(intentTone('noEvidence')).toBe('neutral');
  });

  it('dates the check in from the report date and the authored days', () => {
    expect(checkInDate(new Date(2026, 9, 5), 14).toDateString()).toBe(new Date(2026, 9, 19).toDateString());
    expect(checkInDate(new Date(2026, 11, 25), 14).getFullYear()).toBe(2027);
  });

  it('rounds the talk ratio for display and keeps "none" as null', () => {
    expect(talkRatio(4.28)).toBe(4.3);
    expect(talkRatio(null)).toBeNull();
    expect(round1(14.2857)).toBe(14.3);
  });
});

describe('print pagination', () => {
  const b = (top: number, bottom: number, pageBreak = false) => ({ top, bottom, pageBreak });

  it('packs blocks into pages, keeping the gaps on a page and dropping the one before a page', () => {
    expect(paginate([b(0, 300), b(328, 700), b(728, 1100), b(1128, 1400)], 1200)).toEqual([[0, 1, 2], [3]]);
  });

  it('starts a page where one is forced', () => {
    expect(paginate([b(0, 100), b(128, 200, true), b(228, 300)], 1200)).toEqual([[0], [1, 2]]);
  });

  it('gives a block taller than a page a page of its own', () => {
    expect(paginate([b(0, 100), b(128, 2000), b(2028, 2100)], 1200)).toEqual([[0], [1], [2]]);
  });

  it('splits web cards where a block starts one', () => {
    expect(splitAt([1, 2, 3, 4], n => n === 3)).toEqual([[1, 2], [3, 4]]);
    expect(splitAt([], () => true)).toEqual([]);
  });
});
