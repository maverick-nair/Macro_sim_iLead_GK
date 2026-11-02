/**
 * Season shell rules: new season, captain rotation, which fixture is next.
 * Pure: schedule times arrive already parsed to milliseconds.
 */
import type { Content, Round } from "../../shared/content-schema.ts";
import { startingMetrics } from "./consequences.ts";
import type { Member, SeasonState } from "./types.ts";

export function newSeason(squadId: string, content: Content): SeasonState {
  return {
    version: 2,
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
    trustChallenge: { sittings: {}, activeSitting: null },
    kudosGiven: {},
    kudosClosed: [],
    finalSeen: false,
    revision: 0,
  };
}

/**
 * Brings a saved season up to the current version. Returns null for anything unrecognisable.
 * v1 to v2: adds Trust Challenge, kudos, final and revision fields; live rounds and records gain moment fields.
 */
export function migrateSeason(raw: unknown): SeasonState | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Record<string, unknown> & { version?: number };
  if (s.version === 2) return s as unknown as SeasonState;
  if (s.version !== 1) return null;
  const v1 = s as unknown as Omit<SeasonState, "version"> & { version: 1 };
  const records: SeasonState["records"] = {};
  for (const [k, r] of Object.entries(v1.records ?? {}))
    records[k] = { ...r, momentResults: r.momentResults ?? [] };
  return {
    ...v1,
    version: 2,
    records,
    live: v1.live
      ? { ...v1.live, moment: v1.live.moment ?? null, momentResults: v1.live.momentResults ?? [] }
      : null,
    trustChallenge: { sittings: {}, activeSitting: null },
    kudosGiven: {},
    kudosClosed: [],
    finalSeen: false,
    revision: 0,
  };
}

/** Gap week: the Trust Challenge is open from its unlock time (or the override) and stays open after. */
export function gapWeekOpen(content: Content, ctx: FixtureContext, gapUnlockAt: number | undefined): boolean {
  if (!content.schedule.gapWeek.loaded) return false;
  if (ctx.unlockOverride) return true;
  return gapUnlockAt !== undefined && ctx.now >= gapUnlockAt;
}

/** The final opens at its unlock time (or the override) once every loaded round is played. */
export function finalOpen(
  content: Content,
  state: SeasonState,
  ctx: FixtureContext,
  finalUnlockAt: number | undefined,
): boolean {
  if (!content.schedule.final.loaded) return false;
  const allPlayed = content.rounds.rounds.every((r) => !r.loaded || state.records[String(r.round)]);
  if (!allPlayed || state.live) return false;
  if (ctx.unlockOverride) return true;
  return finalUnlockAt !== undefined && ctx.now >= finalUnlockAt;
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
