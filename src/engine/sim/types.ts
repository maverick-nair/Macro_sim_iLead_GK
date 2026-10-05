import type { StorylineConfig } from '../config';
import type { Mismatch, Style, Triple } from './rules';

export type MetricKey = 'skill' | 'morale' | 'result' | 'trust';
export type Band = 'strong' | 'adequate' | 'weak' | 'harmful';
export type Mood = 'happy' | 'neutral' | 'thinking' | 'concerned' | 'frustrated';

/** What the AI evaluator reports about one live interaction (docs/SIMULATION.md 5.1). */
export interface Evaluation {
  styleUsed: Style;
  confidence: number;
  band: Band;
  /** Verbatim quotes from the participant's words. */
  evidence: string[];
  flags: {
    openQuestions: number;
    acknowledged: boolean;
    invitedContribution: boolean;
    specificNextStep: boolean;
    concernSurfaced: boolean;
    abusive: boolean;
    promise?: { text: string; dueInSubPeriods: number; fulfilledBy: string[] };
  };
  /** Email only. */
  emailIntent?: 'congratulate' | 'warn' | 'neutral';
  usedVoice?: boolean;
  /** A band per rubric dimension, with the words it rests on (scoring-and-report.md 4). */
  dimensions: Array<{ key: string; band: Band; evidence: string[] }>;
  /** Behaviours that force Harmful: blame, discrimination, policy breach, abuse. */
  redFlags: string[];
  /** One band per skill this interaction rates: the skill observations (scoring-and-report.md 5.1). */
  skills?: Array<{ key: string; band: Band; evidence: string[] }>;
}

export interface EvidenceQuote { quote: string; by: string; judgedByAI: boolean }

/** Why a number moved. Every metric change carries one (brief, rule 5). */
export interface Reason { label: string; cause: string; rule: string; evidence: EvidenceQuote[] }

export interface Change {
  /** Member id, or 'team' / 'sponsor'. */
  subject: string;
  metric: MetricKey | 'confidence';
  from: number;
  to: number;
  delta: number;
  reason: Reason;
}

export interface PromiseRecord {
  id: string;
  memberId: string;
  text: string;
  dueAbsSub: number;
  fulfilledBy: string[];
  state: 'open' | 'kept' | 'broken';
}

export interface MemberSim {
  id: string;
  stage: string;
  skill: number;
  morale: number;
  result: number;
  trust: number;
  trustMovedThisSub: number;
  /** Largest net trust move per sub-period, from the trust rules. */
  trustCap: number;
  /** Style set for the current period, null until style setting. */
  style: Style | null;
  lastStyle: Style | null;
  lastReaction: 'pos' | 'neg' | null;
  /** Needed style at the start of the period (energize and training compare against it). */
  neededAtStart: Style;
  /** Sub-periods left away, and why. */
  away: number;
  awayReason: 'training' | 'leave' | null;
  /** Result at each completed sub-period, for trend rules. */
  resultHistory: number[];
  /** Result, morale and trust at each period end. */
  periodEnds: Array<{ result: number; morale: number; trust: number }>;
  stageSincePeriod: number;
  revealed: boolean;
  concernShared: boolean;
  lastChange: number;
  /** Absolute sub-period of the last congratulation or reward. */
  recognizedAt: number | null;
  reassignedInPeriod: number | null;
  trainedInPeriod: number | null;
  assessedStages: string[];
  /** Role fit found by Assess, per stage (SIMULATION 4.3). */
  assessments: Record<string, { skill: number; morale: number; result: number }>;
  /** Needed style at the start of the previous period, for the erratic style change rule. */
  neededPrevStart: Style | null;
  /** Absolute sub-period when `away` was set, so leave starting mid sub-period lasts its full length. */
  awaySetAt: number;
  /** Training request open in this period. */
  trainingRequestedPeriod: number | null;
  roleChangeRequestedPeriod: number | null;
  /** Lowest result seen. */
  lowestResult: number;
  /** Lowest morale seen, for the Turnaround badge. */
  lowestMorale: number;
}

export interface Turn {
  id: string;
  /** 'you', a member or candidate id, or 'sponsor'. */
  by: string;
  text: string;
  voice?: boolean;
  /** The participant spoke over the NPC; the text is what was shown. */
  interrupted?: boolean;
}

export interface Interaction {
  actionKey: string;
  optionKey: string | null;
  memberIds: string[];
  format: string;
  startedAt: number;
  replyTo?: string;
  turns: Turn[];
  hint: string | null;
  concernRevealed: boolean;
  /** The NPC signed off; the participant can only end it now. */
  closed: boolean;
  /** Interview: the candidates, and which one is in the room. */
  candidates?: string[];
  candidate?: number;
  /** A hire on the extra hire budget: one seat past a full stage. */
  budget?: boolean;
}

export interface InboxMessage {
  id: string;
  from: string;
  kind: 'chat' | 'email' | 'sponsor' | 'news';
  title: string;
  body: string;
  atAbsSub: number;
  dueAbsSub: number | null;
  urgent: boolean;
  state: 'open' | 'answered' | 'expired' | 'read';
  /** A scheduled sponsor briefing (Design doc: weeks 4 and 8). */
  briefing?: boolean;
}

export type SponsorLevel = 'low' | 'wavering' | 'steady' | 'confident' | 'champion';

export type CardKind = 'impact' | 'signal' | 'capacity' | 'diagnostic' | 'opportunity' | 'crisis';

export interface EventCard {
  id: string;
  key: string;
  card: CardKind;
  /** `modal` shows on the board; `sponsorCall` rings first. Chat, email and bulletin events make no card. */
  delivery: 'modal' | 'sponsorCall';
  title: string;
  body: string;
  memberId: string | null;
  changes: Change[];
  label: string | null;
  /** The message to answer, when the event expects a reply. */
  messageId: string | null;
}

/** An event waiting for its expected response (Configuration Spec, Expected response and Response window). */
export interface PendingResponse {
  eventKey: string;
  memberId: string | null;
  messageId: string | null;
  actions: string[];
  dueAbsSub: number;
}

/** One finished live interaction, for the week score, the Leadership pillar and badges. */
export interface LiveRecord {
  period: number;
  actionKey: string;
  format: string;
  band: Band;
  memberIds: string[];
  /** Report fields (scoring-and-report.md 5 and 7). Optional so tests can build bare records. */
  id?: string;
  sub?: number;
  title?: string;
  /** The style the evaluator read, when the conversation is style tagged (one person). */
  styleShown?: Style | null;
  skills?: Array<{ key: string; band: Band; evidence: string[] }>;
  /** The participant's own turns, verbatim. */
  quotes?: string[];
  /** Words said by the participant and by the NPCs, open questions asked, recognition statements, and whether it was spoken. */
  talk?: { you: number; npc: number; openQuestions: number; recognition: number; spoken: boolean };
  concern?: boolean;
  /** Sum of absolute changes to people, and the largest changes. */
  impact?: number;
  changes?: Array<{ subject: string; metric: string; delta: number }>;
}

/** A bulletin for the coming period, shown at the week end (Configuration Spec, Delivery). */
export interface NewsItem { key: string; card: CardKind; title: string; body: string; impact: string | null }

export interface Decision { memberId: string; chosen: Style; needed: Style; mismatch: Mismatch; source: string; period?: number }

export interface LogEntry {
  id: string;
  period: number;
  sub: number;
  kind: 'style' | 'action' | 'interaction' | 'event' | 'trigger' | 'periodEnd';
  title: string;
  memberIds: string[];
  changes: Change[];
  quote?: string;
}

export interface Outcome {
  id: string;
  actionKey: string;
  /** Who the reply is from: a member id or 'sponsor'. */
  speaker: string;
  headline: string;
  reply: string;
  affected: string[];
  reactions: Record<string, string>;
  changes: Change[];
  ripple: string | null;
  changed: string[];
}

/** How the period went (scoring-and-report.md 6, week score and stars). */
export interface PeriodSummary {
  period: number;
  /** One line headline and a sentence on the week, worded by the engine. */
  headline: string;
  line: string;
  week: {
    score: number;
    stars: number;
    /** Weekly style setting that matched what people needed. */
    styleFit: { correct: number; total: number; pct: number };
    /** Mean band score of the period's live interactions, or null when there were none. */
    live: { count: number; mean: number } | null;
    /** Final stage output against the period's ideal. */
    funnel: { output: number; ideal: number; pct: number };
  };
  kpis: Record<'skill' | 'morale' | 'result' | 'trust', { start: number; end: number }>;
  valueThisPeriod: number;
  /** The period's share of the target. */
  valueIdeal: number;
  cumulativeValue: number;
  pace: number;
  /** Periods in a row at the streak's star level, and the bonus it earned this period. */
  streak: { count: number; bonus: number; total: number; next: number | null };
  newBadges: Array<{ key: string; reason: string }>;
  /** Confidence and its level word at the start and end of the period. */
  sponsor: { from: number; to: number; fromLevel: SponsorLevel; toLevel: SponsorLevel };
  pulse: { from: number; to: number };
  funnel: Array<{ stage: string; throughput: number; ideal: number; cumulative: number; cumulativeIdeal: number }>;
  /** The stage furthest below its ideal this period. */
  bottleneck: string | null;
  unlockOffer: string[] | null;
  /** Sponsor confidence fell below the check in line: next period has a day less. */
  checkIn: boolean;
  /** Bulletins for the next period. */
  news: NewsItem[];
}

export interface Sim {
  config: StorylineConfig;
  seed: number;
  period: number;
  /** Sub-periods completed in this period. */
  sub: number;
  /** Capacity spent in this period. */
  spent: number;
  /** Period that gets one extra sub-period of capacity (unlock reward), or null. */
  bonusPeriod: number | null;
  absSub: number;
  phase: 'style' | 'board' | 'periodEnd' | 'ended';
  members: MemberSim[];
  departed: MemberSim[];
  candidates: string[];
  /** Absolute sub-period when an action (or action:option, action:member) is available again. */
  availableAt: Record<string, number>;
  funnel: { conversions: number; value: number; periodValue: number; stageOut: number[]; stageOutPeriod: number[] };
  decisions: { period: Decision[]; run: Decision[] };
  styleUses: Record<Style, number>;
  periods: PeriodSummary[];
  streak: number;
  /** Streak bonus earned so far, up to the cap. */
  streakBonus: number;
  /** Badge keys in the order earned, with when and why. */
  badges: Array<{ key: string; period: number; reason: string }>;
  sponsor: { value: number; causes: Array<{ text: string; delta: number }> };
  /** Team means at the start of the run, for the People pillar. */
  runStart: { morale: number; trust: number };
  liveRecords: LiveRecord[];
  /** Reasons written in weekly style setting, for the report's intent vs action. */
  styleNotes: Array<{ period: number; memberId: string; text: string }>;
  /** Actions and days spent per person, for People outcomes. */
  attention: Record<string, { actions: number; days: number }>;
  /** End screen reflection and experience rating. */
  reflection: { answers: string[]; rating: number | null } | null;
  /** Recognitions nobody else felt passed over by (Fair Hand). */
  fairRecognitions: number;
  /** Unlock rewards in hand: the next hire is allowed past a full team and costs no days; the next team activity has no cooldown. */
  hireBudget: boolean;
  freeTeamActivity: boolean;
  /** Period that loses a day to a CEO check in. */
  checkInPeriod: number | null;
  events: {
    /** Fixed and drawn timing per event key; null when a random event did not come up. */
    schedule: Record<string, { period: number; sub: number } | null>;
    fired: string[];
    pending: PendingResponse[];
  };
  pendingReward: string[] | null;
  promises: PromiseRecord[];
  inbox: InboxMessage[];
  cards: EventCard[];
  triggerCount: Record<string, number>;
  log: LogEntry[];
  outcome: Outcome | null;
  liveCount: number;
  voicePeriods: Record<number, { voice: number; total: number }>;
  periodStart: { morale: number; kpis: Record<'skill' | 'morale' | 'result' | 'trust', number> };
  seq: number;
  /** Open live interactions waiting for the participant's words. */
  interactions: Record<string, Interaction>;
  /** Live and hybrid actions taken per period, for the live cap. */
  liveTaken: Record<number, number>;
  /** People someone acted with this period, for weekly drift; `touchedTeam` when a team wide action ran. */
  touched: string[];
  touchedTeam: boolean;
  /** Sponsor confidence at the start of the period, for unlock thresholds. */
  sponsorAtStart: number;
  /** Team Pulse at the start of the period, for its trend. */
  pulseAtStart: number;
  /** Periods in which someone's shown style differed from the declared one (intent vs action). */
  intentGaps: Record<string, number[]>;
}

export type { Mismatch, Style, Triple };
