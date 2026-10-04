import { describe, expect, it } from 'vitest';
import { teamChips } from './chips';

describe('teamChips', () => {
  it('keeps a few personal changes as they are', () => {
    const c = [{ subject: 'kent', metric: 'morale' as const, delta: 8 }, { subject: 'beth', metric: 'morale' as const, delta: -2 }];
    expect(teamChips(c)).toEqual(c.map(x => ({ ...x, count: 1 })));
  });
  it('folds many people moving the same way into one chip, by direction', () => {
    const up = ['a', 'b', 'c', 'd'].map(subject => ({ subject, metric: 'trust' as const, delta: subject === 'a' ? 3 : 1 }));
    const down = [{ subject: 'e', metric: 'trust' as const, delta: -2 }];
    expect(teamChips([...up, ...down], 5)).toEqual([{ subject: 'group', metric: 'trust', delta: 2, count: 4 }, { subject: 'e', metric: 'trust', delta: -2, count: 1 }]);
    expect(teamChips(up, 4)[0].subject).toBe('team');
  });
  it('nets one person\'s changes on a metric before grouping', () => {
    const c = [{ subject: 'kent', metric: 'trust' as const, delta: 2 }, { subject: 'kent', metric: 'trust' as const, delta: -3 }, { subject: 'beth', metric: 'trust' as const, delta: 2 }, { subject: 'beth', metric: 'trust' as const, delta: -2 }];
    expect(teamChips(c)).toEqual([{ subject: 'kent', metric: 'trust', delta: -1, count: 1 }]);
  });
});
