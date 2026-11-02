import type { OptionId } from "../../shared/content-schema.ts";
import type { PromiseItem, RubricPass, Turn } from "../../shared/ai-contract.ts";

export type Phase =
  "LOCKED" | "BRIEFING" | "PLANNING" | "LOCKED_IN" | "INJECT" | "ON_AIR" | "SCORING" | "FULL_TIME" | "LEAGUE";

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

export interface LiveRound {
  round: number;
  phase: Phase;
  phaseStartedAt: number;
  planEndsAt: number | null;
  onAirEndsAt: number | null;
  plan: PlanDraft;
  transcript: Turn[];
  autoSubmitted: boolean;
}

export interface AuditEntry {
  at: string;
  kind: string;
  detail: string;
}

export interface SeasonState {
  version: 1;
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
}
