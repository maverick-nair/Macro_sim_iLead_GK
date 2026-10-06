import { z } from 'zod';
import { MetricKey, StyleKey, Text } from './contract';
import { ImpactBand, Purpose, ReviewStatus, RunSummary, VerdictKey } from './reportContract';

/**
 * The group report's contract (D75, D77): the benchmark aggregate the server stores per storyline and
 * lens (`BenchmarkSummary`), and the group report (`GroupReport`) that `buildGroupReport` makes from a
 * cohort's run summaries. Loaded only by the group report and its API, never in the participant's first load.
 * Percentages are 0 to 100. Sentences are filled from the storyline's group bank (`report.group.copy`).
 */

const Id = z.string().min(1);
const Num = z.number().finite();
const Int = z.number().int();
const Pct = Num.min(0).max(100);
const Count = Int.min(0);

export const COMPLETION_BUCKETS = ['upTo50', 'to80', 'to100', 'full'] as const;
export const CompletionBucket = z.enum(COMPLETION_BUCKETS);
const Bucket = z.object({ key: CompletionBucket, count: Count, share: Pct });
const Kpi = z.object({ start: Num, end: Num });
const Team = z.object({ skill: Kpi, morale: Kpi, result: Kpi, trust: Kpi });
const Attention = z.object({ top: Pct, average: Pct, bottom: Pct });
const Deviations = z.object({ neededUsed: Pct.nullable(), intendedUsed: Pct.nullable(), neededIntended: Pct.nullable() });

/**
 * Averages and distributions of many runs, no individuals (`summarizeBenchmark`). The server stores one
 * per storyline and lens from everyone who has played it, and `buildGroupReport` uses the same function
 * for the group itself. `participants` counts every run; `completed` the runs the averages read.
 */
export const BenchmarkSummary = z.object({
  version: z.literal(1),
  storyline: z.object({ id: Id, name: z.string() }),
  lens: z.object({ id: Id, styles: z.array(StyleKey) }),
  participants: Count,
  completed: Count,
  completeAt: Pct,
  completion: z.object({ average: Pct, buckets: z.array(Bucket).length(4) }),
  /** Per skill: the mean score of the runs that rated it, and how many runs reached each level index (and none). */
  skills: z.array(z.object({ key: Id, reportOnly: z.boolean(), rated: Count, score: Num.nullable(), levels: z.array(Count), unrated: Count })),
  overall: z.object({ rated: Count, score: Num.nullable(), levels: z.array(Count), unrated: Count }),
  objectives: z.object({ target: Num, revenue: Num, conversions: Num, share: Num, beatTarget: Count, team: Team }),
  styles: z.object({
    adaptability: Pct,
    /** Runs whose most used style this was; a tie splits a run between its styles. */
    preferred: z.record(StyleKey, Num.min(0)),
    perStyle: z.array(z.object({ key: StyleKey, count: Count, fitted: Count, needed: Count, proportion: Pct, accuracy: Pct.nullable(), neededShare: Pct }))
  }),
  consistency: Deviations,
  /** Per period, the mean of each stage's throughput and its ideal, over the runs that reached it. */
  funnel: z.array(z.object({ period: Int, runs: Count, stages: z.array(z.object({ stage: Id, actual: Num, ideal: Num })) })),
  /** Per action: mean times taken per run, runs that used it, people reached, the mean net change per person reached. */
  actions: z.array(z.object({ key: Id, frequency: Num.min(0), used: Count, reached: Count, mean: Num.nullable() })),
  attention: Attention.nullable(),
  /** Assessment runs only: how many reached each overall verdict, and none. */
  verdicts: z.object({ assessed: Count, counts: z.record(z.string(), Count) }).nullable()
});

export const GROUP_SECTIONS = ['about', 'verdicts', 'skills', 'distribution', 'completion', 'business', 'adaptability', 'styles', 'consistency', 'funnel', 'actions', 'attention', 'takeaways'] as const;
export const GroupSection = z.enum(GROUP_SECTIONS);

const Level = z.object({ index: Int.min(0), name: Text });
const Rated = z.object({ score: Num.nullable(), outOf10: Num.nullable(), level: Level.nullable() });

/** The group report (`buildGroupReport`, proposed `GET /cohort/{id}/report`). Null sections are withheld or empty. */
export const GroupReport = z.object({
  version: z.literal(1),
  cohort: z.object({ name: Text, date: z.string(), purpose: Purpose, storyline: z.object({ id: Id, name: Text, organisation: Text.nullable() }), lens: z.object({ id: Id, title: Text }) }),
  /** Every participant in the cohort, and those who completed the run (the averages read only these). */
  participants: Count,
  completed: Count,
  periodUnit: z.string(),
  /** How the storyline formats money (src/engine/money.ts). */
  money: z.object({ currency: z.string().length(3), locale: z.string().min(2), display: z.enum(['symbol', 'narrowSymbol', 'code']) }),
  /** In the order shown, for the cohort's purpose. */
  sections: z.array(GroupSection),
  /** Development only: below the minimum cohort size the aggregates are withheld (privacy). */
  withheld: z.object({ minimum: Int.min(1), message: Text }).nullable(),
  benchmark: z.object({ participants: Count }).nullable(),
  about: z.object({ lines: z.array(Text), howToRead: z.array(Text), confidentiality: Text }),
  completion: z.object({ buckets: z.array(Bucket), average: Pct, share: Pct, narrative: Text }).nullable(),
  skills: z.object({
    scale: z.array(z.object({ name: Text, min: Num })),
    rows: z.array(z.object({
      key: Id, name: Text, description: Text.nullable(), reportOnly: z.boolean(),
      group: Rated.extend({ rated: Count }), benchmark: Rated.nullable(),
      narrative: Text, compare: Text.nullable(),
      /** The share of the group at each level, lowest first, and without enough evidence. */
      distribution: z.array(z.object({ index: Int.min(0), name: Text, count: Count, share: Pct })),
      unrated: z.object({ count: Count, share: Pct })
    })),
    prompts: z.array(Text)
  }).nullable(),
  business: z.object({
    target: Num,
    best: z.object({ revenue: Num, share: Num }),
    average: z.object({ revenue: Num, conversions: Num, share: Num }),
    benchmark: z.object({ revenue: Num, conversions: Num, share: Num }).nullable(),
    beatTarget: z.object({ count: Count, share: Pct, benchmark: Pct.nullable() }),
    team: z.array(z.object({ key: MetricKey, group: Kpi, benchmark: Kpi.nullable() })),
    narrative: Text, prompts: z.array(Text)
  }).nullable(),
  styles: z.object({
    styles: z.array(z.object({ key: StyleKey, letter: z.string(), name: Text, description: Text })),
    adaptability: z.object({ group: Pct, benchmark: Pct.nullable(), narrative: Text, compare: Text.nullable() }),
    preferred: z.array(z.object({ key: StyleKey, share: Pct, benchmark: Pct.nullable() })),
    preferredTop: z.array(StyleKey),
    preferredNarrative: Text.nullable(),
    perStyle: z.array(z.object({
      key: StyleKey, proportion: Pct, accuracy: Pct.nullable(), neededShare: Pct,
      benchmark: z.object({ proportion: Pct, accuracy: Pct.nullable() }).nullable(), narrative: z.array(Text)
    })),
    prompts: z.array(Text)
  }).nullable(),
  consistency: z.object({
    actions: z.array(Text),
    deviations: z.array(z.object({ key: z.enum(['neededUsed', 'intendedUsed', 'neededIntended']), group: Pct.nullable(), benchmark: Pct.nullable(), narrative: Text.nullable() }))
  }).nullable(),
  funnel: z.object({
    stage: Text, periods: z.array(z.object({ period: Int, actual: Num, ideal: Num, benchmark: Num.nullable() })),
    narrative: Text.nullable(), prompts: z.array(Text)
  }).nullable(),
  actions: z.object({
    rows: z.array(z.object({ key: Id, name: Text, frequency: Num.min(0), used: Pct, mean: Num.nullable(), impact: ImpactBand, benchmark: Num.nullable() })),
    narrative: Text.nullable(), prompts: z.array(Text)
  }).nullable(),
  attention: z.object({ group: Attention.nullable(), benchmark: Attention.nullable(), narrative: Text.nullable(), prompts: z.array(Text) }).nullable(),
  takeaways: z.array(z.object({ key: Id, title: Text, questions: z.array(Text) })),
  /** Assessment purpose only: the verdict distribution and the participant table (by name, never ranked). */
  assessment: z.object({
    bar: Text,
    narrative: Text,
    verdicts: z.array(z.object({ key: z.union([VerdictKey, z.literal('none')]), label: Text, count: Count, share: Pct, benchmark: Pct.nullable() })),
    participants: z.array(z.object({ name: Text, completion: Pct, level: Text.nullable(), verdict: VerdictKey.nullable(), label: Text.nullable(), review: ReviewStatus }))
  }).nullable()
});

/**
 * Proposed `POST /cohort/report`, for servers that store only run summaries: the cohort's summaries (with
 * each participant's name, for an assessment's table) and the cohort; the server answers a `GroupReport`.
 */
export const GroupReportRequest = z.object({
  cohort: z.object({ id: Id, name: z.string(), date: z.string(), purpose: Purpose }),
  runs: z.array(z.object({ name: z.string(), summary: RunSummary }))
});

export type BenchmarkSummary = z.output<typeof BenchmarkSummary>;
export type GroupReport = z.output<typeof GroupReport>;
export type GroupReportInput = z.input<typeof GroupReport>;
export type GroupSection = z.output<typeof GroupSection>;
export type CompletionBucket = z.output<typeof CompletionBucket>;

/** Parses a group report, applying the copy rules. Throws on a payload that breaks the contract. */
export function parseGroupReport(raw: unknown): GroupReport {
  return GroupReport.parse(raw);
}
