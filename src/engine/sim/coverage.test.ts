import { wordAll as en } from '../../i18n/engineCopy';
import { describe, expect, it } from 'vitest';
import { parseStoryline, type StorylineConfig } from '../config';
import salesElevator from '../storylines/sales-elevator.json';
import { createEngine } from './engine';
import { neededStyles } from './policies';
import { createRng } from './rng';
import { createSim, runFunnel, runSubPeriod } from './sim';

/** Rules the M4 review found untested (docs/DECISIONS.md D54): funnel, events, triggers, role coverage. */
const parsed = parseStoryline(salesElevator);
if (!parsed.ok) throw new Error(parsed.issues.join('\n'));
const config: StorylineConfig = parsed.config;

async function onBoard(seed = 1, cfg = config) {
  const e = createEngine(cfg, { seed });
  await e.dispatch({ type: 'confirmStyles', styles: await neededStyles(e) });
  return e;
}

describe('funnel (Model doc, normalized per D36)', () => {
  it('a stage at result 100 converts exactly its ratio, and never more, whatever the buffer', () => {
    for (const buffer of [0, 50, 200]) {
      const sim = createSim({ ...config, performanceThreshold: buffer }, 1);
      // Morale at 100 too: with people dynamics (D135) a low rolling morale would take a share of the result.
      for (const m of sim.members) { m.result = 100; m.morale = 100; m.away = 0; }
      runFunnel(sim);
      let input = config.money.inputPerSubPeriod[0];
      config.stages.forEach((st, i) => {
        input *= st.conversionRatio;
        expect(sim.funnel.stageOut[i]).toBeCloseTo(input, 6);
      });
    }
  });

  it('people away contribute nothing to their stage', () => {
    const sim = createSim(config, 1);
    const before = createSim(config, 1);
    for (const m of sim.members.filter(x => x.stage === 'leads')) m.away = 2;
    runFunnel(sim); runFunnel(before);
    expect(sim.funnel.stageOut[0]).toBeLessThan(before.funnel.stageOut[0]);
  });
});

describe('events (6.3)', () => {
  it('the week 1 event lands on its sub-period, as a card with a reason on every change', () => {
    const sim = createSim(config, 3);
    sim.phase = 'board';
    runSubPeriod(sim, createRng(3));
    const card = en(sim.cards).find(c => c.key === 'new_crm_system');
    expect(card).toBeDefined();
    expect(card!.changes.length).toBeGreaterThan(0);
    expect(card!.changes.every(c => c.reason.label && c.reason.cause && c.reason.evidence.length)).toBe(true);
  });
});

describe('triggers (6.4)', () => {
  it('resignation removes someone whose trust and morale collapse, once the run is under way', () => {
    const sim = createSim(config, 4);
    sim.phase = 'board';
    const rng = createRng(4);
    for (let i = 0; i < 9; i++) runSubPeriod(sim, rng);
    for (const x of sim.members) { x.trust = 60; x.morale = 60; x.result = 50; }
    sim.triggerCount.resignation = 0;
    const m = sim.members[sim.members.length - 1];
    m.trust = 5; m.morale = 5;
    runSubPeriod(sim, rng);
    expect(sim.members.some(x => x.id === m.id)).toBe(false);
    expect(en(sim.inbox).some(x => x.from === m.id && /Resignation/.test(x.title))).toBe(true);
  });

  it('casual leave takes a high performer away in its period, with a message', () => {
    const sim = createSim(config, 5);
    sim.phase = 'board';
    const rng = createRng(5);
    for (const m of sim.members) m.result = 50;
    sim.members.find(x => x.id === 'ruth')!.result = 90;
    sim.period = 3; sim.sub = 0;
    runSubPeriod(sim, rng);
    const ruth = sim.members.find(x => x.id === 'ruth')!;
    expect(ruth.away).toBeGreaterThan(0);
    expect(ruth.awayReason).toBe('leave');
  });
});

describe('role coverage (Teardown hidden rule 6)', () => {
  it('nobody can be let go if they are the last in their stage', async () => {
    const e = await onBoard();
    const r = await e.dispatch({ type: 'planAction', action: 'fire', memberIds: ['kent'] });
    await e.dispatch({ type: 'submitInteraction', interactionId: r.interactionId!, text: 'I am sorry. Here is what happens next.' });
    expect(en(e.view()).actions.find(a => a.key === 'fire')!.blockedFor.beth).toMatchObject({ reason: 'lastInStage' });
  });

  it('a full team hires nobody', async () => {
    const cfg = { ...config, actions: config.actions.map(a => (a.key === 'hire' ? { ...a, unlockPeriod: 1 } : a)) };
    const e = await onBoard(1, cfg);
    expect(en(e.view()).actions.find(a => a.key === 'hire')!.blocked).toMatchObject({ reason: 'teamFull' });
  });

  it('reassign refuses a full stage and moves someone into a stage with room', async () => {
    const e = await onBoard();
    await expect(e.dispatch({ type: 'planAction', action: 'swap', option: 'reassign', memberIds: ['kent'], stage: 'qualify' })).rejects.toMatchObject({ code: 'stageFull' });
    const r = await e.dispatch({ type: 'planAction', action: 'fire', memberIds: ['justin'] });
    await e.dispatch({ type: 'submitInteraction', interactionId: r.interactionId!, text: 'I am sorry. Here is what happens next.' });
    const m = await e.dispatch({ type: 'planAction', action: 'swap', option: 'reassign', memberIds: ['kent'], stage: 'qualify' });
    await e.dispatch({ type: 'submitInteraction', interactionId: m.interactionId!, text: 'Let me explain why this move matters for you.' });
    expect(en(e.view()).members.find(x => x.id === 'kent')!.stage).toBe('qualify');
  });
});
