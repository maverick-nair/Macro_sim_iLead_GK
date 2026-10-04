import { describe, expect, it } from 'vitest';
import { createI18n } from '../../i18n';
import { timelineText, type ProfileTimelineEntry } from './ProfilePanel';

describe('profile copy', () => {
  const i18n = createI18n();
  const { t } = i18n;
  const entry = (e: Partial<ProfileTimelineEntry>): ProfileTimelineEntry => ({ id: 'x', when: { period: 2, sub: 3 }, title: 'x', tone: 'neutral', changes: null, ...e });

  it('words when an entry happened in the storyline units', () => {
    expect(timelineText(i18n, entry({}), 'week', 'day').when).toBe('Week 2, Day 3');
    expect(timelineText(i18n, entry({}), 'month', 'week').when).toBe('Month 2, Week 3');
  });

  it('builds the outcome line from structured changes with a minus sign', () => {
    const out = (e: Partial<ProfileTimelineEntry>) => timelineText(i18n, entry(e), 'week', 'day').outcome;
    expect(out({ changes: [{ metric: 'morale', delta: 8 }, { metric: 'trust', delta: 6 }] })).toBe('Morale +8, Trust +6');
    expect(out({ changes: [{ metric: 'morale', delta: -6 }] })).toBe('Morale −6');
    expect(out({ changes: [] })).toBe('No change');
    expect(out({ changes: null })).toBeNull();
    expect(out({ reaction: 'felt micromanaged', changes: [{ metric: 'morale', delta: -4 }] })).toBe('Reaction: felt micromanaged. Morale −4');
    expect(out({ reaction: 'positive', changes: null })).toBe('Reaction: positive');
  });

  it('labels facts, the unknown career goal and promises', () => {
    expect(t('profile.fact.label', { key: 'style', unit: 'week' })).toBe('Style this week');
    expect(t('profile.fact.label', { key: 'style', unit: 'month' })).toBe('Style this month');
    expect(t('profile.fact.empty', { key: 'careerGoal' })).toBe('Not shared yet. It may come up in conversation.');
    expect(t('profile.promise.label', { status: 'open' })).toBe('Open promise:');
    expect(t('profile.promise.label', { status: 'broken' })).toBe('Promise broken:');
  });
});
