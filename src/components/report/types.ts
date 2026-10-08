import type { ReactNode } from 'react';
import type { PeriodUnit } from '../action/days';

export type { PeriodUnit };
/** A lens style key (D70); names come with the report's lens. */
export type StyleKey = string;
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
  /** A secondary lens's skill (D70): tagged "Report only", never in the score. */
  reportOnly?: boolean;
  /** The first evidence quote, beside the bar as in the design. */
  quote: ReportQuote | null;
  /**
   * Engine only: the anchor, observation count, Harmful cap and further quotes; in report 3.0 also the
   * score out of 10, what the skill means, its narrative and, in assessment, its verdict.
   */
  more?: {
    anchor: string | null; observations: number; capped: boolean; quotes: ReportQuote[];
    outOf10?: string | null; description?: string | null; narrative?: string | null; verdict?: { label: string; tone: Tone; review: string } | null;
  };
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
  /** Rows: the four needs; columns: the style used, in the lens's order. */
  grid: number[][];
  /** The lens's style difference per grid cell: 0 fits. */
  fit: number[][];
  /** The lens's styles and needs, in the grid's order (D70). */
  styles: Array<{ key: StyleKey; letter: string; name: string }>;
  needs: Array<{ key: string; label: string; short: string }>;
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

/** One choice in "Decisions and consequences" (D137), worded for display. */
export interface DecisionData {
  key: string;
  /** "Week 2". */
  when: string;
  title: string;
  /** The option taken, or null when nothing applied. */
  option: string | null;
  by: 'you' | 'default';
  outcome: string | null;
  /** What it changed: people, then business variables and revenue, as display lines. */
  changes: string[];
  /** Later events it led to, with their week. */
  led: string[];
  /** The leadership it showed, in words. */
  read: string[];
}

/** One stakeholder in "Stakeholders" (D164), worded for display. */
export interface StakeholderData {
  key: string;
  name: string;
  /** "Chief Financial Officer, an executive". */
  role: string;
  /** "Steady to Good". */
  relationship: string;
  measures: Array<{ key: 'trust' | 'satisfaction'; name: string; start: number; end: number; direction: 'up' | 'down' | 'flat' }>;
  interactions: Array<{ key: string; when: string; title: string; how: string; outcome: string | null; changes: string[] }>;
  /** What moved the relationship most, a line each. */
  moves: string[];
}

/** A business variable over the run (D136): start and end, formatted. */
export interface BusinessVariableData { key: string; name: string; start: string; end: string; direction: 'up' | 'down' | 'flat'; better: boolean | null }

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
  /** Assessment only: the overall verdict, shown first (D75). */
  verdict?: VerdictData | null;
}

// ---------------------------------------------------------------- Report 3.0 (D75, D76)

/** Why the storyline runs: development reports carry no verdict words. */
export type Purpose = 'development' | 'assessment';
export type ImpactBand = 'none' | 'veryLow' | 'low' | 'moderate' | 'high';

/** An assessment verdict with what it rests on. */
export interface VerdictData {
  key: string | null;
  label: string;
  /** "The bar: an overall level of Proficient, with no skill below Developing." */
  bar: string;
  /** "Based on 23 conversations". */
  evidence: string;
  /** "AI only, not yet reviewed by an assessor". */
  review: string;
  /** "Records: r8, r16". */
  records: string;
  quotes: ReportQuote[];
  tone: Tone;
}

export interface AboutData {
  lines: string[];
  howToRead: string[];
  confidentiality: string;
}

export interface ObjectivesData {
  revenue: number;
  target: number;
  money: (n: number) => string;
  /** "112%". */
  share: string;
  conversions: number;
  team: Array<{ key: 'skill' | 'morale' | 'result'; label: string; start: number; end: number }>;
  narrative: string;
}

export interface AdaptabilityData {
  pct: number;
  narrative: string;
}

export interface StylesData {
  styles: Array<{ key: StyleKey; letter: string; name: string; count: number; proportion: number; accuracy: number | null; narrative: string[] }>;
  needs: StyleExtras['needs'];
  grid: number[][];
  fit: number[][];
  preferred: string | null;
}

export interface ConsistencyData {
  /** The actions compared, as names. */
  actions: string[];
  deviations: Array<{ key: 'neededUsed' | 'intendedUsed' | 'neededIntended'; value: number | null; narrative: string | null }>;
  members: Array<{ id: string; name: string; needed: string | null; intended: string | null; used: string | null }>;
}

export interface ActionRowData {
  key: string;
  name: string;
  description: string | null;
  narrative: string;
  frequency: number;
  impact: ImpactBand;
}

export interface DistributionData {
  actions: Array<{ key: string; name: string }>;
  members: Array<{ id: string; name: string; left: boolean; cells: Array<{ count: number; impact: ImpactBand }> }>;
  totals: number[];
}

export interface ThoughtData {
  items: Array<{ question: string; guide: string }>;
}

/** The plan's 3.0 parts: the 90 day path and check ins (development), or the development needs (assessment). */
export interface PlanExtras {
  path?: { day30: string; day60: string; day90: string } | null;
  checkIns?: string[];
  needs?: Array<{ key: string; name: string; text: string; anchor: string | null }>;
}

export interface ProgressData {
  attempts: Array<{ key: string; label: string; current: boolean; headline: string; score: number; adaptability: number; target: number; skills: Array<number | null> }>;
  skills: Array<{ key: string; name: string }>;
}
