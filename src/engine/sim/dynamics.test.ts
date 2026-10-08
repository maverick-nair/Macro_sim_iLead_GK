import { describe, expect, it } from 'vitest';
import { wordAll as en } from '../../i18n/engineCopy';
import { parseStoryline, type StorylineConfig, type StorylineInput } from '../config';
import salesElevator from '../storylines/sales-elevator.json';
import { burnout } from './burnout';
import { growthShare, outputShare, rollingMorale, share, trustShare } from './dynamics';
import { createEngine } from './engine';
import { play } from './policies';
import { createRng } from './rng';
import { createSim, effectChanges, runFunnel } from './sim';

/** People dynamics (D135, docs/SIMULATION.md 3.5): morale and trust reach output and attrition with a lag. */

const parse = (x: unknown): StorylineConfig => { const p = parseStoryline(x); if (!p.ok) throw new Error(p.issues.join('\n')); return p.config; };
const se = salesElevator as unknown as StorylineInput;
const withDyn = parse(se);
const without = parse({ ...se, dynamics: undefined });
const reason = { label: 'x', cause: 'x', rule: 'x', evidence: [] };

describe('people dynamics (D135)', () => {
  it('Sales Elevator plays with dynamics, at the documented defaults', () => {
    expect(withDyn.dynamics).toEqual({ window: 5, output: { full: 50, floor: 0.5 }, growth: { full: 50, floor: 0.3 }, trust: { full: 50, floor: 0.5 }, attrition: { below: 20, chance: 0.2, sickDays: 2, resignAfter: 2 } });
    expect(without.dynamics).toBeUndefined();
  });

  it('a share is full at or above its line and falls in a straight line to its floor at 0', () => {
    expect(share(80, 50, 0.5)).toBe(1);
    expect(share(50, 50, 0.5)).toBe(1);
    expect(share(25, 50, 0.5)).toBe(0.75);
    expect(share(0, 50, 0.5)).toBe(0.5);
  });

  it('morale reaches output with a lag: the rolling mean of the last days, the current value before there are any', () => {
    const sim = createSim(withDyn, 1);
    const m = sim.members[0];
    m.morale = 20;
    expect(rollingMorale(sim, m)).toBe(20);
    m.moraleHistory = [80, 80, 80, 80, 80, 20];
    // The last 5 days: four at 80 and one at 20.
    expect(rollingMorale(sim, m)).toBe(68);
    expect(outputShare(sim, m)).toBe(1);
    m.moraleHistory = [10, 10, 10, 10, 10];
    expect(outputShare(sim, m)).toBe(0.6);
    expect(growthShare(sim, m)).toBeCloseTo(0.44, 6);
  });

  it('the funnel reads each result at its output share; without dynamics in full', () => {
    const a = createSim(withDyn, 1), b = createSim(without, 1);
    for (const sim of [a, b]) for (const m of sim.members) { m.result = 80; m.moraleHistory = [0]; }
    runFunnel(a); runFunnel(b);
    expect(a.funnel.stageOut[0]).toBeLessThan(b.funnel.stageOut[0]);
    for (const m of a.members) m.moraleHistory = [90];
    a.funnel.stageOut = a.funnel.stageOut.map(() => 0);
    runFunnel(a);
    expect(a.funnel.stageOut[0]).toBeCloseTo(b.funnel.stageOut[0], 9);
  });

  it('low morale slows result gains, and low trust blunts what your actions do; events are not blunted by trust', () => {
    const run = (config: StorylineConfig, morale: number, trust: number, useTrust: boolean) => {
      const sim = createSim(config, 1);
      const m = sim.members[0];
      Object.assign(m, { morale, trust, result: 40, skill: 40, moraleHistory: [morale] });
      return effectChanges(sim, createRng(9), m, [10, 10, 10], reason, { useTrust });
    };
    const delta = (cs: ReturnType<typeof run>, k: string) => cs.find(c => c.metric === k)?.delta ?? 0;
    const happy = run(withDyn, 80, 80, true), worn = run(withDyn, 0, 80, true), wary = run(withDyn, 80, 0, true), event = run(withDyn, 80, 0, false);
    expect(delta(worn, 'result')).toBeLessThan(delta(happy, 'result'));
    expect(delta(worn, 'morale')).toBe(delta(happy, 'morale'));
    expect(delta(wary, 'skill')).toBeLessThan(delta(happy, 'skill'));
    expect(delta(event, 'skill')).toBeGreaterThan(delta(wary, 'skill'));
    // Without dynamics nothing of this applies.
    expect(run(without, 0, 80, true).map(c => c.delta)).toEqual(run(without, 80, 80, true).map(c => c.delta));
  });

  it('trust below its line lands a smaller share', () => {
    const sim = createSim(withDyn, 1);
    const m = sim.members[0];
    m.trust = 25;
    expect(trustShare(sim, m)).toBe(0.75);
    m.trust = 60;
    expect(trustShare(sim, m)).toBe(1);
  });

  it('sustained low morale keeps people off sick, then they resign; never the last in a stage', async () => {
    // Everyone starts worn out; nobody acts. The draws are the dynamics stream's own, so they replay exactly.
    // The 1.0 triggers are left out, so every departure here is the dynamics' own.
    const low = parse({ ...se, triggers: [], members: se.members.map(m => ({ ...m, start: { ...m.start, morale: 5 } })) });
    const e = createEngine(low, { seed: 4 });
    const left = new Set<string>();
    let sick = 0;
    while (e.view().phase !== 'ended') {
      const v = e.view();
      if (v.phase === 'style') await e.dispatch({ type: 'confirmStyles', styles: Object.fromEntries(v.members.map(m => [m.id, 'D'])) });
      const s = (await e.dispatch({ type: 'endPeriod' })).summary!;
      for (const a of s.attrition ?? []) { if (a.kind === 'resigned') left.add(a.memberId); else sick++; }
      if (e.view().phase === 'periodEnd') await e.dispatch({ type: 'startNextPeriod' });
    }
    expect(sick).toBeGreaterThan(0);
    expect(left.size).toBeGreaterThan(0);
    const v = en(e.view());
    // Every stage keeps someone.
    for (const st of low.stages) expect(v.members.some(m => m.stage === st.key)).toBe(true);
    expect(v.history.some(l => l.title === 'Resigned')).toBe(true);
    // The same seed replays the same people leaving.
    const again = createEngine(low, { seed: 4 });
    while (again.view().phase !== 'ended') {
      const w = again.view();
      if (w.phase === 'style') await again.dispatch({ type: 'confirmStyles', styles: Object.fromEntries(w.members.map(m => [m.id, 'D'])) });
      await again.dispatch({ type: 'endPeriod' });
      if (again.view().phase === 'periodEnd') await again.dispatch({ type: 'startNextPeriod' });
    }
    expect(again.view().members.map(m => m.id)).toEqual(e.view().members.map(m => m.id));
  });
});

describe('the burnout experiment (the first engine audit, D135)', () => {
  // Every fitting effect becomes morale −8, result +14; the good player reads people well and burns them out.
  const SEEDS = [1, 2, 3, 4, 5, 6];
  async function mean(config: StorylineConfig) {
    let revenue = 0, score = 0, left = 0, morale = 0;
    for (const seed of SEEDS) {
      const { view } = await play(config, 'good', seed);
      revenue += view.money.value / config.money.target;
      score += view.score.total;
      left += config.members.length - view.members.length;
      morale += view.kpis.find(k => k.metric === 'morale')!.value;
    }
    const n = SEEDS.length;
    return { revenue: revenue / n, score: score / n, left: left / n, morale: morale / n };
  }

  it('without dynamics, burnout beat balanced play on revenue: the funnel read only result', async () => {
    const balanced = await mean(without), burnt = await mean(parse({ ...burnout(se), dynamics: undefined }));
    expect(burnt.revenue).toBeGreaterThan(balanced.revenue * 1.5);
    expect(burnt.left).toBe(0);
  });

  it('with dynamics, burnout loses to balanced play on revenue and score, and people leave', async () => {
    const balanced = await mean(withDyn), burnt = await mean(parse(burnout(se)));
    expect(burnt.revenue).toBeLessThan(balanced.revenue);
    expect(burnt.score).toBeLessThan(balanced.score - 100);
    expect(burnt.left).toBeGreaterThanOrEqual(2);
    expect(burnt.morale).toBeLessThan(10);
    expect(balanced.left).toBeLessThan(1);
  });
});
