import { describe, expect, it } from 'vitest';
import { copyViolations } from '../i18n/copy';
import { moneyFormatter, parseStoryline, type StorylineInput } from './config';

import salesElevator from './storylines/sales-elevator.json';

const base = () => structuredClone(salesElevator) as unknown as StorylineInput;
const stats = { skill: 50, morale: 50, result: 50 };

function storyline(over: Partial<StorylineInput> = {}): StorylineInput {
  return { ...base(), ...over };
}

const issues = (s: StorylineInput) => { const r = parseStoryline(s); return r.ok ? [] : r.issues; };

describe('storyline config', () => {
  it('accepts the imported Sales Elevator storyline', () => {
    const r = parseStoryline(base());
    expect(r.ok ? [] : r.issues).toEqual([]);
    if (!r.ok) return;
    expect(r.config.members).toHaveLength(10);
    expect(r.config.actions).toHaveLength(13);
    expect(r.config.events).toHaveLength(12);
  });

  it('cleans authored copy on the way in', () => {
    const r = parseStoryline(base());
    const texts = r.ok ? [...r.config.events.flatMap(e => [e.title, e.body.he, e.body.she]), ...r.config.actions.flatMap(a => [a.name, a.description, ...a.options.map(o => o.label)])] : ['parse failed'];
    expect(texts.filter(t => /[\u002D\p{Pd}]/u.test(t))).toEqual([]);
  });

  it('accepts the default shape and fills defaults', () => {
    const r = parseStoryline(storyline());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.config.time.subPeriod).toEqual({ unit: 'day', perPeriod: 5 });
    expect(r.config.time.costStep).toBe(1);
    expect(r.config.thresholds.high).toBe(70);
  });

  it('derives sub-periods from the period unit', () => {
    for (const [unit, sub, per] of [['year', 'quarter', 4], ['month', 'week', 4], ['week', 'day', 5], ['day', 'hour', 8]] as const) {
      const r = parseStoryline(storyline({ time: { period: { unit, count: 8 } } }));
      expect(r.ok && r.config.time.subPeriod).toEqual({ unit: sub, perPeriod: per });
    }
  });

  it('allows 1 to 10 periods, and keeps events inside the run', () => {
    expect(issues(storyline({ time: { period: { unit: 'month', count: 10 } }, money: { ...base().money, inputPerSubPeriod: [8] } }))).toEqual([]);
    expect(issues(storyline({ time: { period: { unit: 'month', count: 6 } } })).join()).toMatch(/events.*after the last period/);
    expect(issues(storyline({ time: { period: { unit: 'month', count: 11 } } })).join()).toMatch(/time.period.count/);
    expect(issues(storyline({ time: { period: { unit: 'month', count: 0 } } })).join()).toMatch(/time.period.count/);
  });

  it('allows 3 to 6 stages, unique keys, and every person valued in every stage', () => {
    expect(issues(storyline({ stages: base().stages.slice(0, 2) })).join()).toMatch(/stages/);
    const seven = [...base().stages, { key: 'renewal', name: 'Renewal', conversionRatio: 0.5, ideal: 1 }, { key: 'upsell', name: 'Upsell', conversionRatio: 0.5, ideal: 1 }];
    expect(issues(storyline({ stages: seven })).join()).toMatch(/stages/);
    const m = base().members.map(p => ({ ...p }));
    m[0] = { ...m[0], byStage: { leads: stats } };
    expect(issues(storyline({ members: m })).join()).toMatch(/Missing values for stage qualify/);
  });

  it('checks action costs, formats and prerequisites', () => {
    const a = base().actions.map(x => ({ ...x }));
    a[0] = { ...a[0], cost: 1.5 };
    a[1] = { ...a[1], kind: 'live', format: undefined };
    a[2] = { ...a[2], prerequisite: 'nope' };
    const out = issues(storyline({ actions: a })).join();
    expect(out).toMatch(/actions.0.cost: Cost must be a multiple of 1/);
    expect(out).toMatch(/actions.1.format/);
    expect(out).toMatch(/Unknown action nope/);
  });

  it('wants one lead input, or one per period', () => {
    expect(issues(storyline({ money: { ...base().money, inputPerSubPeriod: [8, 9, 10] } })).join()).toMatch(/one per period \(8\)/);
    expect(issues(storyline({ money: { ...base().money, inputPerSubPeriod: [6, 7, 8, 8, 9, 9, 10, 10] } }))).toEqual([]);
  });

  it('rejects unknown currencies and locales', () => {
    expect(issues(storyline({ money: { ...base().money, currency: 'XXQ' } })).join()).toMatch(/currency/);
    expect(issues(storyline({ money: { ...base().money, currency: 'usd' } })).join()).toMatch(/ISO 4217/);
  });
});

describe('money formatting', () => {
  const fmt = (currency: string, locale: string, display: 'symbol' | 'code' = 'symbol') =>
    moneyFormatter({ currency, locale, display });

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
