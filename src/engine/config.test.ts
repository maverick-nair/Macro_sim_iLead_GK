import { describe, expect, it } from 'vitest';
import { copyViolations } from '../i18n/copy';
import { moneyFormatter, parseStoryline, type StorylineInput } from './config';

const STAGES = ['leads', 'qualify', 'proposal', 'negotiation', 'conversion'];
const stats = { skill: 50, morale: 50, result: 50 };
const person = (id: string, home = 'leads') => ({
  id, name: id, title: 'Rep', pronoun: 'they' as const, homeStage: home,
  start: { ...stats, trust: 50 }, byStage: Object.fromEntries(STAGES.map(s => [s, stats])),
  profile: { previous: '', tenure: '', experience: '', skills: '', remarks: '' }
});

function storyline(over: Partial<StorylineInput> = {}): StorylineInput {
  return {
    id: 'sales_elevator', name: 'Sales Elevator',
    money: { currency: 'USD', locale: 'en-US', target: 240000, valuePerConversion: 4200, inputPerSubPeriod: [8] },
    time: { period: { unit: 'week', count: 8 } },
    stages: STAGES.map((key, i) => ({ key, name: key, conversionRatio: [0.62, 0.5, 0.3, 0.5, 0.5][i], ideal: 2 })),
    members: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'].map((id, i) => person(id, STAGES[Math.floor(i / 2)])),
    performanceThreshold: 10,
    ...over
  };
}

const issues = (s: StorylineInput) => { const r = parseStoryline(s); return r.ok ? [] : r.issues; };

describe('storyline config', () => {
  it('accepts the default shape and fills defaults', () => {
    const r = parseStoryline(storyline());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.config.time.subPeriod).toEqual({ unit: 'day', perPeriod: 5 });
    expect(r.config.time.costStep).toBe(0.5);
    expect(r.config.thresholds.high).toBe(70);
  });

  it('derives sub-periods from the period unit', () => {
    for (const [unit, sub, per] of [['year', 'quarter', 4], ['month', 'week', 4], ['week', 'day', 5], ['day', 'hour', 8]] as const) {
      const r = parseStoryline(storyline({ time: { period: { unit, count: 6 } } }));
      expect(r.ok && r.config.time.subPeriod).toEqual({ unit: sub, perPeriod: per });
    }
  });

  it('allows 1 to 10 periods', () => {
    expect(issues(storyline({ time: { period: { unit: 'month', count: 10 } } }))).toEqual([]);
    expect(issues(storyline({ time: { period: { unit: 'month', count: 11 } } })).join()).toMatch(/time.period.count/);
    expect(issues(storyline({ time: { period: { unit: 'month', count: 0 } } })).join()).toMatch(/time.period.count/);
  });

  it('allows 3 to 6 stages, unique keys, and every person valued in every stage', () => {
    expect(issues(storyline({ stages: storyline().stages!.slice(0, 2) })).join()).toMatch(/stages/);
    const seven = [...storyline().stages!, { key: 'renewal', name: 'Renewal', conversionRatio: 0.5, ideal: 1 }, { key: 'upsell', name: 'Upsell', conversionRatio: 0.5, ideal: 1 }];
    expect(issues(storyline({ stages: seven })).join()).toMatch(/stages/);
    const m = storyline().members!.map(p => ({ ...p }));
    m[0] = { ...m[0], byStage: { leads: stats } };
    expect(issues(storyline({ members: m })).join()).toMatch(/Missing values for stage qualify/);
  });

  it('wants one lead input, or one per period', () => {
    expect(issues(storyline({ money: { ...storyline().money!, inputPerSubPeriod: [8, 9, 10] } })).join()).toMatch(/one per period \(8\)/);
    expect(issues(storyline({ money: { ...storyline().money!, inputPerSubPeriod: [6, 7, 8, 8, 9, 9, 10, 10] } }))).toEqual([]);
  });

  it('rejects unknown currencies and locales', () => {
    expect(issues(storyline({ money: { ...storyline().money!, currency: 'XXQ' } })).join()).toMatch(/currency/);
    expect(issues(storyline({ money: { ...storyline().money!, currency: 'usd' } })).join()).toMatch(/ISO 4217/);
  });
});

describe('money formatting', () => {
  const fmt = (currency: string, locale: string, display: 'symbol' | 'code' = 'symbol') =>
    moneyFormatter({ currency, locale, display, target: 1, valuePerConversion: 1, inputPerSubPeriod: [1] });

  it('formats every supported currency in its own conventions', () => {
    expect(fmt('USD', 'en-US').format(41200)).toBe('$41,200');
    expect(fmt('GBP', 'en-GB').format(41200)).toBe('£41,200');
    expect(fmt('JPY', 'ja-JP').format(4120000)).toBe('￥4,120,000');
    expect(fmt('SGD', 'en-SG').format(41200)).toBe('$41,200');
    expect(fmt('SGD', 'en-SG', 'code').format(41200)).toMatch(/^SGD\s41,200$/);
    expect(fmt('INR', 'en-IN').format(4120000)).toBe('₹41,20,000');
    expect(fmt('MYR', 'ms-MY').format(41200)).toMatch(/^RM\s41,200$/);
    expect(fmt('AED', 'en-AE', 'code').format(41200)).toMatch(/^AED\s41,200$/);
  });

  it('uses each currency\'s decimals for exact amounts', () => {
    expect(fmt('JPY', 'ja-JP').exact(1234.5)).toBe('￥1,235');
    expect(fmt('USD', 'en-US').exact(1234.5)).toBe('$1,234.50');
  });

  it('compacts large amounts', () => {
    expect(fmt('USD', 'en-US').compact(240000)).toBe('$240K');
    expect(fmt('INR', 'en-IN').compact(2400000)).toBe('₹24L');
  });

  it('never shows a dash for negative amounts', () => {
    for (const [c, l] of [['USD', 'en-US'], ['INR', 'en-IN'], ['JPY', 'ja-JP'], ['AED', 'ar-AE']]) {
      expect(copyViolations(fmt(c, l).format(-1200))).toEqual([]);
    }
  });
});
