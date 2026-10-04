import { describe, expect, it } from 'vitest';
import { parseStoryline, type StorylineConfig } from '../config';
import { lazyClient } from '../client';
import salesElevator from '../storylines/sales-elevator.json';
import { createEngine } from './engine';
import { neededStyles } from './policies';

/** Regression tests for the M4 quality review (docs/DECISIONS.md D54). */
const parsed = parseStoryline(salesElevator);
if (!parsed.ok) throw new Error(parsed.issues.join('\n'));
const config: StorylineConfig = parsed.config;

async function onBoard(seed = 1, cfg = config) {
  const e = createEngine(cfg, { seed });
  await e.dispatch({ type: 'confirmStyles', styles: await neededStyles(e) });
  return e;
}
async function nextPeriod(e: Awaited<ReturnType<typeof onBoard>>) {
  await e.dispatch({ type: 'endPeriod' });
  const v = e.view();
  if (v.pendingReward) await e.dispatch({ type: 'chooseReward', reward: v.pendingReward[0] });
  if (e.view().phase === 'periodEnd') {
    await e.dispatch({ type: 'startNextPeriod' });
    await e.dispatch({ type: 'confirmStyles', styles: await neededStyles(e) });
  }
}
async function toPeriod(e: Awaited<ReturnType<typeof onBoard>>, n: number) {
  while (e.view().clock.period < n && e.view().phase !== 'ended') await nextPeriod(e);
}

describe('review fixes', () => {
  it('answers a message once: reopening it resumes the same conversation', async () => {
    const e = await onBoard(3);
    await toPeriod(e, 4);
    const brief = e.view().inbox.find(m => m.title.startsWith('Briefing'))!;
    const a = await e.dispatch({ type: 'openConversation', kind: 'sponsor', messageId: brief.id });
    const b = await e.dispatch({ type: 'openConversation', kind: 'sponsor', messageId: brief.id });
    expect(b.interactionId).toBe(a.interactionId);
    await e.dispatch({ type: 'submitInteraction', interactionId: a.interactionId!, text: 'We are behind and I own that. The plan is clear by Friday.' });
    await expect(e.dispatch({ type: 'openConversation', kind: 'sponsor', messageId: brief.id })).rejects.toMatchObject({ code: 'closedMessage' });
  });

  it('closes open conversations unfinished when the period ends, and refuses talk off the board', async () => {
    const e = await onBoard();
    const r = await e.dispatch({ type: 'planAction', action: 'f2f', memberIds: ['kent'] });
    await e.dispatch({ type: 'endPeriod' });
    expect(e.view().live).toBeNull();
    expect(e.view().history.some(l => /left unfinished/.test(l.title))).toBe(true);
    await expect(e.dispatch({ type: 'submitInteraction', interactionId: r.interactionId!, text: 'Hello' })).rejects.toMatchObject({ code: 'unknownInteraction' });
  });

  it('drifts everyone left alone, even after a sponsor briefing', async () => {
    const e = await onBoard(3);
    await toPeriod(e, 4);
    const brief = e.view().inbox.find(m => m.title.startsWith('Briefing'))!;
    const r = await e.dispatch({ type: 'openConversation', kind: 'sponsor', messageId: brief.id });
    await e.dispatch({ type: 'submitInteraction', interactionId: r.interactionId!, text: 'We are behind and I own that.' });
    await e.dispatch({ type: 'endPeriod' });
    expect(e.view().history.some(l => l.title === 'Some people were left alone')).toBe(true);
  });

  it('penalises a missed briefing in its own period, including the last one', async () => {
    const e = await onBoard(3);
    await toPeriod(e, 4);
    await e.dispatch({ type: 'endPeriod' });
    expect(e.view().periods.at(-1)!.period).toBe(4);
    expect(e.view().history.some(l => l.title === 'Sponsor briefing missed' && l.period === 4)).toBe(true);
    await e.dispatch({ type: 'startNextPeriod' });
    await e.dispatch({ type: 'confirmStyles', styles: await neededStyles(e) });
    await toPeriod(e, 8);
    await e.dispatch({ type: 'endPeriod' });
    expect(e.view().phase).toBe('ended');
    expect(e.view().history.some(l => l.title === 'Sponsor briefing missed' && l.period === 8)).toBe(true);
  });

  it('checks training cover across everyone picked', async () => {
    const e = await onBoard();
    await expect(e.dispatch({ type: 'planAction', action: 'training', option: 'three_day', memberIds: ['kent', 'beth'] })).rejects.toMatchObject({ code: 'noCover' });
  });

  it('assess reveals role fit for the chosen stage', async () => {
    const e = await onBoard();
    await e.dispatch({ type: 'planAction', action: 'assess', memberIds: ['justin'], stage: 'conversion' });
    const fit = e.view().members.find(m => m.id === 'justin')!.assessments.conversion;
    expect(fit).toBeDefined();
    expect(fit.skill).toBeGreaterThanOrEqual(0);
    expect(e.view().history.some(l => /Assessed for/.test(l.title))).toBe(true);
  });

  it('a harmful interview never lands the candidate', async () => {
    const cfg = { ...config, maxPerStage: 3, actions: config.actions.map(a => (a.key === 'hire' ? { ...a, unlockPeriod: 1 } : a)) };
    const e = await onBoard(2, cfg);
    const r = await e.dispatch({ type: 'planAction', action: 'hire', memberIds: [] });
    const cand = e.view().live!.candidates![0].id;
    await e.dispatch({ type: 'sendTurn', interactionId: r.interactionId!, text: 'How old are you? Are you married?' });
    await e.dispatch({ type: 'chooseCandidate', interactionId: r.interactionId!, candidateId: cand });
    expect(e.view().members.some(m => m.id === cand)).toBe(false);
    expect(e.view().history.some(l => /turned the offer down/.test(l.title))).toBe(true);
  });

  it('letting someone go unsettles the rest of the team', async () => {
    const e = await onBoard();
    const r = await e.dispatch({ type: 'planAction', action: 'fire', memberIds: ['mandy'] });
    expect(r.changes.some(c => c.subject !== 'mandy' && c.metric === 'morale' && c.delta < 0)).toBe(true);
  });

  it('period refusals carry codes the UI can word', async () => {
    const e = createEngine(config, { seed: 1 });
    await expect(e.dispatch({ type: 'endPeriod' })).rejects.toMatchObject({ code: 'wrongPhase' });
    await expect(e.dispatch({ type: 'startNextPeriod' })).rejects.toMatchObject({ code: 'wrongPhase' });
  });

  it('briefings default to the mid point and the end of the run', async () => {
    const short = { ...config, time: { ...config.time, period: { ...config.time.period, count: 3 } }, sponsor: { ...config.sponsor, briefings: undefined } };
    const e = await onBoard(1, short as StorylineConfig);
    await toPeriod(e, 2);
    expect(e.view().inbox.some(m => m.title.startsWith('Briefing'))).toBe(true);
  });

  it('lazyClient retries after a failed load', async () => {
    let n = 0;
    const c = lazyClient(async () => { n++; if (n === 1) throw new Error('offline'); return { view: async () => ({}) as never, send: async () => ({}) as never, streamTurn: async function* () {} }; });
    await expect(c.view()).rejects.toThrow('offline');
    await expect(c.view()).resolves.toBeDefined();
    expect(n).toBe(2);
  });
});
