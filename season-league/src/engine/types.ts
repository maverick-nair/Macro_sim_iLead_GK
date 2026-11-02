import type { OptionId } from "../../shared/content-schema.ts";
import type { PromiseItem, RubricPass, Turn } from "../../shared/ai-contract.ts";

export type Phase =
  | "LOCKED"
  | "COUNTDOWN"
  | "BRIEFING"
  | "PLANNING"
  | "LOCKED_IN"
  | "INJECT"
  | "ON_AIR"
  | "MOMENT"
  | "SCORING"
  | "FULL_TIME"
  | "LEAGUE";

export interface Metrics {
  implementationSurvey: number;
  sixMonthSurvey: number;
  revenuePct: number;
}

export interface Member {
  name: string;
  role: string;
}

export interface PlanDraft {
  headings: string[];
  actions: PromiseItem[];
  clientMessage: string;
  decision: OptionId | null;
}

export interface RubricResult {
  lines: { id: string; score: number; reason: string }[];
  tryThis: string;
  passes: RubricPass[];
  total: number;
  zeroedBy: "decision" | "control-bypass" | null;
  scorer: string;
}

export interface TrustResult {
  behaviors: { id: string; score: number }[];
  average: number;
  verdict: string;
  scorer: string;
}

export interface Challenge {
  target: "plan" | "trust";
  before: number;
  after: number;
  at: string;
}

export interface RoundRecord {
  round: number;
  decision: OptionId | null;
  decisionPoints: number;
  planScore: number;
  rubric: RubricResult | null;
  trust: TrustResult | null;
  metricsBefore: Metrics;
  metricsAfter: Metrics;
  promises: PromiseItem[];
  transcript: Turn[];
  autoSubmitted: boolean;
  challenge: Challenge | null;
  momentResults: MomentResult[];
  captain: string;
  completedAt: string;
}

export interface Ticket {
  id: string;
  status: "critical" | "added";
  round: number;
  fromRound: number;
}

export interface Reveal {
  id: string;
  round: number;
  fromRound: number;
  headline: string;
  text: string;
  shown: boolean;
}

export interface LiftBrief {
  member: string;
  role: string;
  /** Headline, number, risk, ask (the moment's four fields, in order). */
  fields: string[];
}

/** Working state of the moment in progress (MOMENT phase). Kept in the live round so it survives a reload. */
export interface LiveMoment {
  index: number;
  momentId: string;
  endsAt: number;
  transcript: Turn[];
  briefs: LiftBrief[];
  /** Boardroom: what each presenter said, keyed by member name. */
  presentations: Record<string, string>;
  /** Boardroom: how many of the panel's questions have been asked. */
  questionsAsked: number;
  /** "scoring" once the moment ends (time out or the squad ends it); the store then runs its scorer. */
  status: "live" | "scoring";
}

export interface LiveRound {
  round: number;
  phase: Phase;
  phaseStartedAt: number;
  planEndsAt: number | null;
  onAirEndsAt: number | null;
  plan: PlanDraft;
  transcript: Turn[];
  autoSubmitted: boolean;
  /** Set during MOMENT. Completed moments move to `momentResults`. */
  moment: LiveMoment | null;
  momentResults: MomentResult[];
}

/** Lift: one Department Head score per member's brief, 1 to 10. */
export interface LiftResult {
  type: "lift";
  momentId: string;
  briefs: (LiftBrief & { score: number; reason: string })[];
  scorer: string;
}

/** Head of Sales challenge, 0 to 5. */
export interface FaisalResult {
  type: "faisal";
  momentId: string;
  score: number;
  reason: string;
  gaveWay: boolean;
  transcript: Turn[];
  scorer: string;
}

/** Replay of an earlier conversation, scored on the Trust Meter. */
export interface ReplayResult {
  type: "replay";
  momentId: string;
  replayOf: number;
  trust: TrustResult;
  transcript: Turn[];
}

/** Boardroom: six criteria 0 to 5, plus a score per presenter. */
export interface BoardroomResult {
  type: "boardroom";
  momentId: string;
  criteria: { id: string; score: number; reason: string }[];
  presenters: { member: string; role: string; score: number; reason: string }[];
  total: number;
  transcript: Turn[];
  scorer: string;
}

export type MomentResult = LiftResult | FaisalResult | ReplayResult | BoardroomResult;

/** Trust Challenge: one sitting, led by one member, scored on the trust equation. */
export interface TrustEquationResult {
  lines: { id: string; score: number; reason: string; tip: string }[];
  total: number;
  scorer: string;
}

export interface TrustSitting {
  sittingId: string;
  leader: string;
  phase: "ON_AIR" | "SCORING" | "DONE";
  startedAt: number;
  endsAt: number;
  transcript: Turn[];
  result: TrustEquationResult | null;
  completedAt: string | null;
}

export interface AuditEntry {
  at: string;
  kind: string;
  detail: string;
}

export interface SeasonState {
  version: 2;
  squadId: string;
  roster: Member[];
  checkins: Record<string, Member[]>;
  metrics: Metrics;
  pointsEarned: number;
  pointsAvailable: number;
  records: Record<string, RoundRecord>;
  tickets: Ticket[];
  reveals: Reveal[];
  flags: { revenueDisputed: boolean; mandateLabel: string | null; feeds: Record<string, number> };
  live: LiveRound | null;
  audit: AuditEntry[];
  /** Trust Challenge sittings keyed by sitting id. `activeSitting` is the one on air. */
  trustChallenge: { sittings: Record<string, TrustSitting>; activeSitting: string | null };
  /** Kudos this squad gave, keyed by matchday, then receiving squad id. */
  kudosGiven: Record<string, Record<string, number>>;
  /** Matchdays whose kudos step was closed (given or timed out). */
  kudosClosed: string[];
  finalSeen: boolean;
  /** Revision for server sync: bumped on every save. */
  revision: number;
}
