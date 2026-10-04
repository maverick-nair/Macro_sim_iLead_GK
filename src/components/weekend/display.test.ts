import { describe, expect, it } from 'vitest';
import { createI18n } from '../../i18n';
import { barPercent, funnelNumber, funnelRow, funnelScale, levelSteps, newsArt, streakNote } from './display';

const i18n = createI18n();

describe('week end display mappings', () => {
  it('counts the levels moved', () => {
    expect(levelSteps('steady', 'confident')).toEqual({ steps: 1, dir: 'up' });
    expect(levelSteps('confident', 'low')).toEqual({ steps: 3, dir: 'down' });
    expect(levelSteps('steady', 'steady')).toEqual({ steps: 0, dir: 'same' });
    const words = (from: Parameters<typeof levelSteps>[0], to: Parameters<typeof levelSteps>[1]) => i18n.t('weekend.sponsor.change', levelSteps(from, to));
    expect(words('steady', 'confident')).toBe('One step up');
    expect(words('champion', 'wavering')).toBe('Three steps down');
    expect(words('low', 'low')).toBe('Same level');
  });

  it('rounds funnel counts and scales bars', () => {
    expect(funnelNumber(52.04)).toBe(52);
    expect(funnelNumber(4.899)).toBe(4.9);
    expect(funnelNumber(0.79)).toBe(0.8);
    expect(barPercent(42, 45)).toBe(93);
    expect(barPercent(60, 45)).toBe(100);
    expect(barPercent(3, 0)).toBe(0);
    expect(funnelScale([42, 40, 3])).toBeCloseTo(46.2);
    expect(funnelScale([])).toBe(1);
    const stage = { key: 'a', name: 'A', value: 1, ideal: 2, total: { value: 5, ideal: 6 } };
    expect(funnelRow(stage, 'period')).toEqual({ value: 1, ideal: 2 });
    expect(funnelRow(stage, 'total')).toEqual({ value: 5, ideal: 6 });
    expect(funnelRow({ ...stage, total: undefined }, 'total')).toEqual({ value: 1, ideal: 2 });
  });

  it('words the streak in the period unit', () => {
    const rules = { minStars: 2, bonus: 25 };
    expect(streakNote(i18n, { count: 2, bonus: 0, next: 1 }, rules, 'week')).toBe('Weeks in a row at 2 stars or more. 1 more week for a +25 bonus.');
    expect(streakNote(i18n, { count: 0, bonus: 0, next: 3 }, rules, 'week')).toBe('Weeks in a row at 2 stars or more. 3 more weeks for a +25 bonus.');
    expect(streakNote(i18n, { count: 3, bonus: 25, next: 1 }, rules, 'week')).toBe('Weeks in a row at 2 stars or more. +25 bonus earned. 1 more week for a +25 bonus.');
    expect(streakNote(i18n, { count: 6, bonus: 25, next: null }, rules, 'week')).toBe('Weeks in a row at 2 stars or more. +25 bonus earned. Streak bonus maxed.');
    expect(streakNote(i18n, { count: 7, bonus: 0, next: null }, rules, 'month')).toBe('Months in a row at 2 stars or more. Streak bonus maxed.');
    expect(i18n.t('weekend.streak.count', { unit: 'week', n: 3 })).toBe('3 weeks');
    expect(i18n.t('weekend.streak.count', { unit: 'day', n: 1 })).toBe('1 day');
  });

  it('picks news art by card type', () => {
    expect(newsArt('impact')).toContain('art-blue');
    expect(newsArt('opportunity')).toContain('art-mint');
    expect(newsArt('crisis')).toContain('art-warm');
  });
});
