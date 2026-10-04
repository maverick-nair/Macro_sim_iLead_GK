import { describe, expect, it } from 'vitest';
import { createI18n } from './index';

describe('time units', () => {
  const { t } = createI18n();
  it('labels periods and capacity in the storyline unit', () => {
    expect(t('time.period', { unit: 'week', n: 2 })).toBe('Week 2');
    expect(t('time.period', { unit: 'month', n: 3 })).toBe('Month 3');
    expect(t('time.periodOf', { unit: 'year', n: 1, total: 5 })).toBe('Year 1 of 5');
    expect(t('time.left', { amount: t('time.amount', { unit: 'day', n: 3 }) })).toBe('3 days left');
    expect(t('time.amount', { unit: 'week', n: 1 })).toBe('1 week');
    expect(t('time.amount', { unit: 'day', n: 0 })).toBe('No days');
    expect(t('time.endPeriod', { unit: 'month' })).toBe('End month');
  });
});
