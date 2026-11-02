/**
 * The self-running round loop as one state machine:
 * LOCKED, COUNTDOWN, BRIEFING, PLANNING, LOCKED_IN, INJECT, ON_AIR, MOMENT, SCORING, FULL_TIME, LEAGUE,
 * then the next round. ON_AIR is skipped when the round has no main conversation; MOMENT is skipped when
 * the round has no moments.
 * Pure: time comes in as `now` (milliseconds). Every waiting phase has a timeout, so no step needs a person.
 */
import type { Turn } from "../../shared/ai-contract.ts";
import type { ScheduleFile } from "../../shared/content-schema.ts";
import type { LiveMoment, LiveRound, MomentResult, Phase, PlanDraft } from "./types.ts";

export type RoundEvent =
  | { type: "OPEN_PLAN"; now: number }
  | { type: "UPDATE_PLAN"; plan: PlanDraft }
  | { type: "LOCK_PLAY"; now: number }
  | { type: "TAKE_CALL"; now: number }
  | { type: "ADD_TURN"; turn: Turn }
  | { type: "END_CALL"; now: number }
  | {
      type: "MOMENT_UPDATE";
      patch: Partial<Pick<LiveMoment, "transcript" | "briefs" | "presentations" | "questionsAsked">>;
    }
  | { type: "END_MOMENT"; now: number }
  | { type: "MOMENT_SCORED"; result: MomentResult; now: number }
  | { type: "SCORED"; now: number }
  | { type: "TO_LEAGUE"; now: number }
  | { type: "TICK"; now: number };

export interface MachineContext {
  timers: ScheduleFile["timers"];
  planMinutes: number;
  onAirMinutes: number;
  /** False when the round has no main conversation. */
  onAir: boolean;
  /** The round's moments, in order. */
  moments: { id: string; minutes: number }[];
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

/** Kick-off: the countdown runs first; the plan clock starts when the briefing opens. */
export function startRound(round: number, now: number): LiveRound {
  return {
    round,
    phase: "COUNTDOWN",
    phaseStartedAt: now,
    planEndsAt: null,
    onAirEndsAt: null,
    plan: emptyPlan(),
    transcript: [],
    autoSubmitted: false,
    moment: null,
    momentResults: [],
  };
}

const to = (live: LiveRound, phase: Phase, now: number, extra: Partial<LiveRound> = {}): LiveRound => ({
  ...live,
  ...extra,
  phase,
  phaseStartedAt: now,
});

function openMoment(live: LiveRound, index: number, now: number, ctx: MachineContext): LiveRound {
  const m = ctx.moments[index];
  if (!m) return to(live, "SCORING", now, { moment: null });
  const moment: LiveMoment = {
    index,
    momentId: m.id,
    endsAt: now + m.minutes * MIN,
    transcript: [],
    briefs: [],
    presentations: {},
    questionsAsked: 0,
    status: "live",
  };
  return live.phase === "MOMENT" ? { ...live, moment } : to(live, "MOMENT", now, { moment });
}

/** After the main conversation (or instead of it): the moments in order, then scoring. */
const afterConversation = (live: LiveRound, now: number, ctx: MachineContext) =>
  ctx.moments.length ? openMoment(live, 0, now, ctx) : to(live, "SCORING", now);

const afterInject = (live: LiveRound, now: number, ctx: MachineContext) =>
  ctx.onAir
    ? to(live, "ON_AIR", now, { onAirEndsAt: now + ctx.onAirMinutes * MIN })
    : afterConversation(live, now, ctx);

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
      return p === "INJECT" ? afterInject(live, event.now, ctx) : live;
    case "ADD_TURN":
      return p === "ON_AIR" ? { ...live, transcript: [...live.transcript, event.turn] } : live;
    case "END_CALL":
      return p === "ON_AIR" ? afterConversation(live, event.now, ctx) : live;
    case "MOMENT_UPDATE":
      return p === "MOMENT" && live.moment?.status === "live"
        ? { ...live, moment: { ...live.moment, ...event.patch } }
        : live;
    case "END_MOMENT":
      return p === "MOMENT" && live.moment?.status === "live"
        ? { ...live, moment: { ...live.moment, status: "scoring" } }
        : live;
    case "MOMENT_SCORED": {
      if (p !== "MOMENT" || !live.moment || live.moment.momentId !== event.result.momentId) return live;
      const next = { ...live, momentResults: [...live.momentResults, event.result] };
      return openMoment(next, live.moment.index + 1, event.now, ctx);
    }
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
    case "COUNTDOWN":
      return elapsed >= t.countdownSeconds * SEC
        ? to(live, "BRIEFING", now, { planEndsAt: now + ctx.planMinutes * MIN })
        : live;
    case "BRIEFING":
    case "PLANNING":
      // Auto-submit at time-out. Nothing is preselected: no play called means no decision.
      return live.planEndsAt !== null && now >= live.planEndsAt
        ? to(live, "LOCKED_IN", now, { autoSubmitted: true })
        : live;
    case "LOCKED_IN":
      return elapsed >= t.lockedInSeconds * SEC ? to(live, "INJECT", now) : live;
    case "INJECT":
      return elapsed >= t.injectSeconds * SEC ? afterInject(live, now, ctx) : live;
    case "ON_AIR":
      return live.onAirEndsAt !== null && now >= live.onAirEndsAt ? afterConversation(live, now, ctx) : live;
    case "MOMENT":
      return live.moment && live.moment.status === "live" && now >= live.moment.endsAt
        ? { ...live, moment: { ...live.moment, status: "scoring" } }
        : live;
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
  if (live.phase === "MOMENT" && live.moment?.status === "live")
    return Math.max(0, Math.ceil((live.moment.endsAt - now) / SEC));
  return null;
}

/** Points stay hidden until full time. */
export function resultsVisible(live: LiveRound | null): boolean {
  return live !== null && (live.phase === "FULL_TIME" || live.phase === "LEAGUE");
}

/** Builds the machine context for a round from content. */
export function machineContext(
  timers: ScheduleFile["timers"],
  round:
    | {
        loaded: true;
        planMinutes: number;
        onAirMinutes: number;
        onAir: boolean;
        moments: { id: string; minutes: number }[];
      }
    | { loaded: false; planMinutes: number }
    | undefined,
): MachineContext {
  if (!round || !round.loaded)
    return { timers, planMinutes: round?.planMinutes ?? 10, onAirMinutes: 6, onAir: true, moments: [] };
  return {
    timers,
    planMinutes: round.planMinutes,
    onAirMinutes: round.onAirMinutes,
    onAir: round.onAir,
    moments: round.moments.map((m) => ({ id: m.id, minutes: m.minutes })),
  };
}
