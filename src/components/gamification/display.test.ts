import { describe, expect, it } from 'vitest';
import { createI18n } from '../../i18n';
import { copyViolations } from '../../i18n/copy';
import { BADGE_RULES } from './badgeIcons';
import { currentTier, initials, shelfOrder, streakText, type ShelfBadge } from './display';

const { t } = createI18n();
const rule = { length: 3, minStars: 2, bonus: 25, cap: 100 };
const TIERS = [{ key: 'platinum', name: 'Platinum', min: 850 }, { key: 'gold', name: 'Gold', min: 700 }, { key: 'silver', name: 'Silver', min: 500 }, { key: 'bronze', name: 'Bronze', min: 0 }];

describe('streak in words', () => {
  it('counts the streak and the periods to the next bonus, in the period unit', () => {
    expect(streakText(t, { count: 2, next: 1, periodUnit: 'week', rule })).toBe('2 weeks in a row. 1 more week for a +25 bonus.');
    expect(streakText(t, { count: 1, next: 2, periodUnit: 'month', rule })).toBe('1 month in a row. 2 more months for a +25 bonus.');
    expect(streakText(t, { count: 4, next: 1, periodUnit: 'week', rule })).toBe('4 weeks in a row. 1 more week for a +25 bonus.');
  });

  it('states the rule before any period has ended or with no streak running', () => {
    expect(streakText(t, { count: 0, next: undefined, periodUnit: 'week', rule })).toBe('No streak yet. 3 weeks in a row at 2 stars or more earn a +25 bonus.');
    expect(streakText(t, { count: 0, next: 3, periodUnit: 'week', rule })).toBe('No streak yet. 3 weeks in a row at 2 stars or more earn a +25 bonus.');
  });

  it('says when the bonus has reached its cap', () => {
    expect(streakText(t, { count: 7, next: null, periodUnit: 'week', rule })).toBe('7 weeks in a row. The streak bonus is at its most, +100.');
  });

  it('keeps to the copy rules', () => {
    for (const s of [streakText(t, { count: 2, next: 1, periodUnit: 'day', rule }), streakText(t, { count: 0, next: undefined, periodUnit: 'year', rule })]) expect(copyViolations(s)).toEqual([]);
  });
});

describe('tiers', () => {
  it('places a total by the engine thresholds', () => {
    expect(currentTier(433, TIERS)).toBe('bronze');
    expect(currentTier(500, TIERS)).toBe('silver');
    expect(currentTier(849, TIERS)).toBe('gold');
    expect(currentTier(850, TIERS)).toBe('platinum');
    expect(currentTier(0, TIERS)).toBe('bronze');
  });

  it('takes the engine tier once the run has ended', () => {
    expect(currentTier(433, TIERS, { key: 'silver' })).toBe('silver');
  });
});

describe('badge shelf', () => {
  const b = (key: string, earned: boolean, period: number | null = null): ShelfBadge => ({ key, rule: key, name: key, description: '', earned, period, reason: earned ? 'why' : null });

  it('puts earned badges first, in the order they were earned, then the rest in library order', () => {
    const order = shelfOrder([b('a', false), b('b', true, 3), b('c', true, 1), b('d', false), b('e', true, 3)]).map(x => x.key);
    expect(order).toEqual(['c', 'b', 'e', 'a', 'd']);
  });

  it('has an icon for every default badge rule', () => {
    expect(BADGE_RULES).toEqual(['first_close', 'read_the_room', 'flex_master', 'concern_uncovered', 'promise_keeper', 'fair_hand', 'turnaround', 'change_champion', 'steady_hand', 'target_crusher']);
  });

  it('makes initials for a caller without a portrait', () => {
    expect(initials('Paula Jacob')).toBe('PJ');
    expect(initials('priya  nair')).toBe('PN');
  });
});

describe('perk, pulse and sponsor copy', () => {
  it('words the perks in the sub period unit, without dashes', () => {
    expect(t('actions.perk.hire', { unit: 'day' })).toBe('No days, one seat past a full team');
    expect(t('actions.note.checkIn', { unit: 'day', period: 'week' })).toBe('The CEO check in took a day this week');
    expect(t('actions.note.bonusDay', { unit: 'day', period: 'week' })).toBe('Bonus day added this week');
  });

  it('names the pulse tile with its value, trend and counts', () => {
    expect(t('metrics.pulse.valueAria', { value: 62, dir: 'up', unit: 'week', upbeat: 4, steady: 5, struggling: 1 })).toBe('Team pulse 62, rising since the start of the week. 4 upbeat, 5 steady, 1 struggling');
  });

  it('reads the sponsor level with its value, and the lines', () => {
    expect(t('metrics.sponsor.levelValue', { level: 'confident', value: 72 })).toBe('Confident, 72');
    expect(t('metrics.sponsor.unlock', { at: 70, name: 'Paula' })).toBe('Rise to 70 and Paula offers you a reward.');
    expect(t('metrics.sponsor.checkIn', { below: 30, unit: 'day' })).toBe('Drop below 30 and the CEO asks for a check in. It takes a day of your time.');
  });

  it('words the pillar weights as percentages', () => {
    expect(t('score.weight', { weight: 0.3 })).toBe('30%');
    expect(t('score.pillar.aria', { pillar: 'leadership', value: 70, weight: 0.4 })).toBe('Leadership 70 of 100, counts 40%');
  });
});
