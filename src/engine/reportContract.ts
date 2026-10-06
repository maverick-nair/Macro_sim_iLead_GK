import { z } from 'zod';
import { LensView, MetricKey, NeedKey, PeriodUnit, StyleKey, Text } from './contract';

/**
 * The report's part of the engine contract (D64, D75, D76): the report the engine sends once the run has
 * ended, and the run summary (`RunSummary`) that the server stores per attempt and the group report
 * aggregates. It lives beside `contract.ts` rather than in it so the participant's first load does not
 * carry it: the end screen, the report and the group report parse with it, all loaded on demand. The
 * engine view carries the report unparsed (`EngineView.report`); `parseReport` applies the copy rules.
 */

const Id = z.string().min(1);
const Num = z.number().finite();
const Int = z.number().int();
const Pct = Num.min(0).max(100);
const Quote = z.object({ text: Text, when: Text });
const Level = z.object({ index: Int.min(0), name: Text });
export const PURPOSES = ['development', 'assessment'] as const;
export const Purpose = z.enum(PURPOSES);
export const ImpactBand = z.enum(['none', 'veryLow', 'low', 'moderate', 'high']);
export const VerdictKey = z.enum(['exceeds', 'meets', 'approaching', 'below']);
export const SkillVerdictKey = z.enum(['strength', 'meets', 'development']);
export const ReviewStatus = z.enum(['assessor', 'mixed', 'ai']);
export const ReportSection = z.enum([
  'about', 'summary', 'skills', 'objectives', 'adaptability', 'styles', 'style', 'consistency', 'intent', 'actions', 'distribution',
  'moments', 'people', 'business', 'analytics', 'thought', 'takeaways', 'plan', 'progress', 'methodology'
]);
const Kpi = z.object({ start: Num, end: Num });

/**
 * One run, as numbers (src/engine/report/summary.ts, `summarizeRun`). Stable and serialisable: the server
 * keeps one per attempt (`getHistory`), and the group report aggregates them (`buildGroupReport`).
 */
export const RunSummary = z.object({
  version: z.literal(1),
  storyline: z.object({ id: Id, name: z.string() }),
  lens: z.object({ id: Id, styles: z.array(StyleKey).min(2).max(6) }),
  purpose: Purpose,
  seed: Int,
  completion: Pct,
  periods: z.object({ count: Int.min(1), completed: Int.min(0), unit: z.string() }),
  score: z.object({ total: Num, max: Num, tier: Id }),
  objectives: z.object({
    revenue: Num, target: Num, share: Num.min(0), conversions: Int.min(0), beatTarget: z.boolean(),
    team: z.object({ skill: Kpi, morale: Kpi, result: Kpi, trust: Kpi })
  }),
  funnel: z.array(z.object({ period: Int, stages: z.array(z.object({ stage: Id, actual: Num, ideal: Num })) })),
  skills: z.array(z.object({ key: Id, reportOnly: z.boolean(), observations: Int.min(0), score: Num.nullable(), outOf10: Num.min(0).max(10).nullable(), level: Int.min(0).nullable() })),
  overall: z.object({ score: Num.nullable(), level: Int.min(0).nullable() }),
  styles: z.object({
    total: Int.min(0), fitted: Int.min(0), adaptability: Pct, preferred: z.array(StyleKey),
    perStyle: z.array(z.object({ key: StyleKey, count: Int.min(0), proportion: Pct, fitted: Int.min(0), accuracy: Pct.nullable(), needed: Int.min(0), neededShare: Pct })),
    grid: z.array(z.array(Int.min(0))).length(4)
  }),
  consistency: z.object({
    actions: z.array(Id),
    members: z.array(z.object({ memberId: Id, needed: NeedKey.nullable(), desired: StyleKey.nullable(), intended: StyleKey.nullable(), used: StyleKey.nullable() })),
    deviations: z.object({ neededUsed: Pct.nullable(), intendedUsed: Pct.nullable(), neededIntended: Pct.nullable() }),
    counts: z.object({ uses: Int.min(0), usesWithIntent: Int.min(0), settings: Int.min(0) })
  }),
  actions: z.array(z.object({ key: Id, frequency: Int.min(0), reached: Int.min(0), mean: Num.nullable(), impact: ImpactBand })),
  distribution: z.object({
    actions: z.array(Id),
    members: z.array(z.object({ memberId: Id, name: z.string(), left: z.boolean(), total: Num, impact: ImpactBand, cells: z.array(z.object({ count: Int.min(0), mean: Num.nullable(), impact: ImpactBand })) })),
    totals: z.array(Int.min(0))
  }),
  attention: z.object({
    top: Pct.nullable(), average: Pct.nullable(), bottom: Pct.nullable(),
    periods: z.array(z.object({ period: Int, actions: Int.min(0), top: Pct.nullable(), average: Pct.nullable(), bottom: Pct.nullable() }))
  }),
  verdict: z.object({ overall: VerdictKey.nullable(), skills: z.record(Id, SkillVerdictKey.nullable()) }).nullable()
});

const Evidence = { recordIds: z.array(Id), quotes: z.array(Quote), review: ReviewStatus, reviewed: Int.min(0), total: Int.min(0) };

/**
 * Report 2.0 and 3.0 (scoring-and-report.md 5 and 7; D75), sent once the run has ended. Every element
 * traces to the run or to authored copy; sentences are server content (D60).
 */
export const ReportView = z.object({
  available: z.boolean(),
  purpose: Purpose,
  storyline: z.object({ name: Text, organisation: Text.nullable() }),
  /** The lens, and the secondary lens whose skills are report only. */
  lens: LensView.extend({ secondary: z.object({ id: Id, title: Text }).nullable() }),
  periods: Int, periodUnit: PeriodUnit,
  /** In the order shown. */
  sections: z.array(ReportSection),
  score: z.object({ total: Num, max: Num, tier: z.object({ key: Id, name: Text }) }),
  results: z.object({ revenue: Num, target: Num, share: Num, conversions: Int, kpis: z.array(z.object({ metric: MetricKey, start: Num, end: Num, series: z.array(Num) })) }),
  summary: z.object({ level: Level.nullable(), strengths: z.array(Id), priorities: z.array(Id), business: Text, narrative: Text.nullable() }),
  style: z.object({
    shares: z.record(StyleKey, Int), total: Int, dominant: z.array(StyleKey), capability: Num,
    /** Rows: the four needs, in `lens.needs` order; columns: the style used, in `lens.styles` order. */
    grid: z.array(z.array(Int)),
    /** The lens's style difference per grid cell (0 fits), so the report can outline what fit. */
    fit: z.array(z.array(Int.min(0).max(2))), matched: Int, weeklyTotal: Int,
    weeks: z.array(z.object({ memberId: Id, name: Text, left: z.boolean(), cells: z.array(z.object({ period: Int, chosen: StyleKey, fit: Int.min(0).max(2) }).nullable()) })),
    narrative: z.array(Text)
  }),
  intent: z.array(z.object({ memberId: Id, name: Text, intent: z.array(StyleKey), shown: z.array(StyleKey), status: z.enum(['aligned', 'gap', 'noEvidence']), quote: Quote.nullable(), note: z.object({ text: Text, period: Int }).nullable(), trustCost: Num })),
  /**
   * `reportOnly`: a secondary lens's skill, never in the score, badges or summary (D70). `outOf10` is the
   * skill score on the 1.0 report's scale of 10; `description` what the skill means; `narrative` the
   * purpose's line for the level.
   */
  skills: z.array(z.object({
    key: Id, name: Text, reportOnly: z.boolean(), observations: Int, score: Num.nullable(), capped: z.boolean(), level: Level.nullable(), anchor: Text.nullable(), quotes: z.array(Quote),
    outOf10: Num.nullable(), description: Text.nullable(), narrative: Text
  })),
  scale: z.array(z.object({ name: Text, min: Num })),
  moments: z.array(z.object({ id: Id, kind: z.enum(['best', 'revisit']), period: Int, memberId: Id.nullable(), title: Text, situation: Text, behaviour: Text, quote: Text.nullable(), impact: Text, intent: StyleKey.nullable() })),
  people: z.array(z.object({ memberId: Id, name: Text, img: z.string().nullable(), left: z.boolean(), start: z.object({ morale: Num, trust: Num, result: Num }),
    series: z.array(z.object({ period: Int, morale: Num, trust: Num, result: Num })), actions: Int, days: Num, resultChange: Num })),
  business: z.object({ revenue: z.array(z.object({ period: Int, value: Num, pace: Num })), funnel: z.array(z.object({ stage: Id, name: Text, cumulative: Num, cumulativeIdeal: Num })),
    bottleneck: z.object({ stage: Id, name: Text, periods: Int, why: Text.nullable() }).nullable(), conversions: Int }),
  analytics: z.object({ conversations: Int, talkRatio: Num.nullable(), openQuestions: Int, recognition: Int, spoken: Int }),
  plan: z.array(z.object({ skill: Id, name: Text, enoughEvidence: z.boolean(), practice: Text, onTheJob: Text })), checkInDays: Int,
  reflection: z.object({ answers: z.array(z.string()), rating: Int.nullable() }).nullable(), questions: z.array(Text),
  methodology: z.object({ lines: z.array(Text), reviewed: z.boolean(), reviewedCount: Int.default(0), conversations: Int, observations: Int }),
  badges: Int, gamificationTiers: z.array(z.object({ key: Id, name: Text, min: Num })),

  // ---- Report 3.0 (D75, D76)
  /** Every number behind the 3.0 sections. */
  run: RunSummary,
  about: z.object({ lines: z.array(Text), howToRead: z.array(Text), confidentiality: Text }),
  /** Assessment only: the verdicts, each with the conversations it rests on and whether an assessor reviewed them. */
  verdict: z.object({
    overall: z.object({ key: VerdictKey.nullable(), label: Text, bar: Text, ...Evidence }),
    skills: z.array(z.object({ key: Id, verdict: SkillVerdictKey.nullable(), label: Text.nullable(), ...Evidence }))
  }).nullable(),
  objectives: z.object({ narrative: Text }),
  adaptability: z.object({ narrative: Text }),
  styleSummary: z.object({ perStyle: z.array(z.object({ key: StyleKey, narrative: z.array(Text) })), preferred: Text.nullable() }),
  consistency: z.object({ narrative: z.object({ neededUsed: Text.nullable(), intendedUsed: Text.nullable(), neededIntended: Text.nullable() }) }),
  actionSummary: z.array(z.object({ key: Id, name: Text, description: Text.nullable(), narrative: Text })),
  thought: z.array(z.object({ question: Text, guide: Text })),
  takeaways: z.array(Text),
  /** Development: the 30, 60 and 90 day path, and the check ins in days from the report date. */
  path: z.object({ day30: Text, day60: Text, day90: Text }).nullable(),
  checkIns: z.array(Int.min(1)),
  /** Assessment: the development needs, worded neutrally against the bar. */
  needs: z.array(z.object({ key: Id, name: Text, level: Text.nullable(), bar: Text, anchor: Text.nullable() }))
});

/**
 * An earlier attempt, for the report's progress section (`getHistory`, proposed `GET /history`): its run
 * summary and the report's headline (overall level, or the verdict in assessment), with when it ended.
 */
export const HistoryEntry = z.object({ attempt: Int.min(1), endedAt: z.string(), headline: Text, summary: RunSummary });
export const History = z.array(HistoryEntry);

export type RunSummaryView = z.output<typeof RunSummary>;
export type ReportView = z.output<typeof ReportView>;
export type ReportViewInput = z.input<typeof ReportView>;
export type HistoryEntry = z.output<typeof HistoryEntry>;

/** Parses the report the engine sent, applying the copy rules. Throws on a payload that breaks the contract. */
export function parseReport(raw: unknown): ReportView {
  return ReportView.parse(raw);
}
