import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { markGuideSeen, turnGuideOff } from '../../tour/guideStore';
import { dueNotices } from './useGuide';

/** A storage stand in, as local storage behaves; the guide store reads the global. */
function memory() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); } };
}

describe('the board\'s notices (D93, D99)', () => {
  const view = {
    phase: 'board' as const, live: null,
    clock: { period: 3, periods: 8, periodUnit: 'week' as const, subPeriod: 1, subPeriodUnit: 'day' as const, capacity: 5, capacityLeft: 5, costStep: 1, runShare: 0.3 },
    actions: [{ rule: 'hire', unlockPeriod: 3, blocked: null }] as never,
    funnel: [{ key: 'leads', members: 2, ideal: 2 }, { key: 'qualify', members: 1, ideal: 2 }] as never,
    members: [] as never, sponsor: {} as never,
    milestones: [{ key: 'target:25', kind: 'target' as const, stage: null, pct: 25, period: 2, sub: 3 }]
  };
  const keys = (shown: Iterable<string>, dismissed: Iterable<string>) => dueNotices(view, new Set(shown), new Set(dismissed)).map(n => n.key);

  beforeEach(() => { Object.defineProperty(globalThis, 'localStorage', { value: memory(), configurable: true, writable: true }); });
  afterEach(() => { delete (globalThis as { localStorage?: unknown }).localStorage; });

  it('shows a milestone and the tips due, once', () => {
    expect(keys([], [])).toEqual(['milestone:target:25', 'tip:hireUnlocked', 'tip:seatOpen:qualify']);
  });
  it('drops what was dismissed: a milestone reached before the board opened is not news', () => {
    expect(keys([], ['milestone:target:25'])).toEqual(['tip:hireUnlocked', 'tip:seatOpen:qualify']);
    expect(keys(['tip:hireUnlocked'], ['tip:hireUnlocked'])).toEqual(['milestone:target:25', 'tip:seatOpen:qualify']);
  });
  it('keeps a tip on screen once it is marked seen, and never repeats it on a reload', () => {
    markGuideSeen('tip:hireUnlocked');
    expect(keys(['tip:hireUnlocked'], [])).toContain('tip:hireUnlocked');
    expect(keys([], [])).not.toContain('tip:hireUnlocked');
  });
  it('shows no tips once the guide is off, but milestones still', () => {
    turnGuideOff();
    expect(keys([], [])).toEqual(['milestone:target:25']);
  });
});
