import type { ArchetypeKey, Check, PersonaStats, RunResult } from './schema';

/**
 * Checks on the four player types (D150). Pure.
 *
 *   archetypes  warns when two player types that lead differently end up with nearly the same journey: their
 *               mix of actions and their outcomes (score and revenue) both close. The storyline does not tell
 *               those ways of leading apart.
 *   tradeOff    warns when People first beats the Expert on both the Leadership Score and revenue: caring for
 *               people costs nothing in results, so the simulation shows no trade-off between them.
 */

export const ARCHETYPE_THRESHOLDS = {
  /** Action mixes closer than this (total variation distance, 0 to 1) are similar. */
  mix: 0.2,
  /** Average scores closer than this share of the scale are similar. */
  score: 0.03,
  /** Average revenue closer than this (share of the target) is similar. */
  revenue: 0.1
} as const;

const NAMES: Record<ArchetypeKey, string> = { riskTaker: 'Risk taker', conservative: 'Conservative', peopleFirst: 'People first', businessFirst: 'Business first' };
const pct = (x: number) => `${Math.round(x * 100)}%`;

/** Each action's share of all actions a persona took, over its playthroughs. */
export function actionMix(runs: RunResult[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const r of runs) for (const [k, n] of Object.entries(r.actions)) counts.set(k, (counts.get(k) ?? 0) + n);
  const total = [...counts.values()].reduce((a, b) => a + b, 0) || 1;
  return new Map([...counts].map(([k, n]) => [k, n / total]));
}

/** Total variation distance between two action mixes: 0 the same, 1 nothing in common. */
export function mixDistance(a: Map<string, number>, b: Map<string, number>): number {
  const keys = new Set([...a.keys(), ...b.keys()]);
  let d = 0;
  for (const k of keys) d += Math.abs((a.get(k) ?? 0) - (b.get(k) ?? 0));
  return d / 2;
}

export function archetypeChecks(c: { personas: PersonaStats[]; runs: RunResult[]; scoreMax: number }): Check[] {
  const out: Check[] = [];
  const types = c.personas.filter((p): p is PersonaStats & { persona: ArchetypeKey } => p.persona in NAMES && p.runs > 0);
  if (types.length >= 2) {
    const similar: string[] = [];
    let closest: { names: string; mix: number } | null = null;
    for (let i = 0; i < types.length; i++) for (let j = i + 1; j < types.length; j++) {
      const a = types[i], b = types[j];
      const mix = mixDistance(actionMix(c.runs.filter(r => r.persona === a.persona && !r.probe)), actionMix(c.runs.filter(r => r.persona === b.persona && !r.probe)));
      const score = Math.abs(a.score.mean - b.score.mean) / (c.scoreMax || 1);
      const revenue = Math.abs(a.share.mean - b.share.mean);
      const names = `${NAMES[a.persona]} and ${NAMES[b.persona]}`;
      if (!closest || mix < closest.mix) closest = { names, mix };
      if (mix < ARCHETYPE_THRESHOLDS.mix && score < ARCHETYPE_THRESHOLDS.score && revenue < ARCHETYPE_THRESHOLDS.revenue) {
        similar.push(`${names} (${pct(1 - mix)} the same actions, ${Math.round(a.score.mean)} and ${Math.round(b.score.mean)} points)`);
      }
    }
    out.push(similar.length
      ? { key: 'archetypes', status: 'warn', title: `Different ways of leading end up the same: ${similar.join('; ')}`, detail: 'Two player types that lead differently took nearly the same actions and reached nearly the same score and revenue.', fix: 'Give the choices that set them apart real consequences: bold moves (hiring, letting go, moving people) should pay off or cost more than careful ones, and caring for people should play out differently from pushing for results.' }
      : { key: 'archetypes', status: 'pass', title: 'Each player type plays out differently', detail: closest ? `The closest pair, ${closest.names}, share ${pct(1 - closest.mix)} of their actions.` : null, fix: null });
  }
  const people = c.personas.find(p => p.persona === 'peopleFirst' && p.runs > 0);
  const expert = c.personas.find(p => p.persona === 'expert' && p.runs > 0);
  if (people && expert) {
    const both = people.score.mean > expert.score.mean && people.share.mean > expert.share.mean;
    out.push(both
      ? { key: 'tradeOff', status: 'warn', title: `Putting people first beats the Expert on both score and revenue (${Math.round(people.score.mean)} points and ${pct(people.share.mean)} of target, against ${Math.round(expert.score.mean)} and ${pct(expert.share.mean)})`, detail: 'Caring for morale costs nothing in results here, so participants never have to weigh people against the number.', fix: 'Make it a real choice: let time on morale cost some output (a day in one to ones is a day not selling), or give actions that push results a revenue edge that morale actions lack.' }
      : { key: 'tradeOff', status: 'pass', title: 'Putting people first trades off against results', detail: `People first: ${Math.round(people.score.mean)} points and ${pct(people.share.mean)} of target; Expert: ${Math.round(expert.score.mean)} and ${pct(expert.share.mean)}.`, fix: null });
  }
  return out;
}
