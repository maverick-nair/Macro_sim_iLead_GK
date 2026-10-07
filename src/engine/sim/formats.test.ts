import { describe, expect, it } from 'vitest';
import { wordAll as en } from '../../i18n/engineCopy';
import { parseStoryline, type StorylineConfig } from '../config';
import salesElevator from '../storylines/sales-elevator.json';
import { createEngine } from './engine';
import { planBand } from './evaluator';
import { neededStyles } from './policies';

/** The interview and the written plan, finished (D52, D85; SIMULATION 4.3, 5.0, 5.5). */
const parsed = parseStoryline(salesElevator);
if (!parsed.ok) throw new Error(parsed.issues.join('\n'));
const config = parsed.config;
const hiring: StorylineConfig = { ...config, maxPerStage: 3, actions: config.actions.map(a => (a.key === 'hire' ? { ...a, unlockPeriod: 1 } : a)) };

async function onBoard(seed = 1, cfg = config) {
  const e = createEngine(cfg, { seed });
  await e.dispatch({ type: 'confirmStyles', styles: await neededStyles(e) });
  return e;
}

const GOOD = 'Tell me about a time you lost a deal. Walk me through what happened next and why. What did you learn, and what was the result? Next question: give me an example of feedback you acted on.';

describe('interview', () => {
  it('briefs the same structured questions for every candidate', async () => {
    const e = await onBoard(2, hiring);
    await e.dispatch({ type: 'planAction', action: 'hire', memberIds: [] });
    const lv = en(e.view()).live!;
    expect(lv.format).toBe('interview');
    expect(lv.candidates).toHaveLength(2);
    expect(lv.brief.known).toHaveLength(3);
    expect(lv.brief.known[0]).toMatch(/deal you lost/);
  });

  it('a strong interview lands the chosen candidate, and the outcome says so', async () => {
    const e = await onBoard(2, hiring);
    const r = await e.dispatch({ type: 'planAction', action: 'hire', memberIds: [] });
    const cand = en(e.view()).live!.candidates![0];
    await e.dispatch({ type: 'sendTurn', interactionId: r.interactionId!, text: GOOD });
    await e.dispatch({ type: 'nextCandidate', interactionId: r.interactionId! });
    await e.dispatch({ type: 'sendTurn', interactionId: r.interactionId!, text: GOOD });
    const o = en((await e.dispatch({ type: 'chooseCandidate', interactionId: r.interactionId!, candidateId: cand.id })).outcome!);
    expect(o.changed.join(' ')).toMatch(new RegExp(`${cand.name.split(' ')[0]} accepted the offer and joins`));
    expect(en(e.view()).members.some(m => m.id === cand.id)).toBe(true);
  });

  it('passing on both keeps the seat open, and says so', async () => {
    const e = await onBoard(2, hiring);
    const r = await e.dispatch({ type: 'planAction', action: 'hire', memberIds: [] });
    await e.dispatch({ type: 'sendTurn', interactionId: r.interactionId!, text: GOOD });
    const o = en((await e.dispatch({ type: 'chooseCandidate', interactionId: r.interactionId!, candidateId: null })).outcome!);
    expect(o.changed).toEqual(['You passed on both candidates. The seat stays open.']);
  });

  it('a harmful interview never lands the candidate, and the outcome says it was turned down', async () => {
    const e = await onBoard(2, hiring);
    const r = await e.dispatch({ type: 'planAction', action: 'hire', memberIds: [] });
    const cand = en(e.view()).live!.candidates![0];
    await e.dispatch({ type: 'sendTurn', interactionId: r.interactionId!, text: 'How old are you? Are you married?' });
    const o = en((await e.dispatch({ type: 'chooseCandidate', interactionId: r.interactionId!, candidateId: cand.id })).outcome!);
    expect(o.changed.join(' ')).toMatch(/turned the offer down/);
  });
});

describe('written plan', () => {
  const full = { goals: 'Qualify twelve leads from the Ashcroft list', measures: '12 qualified leads in the CRM', owner: 'Derick', due: 5, support: 'I review the list with you on Thursday' };

  it('reads its fields: specific, measurable and involvement', () => {
    expect(['specific', 'measurable', 'involvement'].map(k => planBand(k, full)!.band)).toEqual(['strong', 'strong', 'strong']);
    const thin = { goals: 'Do better', measures: 'more leads', owner: '', due: null, support: '' };
    expect(['specific', 'measurable', 'involvement'].map(k => planBand(k, thin)!.band)).toEqual(['weak', 'weak', 'weak']);
  });

  it('is submitted once with its fields, gets a check in, and is evaluated on the fields alone', async () => {
    const e = await onBoard();
    const r = await e.dispatch({ type: 'planAction', action: 'goals', memberIds: ['derick'] });
    const s = await e.dispatch({ type: 'submitPlan', interactionId: r.interactionId!, plan: full, text: 'Goals: Qualify twelve leads. Measures: 12 qualified leads in the CRM' });
    expect(en(s.turn!.text)).toMatch(/numbers make it clear/);
    await expect(e.dispatch({ type: 'submitPlan', interactionId: r.interactionId!, plan: full, text: 'again' })).rejects.toMatchObject({ code: 'oneShot' });
    // What is said in the check in does not change the plan's evaluation.
    await e.dispatch({ type: 'sendTurn', interactionId: r.interactionId!, text: 'whatever' });
    const o = await e.dispatch({ type: 'endInteraction', interactionId: r.interactionId! });
    expect(o.outcome!.changes.some(c => c.subject === 'derick' && c.metric === 'trust' && c.delta > 0)).toBe(true);
    // The due date is a promise to check in with Derick on the plan.
    const promise = en(e.view()).promises.find(p => p.memberId === 'derick' && p.state === 'open');
    expect(promise?.text).toBe(full.goals);
  });

  it('refuses a plan without goals, measures or owner, or due after the period', async () => {
    const e = await onBoard();
    const r = await e.dispatch({ type: 'planAction', action: 'goals', memberIds: ['derick'] });
    await expect(e.dispatch({ type: 'submitPlan', interactionId: r.interactionId!, plan: { ...full, owner: ' ' }, text: 'x' })).rejects.toMatchObject({ code: 'planIncomplete' });
    await expect(e.dispatch({ type: 'submitPlan', interactionId: r.interactionId!, plan: { ...full, due: 9 }, text: 'x' })).rejects.toMatchObject({ code: 'planDue' });
  });
});
