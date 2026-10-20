import type { Check, PersonaStats, RunResult } from './schema';

/**
 * Combined strategy probes (D149): narrow strategies that a single style or a single action does not cover.
 * Pure: reads the probes' results.
 *
 *   combined  fails when a probe beats the Expert, or when a probe that does not read people (team energy with
 *             one style for everyone, as many actions as possible) reaches the target tier. A pair of actions
 *             repeated with an Expert's reading of people is judged against the Expert only: that it reaches the
 *             target tier is the reading, which `idle` covers.
 *   idle      warns when reading everyone right every week and taking no action reaches the target tier.
 */

export const COMBINED_KINDS = ['energize', 'busy', 'pair'] as const;

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const list = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

export interface StrategyContext {
  probes: RunResult[];
  probesRan: boolean;
  expert: PersonaStats | undefined;
  target: { name: string; min: number };
  styles: Array<{ key: string; name: string }>;
  actions: Array<{ key: string; name: string }>;
}

/** Probe groups of these kinds, by kind and key, with their mean score. */
export function probeGroups(probes: RunResult[], kinds: readonly string[]) {
  const groups = new Map<string, { kind: string; key: string; scores: number[] }>();
  for (const p of probes) {
    if (!p.probe || !kinds.includes(p.probe.kind)) continue;
    const id = `${p.probe.kind}:${p.probe.key}`;
    const g = groups.get(id) ?? { kind: p.probe.kind, key: p.probe.key, scores: [] };
    g.scores.push(p.score);
    groups.set(id, g);
  }
  return [...groups.values()].map(g => ({ ...g, mean: mean(g.scores) }));
}

/** A probe in plain words: "Team energy every week with everyone led as Directing". */
export function describeProbe(kind: string, key: string, c: Pick<StrategyContext, 'styles' | 'actions'>): string {
  const style = (k: string) => c.styles.find(s => s.key === k)?.name ?? k;
  const action = (k: string) => c.actions.find(a => a.key === k)?.name ?? k;
  switch (kind) {
    case 'energize': return `Team energy every week with everyone led as ${style(key)}`;
    case 'busy': return 'Taking as many actions as the days allow, in any style';
    case 'pair': return `Repeating ${list(key.split('+').map(action))}, reading people as an Expert does`;
    case 'idle': return 'Reading everyone right and taking no action';
    case 'style': return `Leading everyone as ${style(key)}`;
    case 'action': return `Spending every day on ${action(key)}`;
    default: return key;
  }
}

export function strategyChecks(c: StrategyContext): Check[] {
  const out: Check[] = [];
  if (!c.probesRan) return out;
  const expert = c.expert?.runs ? c.expert.score.mean : null;
  const groups = probeGroups(c.probes, COMBINED_KINDS);
  if (groups.length) {
    const wins: string[] = [];
    const actions = new Set<string>();
    for (const g of [...groups].sort((a, b) => b.mean - a.mean)) {
      const beats = expert !== null && g.mean > expert;
      const reaches = g.kind !== 'pair' && g.mean >= c.target.min;
      if (!beats && !reaches) continue;
      wins.push(`${describeProbe(g.kind, g.key, c)} ${beats ? `beats Expert play (${Math.round(g.mean)} points against ${Math.round(expert!)})` : `reaches ${c.target.name} (${Math.round(g.mean)} points)`}`);
      if (g.kind === 'pair') for (const k of g.key.split('+')) actions.add(c.actions.find(a => a.key === k)?.name ?? k);
      if (g.kind === 'energize') actions.add('team energy');
    }
    const best = [...groups].sort((a, b) => b.mean - a.mean)[0];
    const shown = wins.length > 3 ? [...wins.slice(0, 3), `${wins.length - 3} more`] : wins;
    out.push(wins.length
      ? {
        key: 'combined', status: 'fail',
        title: `A routine wins over judgement: ${list(shown)}`,
        detail: `${groups.length} combined strategies tried: pairs of actions repeated every day, team energy every week with one style, and as many actions as possible.`,
        fix: `Make repetition cost something: give ${actions.size ? list([...actions]) : 'the repeated actions'} a cooldown, or a smaller effect each time it is repeated in a row, and make answering events and following up worth more, so adapting beats a routine.`
      }
      : {
        key: 'combined', status: 'pass', title: 'No routine of repeated actions beats good leadership',
        detail: `${groups.length} combined strategies tried; the best, ${describeProbe(best.kind, best.key, c).toLowerCase()}, averages ${Math.round(best.mean)}${expert !== null ? ` against the Expert's ${Math.round(expert)}` : ''}.`, fix: null
      });
  }
  const idle = probeGroups(c.probes, ['idle'])[0];
  if (idle) {
    out.push(idle.mean >= c.target.min
      ? {
        key: 'idle', status: 'warn',
        title: `Reading people right without taking any action reaches ${c.target.name} (${Math.round(idle.mean)} points)`,
        detail: 'Style fit alone carries the score: a leader who sets the right style every week and never meets anyone, coaches or answers an event still reaches the target tier.',
        fix: `Make actions count for more than style setting: raise the Business and People weights against Leadership, or make people drift down when nobody acts, so a leader who never acts stays under ${c.target.name}.`
      }
      : { key: 'idle', status: 'pass', title: `Reading people right without acting stays under ${c.target.name}`, detail: `It averages ${Math.round(idle.mean)} points.`, fix: null });
  }
  return out;
}
