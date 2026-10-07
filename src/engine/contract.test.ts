import { describe, expect, it } from 'vitest';
import { parseStoryline } from './config';
import { EngineView, Intent, IntentResult, MetricChange, Outcome } from './contract';
import { createEngine } from './sim/engine';
import { play } from './sim/policies';
import { neededStyles } from './sim/policies';
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
    // Style keys come from the lens (D70): the contract checks their shape, the engine checks the lens.
    expect(Intent.safeParse({ type: 'confirmStyles', styles: { kent: 'coach' } }).success).toBe(true);
    expect(Intent.safeParse({ type: 'confirmStyles', styles: { kent: 'not a key' } }).success).toBe(false);
    expect(Intent.safeParse({ type: 'confirmStyles', styles: { kent: '' } }).success).toBe(false);
    expect(Intent.safeParse({ type: 'submitInteraction', interactionId: 'i1', text: '' }).success).toBe(false);
  });

  it('accepts everything the engine produces, from first view to the end of a run', async () => {
    const e = createEngine(config, { seed: 1 });
    expect(EngineView.safeParse(e.view()).error?.issues ?? []).toEqual([]);
    expect(EngineView.parse(e.view()).storyline).toEqual({ locale: 'en', name: 'Sales Elevator, Innov8 Elevators', organisation: 'Innov8 Elevators' });
    expect(EngineView.parse(e.view()).sponsor).toMatchObject({ name: 'Paula Jacob', title: 'Regional Sales Director' });
    const styles = await neededStyles(e);
    expect(IntentResult.safeParse(await e.dispatch({ type: 'confirmStyles', styles })).error?.issues ?? []).toEqual([]);
    const a = await e.dispatch({ type: 'planAction', action: 'f2f', memberIds: ['kent'] });
    const r = await e.dispatch({ type: 'submitInteraction', interactionId: a.interactionId!, text: 'Here is the plan, step by step. What is getting in the way?' });
    expect(IntentResult.safeParse(r).error?.issues ?? []).toEqual([]);
    const end = await play(config, 'random', 3);
    expect(EngineView.safeParse(end.view).error?.issues ?? []).toEqual([]);
  });
});
