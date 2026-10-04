import { describe, expect, it } from 'vitest';
import { createI18n } from '../../i18n';
import { applyMark, decisionOf } from './CompareView';
import { missingFields } from './PlanForm';
import { sameTime } from './shared';

const ids = ['mandy', 'peter'];

describe('compare decision', () => {
  it('waits until both candidates are marked', () => {
    expect(decisionOf({}, ids)).toBeNull();
    expect(decisionOf({ mandy: 'pass' }, ids)).toBeNull();
  });
  it('marking one Hire marks the other Pass, so there is one hire at most', () => {
    const m = applyMark({ peter: 'hire' }, 'mandy', 'hire', ids);
    expect(m).toEqual({ mandy: 'hire', peter: 'pass' });
    expect(decisionOf(m, ids)).toEqual({ kind: 'hire', id: 'mandy' });
  });
  it('passing on both is a decision', () => {
    const m = applyMark(applyMark({}, 'mandy', 'pass', ids), 'peter', 'pass', ids);
    expect(decisionOf(m, ids)).toEqual({ kind: 'passBoth' });
  });
  it('never reads two hires as a decision', () => {
    expect(decisionOf({ mandy: 'hire', peter: 'hire' }, ids)).toBeNull();
  });
});

describe('plan form', () => {
  it('lists the required fields still empty, in form order; support is optional', () => {
    expect(missingFields({ goals: ' ', measures: '', owner: 'Kent', due: null, support: '' })).toEqual(['goals', 'measures', 'due']);
    expect(missingFields({ goals: 'a', measures: 'b', owner: 'c', due: 4, support: '' })).toEqual([]);
  });
});

describe('sim time', () => {
  it('compares period and sub period', () => {
    expect(sameTime({ period: 2, sub: 3 }, { period: 2, sub: 3 })).toBe(true);
    expect(sameTime({ period: 2, sub: 3 }, { period: 2, sub: 4 })).toBe(false);
    expect(sameTime({ period: 2, sub: 3 }, undefined)).toBe(false);
  });
  it('reads in the storyline units', () => {
    const { t } = createI18n();
    const when = (period: number, sub: number, pu: string, su: string) => t('liveformats.when', { period: t('time.period', { unit: pu, n: period }), sub: t('time.subPeriod', { unit: su, n: sub }) });
    expect(when(2, 3, 'week', 'day')).toBe('Week 2, Day 3');
    expect(when(2, 1, 'month', 'week')).toBe('Month 2, Week 1');
  });
});
