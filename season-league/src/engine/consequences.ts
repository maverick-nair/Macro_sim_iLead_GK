/**
 * Consequence model (workbook v1.1 rules as summarised in the PRD). Pure functions only.
 */
import type { ConsequenceFile, Evidence, LoadedRound, OptionId } from "../../shared/content-schema.ts";
import type { Metrics, Reveal, RoundRecord, SeasonState, Ticket } from "./types.ts";

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const round1 = (v: number) => Math.round(v * 10) / 10;

/** Decisions earn 10, 5 or 0 points, shown to the squad as +5, 0 or minus 5. */
export function decisionDisplay(points: number, c?: ConsequenceFile): string {
  const fromContent = c?.decisionDisplay[String(points)];
  if (fromContent) return fromContent;
  if (points >= 10) return "+5";
  if (points >= 5) return "0";
  return "minus 5";
}

export function startingMetrics(c: ConsequenceFile): Metrics {
  return { ...c.start };
}

/** Leadership score: points earned over points available, out of 100. Reads 50 before Round 1. */
export function leadershipScore(earned: number, available: number, c?: ConsequenceFile): number {
  if (available <= 0) return c?.leadershipBeforeRound1 ?? 50;
  return Math.round((earned / available) * 100);
}

export function applyMetricEffects(
  m: Metrics,
  effects: LoadedRound["options"][number]["effects"],
  c: ConsequenceFile,
): Metrics {
  return {
    implementationSurvey: round1(
      clamp(m.implementationSurvey + (effects.implementationSurvey ?? 0), c.caps.surveyMin, c.caps.surveyMax),
    ),
    sixMonthSurvey: round1(
      clamp(m.sixMonthSurvey + (effects.sixMonthSurvey ?? 0), c.caps.surveyMin, c.caps.surveyMax),
    ),
    revenuePct: round1(clamp(m.revenuePct + (effects.revenuePct ?? 0), c.caps.revenueMin, c.caps.revenueMax)),
  };
}

export interface RoundOutcomeInput {
  round: LoadedRound;
  decision: OptionId | null;
  /** Plan score from the rubric scorer, 0 to 20, before decision zeroing. */
  planScore: number;
}

export interface RoundOutcome {
  decisionPoints: number;
  planScore: number;
  zeroedByDecision: boolean;
  metricsAfter: Metrics;
  tickets: Ticket[];
  reveals: Reveal[];
  flags: SeasonState["flags"];
}

/**
 * Applies one round's decision to the season: points, dashboard metrics and carry-forward triggers.
 * A missing decision (time ran out with no play called) earns 0 points and changes nothing else.
 */
export function resolveRound(state: SeasonState, input: RoundOutcomeInput, c: ConsequenceFile): RoundOutcome {
  const option = input.decision ? input.round.options.find((o) => o.id === input.decision) : undefined;
  const effects = option?.effects ?? { points: 0 as const };
  const zeroedByDecision = effects.zeroPlan === true;
  const planScore = zeroedByDecision ? 0 : clamp(input.planScore, 0, c.pointsPerRound.plan);
  const metricsAfter = option ? applyMetricEffects(state.metrics, effects, c) : { ...state.metrics };

  const r = input.round.round;
  const tickets = [...state.tickets];
  for (const t of effects.tickets ?? []) {
    const existing = tickets.findIndex((x) => x.id === t.id);
    const ticket: Ticket = { id: t.id, status: t.status, round: t.round, fromRound: r };
    if (existing >= 0) tickets[existing] = ticket;
    else tickets.push(ticket);
  }

  const reveals = [...state.reveals];
  if (option?.breaking)
    reveals.push({
      id: `r${r}-${option.id}`,
      round: option.breaking.round,
      fromRound: r,
      headline: option.breaking.headline,
      text: option.breaking.text,
      shown: false,
    });

  const flags = {
    revenueDisputed: state.flags.revenueDisputed || effects.revenueDisputed === true,
    mandateLabel: effects.mandateLabel ?? state.flags.mandateLabel,
    feeds: {
      ...state.flags.feeds,
      ...(input.round.actionLogFeeds ? { [String(r)]: input.round.actionLogFeeds } : {}),
    },
  };

  return {
    decisionPoints: effects.points,
    planScore,
    zeroedByDecision,
    metricsAfter,
    tickets,
    reveals,
    flags,
  };
}

/** Commits a resolved round to the season state. */
export function commitRound(
  state: SeasonState,
  record: RoundRecord,
  outcome: RoundOutcome,
  c: ConsequenceFile,
): SeasonState {
  return {
    ...state,
    metrics: outcome.metricsAfter,
    pointsEarned: state.pointsEarned + outcome.decisionPoints + outcome.planScore,
    pointsAvailable: state.pointsAvailable + c.pointsPerRound.plan + c.pointsPerRound.decision,
    records: { ...state.records, [String(record.round)]: record },
    tickets: outcome.tickets,
    reveals: outcome.reveals,
    flags: outcome.flags,
  };
}

/** Carry forward: an earlier round's choice can swap this round's evidence (Round 1 sets Round 2). */
export function evidenceFor(round: LoadedRound, state: SeasonState): Evidence[] {
  for (const [fromRound, byOption] of Object.entries(round.evidenceByPriorChoice)) {
    const decision = state.records[fromRound]?.decision;
    const swap = decision ? byOption[decision] : undefined;
    if (swap) return swap;
  }
  return round.evidence;
}

/** Tickets that are live in a given round (for briefings and the servicing rounds). */
export function ticketsInRound(state: SeasonState, round: number): Ticket[] {
  return state.tickets.filter((t) => t.round <= round);
}

/** Breaking news due when a round starts: past choices landing now. */
export function revealsDue(state: SeasonState, round: number): Reveal[] {
  return state.reveals.filter((r) => r.round <= round && !r.shown);
}

/** Promise log carried into a later round (Round 6 action log feeds Round 8). */
export function carriedPromises(state: SeasonState, round: number) {
  return Object.entries(state.flags.feeds)
    .filter(([, to]) => to === round)
    .flatMap(([from]) => state.records[from]?.promises ?? []);
}
