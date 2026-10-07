import { wordAll as en } from '../../i18n/engineCopy';
import { describe, expect, it } from 'vitest';
import { copyViolations } from '../../i18n/copy';
import { parseStoryline, type StorylineConfig } from '../config';
import salesElevator from '../storylines/sales-elevator.json';
import { createEngine, IntentError } from './engine';
import { neededStyles, play } from './policies';
import { type Style } from './rules';
import type { Change } from './types';

const parsed = parseStoryline(salesElevator);
if (!parsed.ok) throw new Error(parsed.issues.join('\n'));
const config: StorylineConfig = parsed.config;

const needed = (e: ReturnType<typeof createEngine>) => neededStyles(e);
const wrong = (s: Style): Style => ({ D: 'E', G: 'P', P: 'G', E: 'D' } as Record<string, Style>)[s];
const reasoned = (changes: Change[]) => changes.every(c => c.reason.label && c.reason.cause && c.reason.rule);

describe('engine', () => {
  it('starts in style setting and refuses actions until styles are set', async () => {
    const e = createEngine(config, { seed: 1 });
    expect(en(e.view()).phase).toBe('style');
    await expect(e.dispatch({ type: 'planAction', action: 'f2f', memberIds: ['kent'] })).rejects.toBeInstanceOf(IntentError);
    await expect(e.dispatch({ type: 'confirmStyles', styles: { kent: 'D' } })).rejects.toThrow(/Set a style/);
  });

  it('applies weekly styles with a reason on every change, and builds trust when they fit', async () => {
    const e = createEngine(config, { seed: 2 });
    const styles = await needed(e);
    const before = Object.fromEntries(en(e.view()).members.map(m => [m.id, m.trust!]));
    const r = await e.dispatch({ type: 'confirmStyles', styles });
    expect(r.view.phase).toBe('board');
    expect(reasoned(r.changes)).toBe(true);
    for (const m of r.view.members) expect(m.trust).toBe(Math.min(100, before[m.id] + 2));
  });

  it('spends whole days: five actions fill a week, and repeat limits apply', async () => {
    const e = createEngine(config, { seed: 3 });
    await e.dispatch({ type: 'confirmStyles', styles: await needed(e) });
    const m = await e.dispatch({ type: 'planAction', action: 'meet', memberIds: [] });
    await e.dispatch({ type: 'submitInteraction', interactionId: m.interactionId!, text: 'Let us work on this together. What do you think?' });
    expect(en(e.view()).clock.capacityLeft).toBe(4);
    expect(en(e.view()).actions.find(a => a.key === 'meet')!.blocked).toMatchObject({ reason: 'cooldown' });
    for (const id of ['beth', 'justin', 'peter', 'lowe']) {
      const r = await e.dispatch({ type: 'planAction', action: 'assess', memberIds: [id], stage: 'conversion' });
      expect(r.changes).toEqual([]);
    }
    expect(en(e.view()).clock.capacityLeft).toBe(0);
    await expect(e.dispatch({ type: 'planAction', action: 'assess', memberIds: ['kent'], stage: 'conversion' })).rejects.toMatchObject({ code: 'noCapacity' });
  });

  it('reads the style of a live conversation and applies the Model doc maths, with evidence', async () => {
    const e = createEngine(config, { seed: 4 });
    await e.dispatch({ type: 'confirmStyles', styles: await needed(e) });
    const r = await e.dispatch({ type: 'planAction', action: 'f2f', memberIds: ['kent'] });
    const o = await e.dispatch({ type: 'submitInteraction', interactionId: r.interactionId!, text: 'I am sorry I missed your message. Here is the plan, step by step. I need you to update the CRM by tomorrow. What is getting in the way?' });
    expect(o.outcome!.changes.some(c => c.subject === 'kent' && c.metric === 'morale' && c.delta > 0)).toBe(true);
    const ev = o.outcome!.changes.find(c => c.subject === 'kent')!.reason.evidence;
    expect(ev.length).toBeGreaterThan(0);
    expect(ev.every(q => q.judgedByAI)).toBe(true);
    expect(en(o.outcome!.headline)).not.toMatch(/strong|adequate|weak|harmful/i);
  });

  it('tracks promises: kept raises trust, broken lowers it', async () => {
    const e = createEngine(config, { seed: 5 });
    await e.dispatch({ type: 'confirmStyles', styles: await needed(e) });
    const a = await e.dispatch({ type: 'planAction', action: 'f2f', memberIds: ['beth'] });
    await e.dispatch({ type: 'submitInteraction', interactionId: a.interactionId!, text: 'Let me explain why this matters. I will review your call list with you by Friday.' });
    expect(en(e.view()).members.find(m => m.id === 'beth')!.promise).toMatch(/review your call list/);
    const b = await e.dispatch({ type: 'planAction', action: 'goals', memberIds: ['beth'] });
    const kept = await e.dispatch({ type: 'submitInteraction', interactionId: b.interactionId!, text: 'Let me explain the reason for these goals.' });
    expect(en(kept.changes).some(c => c.subject === 'beth' && c.metric === 'trust' && c.reason.label === 'Promise kept')).toBe(true);
  });

  it('upsets the top performer when someone else is rewarded (Model doc)', async () => {
    const e = createEngine(config, { seed: 6 });
    await e.dispatch({ type: 'confirmStyles', styles: await needed(e) });
    const top = [...en(e.view()).members].sort((a, b) => b.result! - a.result!)[0].id;
    const other = en(e.view()).members.find(m => m.id !== top)!.id;
    const r = await e.dispatch({ type: 'planAction', action: 'reward', memberIds: [other] });
    expect(r.changes.some(c => c.subject === top && c.metric === 'trust' && c.delta < 0)).toBe(true);
    expect(r.changes.some(c => c.subject === top && c.metric === 'result' && c.delta < 0)).toBe(true);
  });

  it('replays exactly from the same seed and intents', async () => {
    const run = async () => {
      const e = createEngine(config, { seed: 7 });
      await e.dispatch({ type: 'confirmStyles', styles: await needed(e) });
      const r = await e.dispatch({ type: 'planAction', action: 'f2f', memberIds: ['peter'] });
      await e.dispatch({ type: 'submitInteraction', interactionId: r.interactionId!, text: 'Here is the plan, step by step.' });
      await e.dispatch({ type: 'endPeriod' });
      const v = en(e.view());
      return JSON.stringify({ members: v.members, money: v.money, score: v.score });
    };
    expect(await run()).toBe(await run());
  });

  it('ends a period with stars, points and a summary, and finishes the run with a tier', async () => {
    const r = await play(config, 'good', 8);
    expect(r.view.phase).toBe('ended');
    expect(r.view.periods).toHaveLength(config.time.period.count);
    expect(r.view.score.tier?.key).toMatch(/bronze|silver|gold|platinum/);
    expect(r.view.score.total).toBeGreaterThanOrEqual(0);
    expect(r.view.score.total).toBeLessThanOrEqual(1000);
    expect(r.view.periods.every(p => p.week.score >= 0 && p.week.score <= 100 && p.week.stars >= 0 && p.week.stars <= 3)).toBe(true);
  });

  it('keeps every engine string inside the copy rules over a whole run', async () => {
    for (const policy of ['good', 'random'] as const) {
      const r = await play(config, policy, 9);
      const texts = en(r.view.history).flatMap(l => [l.title, ...l.changes.flatMap(c => [c.reason.label, c.reason.cause, c.reason.rule])]);
      expect(texts.flatMap(t => copyViolations(t).map(v => `${v}: ${t}`))).toEqual([]);
    }
  });

  it('rewards good leadership over passive play', async () => {
    const seeds = [11, 12, 13, 14, 15];
    const mean = async (p: 'good' | 'passive') => (await Promise.all(seeds.map(s => play(config, p, s)))).reduce((a, r) => a + r.view.score.total, 0) / seeds.length;
    expect(await mean('good')).toBeGreaterThan((await mean('passive')) * 1.3);
  });

  it('sends no stats before the profile is opened, and never names the needed style', async () => {
    const e = createEngine(config, { seed: 12 });
    expect(en(e.view()).members.every(m => m.skill === null && m.trust === null)).toBe(true);
    const r = await e.dispatch({ type: 'confirmStyles', styles: Object.fromEntries(en(e.view()).members.map(m => [m.id, 'G'])) as Record<string, Style> });
    const words = r.changes.map(c => c.reason.cause).join(' ');
    expect(words).not.toMatch(/needed (Directing|Guiding|Partnering|Entrusting)/);
  });

  it('never reveals the needed style in the view', () => {
    const v = createEngine(config, { seed: 10 }).view();
    expect(JSON.stringify(v)).not.toMatch(/neededAtStart|"needed"/);
    expect(wrong('D')).toBe('E');
  });
});
