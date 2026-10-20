import { describe, expect, it } from 'vitest';
import type { EngineView } from '../../engine/contract';
import { flush } from '../session/session';
import { bandModel, tierProgress, type BandView } from './band';
import { feedbackChanges, lastFeedback } from './feed';

const reason = { label: 'r', cause: 'c', rule: 'x', evidence: [] };
const TIERS = [{ key: 'platinum', name: 'Platinum', min: 850 }, { key: 'gold', name: 'Gold', min: 700 }, { key: 'silver', name: 'Silver', min: 500 }, { key: 'bronze', name: 'Bronze', min: 0 }];

function view(over: Partial<BandView> = {}): BandView {
  return {
    kpis: [{ metric: 'skill', value: 56, start: 53, trend: 'up' }, { metric: 'morale', value: 50, start: 52, trend: 'down' }, { metric: 'result', value: 55, start: 55, trend: 'flat' }, { metric: 'trust', value: 54.4, start: 51, trend: 'up' }],
    money: { currency: 'USD', locale: 'en-US', display: 'symbol', target: 240000, value: 60000, valueThisPeriod: 0 },
    clock: { period: 2, periods: 8, periodUnit: 'week', subPeriod: 3, subPeriodUnit: 'day', capacity: 5, capacityLeft: 3, costStep: 0.5, runShare: 0.3125 },
    score: { total: 412, max: 1000, business: 40, people: 50, leadership: 45, capability: 60, live: null, bonus: 0, tier: null },
    gamification: { weights: { business: 0.3, people: 0.3, leadership: 0.4 }, stars: [40, 60, 80], streak: { length: 2, minStars: 2, bonus: 25, cap: 100 }, tiers: TIERS, leaderboard: { enabled: true, scope: 'cohort', size: 10, anonymous: false }, celebration: 'subtle' },
    periods: [],
    sponsor: { name: 'Roger Kent', title: 'CEO', img: null, styleLine: '', value: 56, unlockAt: 70, checkInBelow: 30, level: 'steady', causes: [] },
    ...over
  } as BandView;
}

describe('the desk status band (D211)', () => {
  it('reads each team number with its change since the period started', () => {
    expect(bandModel(view()).kpis.map(k => [k.metric, k.delta])).toEqual([['skill', 3], ['morale', -2], ['result', 0], ['trust', 3]]);
  });

  it('places the money against the pace marker: behind, ahead or on pace by how much', () => {
    const m = bandModel(view()).money;
    expect(m.share).toBe(0.25);
    expect(m.pace).toBe(0.3125);
    expect(m.state).toBe('behind');
    expect(m.gap).toBe(-15000);
    expect(bandModel(view({ money: { ...view().money, value: 80000 } })).money).toMatchObject({ state: 'ahead', gap: 5000 });
    expect(bandModel(view({ money: { ...view().money, value: 75000 } })).money.state).toBe('onPace');
  });

  it('finds the tier by the engine\'s thresholds, the next one up and the points to it', () => {
    expect(bandModel(view()).tier).toEqual({ key: 'bronze', name: 'Bronze', next: { name: 'Silver', toGo: 88 }, progress: 412 / 500 });
    expect(tierProgress(900, TIERS, null)).toMatchObject({ key: 'platinum', next: null, progress: 1 });
    // Once the run has ended the engine's tier wins.
    expect(tierProgress(412, TIERS, { key: 'silver', name: 'Silver' })).toMatchObject({ key: 'silver', next: { name: 'Gold', toGo: 288 } });
    expect(tierProgress(412, [], null)).toBeNull();
  });

  it('shows the last period\'s stars and the sponsor\'s change since it, none before the first period end', () => {
    const before = bandModel(view());
    expect(before.stars).toBeNull();
    expect(before.sponsor).toEqual({ value: 56, delta: null, unlockAt: 70, checkInBelow: 30, state: 'between' });
    const after = bandModel(view({ periods: [{ period: 1, week: { stars: 2 }, sponsor: { to: 50 } }] as never }));
    expect(after.stars).toEqual({ earned: 2, period: 1 });
    expect(after.sponsor.delta).toBe(6);
    expect(bandModel(view({ sponsor: { ...view().sponsor, value: 72 } })).sponsor.state).toBe('reward');
    expect(bandModel(view({ sponsor: { ...view().sponsor, value: 25 } })).sponsor.state).toBe('checkIn');
  });
});

describe('the desk feed (D212)', () => {
  const entry = (kind: EngineView['history'][number]['kind'], changes: EngineView['history'][number]['changes'] = [], action?: string) => ({ id: `${kind}${changes.length}${action ?? ''}`, period: 1, sub: 2, kind, title: kind, memberIds: [], changes, action });
  const ch = (subject: string, metric: 'skill' | 'morale' | 'confidence', delta: number) => ({ subject, metric, from: 50, to: 50 + delta, delta, reason });

  it('takes the participant\'s last doing from the history, never an event that happened to them', () => {
    expect(lastFeedback({ history: [] })).toBeNull();
    expect(lastFeedback({ history: [entry('style'), entry('action'), entry('trigger'), entry('periodEnd'), entry('event')] as never })?.kind).toBe('action');
    expect(lastFeedback({ history: [entry('interaction'), entry('event', [], 'choice:discount')] as never })?.action).toBe('choice:discount');
  });

  it('words what it changed: people grouped as the outcome groups them, then the sponsor, the rest counted', () => {
    const e = entry('action', [ch('beth', 'skill', 3), ch('beth', 'morale', 2), ch('sponsor', 'confidence', 4), ch('kent', 'skill', 0)]);
    expect(feedbackChanges(e as never, 10)).toEqual({ changes: [{ subject: 'beth', metric: 'skill', delta: 3, count: 1 }, { subject: 'beth', metric: 'morale', delta: 2, count: 1 }, { subject: 'sponsor', metric: 'confidence', delta: 4, count: 1 }], more: 0 });
    const wide = entry('style', ['a', 'b', 'c'].map(id => ch(id, 'morale', 2)).concat([ch('d', 'skill', 1), ch('sponsor', 'confidence', -3)]));
    const r = feedbackChanges(wide as never, 3, 2);
    expect(r.changes).toEqual([{ subject: 'team', metric: 'morale', delta: 2, count: 3 }, { subject: 'd', metric: 'skill', delta: 1, count: 1 }]);
    expect(r.more).toBe(1);
  });
});

describe('save progress (D213)', () => {
  const queue = (pending: number, online = true) => {
    let st = { online, pending };
    const fns = new Set<() => void>();
    return { view: () => Promise.reject(), send: () => Promise.reject(), streamTurn: () => Promise.reject(), state: () => st, subscribe: (f: () => void) => { fns.add(f); return () => fns.delete(f); },
      set(next: Partial<typeof st>) { st = { ...st, ...next }; fns.forEach(f => f()); } };
  };
  it('is saved at once with nothing waiting, or on a client without a queue', async () => {
    await expect(flush(null)).resolves.toBe('saved');
    await expect(flush(queue(0) as never)).resolves.toBe('saved');
  });
  it('waits for the queue to drain; offline, or too slow, the actions stay queued on this device', async () => {
    const q = queue(2);
    const p = flush(q as never);
    q.set({ pending: 1 });
    q.set({ pending: 0 });
    await expect(p).resolves.toBe('saved');
    await expect(flush(queue(1, false) as never)).resolves.toBe('queued');
    const going = queue(1);
    const offline = flush(going as never);
    going.set({ online: false });
    await expect(offline).resolves.toBe('queued');
    await expect(flush(queue(1) as never, 10)).resolves.toBe('queued');
  });
});
