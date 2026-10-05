import type { ReactNode } from 'react';
import type { PeriodUnit } from '../action/days';

export type { PeriodUnit };
export type StyleKey = 'D' | 'G' | 'P' | 'E';
export const STYLE_KEYS: readonly StyleKey[] = ['D', 'G', 'P', 'E'];
export type Tone = 'gain' | 'attention' | 'neutral';

/** A verbatim quote and where it was said ("Week 2, 1:1 with Kent"). */
export interface ReportQuote {
  text: string;
  when: string;
}

/** One block of the report: a section, or the header. Pages and web cards are made of blocks. */
export interface ReportBlock {
  key: string;
  node: ReactNode;
  /** Web view: this block starts a new card. */
  card?: boolean;
  /** Print view: this block starts a new page. */
  pageBreak?: boolean;
}

export interface ReportHeaderData {
  /** The participant's name, the page's h1. */
  name: string;
  /** "Northwind Sales Leaders · October 2026 · 98 minutes of play". */
  line: string;
  /** Tier name, once the run has ended. */
  tier: string | null;
  /** Leadership Score, formatted. */
  score: string;
}

/** One small multiple: a series over the run, with an optional dashed target. */
export interface TeamSeries {
  key: string;
  label: string;
  /** The last value, formatted. */
  end: string;
  values: number[];
  target: number[] | null;
  /** Vertical scale of the small multiple: [low, high]. */
  domain: [number, number];
  note: string;
  /** The chart's name for screen readers ("Team skill from 57 to 71"). */
  summary: string;
  /** Values as the table shows them, one per period. */
  cells: string[];
  targetCells: string[] | null;
}

export interface SkillRowData {
  key: string;
  name: string;
  /** Null: not enough evidence. */
  level: { index: number; name: string } | null;
  /** The first evidence quote, beside the bar as in the design. */
  quote: ReportQuote | null;
  /** Engine only: the anchor, observation count, Harmful cap and further quotes. */
  more?: { anchor: string | null; observations: number; capped: boolean; quotes: ReportQuote[] };
}

/** A week in the style fit heatmap: the style chosen and how it fit (0 matched, 1 one step off, 2 missed). */
export interface FitCell {
  style: StyleKey;
  fit: 0 | 1 | 2;
}

export interface FitRow {
  id: string;
  /** As shown in the row header. */
  name: string;
  /** For the cell's name ("Kent Goldberg, week 1: Directing, missed"). */
  fullName: string;
  left: boolean;
  /** One per period; null when the person was not on the team that period. */
  cells: Array<FitCell | null>;
}

/** Style flexibility and fit beyond the heatmap: engine only. */
export interface StyleExtras {
  shares: Record<StyleKey, number>;
  total: number;
  dominant: StyleKey[];
  capability: number;
  /** Rows: the style needed (D, G, P, E); columns: the style used. */
  grid: number[][];
  narrative: string[];
}

export interface IntentCardData {
  key: string;
  /** Engine only: who the card is about. The design's cards name people in the text. */
  name?: string;
  /** The participant's own reason from style setting. */
  said: string | null;
  did: string;
  verdict: string;
  tone: Tone;
  /** For a gap: the words that showed a different style. */
  quote?: ReportQuote | null;
  /** "Trust −4 from mixed signals". */
  cost?: string | null;
}

export interface PlanItemData {
  key: string;
  /** The design's one line step, or the authored practice activity. */
  text: string;
  /** Engine only: the skill, the on the job action and whether the skill had enough evidence. */
  skill?: string;
  onTheJob?: string;
  enoughEvidence?: boolean;
}

export interface MomentData {
  key: string;
  kind: 'best' | 'revisit';
  /** "Week 2". */
  when: string;
  title: string;
  situation: string;
  behaviour: string;
  quote: string | null;
  impact: string;
  /** The declared style for that person that period, as a name. */
  intent: string | null;
}

export interface PersonData {
  id: string;
  name: string;
  left: boolean;
  /** Start values, then one point per period. */
  points: Array<{ label: string; morale: number; trust: number; result: number }>;
  actions: number;
  days: string;
  resultChange: number;
}

export interface BusinessData {
  revenue: Array<{ label: string; value: number; pace: number }>;
  /** Money formatter for axis ticks and labels. */
  money: (n: number) => string;
  funnel: Array<{ key: string; name: string; value: number; ideal: number; bottleneck: boolean }>;
  bottleneck: { name: string; periods: number; why: string | null } | null;
  conversions: number;
  /** Revenue against target, formatted: the engine's business line. */
  line: string;
}

export interface AnalyticsData {
  conversations: number;
  talkRatio: number | null;
  openQuestions: number;
  recognition: number;
  spoken: number;
}

export interface MethodologyData {
  lines: string[];
  reviewed: boolean;
  /** Conversations an assessor reviewed (their bands replace the AI's). */
  reviewedCount?: number;
  conversations: number;
  observations: number;
}

export interface SummaryExtras {
  level: string | null;
  strengths: string[];
  priorities: string[];
  business: string;
}
