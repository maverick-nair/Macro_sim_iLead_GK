import type { PeriodUnit, SubPeriodUnit } from '../action/days';
import type { StarKind } from '../gamification/StarMeter';

export type { PeriodUnit, SubPeriodUnit };

/** The steps of the week end, in order (spec, Week end). Badge, unlock and news may be absent. */
export const WEEKEND_STEPS = ['banner', 'report', 'badge', 'unlock', 'news'] as const;
export type WeekEndStep = (typeof WEEKEND_STEPS)[number];
export const isWeekEndStep = (v: string | null | undefined): v is WeekEndStep => !!v && (WEEKEND_STEPS as readonly string[]).includes(v);

export type MetricKey = 'skill' | 'morale' | 'result' | 'trust';
export type SponsorLevel = 'low' | 'wavering' | 'steady' | 'confident' | 'champion';
export type FunnelView = 'period' | 'total';

/** One funnel stage: what came through and the ideal, for this period and, when known, the run so far. */
export interface WeekEndFunnelStage {
  key: string;
  name: string;
  value: number;
  ideal: number;
  /** The run so far. Absent in the design fixture, which shows this period only. */
  total?: { value: number; ideal: number };
}

export interface WeekEndFunnel {
  stages: WeekEndFunnelStage[];
  /** The bar length that fills the track, per view. */
  scale: number;
  totalScale?: number;
  /** Stage key of the bottleneck, or null. */
  bottleneck: string | null;
}

/** A star row: the design's three kinds (fixture), or a threshold with its own title (engine). */
export interface WeekEndStarRow {
  kind?: StarKind;
  title?: string;
  earned: boolean;
  detail: string;
}

export interface WeekEndReport {
  funnel: WeekEndFunnel;
  kpis: Array<{ metric: MetricKey; start: number; end: number }>;
  stars: WeekEndStarRow[];
  /** What made the period's score, one line each. Absent in the design fixture. */
  scoreParts?: string[];
  streak: { count: number; unit: PeriodUnit | 'day'; note: string };
  sponsor: { from: SponsorLevel; to: SponsorLevel; values?: { from: number; to: number } };
  pulse: {
    upbeat: number; steady: number; struggling: number;
    /** Struggling at the end of the last period, as the design words it. */
    lastStruggling?: number;
    /** Team Pulse value and change, from the engine. */
    value?: { from: number; to: number };
  };
  /** Sponsor confidence fell below the check in line: next period has a sub period less. */
  checkIn?: { sponsorName: string; line: number } | null;
  /**
   * The business this period (D135 to D137): each shown variable from start to end, formatted, and lines on the
   * choices made or left to their default and on anyone off sick or gone. Absent when the storyline has none.
   */
  business?: { rows: Array<{ key: string; name: string; start: string; end: string; dir: 'up' | 'down' | 'flat'; better: boolean | null }>; notes: string[] } | null;
}

export interface WeekEndBadge {
  key: string;
  /** The badge rule, which picks the icon. */
  rule: string;
  name: string;
  reason: string;
}

export interface WeekEndReward {
  key: string;
  name: string;
  description: string;
}

export interface WeekEndNews {
  key: string;
  card: 'impact' | 'signal' | 'capacity' | 'diagnostic' | 'opportunity' | 'crisis';
  title: string;
  body: string;
  impact: string | null;
}
