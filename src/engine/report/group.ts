import type { Purpose, StorylineConfig } from '../config';
import type { BenchmarkSummary, CompletionBucket, GroupReport, GroupSection } from '../groupContract';
import { fitOf, NEEDS, type Lens } from '../lens';
import { DEFAULT_GROUP_COPY, type GroupCopy } from './groupDefaults';
import { impactBand, type RunSummary } from './summary';
import type { VerdictKey } from './verdict';

/**
 * The group report (D75, D77): aggregates of a cohort's run summaries, for the organization. Pure and
 * deterministic, so the server can run the same code (`GET /cohort/{id}/report`, or `POST /cohort/report`
 * from stored summaries). `summarizeBenchmark` is the aggregate the server stores from everyone who
 * has played a storyline; the group's own numbers come from the same function, so the two always compare
 * like with like. Rules (SIMULATION 8.5):
 *
 * - The completion rate counts every participant; every other average reads only the runs completed to
 *   `report.group.completeAt`% (default 100).
 * - Development: no verdicts, no names, no ranking. Below `report.group.minimumCohort` participants who
 *   completed (default 5), every aggregate is withheld with a message; below it in all, the completion rate too.
 * - Assessment: the verdict distribution and a participant table in name order (never a ranking).
 * - Narratives come from the storyline's group bank (`report.group.copy`), or `DEFAULT_GROUP_COPY`.
 */

export interface CohortInfo {
  name: string;
  /** The report date, as an ISO date (YYYY-MM-DD). */
  date: string;
  purpose: Purpose;
  /** The storyline the cohort played: names, rating scale, actions, impact bands and the group bank. */
  storyline: StorylineConfig;
  /** The lens the runs were played with. Left out, the storyline's. */
  lens?: Lens;
}

export interface GroupReportInput {
  runs: RunSummary[];
  /** Each run's participant name, in the same order: only an assessment's participant table shows them. */
  names?: string[];
  benchmark?: BenchmarkSummary | null;
  cohort: CohortInfo;
}

const r1 = (n: number) => Math.round(n * 10) / 10;
const r2 = (n: number) => Math.round(n * 100) / 100;
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const meanOrNull = (xs: Array<number | null | undefined>) => {
  const ys = xs.filter((x): x is number => typeof x === 'number');
  return ys.length ? r2(mean(ys)) : null;
};
const pct = (part: number, whole: number) => (whole ? r2((100 * part) / whole) : 0);
const fill = (text: string, vars: Record<string, string | number>) => text.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
const byLevel = <T>(list: T[], index: number, levels: number): T => list[Math.min(list.length - 1, Math.round((index * (list.length - 1)) / Math.max(1, levels - 1)))];
const band3 = (v: number, lo: number, hi: number) => (v < lo ? 'low' as const : v < hi ? 'mid' as const : 'high' as const);
const lower = (t: string) => t.charAt(0).toLowerCase() + t.slice(1);
const list = (xs: string[], last: string) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} ${last} ${xs[xs.length - 1]}`);

/** The completion bucket of a run: 50% or less, over 50 to under 80, 80 to under 100, and 100. */
export function completionBucket(completion: number): CompletionBucket {
  return completion >= 100 ? 'full' : completion >= 80 ? 'to100' : completion > 50 ? 'to80' : 'upTo50';
}

/** The level index a score reaches on a rating scale (lower thresholds, lowest first). */
const levelOf = (scale: Array<{ min: number }>, score: number) => scale.reduce((lv, l, i) => (score >= l.min ? i : lv), 0);

const VERDICTS: Array<VerdictKey | 'none'> = ['exceeds', 'meets', 'approaching', 'below', 'none'];

/**
 * The benchmark aggregate (D77): averages and distributions of many runs, no individuals. The runs should
 * share a storyline and lens; the first run names them. Runs completed to `completeAt`% or more feed
 * every average; the completion rate counts all.
 */
export function summarizeBenchmark(runs: RunSummary[], opts: { completeAt?: number } = {}): BenchmarkSummary {
  const completeAt = opts.completeAt ?? 100;
  const first = runs[0];
  const done = runs.filter(r => r.completion >= completeAt);
  const counts = new Map<CompletionBucket, number>();
  for (const r of runs) counts.set(completionBucket(r.completion), (counts.get(completionBucket(r.completion)) ?? 0) + 1);
  const buckets = (['upTo50', 'to80', 'to100', 'full'] as const).map(key => ({ key, count: counts.get(key) ?? 0, share: pct(counts.get(key) ?? 0, runs.length) }));

  // Skills: the mean of the runs that rated each, and the runs at each level.
  const tally = (levels: Array<number | null>) => {
    const out: number[] = [];
    for (const l of levels) if (l !== null) { while (out.length <= l) out.push(0); out[l] += 1; }
    return out;
  };
  const skillKeys = first ? first.skills.map(s => ({ key: s.key, reportOnly: s.reportOnly })) : [];
  const skills = skillKeys.map(({ key, reportOnly }) => {
    const mine = done.map(r => r.skills.find(s => s.key === key)).filter(s => !!s);
    const scores = mine.map(s => s.score).filter((x): x is number => x !== null);
    return { key, reportOnly, rated: scores.length, score: scores.length ? r2(mean(scores)) : null, levels: tally(mine.map(s => s.level)), unrated: done.length - mine.filter(s => s.level !== null).length };
  });
  const overallScores = done.map(r => r.overall.score).filter((x): x is number => x !== null);
  const overall = { rated: overallScores.length, score: overallScores.length ? r2(mean(overallScores)) : null, levels: tally(done.map(r => r.overall.level)), unrated: done.filter(r => r.overall.level === null).length };

  // Objectives and the team.
  const kpi = (k: 'skill' | 'morale' | 'result' | 'trust') => ({ start: r2(mean(done.map(r => r.objectives.team[k].start))), end: r2(mean(done.map(r => r.objectives.team[k].end))) });
  const objectives = {
    target: first?.objectives.target ?? 0,
    revenue: r2(mean(done.map(r => r.objectives.revenue))), conversions: r2(mean(done.map(r => r.objectives.conversions))), share: r2(mean(done.map(r => r.objectives.share))),
    beatTarget: done.filter(r => r.objectives.beatTarget).length,
    team: { skill: kpi('skill'), morale: kpi('morale'), result: kpi('result'), trust: kpi('trust') }
  };

  // Styles: adaptability per run, the preferred style (a tie splits the run), pooled proportion and accuracy.
  const styleKeys = first?.lens.styles ?? [];
  const preferred = Object.fromEntries(styleKeys.map(k => [k, r2(done.reduce((a, r) => a + (r.styles.preferred.includes(k) ? 1 / r.styles.preferred.length : 0), 0))]));
  const total = done.reduce((a, r) => a + r.styles.total, 0);
  const perStyle = styleKeys.map(key => {
    const rows = done.map(r => r.styles.perStyle.find(s => s.key === key)).filter(s => !!s);
    const count = rows.reduce((a, s) => a + s.count, 0), fitted = rows.reduce((a, s) => a + s.fitted, 0), needed = rows.reduce((a, s) => a + s.needed, 0);
    return { key, count, fitted, needed, proportion: pct(count, total), accuracy: count ? pct(fitted, count) : null, neededShare: pct(needed, total) };
  });
  const styles = { adaptability: r2(mean(done.map(r => r.styles.adaptability))), preferred, perStyle };

  const consistency = {
    neededUsed: meanOrNull(done.map(r => r.consistency.deviations.neededUsed)),
    intendedUsed: meanOrNull(done.map(r => r.consistency.deviations.intendedUsed)),
    neededIntended: meanOrNull(done.map(r => r.consistency.deviations.neededIntended))
  };

  // The funnel, period by period, over the runs that reached each period.
  const periods = Math.max(0, ...done.map(r => r.funnel.length));
  const funnel = Array.from({ length: periods }, (_, i) => {
    const rows = done.map(r => r.funnel[i]).filter(p => !!p);
    const stages = (rows[0]?.stages ?? []).map((st, j) => ({ stage: st.stage, actual: r2(mean(rows.map(p => p.stages[j]?.actual ?? 0))), ideal: r2(mean(rows.map(p => p.stages[j]?.ideal ?? 0))) }));
    return { period: rows[0]?.period ?? i + 1, runs: rows.length, stages };
  });

  // Actions: mean frequency per run, runs that used each, and the mean change per person reached, pooled.
  const actions = (first?.actions ?? []).map(({ key }) => {
    const rows = done.map(r => r.actions.find(a => a.key === key)).filter(a => !!a);
    const reached = rows.reduce((a, x) => a + x.reached, 0);
    const net = rows.reduce((a, x) => a + (x.mean ?? 0) * x.reached, 0);
    return { key, frequency: r2(mean(done.map(r => r.actions.find(a => a.key === key)?.frequency ?? 0))), used: rows.filter(x => x.frequency > 0).length, reached, mean: reached ? r2(net / reached) : null };
  });

  // Time spent: the mean of each run's shares, over runs with one to one actions.
  const att = done.filter(r => r.attention.top !== null);
  const attention = att.length ? { top: r2(mean(att.map(r => r.attention.top!))), average: r2(mean(att.map(r => r.attention.average!))), bottom: r2(mean(att.map(r => r.attention.bottom!))) } : null;

  // Verdicts: assessment runs only, over every participant (a verdict can rest on an unfinished run).
  const assessed = runs.filter(r => r.verdict);
  const verdicts = assessed.length ? { assessed: assessed.length, counts: Object.fromEntries(VERDICTS.map(k => [k, assessed.filter(r => (r.verdict!.overall ?? 'none') === k).length])) } : null;

  return {
    version: 1,
    storyline: first?.storyline ?? { id: 'none', name: '' },
    lens: { id: first?.lens.id ?? 'none', styles: [...styleKeys] },
    participants: runs.length, completed: done.length, completeAt,
    completion: { average: r2(mean(runs.map(r => r.completion))), buckets },
    skills, overall, objectives, styles, consistency, funnel, actions, attention, verdicts
  };
}

const DEVELOPMENT_SECTIONS: GroupSection[] = ['about', 'skills', 'distribution', 'completion', 'business', 'adaptability', 'styles', 'consistency', 'funnel', 'actions', 'attention', 'takeaways'];
const ASSESSMENT_SECTIONS: GroupSection[] = ['about', 'verdicts', 'skills', 'distribution', 'completion', 'business', 'adaptability', 'styles', 'consistency', 'funnel', 'actions', 'attention', 'takeaways'];

/** The group report from a cohort's run summaries (D75, D77). See the rules above. */
export function buildGroupReport({ runs, names, benchmark: bench = null, cohort }: GroupReportInput): GroupReport {
  const c = cohort.storyline, r = c.report, lens = cohort.lens ?? c.lens;
  const settings = r.group;
  const P: GroupCopy = settings.copy ?? DEFAULT_GROUP_COPY;
  const purpose = cohort.purpose;
  const unit = c.time.period.unit;
  const scale = r.scale;
  const g = summarizeBenchmark(runs, { completeAt: settings.completeAt });
  // A benchmark of another storyline compares nothing; one of another lens compares everything but the styles.
  const b = bench && bench.storyline.id === c.id && bench.completed > 0 ? bench : null;
  const sameLens = !!b && b.lens.id === lens.id;
  const n = runs.length, completed = g.completed;
  const minimum = purpose === 'development' ? settings.minimumCohort : 1;
  const withheld = completed < minimum ? { minimum, message: fill(P.withheld, { n, completed, min: minimum }) } : null;
  const showCompletion = n >= minimum && n > 0;
  const shown = !withheld;
  const styleName = (k: string) => lens.styles.find(s => s.key === k)?.name ?? k;
  const actionName = (k: string) => c.actions.find(a => a.key === k)?.name ?? k;
  const compare = (group: number | null, base: number | null | undefined, near: number, digits: (d: number) => number) => {
    if (group === null || base === null || base === undefined) return null;
    const d = digits(group - base);
    return Math.abs(d) < near ? P.compare.level : fill(d > 0 ? P.compare.above : P.compare.below, { diff: Math.abs(d) });
  };
  const rated = (score: number | null) => ({ score, outOf10: score === null ? null : r1(score / 10), level: score === null ? null : { index: levelOf(scale, score), name: scale[levelOf(scale, score)].name } });

  // ---- about
  const barWords = `an overall level of ${scale[r.assessment.bar.overall].name}, with no skill below ${scale[r.assessment.bar.floor].name}`;
  const about = {
    lines: P.about.map(l => fill(l, { unit, n })),
    howToRead: [...P.howToRead, ...(b ? [fill(P.benchmark, { n: b.participants })] : [])].map(l => fill(l, { unit, n, min: settings.minimumCohort })),
    confidentiality: fill(P.confidentiality[purpose], { min: settings.minimumCohort })
  };

  // ---- completion
  const completion = showCompletion ? { buckets: g.completion.buckets, average: g.completion.average, share: pct(completed, n), narrative: fill(P.completion, { completed, n, pct: Math.round(pct(completed, n)) }) } : null;

  // ---- skills, with the share of the group at each level
  const skills = shown ? {
    scale: scale.map(l => ({ name: l.name, min: l.min })),
    rows: g.skills.map(s => {
      const def = r.skills.find(x => x.key === s.key);
      const name = def?.name ?? s.key;
      const group = rated(s.score);
      const base = b?.skills.find(x => x.key === s.key);
      const benchmark = base ? rated(base.score) : null;
      return {
        key: s.key, name, description: def?.description ?? null, reportOnly: s.reportOnly,
        group: { ...group, rated: s.rated }, benchmark,
        narrative: fill(group.level ? byLevel(P.skill, group.level.index, scale.length) : P.skillNone, { skill: lower(name) }),
        compare: compare(group.outOf10, benchmark?.outOf10, 0.5, r1),
        distribution: scale.map((l, i) => ({ index: i, name: l.name, count: s.levels[i] ?? 0, share: pct(s.levels[i] ?? 0, completed) })),
        unrated: { count: s.unrated, share: pct(s.unrated, completed) }
      };
    }),
    prompts: P.prompts.skills
  } : null;

  // ---- business
  const o = g.objectives;
  // The best revenue is the group's own (one run's number, never stored in a benchmark).
  const bestRevenue = Math.max(0, ...runs.filter(x => x.completion >= settings.completeAt).map(x => x.objectives.revenue));
  const business = shown ? {
    target: c.money.target,
    best: { revenue: bestRevenue, share: pct(bestRevenue, c.money.target) },
    average: { revenue: o.revenue, conversions: o.conversions, share: o.share },
    benchmark: b ? { revenue: b.objectives.revenue, conversions: b.objectives.conversions, share: b.objectives.share } : null,
    beatTarget: { count: o.beatTarget, share: pct(o.beatTarget, completed), benchmark: b ? pct(b.objectives.beatTarget, b.completed) : null },
    team: (['skill', 'morale', 'result', 'trust'] as const).map(k => ({ key: k, group: o.team[k], benchmark: b ? b.objectives.team[k] : null })),
    narrative: fill(P.business[o.share < 60 ? 'below' : o.share < 100 ? 'near' : 'met'], { share: `${Math.round(o.share)}%` }),
    prompts: P.prompts.business
  } : null;

  // ---- styles: adaptability, preferred styles, proportion and accuracy per style
  const needsFor = (k: string) => {
    const fits = NEEDS.filter(need => fitOf(lens, k, need) === 0);
    return (fits.length ? fits : NEEDS.filter(need => fitOf(lens, k, need) === 1)).map(need => lower(lens.needs[need].label));
  };
  const prefShare = (k: string) => pct(g.styles.preferred[k] ?? 0, completed);
  const topShare = Math.max(0, ...lens.styles.map(s => g.styles.preferred[s.key] ?? 0));
  const preferredTop = topShare > 0 ? lens.styles.map(s => s.key).filter(k => (g.styles.preferred[k] ?? 0) === topShare) : [];
  const styles = shown ? {
    styles: lens.styles.map(s => ({ key: s.key, letter: s.letter, name: s.name, description: s.description })),
    adaptability: {
      group: g.styles.adaptability, benchmark: sameLens ? b!.styles.adaptability : null,
      narrative: fill(P.adaptability[band3(g.styles.adaptability, 40, 70)], { pct: Math.round(g.styles.adaptability) }),
      compare: compare(g.styles.adaptability, sameLens ? b!.styles.adaptability : null, 3, Math.round)
    },
    preferred: lens.styles.map(s => ({ key: s.key, share: prefShare(s.key), benchmark: sameLens ? pct(b!.styles.preferred[s.key] ?? 0, b!.completed) : null })),
    preferredTop,
    preferredNarrative: preferredTop.length ? fill(P.preferred, { styles: list(preferredTop.map(styleName), 'and'), pct: Math.round(prefShare(preferredTop[0])) }) : null,
    perStyle: g.styles.perStyle.map(s => {
      const vars = { style: styleName(s.key), needs: list(needsFor(s.key), 'or') };
      const base = sameLens ? b!.styles.perStyle.find(x => x.key === s.key) : undefined;
      const narrative = !s.count ? [fill(P.style.unused, vars)] : [
        fill(P.style[band3(s.accuracy ?? 0, 40, 70)], vars),
        ...(s.proportion < s.neededShare - 10 ? [fill(P.style.under, vars)] : s.proportion > s.neededShare + 10 ? [fill(P.style.over, vars)] : [])
      ];
      return { key: s.key, proportion: s.proportion, accuracy: s.accuracy, neededShare: s.neededShare, benchmark: base ? { proportion: base.proportion, accuracy: base.accuracy } : null, narrative };
    }),
    prompts: P.prompts.styles
  } : null;

  // ---- consistency
  const consistency = shown ? {
    actions: r.consistencyActions.map(actionName),
    deviations: (['neededUsed', 'intendedUsed', 'neededIntended'] as const).map(k => ({
      key: k, group: g.consistency[k], benchmark: sameLens ? b!.consistency[k] : null,
      narrative: g.consistency[k] === null ? null : P.consistency[k][band3(g.consistency[k]!, 25, 50)]
    }))
  } : null;

  // ---- the funnel: the last stage (conversions), ideal against actual, period by period
  const lastStage = c.stages.at(-1)!;
  const lastOf = (p: BenchmarkSummary['funnel'][number] | undefined) => p?.stages.find(s => s.stage === lastStage.key) ?? p?.stages.at(-1);
  const funnelPeriods = g.funnel.map(p => ({ period: p.period, actual: lastOf(p)?.actual ?? 0, ideal: lastOf(p)?.ideal ?? 0, benchmark: b ? lastOf(b.funnel.find(x => x.period === p.period))?.actual ?? null : null }));
  const actualSum = funnelPeriods.reduce((a, p) => a + p.actual, 0), idealSum = funnelPeriods.reduce((a, p) => a + p.ideal, 0);
  const funnel = shown ? {
    stage: lastStage.name, periods: funnelPeriods,
    narrative: funnelPeriods.length ? fill(P.funnel, { count: funnelPeriods.length, unit, actual: r1(actualSum), ideal: r1(idealSum), pct: Math.round(pct(actualSum, idealSum)) }) : null,
    prompts: P.prompts.funnel
  } : null;

  // ---- actions: frequency and impact across the group
  const actionRows = g.actions.map(a => ({
    key: a.key, name: actionName(a.key), frequency: a.frequency, used: pct(a.used, completed), mean: a.mean,
    impact: a.used ? impactBand(a.mean, r.impact) : 'none' as const,
    benchmark: b?.actions.find(x => x.key === a.key)?.frequency ?? null
  }));
  const most = [...actionRows].sort((x, y) => y.frequency - x.frequency)[0];
  const best = [...actionRows].filter(a => a.mean !== null && a.used > 0).sort((x, y) => y.mean! - x.mean!)[0];
  const actions = shown ? {
    rows: actionRows,
    narrative: most && most.frequency > 0 && best ? fill(P.actions, { action: most.name, best: best.name }) : null,
    prompts: P.prompts.actions
  } : null;

  // ---- management style: time with top, average and bottom performers
  const att = g.attention;
  const attKey = att ? (Math.max(att.top, att.average, att.bottom) - Math.min(att.top, att.average, att.bottom) < 10 ? 'even' : (['top', 'average', 'bottom'] as const).reduce((k, x) => (att[x] > att[k] ? x : k), 'top' as 'top' | 'average' | 'bottom')) : null;
  const attention = shown ? { group: att, benchmark: b?.attention ?? null, narrative: attKey ? P.attention[attKey] : null, prompts: P.prompts.attention } : null;

  // ---- assessment: verdicts and the participant table, by name
  const labels = r.assessment.labels;
  const label = (k: VerdictKey | 'none') => (k === 'none' ? labels.insufficient : labels[k]);
  const assessed = runs.map((run, i) => ({ run, name: names?.[i] ?? `Participant ${i + 1}` }));
  const verdictCounts = g.verdicts?.counts ?? {};
  const assessment = purpose === 'assessment' ? {
    bar: barWords,
    narrative: fill(P.verdicts, { met: (verdictCounts.exceeds ?? 0) + (verdictCounts.meets ?? 0), total: n }),
    verdicts: VERDICTS.map(k => ({ key: k, label: label(k), count: verdictCounts[k] ?? 0, share: pct(verdictCounts[k] ?? 0, n), benchmark: b?.verdicts ? pct(b.verdicts.counts[k] ?? 0, b.verdicts.assessed) : null })),
    participants: assessed.sort((x, y) => x.name.localeCompare(y.name, 'en') || runs.indexOf(x.run) - runs.indexOf(y.run)).map(({ run, name }) => {
      const key = run.verdict?.overall ?? null;
      const rv = run.review ?? { conversations: 0, reviewed: 0 };
      return {
        name, completion: run.completion, level: run.overall.level === null ? null : scale[run.overall.level]?.name ?? null,
        verdict: key, label: run.verdict ? label(key ?? 'none') : null,
        review: rv.conversations && rv.reviewed === rv.conversations ? 'assessor' as const : rv.reviewed ? 'mixed' as const : 'ai' as const
      };
    })
  } : null;

  const takeaways = shown ? P.takeaways : [];
  const present: Record<GroupSection, boolean> = {
    about: true, verdicts: !!assessment, skills: !!skills, distribution: !!skills, completion: !!completion, business: !!business, adaptability: !!styles,
    styles: !!styles, consistency: !!consistency, funnel: !!funnel, actions: !!actions, attention: !!attention, takeaways: takeaways.length > 0
  };
  return {
    version: 1,
    cohort: { name: cohort.name, date: cohort.date, purpose, storyline: { id: c.id, name: c.name, organisation: c.organisation ?? null }, lens: { id: lens.id, title: lens.title } },
    participants: n, completed, periodUnit: unit,
    sections: (purpose === 'assessment' ? ASSESSMENT_SECTIONS : DEVELOPMENT_SECTIONS).filter(s => present[s]),
    withheld,
    benchmark: b ? { participants: b.participants } : null,
    about, completion, skills, business, styles, consistency, funnel, actions, attention, takeaways, assessment
  };
}
