import { purposeOf, type Purpose } from '../config';
import { bestStyle, fitOf, NEEDS, type NeedKey } from '../lens';
import { capability, leadershipScore, tierFor } from '../sim/score';
import { totalSubs } from '../sim/sim';
import type { ActionRecord, Sim } from '../sim/types';
import { mean, overallOf, rateSkills } from './ratings';
import { overallVerdict, skillVerdict, type SkillVerdictKey, type VerdictKey } from './verdict';

/**
 * The run summary (D75, D76): every number the individual report 3.0 reads beyond Report 2.0, and what the
 * group report aggregates across participants. Stable and serialisable: plain JSON, keys and numbers
 * only (no sentences), versioned. The Zod schema is `RunSummary` in `src/engine/reportContract.ts`.
 * Percentages are 0 to 100, kept to two decimals so aggregates stay exact enough.
 */

export type ImpactBand = 'none' | 'veryLow' | 'low' | 'moderate' | 'high';
export const IMPACT_BANDS: ImpactBand[] = ['none', 'veryLow', 'low', 'moderate', 'high'];
type Kpi = 'skill' | 'morale' | 'result' | 'trust';

export interface RunSummary {
  version: 1;
  storyline: { id: string; name: string };
  /** The lens's id and its style keys, in order: the columns of every style table. */
  lens: { id: string; styles: string[] };
  purpose: Purpose;
  seed: number;
  /** Share of the run played, 0 to 100. */
  completion: number;
  periods: { count: number; completed: number; unit: string };
  score: { total: number; max: number; tier: string };
  objectives: {
    revenue: number; target: number; share: number; conversions: number; beatTarget: boolean;
    /** Team averages at the start of the run and at its end. */
    team: Record<Kpi, { start: number; end: number }>;
  };
  /** Each period's stage throughput against its ideal: the funnel, week by week. */
  funnel: Array<{ period: number; stages: Array<{ stage: string; actual: number; ideal: number }> }>;
  skills: Array<{ key: string; reportOnly: boolean; observations: number; score: number | null; outOf10: number | null; level: number | null }>;
  overall: { score: number | null; level: number | null };
  styles: {
    /** Style tagged choices (weekly setting and one to one conversations) and how many fit the need. */
    total: number; fitted: number;
    /** Overall leadership adaptability: share of all style choices that fit, 0 to 100. */
    adaptability: number;
    /** Most used styles, ties listed, in lens order. */
    preferred: string[];
    perStyle: Array<{
      key: string; count: number; proportion: number; fitted: number;
      /** Share of this style's uses that fit the need, or null when unused. */
      accuracy: number | null;
      /** Choices where this style would have fit, and their share of all choices: how often people needed it. */
      needed: number; neededShare: number;
    }>;
    /** Rows: the four needs; columns: the lens's styles. Counts of choices. */
    grid: number[][];
  };
  consistency: {
    /** The actions compared (the 1.0 report's five, as action keys). */
    actions: string[];
    /** Per member, the predominant need (and the first style that fits it), the predominant style set, and the predominant style used. */
    members: Array<{ memberId: string; needed: NeedKey | null; desired: string | null; intended: string | null; used: string | null }>;
    /**
     * Deviations, 0 to 100, or null with nothing to compare. needed vs used: uses whose style did not fit
     * the person's need then; intended vs used: uses whose style differed from the style set for that
     * person that period; needed vs intended: weekly settings that did not fit the need.
     */
    deviations: { neededUsed: number | null; intendedUsed: number | null; neededIntended: number | null };
    counts: { uses: number; usesWithIntent: number; settings: number };
  };
  /** Per action, in storyline order: times taken, people reached, the mean net change per person reached, its band. */
  actions: Array<{ key: string; frequency: number; reached: number; mean: number | null; impact: ImpactBand }>;
  /** Members by action: counts and impact bands, members ordered by total impact, highest first. */
  distribution: {
    actions: string[];
    members: Array<{ memberId: string; name: string; left: boolean; total: number; impact: ImpactBand; cells: Array<{ count: number; mean: number | null; impact: ImpactBand }> }>;
    totals: number[];
  };
  /**
   * Time spent: share of one to one actions (0 to 100) with the top three, the bottom three and everyone
   * else, ranked by result at the start of each period. Null shares when there were no such actions.
   */
  attention: {
    top: number | null; average: number | null; bottom: number | null;
    periods: Array<{ period: number; actions: number; top: number | null; average: number | null; bottom: number | null }>;
  };
  /** Assessment purpose only (D75): the verdict keys. Labels and evidence are in the report. */
  verdict: { overall: VerdictKey | null; skills: Record<string, SkillVerdictKey | null> } | null;
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const pct = (part: number, whole: number) => (whole ? r2((100 * part) / whole) : null);

/** Most frequent values, ties listed in the given order. */
function predominant<T>(xs: T[], order: readonly T[]): T[] {
  const counts = new Map<T, number>();
  for (const x of xs) counts.set(x, (counts.get(x) ?? 0) + 1);
  const top = Math.max(0, ...counts.values());
  return top ? order.filter(x => counts.get(x) === top) : [];
}

/** The impact band of a mean net change (D76 thresholds in `report.impact`). */
export function impactBand(m: number | null, t: { low: number; moderate: number; high: number }): ImpactBand {
  if (m === null) return 'none';
  return m < t.low ? 'veryLow' : m < t.moderate ? 'low' : m < t.high ? 'moderate' : 'high';
}

/** Everyone an action applied to, with the net skill + morale + result change it made to each. */
export function touches(rec: ActionRecord): Array<{ memberId: string; net: number; changed: boolean }> {
  const ids = [...new Set([...rec.reached, ...Object.keys(rec.effects)])];
  return ids.map(id => {
    const e = rec.effects[id];
    return { memberId: id, net: e ? e[0] + e[1] + e[2] : 0, changed: !!e && e.some(v => v !== 0) };
  });
}

/** The band for a set of touches: none when nothing changed, else by the mean. */
function bandOf(ts: Array<{ net: number; changed: boolean }>, t: { low: number; moderate: number; high: number }) {
  return ts.some(x => x.changed) ? impactBand(mean(ts.map(x => x.net)), t) : 'none';
}

export function summarizeRun(sim: Sim): RunSummary {
  const c = sim.config, rep = c.report;
  const purpose = purposeOf(c);
  const styles = c.lens.styles.map(s => s.key);
  const score = leadershipScore(sim);
  const all = [...sim.members, ...sim.departed];
  const nameOf = (id: string) => c.members.find(p => p.id === id)?.name ?? c.candidates.find(p => p.id === id)?.name ?? id;

  // ---- objectives
  const kpi = (k: Kpi) => ({ start: sim.periods[0]?.kpis[k].start ?? sim.periodStart.kpis[k], end: sim.periods.at(-1)?.kpis[k].end ?? sim.periodStart.kpis[k] });
  const objectives = {
    revenue: Math.round(sim.funnel.value), target: c.money.target, share: r2((100 * sim.funnel.value) / c.money.target), conversions: Math.floor(sim.funnel.conversions),
    beatTarget: sim.funnel.value >= c.money.target,
    team: { skill: kpi('skill'), morale: kpi('morale'), result: kpi('result'), trust: kpi('trust') }
  };

  // ---- skills and verdicts
  const rated = rateSkills(sim);
  const overall = overallOf(sim, rated);
  const skills = rated.map(s => ({ key: s.key, reportOnly: s.reportOnly, observations: s.observations, score: s.score, outOf10: s.score === null ? null : s.score / 10, level: s.level?.index ?? null }));
  const bar = rep.assessment.bar;
  const primary = rated.filter(s => !s.reportOnly);
  const verdict = purpose === 'assessment' ? {
    overall: overallVerdict(overall.level, primary.map(s => s.level?.index ?? null), bar),
    skills: Object.fromEntries(primary.map(s => [s.key, skillVerdict(s.level?.index ?? null, bar)]))
  } : null;

  // ---- styles: proportion, accuracy, need, adaptability (every style tagged choice)
  const choices = sim.decisions.run;
  const perStyle = styles.map(k => {
    const mine = choices.filter(d => d.chosen === k);
    const fitted = mine.filter(d => d.mismatch === 0).length;
    const needed = choices.filter(d => fitOf(c.lens, k, d.need) === 0).length;
    return { key: k, count: mine.length, proportion: pct(mine.length, choices.length) ?? 0, fitted, accuracy: pct(fitted, mine.length), needed, neededShare: pct(needed, choices.length) ?? 0 };
  });
  const fittedAll = choices.filter(d => d.mismatch === 0).length;
  const stylesOut = {
    total: choices.length, fitted: fittedAll, adaptability: r2(capability(sim)),
    preferred: predominant(choices.map(d => d.chosen), styles),
    perStyle,
    grid: NEEDS.map(need => styles.map(used => choices.filter(d => d.need === need && d.chosen === used).length))
  };

  // ---- consistency: needed, intended and used, over the 1.0 report's five actions
  const counted = new Set(rep.consistencyActions);
  const recs = sim.actionRecords.filter(r => counted.has(r.actionKey));
  const uses = recs.flatMap(r => r.uses.map(u => ({ ...u, period: r.period })));
  const weekly = choices.filter(d => d.source === 'weeklyStyle');
  const intentFor = (memberId: string, period: number) => weekly.find(d => d.memberId === memberId && d.period === period)?.chosen ?? null;
  const withIntent = uses.map(u => ({ ...u, intended: intentFor(u.memberId, u.period) })).filter(u => u.intended !== null);
  const consistency = {
    actions: [...rep.consistencyActions],
    members: all.map(m => {
      const needs = [...weekly.filter(d => d.memberId === m.id).map(d => d.need), ...uses.filter(u => u.memberId === m.id).map(u => u.need)];
      const need = predominant(needs, NEEDS)[0] ?? null;
      return {
        memberId: m.id, needed: need, desired: need ? bestStyle(c.lens, need) : null,
        intended: predominant(weekly.filter(d => d.memberId === m.id).map(d => d.chosen), styles)[0] ?? null,
        used: predominant(uses.filter(u => u.memberId === m.id).map(u => u.style), styles)[0] ?? null
      };
    }).filter(m => m.needed || m.intended || m.used),
    deviations: {
      neededUsed: pct(uses.filter(u => fitOf(c.lens, u.style, u.need) !== 0).length, uses.length),
      intendedUsed: pct(withIntent.filter(u => u.style !== u.intended).length, withIntent.length),
      neededIntended: pct(weekly.filter(d => d.mismatch !== 0).length, weekly.length)
    },
    counts: { uses: uses.length, usesWithIntent: withIntent.length, settings: weekly.length }
  };

  // ---- actions: frequency and impact
  const t = rep.impact;
  const actions = c.actions.map(a => {
    const mine = sim.actionRecords.filter(r => r.actionKey === a.key);
    const ts = mine.flatMap(touches);
    return { key: a.key, frequency: mine.length, reached: ts.length, mean: ts.length ? r2(mean(ts.map(x => x.net))) : null, impact: bandOf(ts, t) };
  });

  // ---- distribution: members by action, ordered by total impact
  const keys = c.actions.map(a => a.key);
  const byMember = new Map<string, Map<string, Array<{ net: number; changed: boolean }>>>();
  for (const rec of sim.actionRecords) for (const x of touches(rec)) {
    const row = byMember.get(x.memberId) ?? new Map();
    byMember.set(x.memberId, row);
    row.set(rec.actionKey, [...(row.get(rec.actionKey) ?? []), x]);
  }
  const order = [...c.members, ...c.candidates].map(p => p.id);
  const people = [...all].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  const members = people.map(m => {
    const row = byMember.get(m.id) ?? new Map<string, Array<{ net: number; changed: boolean }>>();
    const everything = [...row.values()].flat();
    return {
      memberId: m.id, name: nameOf(m.id), left: sim.departed.includes(m), total: everything.reduce((s, x) => s + x.net, 0), impact: bandOf(everything, t),
      cells: keys.map(k => {
        const ts = row.get(k) ?? [];
        return { count: ts.length, mean: ts.length ? r2(mean(ts.map(x => x.net))) : null, impact: bandOf(ts, t) };
      })
    };
  }).sort((a, b) => b.total - a.total || order.indexOf(a.memberId) - order.indexOf(b.memberId));
  const distribution = { actions: keys, members, totals: keys.map((_, i) => members.reduce((s, m) => s + m.cells[i].count, 0)) };

  // ---- time spent with top, average and bottom performers (one to one actions, by period)
  const periodsAttention = sim.periodStartResults.map((results, i) => {
    const period = i + 1;
    const ranked = Object.entries(results).sort((a, b) => b[1] - a[1] || order.indexOf(a[0]) - order.indexOf(b[0])).map(([id]) => id);
    const top = new Set(ranked.slice(0, 3)), bottom = new Set(ranked.slice(-3).filter(id => !top.has(id)));
    const tally = { top: 0, average: 0, bottom: 0 };
    let n = 0;
    for (const rec of sim.actionRecords.filter(r => r.period === period && r.scope === 'member' && r.reached.length)) {
      n += 1;
      for (const id of rec.reached) tally[top.has(id) ? 'top' : bottom.has(id) ? 'bottom' : 'average'] += 1 / rec.reached.length;
    }
    return { period, actions: n, tally };
  });
  const sum = (k: 'top' | 'average' | 'bottom') => periodsAttention.reduce((s, p) => s + p.tally[k], 0);
  const totalActions = periodsAttention.reduce((s, p) => s + p.actions, 0);
  const attention = {
    top: pct(sum('top'), totalActions), average: pct(sum('average'), totalActions), bottom: pct(sum('bottom'), totalActions),
    periods: periodsAttention.map(p => ({ period: p.period, actions: p.actions, top: pct(p.tally.top, p.actions), average: pct(p.tally.average, p.actions), bottom: pct(p.tally.bottom, p.actions) }))
  };

  return {
    version: 1,
    storyline: { id: c.id, name: c.name },
    lens: { id: c.lens.id, styles },
    purpose, seed: sim.seed,
    completion: sim.phase === 'ended' ? 100 : Math.min(100, Math.floor((100 * sim.absSub) / totalSubs(sim))),
    periods: { count: c.time.period.count, completed: sim.periods.length, unit: c.time.period.unit },
    score: { total: score.total, max: score.max, tier: tierFor(sim, score.total).key },
    objectives,
    funnel: sim.periods.map(p => ({ period: p.period, stages: p.funnel.map(f => ({ stage: f.stage, actual: r2(f.throughput), ideal: r2(f.ideal) })) })),
    skills, overall: { score: overall.score === null ? null : r2(overall.score), level: overall.level },
    styles: stylesOut, consistency, actions, distribution, attention, verdict
  };
}
