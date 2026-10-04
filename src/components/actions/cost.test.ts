import { describe, expect, it } from 'vitest';
import { createI18n } from '../../i18n';
import { dayArgs } from '../action/days';

describe('costs in the sub-period unit', () => {
  const { t } = createI18n();
  it('keeps the day text', () => {
    const steps = [0, 0.5, 1, 1.5, 2, 2.5, 5];
    expect(steps.map(d => t('action.days', dayArgs(d)))).toEqual(['No days', '½ day', '1 day', '1½ days', '2 days', '2½ days', '5 days']);
    // The unit aware message agrees with the day entry, so either can serve days.
    expect(steps.map(d => t('actions.cost', dayArgs(d, 'day')))).toEqual(steps.map(d => t('action.days', dayArgs(d))));
  });
  it('reads in weeks, hours and quarters', () => {
    expect([0, 0.5, 1, 1.5, 3].map(d => t('actions.cost', dayArgs(d, 'week')))).toEqual(['No weeks', '½ week', '1 week', '1½ weeks', '3 weeks']);
    expect(t('actions.cost', dayArgs(2, 'hour'))).toBe('2 hours');
    expect(t('actions.cost', dayArgs(1, 'quarter'))).toBe('1 quarter');
    expect(t('action.blocked.days', { need: t('actions.cost', dayArgs(1, 'week')), have: t('actions.cost', dayArgs(0.5, 'week')) })).toBe('Needs 1 week, you have ½ week');
  });
  it('says the free actions and the lock in the unit', () => {
    expect(t('inbox.footer', { unit: 'day' })).toBe('Replying costs no days, and still counts with that person.');
    expect(t('inbox.footer', { unit: 'week' })).toBe('Replying costs no weeks, and still counts with that person.');
    expect(t('actions.out.body', { period: 'month', unit: 'week' })).toBe('Actions are locked until next month. Reply to messages any time, they cost no weeks.');
    expect(t('team.stage.bottleneck', { unit: 'month' })).toBe('Bottleneck this month');
  });
});
