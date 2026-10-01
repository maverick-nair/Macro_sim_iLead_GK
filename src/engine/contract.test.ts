import { describe, expect, it } from 'vitest';
import { Intent, MetricChange, Outcome } from './contract';

const change = {
  subject: { type: 'member', id: 'kent' },
  metric: 'morale', from: 9, to: 17, delta: 8,
  reason: { label: '1:1 went well', cause: 'You listened - and asked for help.', rule: 'Lifts Morale 6-10.', evidence: [{ quote: 'I want to hear what is on your mind', by: 'You, 1:1 with Kent', judgedByAI: true }] }
};

describe('engine contract', () => {
  it('parses a metric change and sanitizes engine text', () => {
    const c = MetricChange.parse(change);
    expect(c.reason.cause).toBe('You listened, and asked for help.');
    expect(c.reason.rule).toBe('Lifts Morale 6 to 10.');
  });

  it('rejects a change with no reason', () => {
    const { reason: _, ...bare } = change;
    expect(MetricChange.safeParse(bare).success).toBe(false);
  });

  it('caps what changed at two lines', () => {
    const o = { id: 'o1', interactionId: 'i1', headline: 'h', reply: 'r', affected: [], reactions: {}, changes: [change], ripple: null, changed: ['a', 'b', 'c'] };
    expect(Outcome.safeParse(o).success).toBe(false);
  });

  it('validates intents', () => {
    expect(Intent.safeParse({ type: 'setStyle', memberId: 'kent', style: 'G' }).success).toBe(true);
    expect(Intent.safeParse({ type: 'setStyle', memberId: 'kent', style: 'X' }).success).toBe(false);
  });
});
