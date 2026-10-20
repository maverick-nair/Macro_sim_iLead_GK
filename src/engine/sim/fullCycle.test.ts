import { describe, expect, it } from 'vitest';
import { parseStoryline } from '../config';
import salesElevator from '../storylines/sales-elevator.json';
import { createSim, runFunnel } from './sim';
import { FOCUS_BONUS, stageStrength, targets } from './fullCycle';

const parse = (raw: unknown) => { const p = parseStoryline(raw); if (!p.ok) throw new Error(p.issues.join('\n')); return p.config; };

describe('the full cycle sales model (D243)', () => {
  it('shares the team target by experience, adding up to it, and keeps an authored target as written', () => {
    const sim = createSim(parse(salesElevator), 1);
    const t = targets(sim);
    expect(Object.values(t).reduce((a, v) => a + v, 0)).toBeCloseTo(sim.config.money.target, 6);
    const skill = (id: string) => sim.config.members.find(p => p.id === id)!.start.skill;
    const [low, high] = [...sim.members].sort((a, b) => skill(a.id) - skill(b.id)).map(m => m.id).filter((_, i, a) => i === 0 || i === a.length - 1);
    expect(t[high]).toBeGreaterThan(t[low]);
    const authored = parse({ ...salesElevator, members: salesElevator.members.map((p, i) => (i === 0 ? { ...p, target: 50000 } : p)) });
    const t2 = targets(createSim(authored, 1));
    expect(t2[salesElevator.members[0].id]).toBe(50000);
    expect(Object.values(t2).reduce((a, v) => a + v, 0)).toBeCloseTo(240000, 6);
  });

  it('runs each person at their own strength per stage, stronger where they focus', () => {
    const sim = createSim(parse(salesElevator), 1);
    const m = sim.members[0];
    const p = sim.config.members[0];
    const other = sim.config.stages.find(s => s.key !== m.stage)!.key;
    expect(stageStrength(sim, m, other, 50)).toBe(Math.max(0, Math.min(100, 50 + p.byStage[other].result - p.byStage[p.homeStage].result)));
    expect(stageStrength(sim, m, m.stage, 50)).toBe(Math.min(100, 50 + FOCUS_BONUS));
  });

  it('credits what each person closes, and the team funnel is their sum', () => {
    const sim = createSim(parse(salesElevator), 1);
    runFunnel(sim);
    const by = sim.funnel.byMember!;
    expect(Object.keys(by).sort()).toEqual(sim.members.filter(m => m.away === 0).map(m => m.id).sort());
    expect(Object.values(by).reduce((a, v) => a + v, 0)).toBeCloseTo(sim.funnel.value, 6);
    expect(sim.funnel.stageOut.every((v, i, a) => i === 0 || v <= a[i - 1])).toBe(true);
  });

  it('keeps the stage model for storylines that say so', () => {
    const sim = createSim(parse({ ...salesElevator, salesModel: 'stages' }), 1);
    runFunnel(sim);
    expect(sim.funnel.byMember).toBeUndefined();
  });
});
