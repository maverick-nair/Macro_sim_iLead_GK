import { describe, expect, it } from 'vitest';
import { parseStoryline, type StorylineConfig } from '../config';
import salesElevator from '../storylines/sales-elevator.json';
import { createEngine, IntentError } from './engine';
import { overallBand } from './evaluator';
import { neededStyles } from './policies';

const parsed = parseStoryline(salesElevator);
if (!parsed.ok) throw new Error(parsed.issues.join('\n'));
const config: StorylineConfig = parsed.config;

async function onBoard(seed = 1, cfg = config) {
  const e = createEngine(cfg, { seed });
  await e.dispatch({ type: 'confirmStyles', styles: await neededStyles(e) });
  return e;
}

async function toPeriod(e: Awaited<ReturnType<typeof onBoard>>, n: number) {
  while (e.view().clock.period < n) {
    await e.dispatch({ type: 'endPeriod' });
    const v = e.view();
    if (v.pendingReward) await e.dispatch({ type: 'chooseReward', reward: v.pendingReward[0] });
    await e.dispatch({ type: 'startNextPeriod' });
    await e.dispatch({ type: 'confirmStyles', styles: await neededStyles(e) });
  }
}

describe('live interactions', () => {
  it('bands: a red flag forces Harmful, otherwise the median, ties to the lower band', () => {
    expect(overallBand([{ band: 'strong' }, { band: 'strong' }, { band: 'weak' }], [])).toBe('strong');
    expect(overallBand([{ band: 'strong' }, { band: 'weak' }], [])).toBe('weak');
    expect(overallBand([{ band: 'strong' }, { band: 'adequate' }, { band: 'weak' }, { band: 'strong' }], [])).toBe('adequate');
    expect(overallBand([{ band: 'strong' }, { band: 'strong' }], ['blame'])).toBe('harmful');
  });

  it('runs a 1:1 as a conversation: the NPC opens, answers each turn, and ending it evaluates everything said', async () => {
    const e = await onBoard();
    const r = await e.dispatch({ type: 'planAction', action: 'f2f', memberIds: ['kent'] });
    const lv = e.view().live!;
    expect(lv.format).toBe('roleplay');
    expect(lv.turns).toHaveLength(1);
    expect(lv.turns[0].aiGenerated).toBe(true);
    expect(lv.brief.declaredStyle).not.toBeNull();
    const t = await e.dispatch({ type: 'sendTurn', interactionId: r.interactionId!, text: 'Thanks for making time, I appreciate it. What is on your mind?' });
    expect(t.turn?.by).toBe('kent');
    expect(e.view().live!.turnsLeft).toBe(11);
    const end = await e.dispatch({ type: 'endInteraction', interactionId: r.interactionId! });
    expect(end.outcome?.changes.length).toBeGreaterThan(0);
    expect(end.outcome?.reply).toBe(t.turn?.text);
    expect(e.view().live).toBeNull();
  });

  it('surfaces a hidden concern when you ask, and the profile shows it', async () => {
    const e = await onBoard();
    const r = await e.dispatch({ type: 'planAction', action: 'f2f', memberIds: ['kent'] });
    const t = await e.dispatch({ type: 'sendTurn', interactionId: r.interactionId!, text: 'I am sorry it has been rough. What is on your mind?' });
    expect(t.turn?.text).toMatch(/not what I was promised/);
    await e.dispatch({ type: 'endInteraction', interactionId: r.interactionId! });
    expect(e.view().members.find(m => m.id === 'kent')!.shared).toMatch(/promised/);
  });

  it('keeps to the turn limit and lets the participant interrupt the NPC', async () => {
    const e = await onBoard();
    const r = await e.dispatch({ type: 'planAction', action: 'coach', memberIds: ['beth'] });
    const id = r.interactionId!;
    const t = await e.dispatch({ type: 'sendTurn', interactionId: id, text: 'How is the pipeline looking?' });
    await e.dispatch({ type: 'interruptTurn', interactionId: id, turnId: t.turn!.id, shownChars: 4 });
    const turn = e.view().live!.turns.find(x => x.id === t.turn!.id)!;
    expect(turn.interrupted).toBe(true);
    expect(turn.text.length).toBeLessThanOrEqual(4);
    for (let i = 0; i < 20 && !e.view().live!.closed && e.view().live!.turnsLeft > 0; i++) await e.dispatch({ type: 'sendTurn', interactionId: id, text: 'Go on.' });
    await expect(e.dispatch({ type: 'sendTurn', interactionId: id, text: 'One more.' })).rejects.toBeInstanceOf(IntentError);
  });

  it('gives one hint per interaction when hints are on request', async () => {
    const e = await onBoard();
    const r = await e.dispatch({ type: 'planAction', action: 'f2f', memberIds: ['peter'] });
    const h = await e.dispatch({ type: 'requestHint', interactionId: r.interactionId! });
    expect(h.hint).toMatch(/open question/);
    expect(e.view().live!.hint.text).toBe(h.hint);
  });

  it('caps live conversations per period; replies do not count', async () => {
    const e = await onBoard();
    for (const id of ['kent', 'beth']) {
      const r = await e.dispatch({ type: 'planAction', action: 'f2f', memberIds: [id] });
      await e.dispatch({ type: 'endInteraction', interactionId: r.interactionId! }).catch(async () => e.dispatch({ type: 'submitInteraction', interactionId: r.interactionId!, text: 'Thanks.' }));
    }
    expect(e.view().actions.find(a => a.key === 'f2f')!.blockedFor.justin).toMatchObject({ reason: 'liveCap', cap: 2 });
    expect(e.view().actions.find(a => a.key === 'energize')!.blocked).toBeNull();
  });

  it('meetings carry no style, so they never count as a style choice', async () => {
    const e = await onBoard();
    const before = e.view().history.length;
    const r = await e.dispatch({ type: 'planAction', action: 'meet', memberIds: [] });
    await e.dispatch({ type: 'submitInteraction', interactionId: r.interactionId!, text: 'Today we have three things. First the pipeline, then the CRM. What do you all think?' });
    expect(e.view().history.length).toBeGreaterThan(before);
    const end = await e.dispatch({ type: 'endPeriod' });
    expect(end.summary!.accuracy).toBe(1);
  });

  it('interviews two candidates, then hires the one you choose', async () => {
    const cfg = { ...config, actions: config.actions.map(a => (a.key === 'hire' ? { ...a, unlockPeriod: 1 } : a)), maxPerStage: 3 };
    const e = await onBoard(2, cfg);
    const r = await e.dispatch({ type: 'planAction', action: 'hire', memberIds: [] });
    const lv = e.view().live!;
    expect(lv.format).toBe('interview');
    expect(lv.candidates).toHaveLength(2);
    await e.dispatch({ type: 'sendTurn', interactionId: r.interactionId!, text: 'Tell me about a time you turned around a cold lead. What happened next?' });
    await e.dispatch({ type: 'nextCandidate', interactionId: r.interactionId! });
    expect(e.view().live!.candidate).toBe(1);
    const chosen = lv.candidates![1].id;
    await e.dispatch({ type: 'chooseCandidate', interactionId: r.interactionId!, candidateId: chosen });
    expect(e.view().members.some(m => m.id === chosen)).toBe(true);
    expect(e.view().members.find(m => m.id === chosen)!.trust).not.toBe(Number.NaN);
  });

  it('opens a sponsor briefing in week 4; skipping it costs sponsor confidence', async () => {
    const e = await onBoard(3);
    await expect(e.dispatch({ type: 'openConversation', kind: 'sponsor' })).rejects.toMatchObject({ code: 'noBriefing' });
    await toPeriod(e, 4);
    const brief = e.view().inbox.find(m => m.kind === 'sponsor' && /Briefing/.test(m.title));
    expect(brief).toBeDefined();
    const r = await e.dispatch({ type: 'openConversation', kind: 'sponsor', messageId: brief!.id });
    expect(e.view().live!.turns[0].text).toMatch(/update/);
    await e.dispatch({ type: 'sendTurn', interactionId: r.interactionId!, text: 'Honestly we are behind on conversions. I own that. The plan is to coach Peter by Friday, and I need support on leads.' });
    const end = await e.dispatch({ type: 'endInteraction', interactionId: r.interactionId! });
    expect(end.outcome!.changes.some(c => c.subject === 'sponsor')).toBe(true);
  });

  it('starts everyone at trust 50 (scoring-and-report.md) and reads trust rules from config', async () => {
    const e = createEngine(config, { seed: 4 });
    await neededStyles(e);
    expect(new Set(e.view().members.map(m => m.trust))).toEqual(new Set([50]));
    const strict = createEngine({ ...config, trustRules: { ...config.trustRules, start: 40 } }, { seed: 4 });
    await neededStyles(strict);
    expect(strict.view().members[0].trust).toBe(40);
  });

  it('costs trust when the style you show differs from the one you declared, two periods running', async () => {
    const e = await onBoard(5);
    const run = async () => {
      const declared = e.view().members.find(m => m.id === 'derick')!.style!;
      const say = declared === 'E' ? 'Here is the plan, step by step. I need you to do this today.' : 'You decide. It is up to you, I trust you.';
      const r = await e.dispatch({ type: 'planAction', action: 'f2f', memberIds: ['derick'] });
      return e.dispatch({ type: 'submitInteraction', interactionId: r.interactionId!, text: say });
    };
    const first = await run();
    expect(first.changes.some(c => c.reason.label === 'Mixed signals')).toBe(false);
    await toPeriod(e, 2);
    const second = await run();
    expect(second.changes.some(c => c.subject === 'derick' && c.reason.label === 'Mixed signals' && c.delta < 0)).toBe(true);
  });
});
