import { describe, expect, it } from 'vitest';
import { parseStoryline } from './config';
import { EngineView, Intent, IntentResult, MetricChange, Outcome } from './contract';
import { createEngine } from './sim/engine';
import { play } from './sim/policies';
import { neededStyle } from './sim/rules';
import salesElevator from './storylines/sales-elevator.json';

const parsed = parseStoryline(salesElevator);
if (!parsed.ok) throw new Error(parsed.issues.join('\n'));
const config = parsed.config;

const change = {
  subject: 'kent', metric: 'morale', from: 9, to: 17, delta: 8,
  reason: { label: '1:1 went well', cause: 'You listened - and asked for help.', rule: 'Lifts Morale 6-10.', evidence: [{ quote: 'I want to hear what is on your mind', by: 'You', judgedByAI: true }] }
};

describe('engine contract', () => {
  it('sanitizes engine text on the way in', () => {
    const c = MetricChange.parse(change);
    expect(c.reason.cause).toBe('You listened, and asked for help.');
    expect(c.reason.rule).toBe('Lifts Morale 6 to 10.');
  });

  it('rejects a change with no reason', () => {
    const { reason: _, ...bare } = change;
    expect(MetricChange.safeParse(bare).success).toBe(false);
  });

  it('caps what changed at two lines', () => {
    const o = { id: 'o1', actionKey: 'f2f', headline: 'h', reply: 'r', affected: [], reactions: {}, changes: [change], ripple: null, changed: ['a', 'b', 'c'] };
    expect(Outcome.safeParse(o).success).toBe(false);
  });

  it('validates intents', () => {
    expect(Intent.safeParse({ type: 'confirmStyles', styles: { kent: 'G' } }).success).toBe(true);
    expect(Intent.safeParse({ type: 'confirmStyles', styles: { kent: 'X' } }).success).toBe(false);
    expect(Intent.safeParse({ type: 'submitInteraction', interactionId: 'i1', text: '' }).success).toBe(false);
  });

  it('accepts everything the engine produces, from first view to the end of a run', async () => {
    const e = createEngine(config, { seed: 1 });
    expect(EngineView.safeParse(e.view()).error?.issues ?? []).toEqual([]);
    const styles = Object.fromEntries(e.view().members.map(m => [m.id, neededStyle(m)]));
    expect(IntentResult.safeParse(await e.dispatch({ type: 'confirmStyles', styles })).error?.issues ?? []).toEqual([]);
    const a = await e.dispatch({ type: 'planAction', action: 'f2f', memberIds: ['kent'] });
    const r = await e.dispatch({ type: 'submitInteraction', interactionId: a.interactionId!, text: 'Here is the plan, step by step. What is getting in the way?' });
    expect(IntentResult.safeParse(r).error?.issues ?? []).toEqual([]);
    const end = await play(config, 'random', 3);
    expect(EngineView.safeParse(end.view).error?.issues ?? []).toEqual([]);
  });
});
