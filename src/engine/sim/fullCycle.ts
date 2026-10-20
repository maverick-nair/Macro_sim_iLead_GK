import type { MemberSim, Sim } from './types';

/**
 * The full cycle sales model (D243): every person sells end to end. Leads are shared out by target, each person's
 * deals move through every stage at their own strength there, and what they close is theirs. Pure helpers over the
 * sim, so the funnel step and the view read the same numbers.
 */

export const fullCycle = (sim: Sim) => sim.config.salesModel === 'fullCycle';

/** A stage the person is focusing on (their `stage`, set by Change focus) runs this much stronger. */
export const FOCUS_BONUS = 8;
/** Experience weights the shared target: starting skill plus this, so nobody carries nothing. */
const WEIGHT_FLOOR = 50;

const config = (sim: Sim, id: string) => sim.config.members.find(p => p.id === id) ?? sim.config.candidates.find(p => p.id === id)!;

/**
 * Each current member's target: an authored one as written, the rest of the team target shared in proportion to
 * starting skill plus 50. They add up to the team target whoever is on the team now.
 */
export function targets(sim: Sim): Record<string, number> {
  const total = sim.config.money.target;
  const authored = sim.members.filter(m => config(sim, m.id).target !== undefined);
  const fixed = authored.reduce((a, m) => a + config(sim, m.id).target!, 0);
  const rest = sim.members.filter(m => config(sim, m.id).target === undefined);
  const weights = rest.map(m => config(sim, m.id).start.skill + WEIGHT_FLOOR);
  const sum = weights.reduce((a, w) => a + w, 0);
  const left = Math.max(0, total - fixed);
  return Object.fromEntries([
    ...authored.map(m => [m.id, config(sim, m.id).target!] as const),
    ...rest.map((m, i) => [m.id, sum > 0 ? left * weights[i] / sum : 0] as const)
  ]);
}

/** Their strength at a stage: their result now, moved by how much better or worse they are there than at home, plus focus. */
export function stageStrength(sim: Sim, m: MemberSim, stage: string, result: number): number {
  const p = config(sim, m.id);
  const home = p.byStage[p.homeStage]?.result ?? p.start.result;
  const there = p.byStage[stage]?.result ?? home;
  return Math.max(0, Math.min(100, result + there - home + (m.stage === stage ? FOCUS_BONUS : 0)));
}

/**
 * One sub-period of selling: the day's leads shared by target, each person's own through every stage. Adds to the
 * team's stage output and to what each person has closed; returns the conversions.
 */
export function runFullCycle(sim: Sim, input: number, effective: (m: MemberSim) => number): number {
  const { stages, money, performanceThreshold } = sim.config;
  const shares = targets(sim);
  const total = Object.values(shares).reduce((a, v) => a + v, 0);
  const byMember = (sim.funnel.byMember ??= {});
  let conversions = 0;
  for (const m of sim.members) {
    // Away, their leads go unworked: no one covers (as a stage with nobody in it).
    if (m.away > 0 || total <= 0) continue;
    let flow = input * shares[m.id] / total;
    const result = effective(m);
    stages.forEach((st, i) => {
      const strength = stageStrength(sim, m, st.key, result);
      flow = Math.max(0, flow * st.conversionRatio * (strength + performanceThreshold) / (100 + performanceThreshold));
      sim.funnel.stageOut[i] += flow;
      sim.funnel.stageOutPeriod[i] += flow;
    });
    conversions += flow;
    byMember[m.id] = (byMember[m.id] ?? 0) + flow * money.valuePerConversion;
  }
  return conversions;
}
