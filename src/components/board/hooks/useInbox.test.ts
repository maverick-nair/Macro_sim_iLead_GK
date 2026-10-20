import { describe, expect, it } from 'vitest';
import { canLater, stampOf, visibleInbox } from './useInbox';

describe('the inbox as the board shows it', () => {
  const msg = (id: string, dueInSubPeriods: number | null) => ({ id, dueInSubPeriods });
  const inbox = [msg('news1', null), msg('kent', 2), msg('beth', 0)];

  it('sets a message aside only while it is not yet due', () => {
    expect(canLater(msg('a', null))).toBe(true);
    expect(canLater(msg('a', 1))).toBe(true);
    expect(canLater(msg('a', 0))).toBe(false);
  });
  it('hides what was read here and what Later set aside, until the next sub-period', () => {
    const now = stampOf({ period: 2, subPeriod: 3 });
    expect(now).toBe('2:3');
    expect(visibleInbox(inbox, ['news1'], {}, now).map(x => x.id)).toEqual(['kent', 'beth']);
    expect(visibleInbox(inbox, [], { kent: now }, now).map(x => x.id)).toEqual(['news1', 'beth']);
    // The next sub-period brings it back.
    expect(visibleInbox(inbox, [], { kent: now }, stampOf({ period: 2, subPeriod: 4 })).map(x => x.id)).toEqual(['news1', 'kent', 'beth']);
    // A message due now cannot hide, even when it was set aside earlier.
    expect(visibleInbox(inbox, [], { beth: now }, now).map(x => x.id)).toEqual(['news1', 'kent', 'beth']);
  });
});
