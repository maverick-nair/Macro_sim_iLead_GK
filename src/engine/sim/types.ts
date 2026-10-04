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
  /** Training request open in this period. */
  trainingRequestedPeriod: number | null;
  roleChangeRequestedPeriod: number | null;
  /** Lowest result seen, for the Turnaround badge. */
  lowestResult: number;
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
}

export interface EventCard {
  id: string;
  key: string;
  card: 'impact' | 'signal' | 'capacity' | 'diagnostic';
  title: string;
  body: string;
  memberId: string | null;
  changes: Change[];
}

export interface Decision { memberId: string; chosen: Style; needed: Style; mismatch: Mismatch; source: string }

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
  headline: string;
  reply: string;
  affected: string[];
  reactions: Record<string, string>;
  changes: Change[];
  ripple: string | null;
  changed: string[];
}

export interface PeriodSummary {
  period: number;
  stars: { people: boolean; leadership: boolean; business: boolean };
  kpis: Record<'skill' | 'morale' | 'result' | 'trust', { start: number; end: number }>;
  valueThisPeriod: number;
  cumulativeValue: number;
  pace: number;
  accuracy: number;
  points: { business: number; people: number; leadership: number; streakBonus: number };
  streak: number;
  newBadges: string[];
  sponsor: { from: number; to: number };
  funnel: Array<{ stage: string; throughput: number; ideal: number }>;
  unlockOffer: string[] | null;
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
  score: { business: number; people: number; leadership: number; bonus: number };
  periods: PeriodSummary[];
  streak: number;
  badges: string[];
  sponsor: { value: number; causes: Array<{ text: string; delta: number }>; crossed: number[] };
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
  interactions: Record<string, { actionKey: string; optionKey: string | null; memberIds: string[]; format: string; startedAt: number; replyTo?: string }>;
}

export type { Mismatch, Style, Triple };
