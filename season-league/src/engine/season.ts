/**
 * Season shell rules: new season, captain rotation, which fixture is next.
 * Pure: schedule times arrive already parsed to milliseconds.
 */
import type { Content, Round } from "../../shared/content-schema.ts";
import { startingMetrics } from "./consequences.ts";
import type { Member, SeasonState } from "./types.ts";

export function newSeason(squadId: string, content: Content): SeasonState {
  return {
    version: 1,
    squadId,
    roster: [],
    checkins: {},
    metrics: startingMetrics(content.consequence),
    pointsEarned: 0,
    pointsAvailable: 0,
    records: {},
    tickets: [],
    reveals: [],
    flags: { revenueDisputed: false, mandateLabel: null, feeds: {} },
    live: null,
    audit: [],
  };
}

/** The captain rotates every round in roster order. */
export function captainFor(roster: Member[], round: number): Member | null {
  if (roster.length === 0) return null;
  return roster[(round - 1) % roster.length] ?? null;
}

export type FixtureStatus = "played" | "live" | "next" | "upcoming" | "locked" | "not-loaded";

export interface FixtureContext {
  unlockAt: Record<number, number>;
  now: number;
  unlockOverride: boolean;
}

export function matchdayUnlocked(matchday: number, ctx: FixtureContext): boolean {
  if (ctx.unlockOverride) return true;
  const at = ctx.unlockAt[matchday];
  return at !== undefined && ctx.now >= at;
}

/** The next round the squad can kick off: the first loaded, unplayed round in an unlocked matchday. */
export function nextPlayableRound(content: Content, state: SeasonState, ctx: FixtureContext): Round | null {
  for (const r of content.rounds.rounds) {
    if (state.records[String(r.round)]) continue;
    if (!r.loaded) continue;
    if (!matchdayUnlocked(r.matchday, ctx)) return null;
    return r;
  }
  return null;
}

export function fixtureStatus(
  r: Round,
  content: Content,
  state: SeasonState,
  ctx: FixtureContext,
): FixtureStatus {
  if (state.records[String(r.round)]) return "played";
  if (state.live?.round === r.round) return "live";
  if (!r.loaded) return "not-loaded";
  if (!matchdayUnlocked(r.matchday, ctx)) return "locked";
  return nextPlayableRound(content, state, ctx)?.round === r.round ? "next" : "upcoming";
}

/** Matchday check-in: the squad confirms who is present once per matchday. */
export function needsCheckin(state: SeasonState, matchday: number): boolean {
  return state.roster.length < 4 || !state.checkins[String(matchday)];
}
