import { describe, expect, it } from 'vitest';
import { createI18n } from '../../i18n';

describe('HUD time copy', () => {
  const { t } = createI18n();
  const amount = (unit: string, n: number) => t('time.amountHalves', { unit, whole: Math.floor(n), half: n % 1 ? 'yes' : 'no' });

  it('formats capacity left with halves in the storyline unit', () => {
    expect(t('time.left', { amount: amount('day', 2.5) })).toBe('2½ days left');
    expect(amount('day', 0)).toBe('No days');
    expect(amount('day', 0.5)).toBe('½ day');
    expect(amount('day', 1)).toBe('1 day');
    expect(amount('day', 1.5)).toBe('1½ days');
    expect(amount('week', 3)).toBe('3 weeks');
    expect(amount('quarter', 0.5)).toBe('½ quarter');
    expect(amount('hour', 4.5)).toBe('4½ hours');
  });

  it('labels the period and the end button', () => {
    expect(t('hud.clock', { period: t('time.period', { unit: 'week', n: 2 }), subPeriod: t('time.subPeriod', { unit: 'day', n: 3 }) })).toBe('Week 2 · Day 3');
    expect(t('time.endPeriodNumber', { unit: 'week', n: 2 })).toBe('End week 2');
    expect(t('time.endPeriodNumber', { unit: 'month', n: 2 })).toBe('End month 2');
    expect(t('time.capacityAria', { left: 2.5, total: 5, unit: 'day', period: 'week' })).toBe('2.5 of 5 days left this week');
    expect(t('hud.streak', { n: 3, unit: 'week' })).toBe('3 week streak');
  });
});
