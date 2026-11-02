/**
 * The self-running round loop as one state machine:
 * LOCKED, BRIEFING, PLANNING, LOCKED_IN, INJECT, ON_AIR, SCORING, FULL_TIME, LEAGUE, then the next round.
 * Pure: time comes in as `now` (milliseconds). Every waiting phase has a timeout, so no step needs a person.
 */
import type { Turn } from "../../shared/ai-contract.ts";
import type { ScheduleFile } from "../../shared/content-schema.ts";
import type { LiveRound, Phase, PlanDraft } from "./types.ts";

export type RoundEvent =
  | { type: "OPEN_PLAN"; now: number }
  | { type: "UPDATE_PLAN"; plan: PlanDraft }
  | { type: "LOCK_PLAY"; now: number }
  | { type: "TAKE_CALL"; now: number }
  | { type: "ADD_TURN"; turn: Turn }
  | { type: "END_CALL"; now: number }
  | { type: "SCORED"; now: number }
  | { type: "TO_LEAGUE"; now: number }
  | { type: "TICK"; now: number };

export interface MachineContext {
  timers: ScheduleFile["timers"];
  onAirMinutes: number;
}

const MIN = 60_000;
const SEC = 1_000;

export function emptyPlan(headingCount = 4): PlanDraft {
  return {
    headings: Array.from({ length: headingCount }, () => ""),
    actions: [],
    clientMessage: "",
    decision: null,
  };
}

export function startRound(round: number, planMinutes: number, now: number): LiveRound {
  return {
    round,
    phase: "BRIEFING",
    phaseStartedAt: now,
    planEndsAt: now + planMinutes * MIN,
    onAirEndsAt: null,
    plan: emptyPlan(),
    transcript: [],
    autoSubmitted: false,
  };
}

const to = (live: LiveRound, phase: Phase, now: number, extra: Partial<LiveRound> = {}): LiveRound => ({
  ...live,
  ...extra,
  phase,
  phaseStartedAt: now,
});

const goOnAir = (live: LiveRound, now: number, ctx: MachineContext) =>
  to(live, "ON_AIR", now, { onAirEndsAt: now + ctx.onAirMinutes * MIN });

/** Returns the next live round, or null when the round is over and the squad is back in the lobby. */
export function step(live: LiveRound, event: RoundEvent, ctx: MachineContext): LiveRound | null {
  const p = live.phase;
  switch (event.type) {
    case "OPEN_PLAN":
      return p === "BRIEFING" ? to(live, "PLANNING", event.now) : live;
    case "UPDATE_PLAN":
      return p === "BRIEFING" || p === "PLANNING" ? { ...live, plan: event.plan } : live;
    case "LOCK_PLAY":
      return (p === "BRIEFING" || p === "PLANNING") && live.plan.decision
        ? to(live, "LOCKED_IN", event.now, { autoSubmitted: false })
        : live;
    case "TAKE_CALL":
      return p === "INJECT" ? goOnAir(live, event.now, ctx) : live;
    case "ADD_TURN":
      return p === "ON_AIR" ? { ...live, transcript: [...live.transcript, event.turn] } : live;
    case "END_CALL":
      return p === "ON_AIR" ? to(live, "SCORING", event.now) : live;
    case "SCORED":
      return p === "SCORING" ? to(live, "FULL_TIME", event.now) : live;
    case "TO_LEAGUE":
      if (p === "FULL_TIME") return to(live, "LEAGUE", event.now);
      if (p === "LEAGUE") return null;
      return live;
    case "TICK":
      return tick(live, event.now, ctx);
  }
}

function tick(live: LiveRound, now: number, ctx: MachineContext): LiveRound | null {
  const elapsed = now - live.phaseStartedAt;
  const t = ctx.timers;
  switch (live.phase) {
    case "BRIEFING":
    case "PLANNING":
      // Auto-submit at time-out. Nothing is preselected: no play called means no decision.
      return live.planEndsAt !== null && now >= live.planEndsAt
        ? to(live, "LOCKED_IN", now, { autoSubmitted: true })
        : live;
    case "LOCKED_IN":
      return elapsed >= t.lockedInSeconds * SEC ? to(live, "INJECT", now) : live;
    case "INJECT":
      return elapsed >= t.injectSeconds * SEC ? goOnAir(live, now, ctx) : live;
    case "ON_AIR":
      return live.onAirEndsAt !== null && now >= live.onAirEndsAt ? to(live, "SCORING", now) : live;
    case "FULL_TIME":
      return elapsed >= t.fullTimeSeconds * SEC ? to(live, "LEAGUE", now) : live;
    case "LEAGUE":
      return elapsed >= t.leagueSeconds * SEC ? null : live;
    default:
      return live;
  }
}

/** Seconds left on whichever clock is running, or null. */
export function clockSeconds(live: LiveRound | null, now: number): number | null {
  if (!live) return null;
  if ((live.phase === "BRIEFING" || live.phase === "PLANNING") && live.planEndsAt !== null)
    return Math.max(0, Math.ceil((live.planEndsAt - now) / SEC));
  if (live.phase === "ON_AIR" && live.onAirEndsAt !== null)
    return Math.max(0, Math.ceil((live.onAirEndsAt - now) / SEC));
  return null;
}

/** Points stay hidden until full time. */
export function resultsVisible(live: LiveRound | null): boolean {
  return live !== null && (live.phase === "FULL_TIME" || live.phase === "LEAGUE");
}
