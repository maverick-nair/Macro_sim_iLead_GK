import { describe, expect, it } from 'vitest';
import { BenchmarkSummary, GroupReport } from '../groupContract';
import { parseStoryline, type StorylineConfig, type StorylineInput } from '../config';
import salesElevator from '../storylines/sales-elevator.json';
import { SIX_STYLES_LENS, withSixStyles } from '../storylines/sixStyles';
import { RunSummary as RunSummarySchema } from '../reportContract';
import { buildGroupReport, completionBucket, summarizeBenchmark } from './group';
import { DEFAULT_GROUP_COPY } from './groupDefaults';
import type { RunSummary } from './summary';
import cachedBenchmark from '../../api/samples/benchmark-readiness_based.json';

/** Group report (D77): every aggregate on small cohorts computed by hand. */

const config = (extra: Record<string, unknown> = {}, six = false): StorylineConfig => {
  const base = salesElevator as unknown as StorylineInput;
  const r = parseStoryline({ ...(six ? withSixStyles(base) : base), ...extra });
  if (!r.ok) throw new Error(r.issues.join('\n'));
  return r.config;
};
const SE = config();
const SKILLS = SE.report.skills.map(s => s.key);
const ACTIONS = SE.actions.map(a => a.key);

interface Opts {
  completion?: number; revenue?: number; conversions?: number; skill?: number | null; level?: number | null; adaptability?: number;
  preferred?: string[]; perStyle?: Record<string, [count: number, fitted: number, needed: number]>; total?: number;
  deviations?: [number | null, number | null, number | null]; funnel?: Array<[actual: number, ideal: number]>;
  coach?: [frequency: number, reached: number, mean: number | null]; attention?: [number, number, number] | null;
  team?: number; verdict?: 'exceeds' | 'meets' | 'approaching' | 'below' | null; purpose?: 'development' | 'assessment';
  review?: [number, number]; styles?: string[]; overallLevel?: number | null;
}

/** A run summary with the given numbers; everything else zero. Every skill gets the same score. */
function run(o: Opts = {}): RunSummary {
  const styles = o.styles ?? ['D', 'G', 'P', 'E'];
  const total = o.total ?? 10;
  const per = o.perStyle ?? {};
  const kpi = (end: number) => ({ start: 50, end });
  const team = o.team ?? 60;
  const purpose = o.purpose ?? 'development';
  return {
    version: 1, storyline: { id: SE.id, name: SE.name }, lens: { id: styles.length === 4 ? 'readiness_based' : 'six_styles', styles }, purpose, seed: 1,
    completion: o.completion ?? 100, periods: { count: 8, completed: 8, unit: 'week' }, score: { total: 500, max: 1000, tier: 'gold' },
    objectives: { revenue: o.revenue ?? 0, target: 240000, share: ((o.revenue ?? 0) / 240000) * 100, conversions: o.conversions ?? 0, beatTarget: (o.revenue ?? 0) >= 240000,
      team: { skill: kpi(team), morale: kpi(team), result: kpi(team), trust: kpi(team) } },
    funnel: (o.funnel ?? []).map(([actual, ideal], i) => ({ period: i + 1, stages: [{ stage: 'leads', actual: 1, ideal: 2 }, { stage: 'conversion', actual, ideal }] })),
    skills: SKILLS.map(key => ({ key, reportOnly: false, observations: 2, score: o.skill === undefined ? 50 : o.skill, outOf10: null, level: o.level === undefined ? 1 : o.level })),
    overall: { score: o.skill === undefined ? 50 : o.skill, level: o.overallLevel === undefined ? (o.level === undefined ? 1 : o.level) : o.overallLevel },
    styles: {
      total, fitted: 0, adaptability: o.adaptability ?? 50, preferred: o.preferred ?? [styles[0]],
      perStyle: styles.map(key => { const [count, fitted, needed] = per[key] ?? [0, 0, 0]; return { key, count, proportion: 0, fitted, accuracy: null, needed, neededShare: 0 }; }),
      grid: [[0], [0], [0], [0]]
    },
    consistency: { actions: [], members: [], deviations: { neededUsed: o.deviations?.[0] ?? null, intendedUsed: o.deviations?.[1] ?? null, neededIntended: o.deviations?.[2] ?? null }, counts: { uses: 0, usesWithIntent: 0, settings: 0 } },
    actions: ACTIONS.map(key => key === 'coach' && o.coach ? { key, frequency: o.coach[0], reached: o.coach[1], mean: o.coach[2], impact: 'none' as const } : { key, frequency: 0, reached: 0, mean: null, impact: 'none' as const }),
    distribution: { actions: [], members: [], totals: [] },
    attention: o.attention === null || !o.attention ? { top: null, average: null, bottom: null, periods: [] } : { top: o.attention[0], average: o.attention[1], bottom: o.attention[2], periods: [] },
    review: o.review ? { conversations: o.review[0], reviewed: o.review[1] } : undefined,
    verdict: purpose === 'assessment' ? { overall: o.verdict ?? null, skills: {} } : null
  };
}

describe('completion buckets', () => {
  it('splits at 50, 80 and 100', () => {
    expect([0, 50, 50.5, 79.9, 80, 99, 100].map(completionBucket)).toEqual(['upTo50', 'upTo50', 'to80', 'to80', 'to100', 'to100', 'full']);
  });
});

describe('summarizeBenchmark', () => {
  const runs = [
    run({ revenue: 240000, conversions: 8, skill: 80, level: 3, adaptability: 60, preferred: ['D'], perStyle: { D: [6, 3, 4], G: [4, 4, 2] }, total: 10, deviations: [20, null, 40], funnel: [[1, 2], [2, 2]], coach: [4, 2, 10], attention: [50, 25, 25], team: 70 }),
    run({ revenue: 120000, conversions: 4, skill: 40, level: 1, adaptability: 40, preferred: ['D', 'G'], perStyle: { D: [2, 0, 4], G: [8, 2, 4] }, total: 10, deviations: [40, 30, null], funnel: [[0, 2]], coach: [2, 2, -4], attention: null, team: 50 }),
    run({ revenue: 0, conversions: 0, skill: null, level: null, adaptability: 0, completion: 25, funnel: [[9, 9]] })
  ];
  const b = summarizeBenchmark(runs);

  it('counts every run in the completion rate and only completed runs in the averages', () => {
    expect(b.participants).toBe(3);
    expect(b.completed).toBe(2);
    expect(b.completion.average).toBe(75);
    expect(b.completion.buckets).toEqual([{ key: 'upTo50', count: 1, share: 33.33 }, { key: 'to80', count: 0, share: 0 }, { key: 'to100', count: 0, share: 0 }, { key: 'full', count: 2, share: 66.67 }]);
  });

  it('averages skills over the runs that rated them, with the runs at each level', () => {
    const s = b.skills[0];
    expect(s).toEqual({ key: SKILLS[0], reportOnly: false, rated: 2, score: 60, levels: [0, 1, 0, 1], unrated: 0 });
    expect(b.overall).toMatchObject({ rated: 2, score: 60, unrated: 0 });
  });

  it('averages objectives and the team, and counts who beat the target', () => {
    expect(b.objectives).toMatchObject({ revenue: 180000, conversions: 6, share: 75, beatTarget: 1 });
    expect(b.objectives.team.skill).toEqual({ start: 50, end: 60 });
  });

  it('pools proportion and accuracy, splits a tied preference, averages adaptability and deviations', () => {
    expect(b.styles.adaptability).toBe(50);
    expect(b.styles.preferred).toEqual({ D: 1.5, G: 0.5, P: 0, E: 0 });
    // D: 8 of 20 choices, 3 of 8 fit, needed 8 of 20. G: 12 of 20, 6 of 12 fit.
    expect(b.styles.perStyle[0]).toEqual({ key: 'D', count: 8, fitted: 3, needed: 8, proportion: 40, accuracy: 37.5, neededShare: 40 });
    expect(b.styles.perStyle[1]).toMatchObject({ key: 'G', proportion: 60, accuracy: 50, neededShare: 30 });
    expect(b.styles.perStyle[2]).toMatchObject({ key: 'P', count: 0, accuracy: null });
    expect(b.consistency).toEqual({ neededUsed: 30, intendedUsed: 30, neededIntended: 40 });
  });

  it('averages the funnel over the runs that reached each period', () => {
    expect(b.funnel).toEqual([
      { period: 1, runs: 2, stages: [{ stage: 'leads', actual: 1, ideal: 2 }, { stage: 'conversion', actual: 0.5, ideal: 2 }] },
      { period: 2, runs: 1, stages: [{ stage: 'leads', actual: 1, ideal: 2 }, { stage: 'conversion', actual: 2, ideal: 2 }] }
    ]);
  });

  it('pools the mean change per person reached, and averages time spent over runs with one to one actions', () => {
    // (10 × 2 − 4 × 2) / 4 = 3; frequency (4 + 2) / 2.
    expect(b.actions.find(a => a.key === 'coach')).toEqual({ key: 'coach', frequency: 3, used: 2, reached: 4, mean: 3 });
    expect(b.actions.find(a => a.key === 'email')).toEqual({ key: 'email', frequency: 0, used: 0, reached: 0, mean: null });
    expect(b.attention).toEqual({ top: 50, average: 25, bottom: 25 });
  });

  it('keeps no individual: no seeds, names or single runs, and parses with its schema', () => {
    expect(() => BenchmarkSummary.parse(b)).not.toThrow();
    const json = JSON.stringify(b);
    for (const k of ['seed', 'memberId', 'name":"Kent', 'best']) expect(json).not.toContain(k);
    expect(b.verdicts).toBeNull();
  });

  it('counts verdicts over assessment runs, finished or not', () => {
    const v = summarizeBenchmark([run({ purpose: 'assessment', verdict: 'meets' }), run({ purpose: 'assessment', verdict: null, completion: 40 }), run()]);
    expect(v.verdicts).toEqual({ assessed: 2, counts: { exceeds: 0, meets: 1, approaching: 0, below: 0, none: 1 } });
  });

  it('reads a lower completion bar when asked', () => {
    expect(summarizeBenchmark(runs, { completeAt: 20 }).completed).toBe(3);
  });

  it('the cached mock benchmark parses: 300 runs, no individuals', () => {
    const cached = BenchmarkSummary.parse(cachedBenchmark);
    expect(cached.participants).toBe(300);
    expect(cached.lens.id).toBe('readiness_based');
  });
});

const cohort = (purpose: 'development' | 'assessment', c = SE) => ({ name: 'Test cohort', date: '2026-10-05', purpose, storyline: c });
const five = () => [
  run({ revenue: 240000, conversions: 8, skill: 80, level: 3, adaptability: 80, preferred: ['G'], perStyle: { D: [5, 4, 5], G: [5, 5, 5] }, deviations: [10, 10, 10], funnel: [[1, 1]], coach: [3, 3, 12], attention: [20, 30, 50] }),
  run({ revenue: 200000, conversions: 6, skill: 60, level: 2, adaptability: 70, preferred: ['G'], perStyle: { D: [5, 4, 5], G: [5, 5, 5] }, deviations: [10, 10, 10], funnel: [[1, 1]], coach: [3, 3, 12], attention: [20, 30, 50] }),
  run({ revenue: 160000, conversions: 4, skill: 60, level: 2, adaptability: 70, preferred: ['D'], perStyle: { D: [5, 4, 5], G: [5, 5, 5] }, deviations: [10, 10, 10], funnel: [[0.5, 1]], coach: [3, 3, 12], attention: [20, 30, 50] }),
  run({ revenue: 160000, conversions: 4, skill: 40, level: 1, adaptability: 70, preferred: ['G'], perStyle: { D: [5, 4, 5], G: [5, 5, 5] }, deviations: [10, 10, 10], funnel: [[0.5, 1]], coach: [3, 3, 12], attention: [20, 30, 50] }),
  run({ revenue: 140000, conversions: 3, skill: null, level: null, adaptability: 60, preferred: ['G'], perStyle: { D: [5, 4, 5], G: [5, 5, 5] }, deviations: [10, 10, 10], funnel: [[0.5, 1]], coach: [3, 3, 12], attention: [20, 30, 50] })
];

describe('buildGroupReport, development', () => {
  const names = ['Ada Lovelace', 'Ben Okafor', 'Chen Wei', 'Dana Kowalski', 'Elif Demir'];
  const g = buildGroupReport({ runs: five(), names, cohort: cohort('development') });

  it('parses with its schema, in the development order, with no verdicts and no names', () => {
    expect(() => GroupReport.parse(g)).not.toThrow();
    expect(g.sections).toEqual(['about', 'skills', 'distribution', 'completion', 'business', 'adaptability', 'styles', 'consistency', 'funnel', 'actions', 'attention', 'takeaways']);
    expect(g.assessment).toBeNull();
    expect(g.withheld).toBeNull();
    const json = JSON.stringify(g);
    for (const n of names) expect(json).not.toContain(n);
    expect(json).not.toMatch(/the bar|verdict/i);
  });

  it('skills: the mean of rated runs out of 10 with its level, its narrative, and the share at each level', () => {
    const s = g.skills!.rows[0];
    expect(s.group).toEqual({ score: 60, outOf10: 6, level: { index: 2, name: 'Proficient' }, rated: 4 });
    expect(s.narrative).toBe(DEFAULT_GROUP_COPY.skill[2].replace('{skill}', 'situational flexibility'));
    expect(s.distribution.map(d => d.share)).toEqual([0, 20, 40, 20, 0]);
    expect(s.unrated).toEqual({ count: 1, share: 20 });
    expect(s.benchmark).toBeNull();
    expect(s.compare).toBeNull();
  });

  it('business: best, averages, who beat the target, the team, and the narrative band', () => {
    const b = g.business!;
    expect(b.best).toEqual({ revenue: 240000, share: 100 });
    expect(b.average).toEqual({ revenue: 180000, conversions: 5, share: 75 });
    expect(b.beatTarget).toEqual({ count: 1, share: 20, benchmark: null });
    expect(b.narrative).toBe('On average the group came close, at 75% of the target. The gap is usually a few people in one stage of the funnel.');
  });

  it('styles: adaptability, preferred share by participant, narratives by accuracy and need', () => {
    const s = g.styles!;
    expect(s.adaptability.group).toBe(70);
    expect(s.adaptability.narrative).toContain('On average 70%');
    expect(s.preferred.map(p => p.share)).toEqual([20, 80, 0, 0]);
    expect(s.preferredTop).toEqual(['G']);
    expect(s.preferredNarrative).toBe('Guiding was the style the group preferred: the most used style for 80% of participants.');
    expect(s.perStyle[0]).toMatchObject({ key: 'D', proportion: 50, accuracy: 80, neededShare: 50 });
    expect(s.perStyle[0].narrative).toEqual(['When the group used Directing, it mostly fit what people needed.']);
    expect(s.perStyle[2].narrative).toEqual(['The group did not use Partnering. It suits people who are capable but cautious.']);
  });

  it('consistency, funnel, actions and time spent', () => {
    expect(g.consistency!.deviations.map(d => d.group)).toEqual([10, 10, 10]);
    expect(g.consistency!.deviations[0].narrative).toBe(DEFAULT_GROUP_COPY.consistency.neededUsed.low);
    expect(g.consistency!.actions).toEqual(['Meet the team', 'Meet face to face', 'Set goals', 'Coach member', 'Give feedback']);
    expect(g.funnel!.periods).toEqual([{ period: 1, actual: 0.7, ideal: 1, benchmark: null }]);
    expect(g.funnel!.narrative).toBe('Over 1 weeks the group averaged 0.7 conversions against an ideal of 1: 70% of what was possible.');
    const coach = g.actions!.rows.find(r => r.key === 'coach')!;
    expect(coach).toMatchObject({ frequency: 3, used: 100, mean: 12, impact: 'high' });
    expect(g.actions!.narrative).toBe('The action the group used most, Coach member, was also the one that did the most for the people it reached.');
    expect(g.attention!.group).toEqual({ top: 20, average: 30, bottom: 50 });
    expect(g.attention!.narrative).toBe(DEFAULT_GROUP_COPY.attention.bottom);
    expect(g.takeaways.map(t => t.key)).toEqual(['skills', 'leadership', 'results', 'styles', 'actions', 'attention']);
  });

  it('compares with a benchmark of the same storyline and lens', () => {
    const bench = summarizeBenchmark([run({ skill: 50, level: 1, adaptability: 60, revenue: 120000, perStyle: { D: [2, 1, 2] } }), run({ skill: 50, level: 1, adaptability: 60, revenue: 240000 })]);
    const h = buildGroupReport({ runs: five(), benchmark: bench, cohort: cohort('development') });
    expect(h.benchmark).toEqual({ participants: 2 });
    expect(h.skills!.rows[0].benchmark).toEqual({ score: 50, outOf10: 5, level: { index: 1, name: 'Developing' } });
    expect(h.skills!.rows[0].compare).toBe('The group is 1 point above the benchmark.');
    expect(h.styles!.adaptability).toMatchObject({ benchmark: 60, compare: 'The group is 10 points above the benchmark.' });
    expect(h.business!.benchmark).toEqual({ revenue: 180000, conversions: 0, share: 75 });
    expect(h.business!.beatTarget.benchmark).toBe(50);
    expect(h.styles!.perStyle[0].benchmark).toEqual({ proportion: 10, accuracy: 50 }); // 2 of the benchmark's 20 choices
    expect(h.about.howToRead.at(-1)).toBe('Benchmark: the average of everyone who has played this simulation so far (2 participants).');
    // Another storyline's benchmark compares nothing.
    const other = buildGroupReport({ runs: five(), benchmark: { ...bench, storyline: { id: 'other', name: 'Other' } }, cohort: cohort('development') });
    expect(other.benchmark).toBeNull();
    expect(other.skills!.rows[0].benchmark).toBeNull();
  });

  it('is deterministic', () => {
    expect(buildGroupReport({ runs: five(), names, cohort: cohort('development') })).toEqual(g);
  });
});

describe('the minimum cohort (development privacy)', () => {
  it('withholds every aggregate below 5 participants who completed, keeping the completion rate when 5 or more played', () => {
    const runs = [...five().slice(0, 4), run({ completion: 30 })];
    const g = buildGroupReport({ runs, cohort: cohort('development') });
    expect(g.withheld).toEqual({ minimum: 5, message: 'Group results are withheld for now. 4 of 5 participants completed the simulation, and this report needs at least 5 to keep individual results private. The results appear once at least 5 participants have completed the simulation.' });
    expect(g.sections).toEqual(['about', 'completion']);
    expect(g.completion!.share).toBe(80);
    for (const k of ['skills', 'business', 'styles', 'consistency', 'funnel', 'actions', 'attention'] as const) expect(g[k]).toBeNull();
    expect(g.takeaways).toEqual([]);
  });

  it('withholds the completion rate too when fewer than 5 played', () => {
    const g = buildGroupReport({ runs: five().slice(0, 3), cohort: cohort('development') });
    expect(g.sections).toEqual(['about']);
    expect(g.completion).toBeNull();
    expect(g.participants).toBe(3);
  });

  it('follows the storyline\'s minimum', () => {
    const g = buildGroupReport({ runs: five().slice(0, 3), cohort: cohort('development', config({ report: { group: { minimumCohort: 3, completeAt: 100 } } })) });
    expect(g.withheld).toBeNull();
  });
});

describe('buildGroupReport, assessment', () => {
  const runs = [
    run({ purpose: 'assessment', verdict: 'meets', overallLevel: 2, review: [4, 4] }),
    run({ purpose: 'assessment', verdict: 'exceeds', overallLevel: 3, review: [4, 1] }),
    run({ purpose: 'assessment', verdict: 'below', overallLevel: 0, review: [4, 0] }),
    run({ purpose: 'assessment', verdict: null, overallLevel: null, completion: 50 })
  ];
  const g = buildGroupReport({ runs, names: ['Zoe Carter', 'Ada Lovelace', 'Ben Okafor', 'Chen Wei'], cohort: cohort('assessment') });

  it('adds the verdicts first and keeps every aggregate however small the cohort', () => {
    expect(() => GroupReport.parse(g)).not.toThrow();
    expect(g.sections.slice(0, 3)).toEqual(['about', 'verdicts', 'skills']);
    expect(g.withheld).toBeNull();
    expect(g.about.confidentiality).toBe(DEFAULT_GROUP_COPY.confidentiality.assessment);
  });

  it('counts verdicts with labels and the bar', () => {
    const a = g.assessment!;
    expect(a.bar).toBe('an overall level of Proficient, with no skill below Developing');
    expect(a.verdicts.map(v => [v.key, v.count, v.share])).toEqual([['exceeds', 1, 25], ['meets', 1, 25], ['approaching', 0, 0], ['below', 1, 25], ['none', 1, 25]]);
    expect(a.verdicts[4].label).toBe('Not enough evidence for a verdict');
    expect(a.narrative).toBe('2 of 4 participants met or exceeded the bar.');
  });

  it('lists participants by name, never by result, with level, verdict and review status', () => {
    expect(g.assessment!.participants).toEqual([
      { name: 'Ada Lovelace', completion: 100, level: 'Advanced', verdict: 'exceeds', label: 'Exceeds the bar', review: 'mixed' },
      { name: 'Ben Okafor', completion: 100, level: 'Novice', verdict: 'below', label: 'Below the bar', review: 'ai' },
      { name: 'Chen Wei', completion: 50, level: null, verdict: null, label: 'Not enough evidence for a verdict', review: 'ai' },
      { name: 'Zoe Carter', completion: 100, level: 'Proficient', verdict: 'meets', label: 'Meets the bar', review: 'assessor' }
    ]);
  });
});

describe('six style lens', () => {
  const six = config({}, true);
  const keys = SIX_STYLES_LENS.styles.map(s => s.key);
  const runs = Array.from({ length: 5 }, (_, i) => run({ styles: keys, preferred: [keys[i % 2 ? 5 : 1]], perStyle: { command: [4, 3, 4], coach: [6, 3, 2] }, total: 10 }));

  it('names six styles from the lens, with their narratives and needs', () => {
    const g = buildGroupReport({ runs, cohort: cohort('development', six) });
    expect(g.cohort.lens).toEqual({ id: 'six_styles', title: 'Six Leadership Styles' });
    expect(g.styles!.styles.map(s => s.name)).toEqual(['Vision Setter', 'Coach', 'Harmonizer', 'Collaborator', 'Pace Setter', 'Commander']);
    expect(g.styles!.preferred.map(p => p.share)).toEqual([0, 60, 0, 0, 0, 40]);
    expect(g.styles!.perStyle.find(s => s.key === 'command')!.narrative[0]).toBe('When the group used Commander, it mostly fit what people needed.');
    expect(g.styles!.perStyle.find(s => s.key === 'harmony')!.narrative[0]).toBe('The group did not use Harmonizer. It suits people who are capable but drained.');
  });

  it('a benchmark of another lens compares everything but the styles', () => {
    const bench = { ...summarizeBenchmark(five()), storyline: { id: six.id, name: six.name } };
    const g = buildGroupReport({ runs, benchmark: bench, cohort: cohort('development', six) });
    expect(g.skills!.rows[0].benchmark).not.toBeNull();
    expect(g.styles!.adaptability.benchmark).toBeNull();
    expect(g.styles!.preferred.every(p => p.benchmark === null)).toBe(true);
    expect(g.consistency!.deviations.every(d => d.benchmark === null)).toBe(true);
  });
});

describe('the group bank', () => {
  it('an author\'s bank replaces the defaults, through the copy rules', () => {
    const copy = { ...DEFAULT_GROUP_COPY, completion: 'Finished: {completed} of {n} — well done.' };
    const g = GroupReport.parse(buildGroupReport({ runs: five(), cohort: cohort('development', config({ report: { group: { minimumCohort: 5, completeAt: 100, copy } } })) }));
    expect(g.completion!.narrative).toBe('Finished: 5 of 5, well done.');
  });

  it('the default bank keeps the copy rules: no dashes, no emoji, never "competency"', () => {
    const text = JSON.stringify(DEFAULT_GROUP_COPY);
    expect(text).not.toMatch(/[-‐-―−]/);
    expect(text).not.toMatch(/competenc/i);
    expect(text).not.toMatch(/\p{Extended_Pictographic}/u);
  });
});

describe('run summaries', () => {
  it('fixtures here are valid run summaries', () => {
    expect(() => RunSummarySchema.parse(run({ purpose: 'assessment', verdict: 'meets', review: [2, 1] }))).not.toThrow();
  });
});
