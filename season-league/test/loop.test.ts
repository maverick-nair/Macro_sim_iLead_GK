import { describe, expect, it } from "vitest";
import type { RubricPass } from "../shared/ai-contract.ts";
import { validateContent } from "../shared/content-schema.ts";
import { computeLeague } from "../src/engine/league.ts";
import {
  clockSeconds,
  emptyPlan,
  resultsVisible,
  startRound,
  step,
  type MachineContext,
} from "../src/engine/round-machine.ts";
import { combinePasses, needsTieBreak } from "../src/engine/rubric.ts";
import {
  captainFor,
  fixtureStatus,
  needsCheckin,
  newSeason,
  nextPlayableRound,
} from "../src/engine/season.ts";
import { seedContent } from "./fixtures.ts";

const seed = seedContent();
const ctx: MachineContext = {
  timers: seed.schedule.timers,
  planMinutes: 12,
  onAirMinutes: 6,
  onAir: true,
  moments: [],
};
const MIN = 60_000;

/** A live round past the kick-off countdown, in the briefing with the plan clock running. */
const briefing = (now = 0) =>
  step(startRound(2, now), { type: "TICK", now: now + seed.schedule.timers.countdownSeconds * 1000 }, ctx)!;

describe("round state machine", () => {
  it("runs from briefing to the lobby with timeouts only, no human action", () => {
    let t = 0;
    let live = startRound(2, t);
    expect(live.phase).toBe("COUNTDOWN");
    expect(clockSeconds(live, t)).toBeNull(); // the plan clock starts after the countdown
    t += seed.schedule.timers.countdownSeconds * 1000;
    live = step(live, { type: "TICK", now: t }, ctx)!;
    expect(live.phase).toBe("BRIEFING");
    expect(clockSeconds(live, t)).toBe(720);
    expect(live.plan.decision).toBeNull(); // nothing preselected
    const advance = (ms: number) => {
      t += ms;
      const next = step(live!, { type: "TICK", now: t }, ctx);
      return next;
    };
    live = advance(12 * MIN)!;
    expect(live.phase).toBe("LOCKED_IN");
    expect(live.autoSubmitted).toBe(true);
    live = advance(seed.schedule.timers.lockedInSeconds * 1000)!;
    expect(live.phase).toBe("INJECT");
    live = advance(seed.schedule.timers.injectSeconds * 1000)!;
    expect(live.phase).toBe("ON_AIR");
    expect(clockSeconds(live, t)).toBe(360);
    live = advance(6 * MIN)!;
    expect(live.phase).toBe("SCORING");
    expect(resultsVisible(live)).toBe(false);
    live = step(live, { type: "SCORED", now: t }, ctx)!;
    expect(live.phase).toBe("FULL_TIME");
    expect(resultsVisible(live)).toBe(true);
    live = advance(seed.schedule.timers.fullTimeSeconds * 1000)!;
    expect(live.phase).toBe("LEAGUE");
    expect(advance(seed.schedule.timers.leagueSeconds * 1000)).toBeNull();
  });

  it("only locks the play once a play card is chosen", () => {
    let live = briefing();
    live = step(live, { type: "OPEN_PLAN", now: 4000 }, ctx)!;
    expect(step(live, { type: "LOCK_PLAY", now: 2 }, ctx)!.phase).toBe("PLANNING");
    live = step(live, { type: "UPDATE_PLAN", plan: { ...emptyPlan(), decision: "A" } }, ctx)!;
    const locked = step(live, { type: "LOCK_PLAY", now: 3 }, ctx)!;
    expect(locked.phase).toBe("LOCKED_IN");
    expect(locked.autoSubmitted).toBe(false);
  });

  it("ignores plan edits after the play is locked", () => {
    let live = step(briefing(), { type: "UPDATE_PLAN", plan: { ...emptyPlan(), decision: "C" } }, ctx)!;
    live = step(live, { type: "LOCK_PLAY", now: 1 }, ctx)!;
    live = step(live, { type: "UPDATE_PLAN", plan: { ...emptyPlan(), decision: "A" } }, ctx)!;
    expect(live.plan.decision).toBe("C");
  });
});

describe("round moments in the state machine", () => {
  const withMoments: MachineContext = {
    ...ctx,
    moments: [
      { id: "lift", minutes: 4 },
      { id: "boardroom", minutes: 10 },
    ],
  };
  const atInject = () => {
    let live = step(
      briefing(),
      { type: "UPDATE_PLAN", plan: { ...emptyPlan(), decision: "A" } },
      withMoments,
    )!;
    live = step(live, { type: "LOCK_PLAY", now: 5000 }, withMoments)!;
    return step(
      live,
      { type: "TICK", now: 5000 + seed.schedule.timers.lockedInSeconds * 1000 },
      withMoments,
    )!;
  };

  it("runs each moment after the call, in order, then scores", () => {
    let live = step(atInject(), { type: "TAKE_CALL", now: 10_000 }, withMoments)!;
    expect(live.phase).toBe("ON_AIR");
    live = step(live, { type: "END_CALL", now: 20_000 }, withMoments)!;
    expect(live.phase).toBe("MOMENT");
    expect(live.moment?.momentId).toBe("lift");
    expect(clockSeconds(live, 20_000)).toBe(240);
    live = step(live, { type: "MOMENT_UPDATE", patch: { questionsAsked: 1 } }, withMoments)!;
    expect(live.moment?.questionsAsked).toBe(1);
    // Time out turns the moment to scoring; the store then scores it.
    live = step(live, { type: "TICK", now: 20_000 + 4 * MIN }, withMoments)!;
    expect(live.moment?.status).toBe("scoring");
    expect(clockSeconds(live, 20_000 + 4 * MIN)).toBeNull();
    const lift = { type: "lift" as const, momentId: "lift", briefs: [], scorer: "t" };
    live = step(live, { type: "MOMENT_SCORED", result: lift, now: 30_000 + 4 * MIN }, withMoments)!;
    expect(live.phase).toBe("MOMENT");
    expect(live.moment?.momentId).toBe("boardroom");
    expect(live.momentResults).toHaveLength(1);
    live = step(live, { type: "END_MOMENT", now: 40_000 + 4 * MIN }, withMoments)!;
    expect(live.moment?.status).toBe("scoring");
    const board = {
      type: "boardroom" as const,
      momentId: "boardroom",
      criteria: [],
      presenters: [],
      total: 0,
      transcript: [],
      scorer: "t",
    };
    live = step(live, { type: "MOMENT_SCORED", result: board, now: 50_000 + 4 * MIN }, withMoments)!;
    expect(live.phase).toBe("SCORING");
    expect(live.moment).toBeNull();
    expect(live.momentResults.map((r) => r.momentId)).toEqual(["lift", "boardroom"]);
  });

  it("ignores a score for a moment that is not the current one", () => {
    let live = step(atInject(), { type: "TAKE_CALL", now: 10_000 }, withMoments)!;
    live = step(live, { type: "END_CALL", now: 20_000 }, withMoments)!;
    const wrong = { type: "lift" as const, momentId: "boardroom", briefs: [], scorer: "t" };
    expect(step(live, { type: "MOMENT_SCORED", result: wrong, now: 21_000 }, withMoments)).toBe(live);
  });

  it("goes straight from the inject to the moments when the round has no main conversation", () => {
    const noCall = { ...withMoments, onAir: false };
    const live = step(atInject(), { type: "TAKE_CALL", now: 10_000 }, noCall)!;
    expect(live.phase).toBe("MOMENT");
    expect(live.moment?.momentId).toBe("lift");
  });
});

const pass = (scores: number[], bypass = false): RubricPass => ({
  lines: scores.map((score, i) => ({ id: seed.rubric.lines[i]!.id, score, reason: `reason ${score}` })),
  tryThis: "Try this",
  releasesPaymentWithoutAuthorizers: bypass,
});

describe("rubric scorer rules", () => {
  it("asks for a third pass only when a line differs by more than 2", () => {
    expect(needsTieBreak(pass([4, 3, 4, 4]), pass([2, 3, 4, 5]), 2)).toBe(false);
    expect(needsTieBreak(pass([5, 3, 4, 4]), pass([2, 3, 4, 4]), 2)).toBe(true);
  });

  it("averages two passes and takes the median of three", () => {
    const two = combinePasses([pass([4, 3, 4, 4]), pass([3, 3, 5, 4])], seed.rubric, 2, {
      zeroByDecision: false,
      scorer: "t",
    });
    expect(two.lines.map((l) => l.score)).toEqual([4, 3, 5, 4]);
    expect(two.total).toBe(16);
    const three = combinePasses(
      [pass([5, 3, 4, 4]), pass([1, 3, 4, 4]), pass([4, 2, 4, 4])],
      seed.rubric,
      2,
      { zeroByDecision: false, scorer: "t" },
    );
    expect(three.lines.map((l) => l.score)).toEqual([4, 3, 4, 4]);
  });

  it("scores the plan 0 for releasing a payment without the registered authorizers (Round 2)", () => {
    const r = combinePasses([pass([5, 5, 5, 5], true), pass([5, 5, 5, 5], true)], seed.rubric, 2, {
      zeroByDecision: false,
      scorer: "t",
    });
    expect(r.total).toBe(0);
    expect(r.zeroedBy).toBe("control-bypass");
    const r3 = combinePasses([pass([5, 5, 5, 5], true), pass([5, 5, 5, 5], true)], seed.rubric, 3, {
      zeroByDecision: false,
      scorer: "t",
    });
    expect(r3.total).toBe(20);
  });

  it("carries the scorer and rubric version", () => {
    const r = combinePasses([pass([4, 3, 4, 4]), pass([4, 3, 4, 4])], seed.rubric, 2, {
      zeroByDecision: true,
      scorer: "mock",
    });
    expect(r.scorer).toBe("mock / rubric-v1");
    expect(r.total).toBe(0);
  });
});

describe("league", () => {
  const sq = (id: string, plan: number, trust: number, decision: number) => ({
    squadId: id,
    name: id,
    colour: "amber",
    rounds: { "2": { planScore: plan, trust, decisionPoints: decision } },
  });

  it("weights sum to 100", () => {
    expect(seed.league.categories.reduce((s, c) => s + c.weight, 0)).toBe(100);
  });

  it("joins categories with v3.1 weights and marks the rest pending", () => {
    const [top] = computeLeague(seed.league, [sq("a", 20, 10, 10)]);
    expect(top!.points).toBe(50); // plan 20 + trust 20 + decisions 10
    expect(top!.pending).toEqual(["boardroom", "challenges", "trustChallenge", "missions", "kudos"]);
  });

  it("breaks ties on the Trust Meter and reports rank movement", () => {
    // a: plan 10/20 (10) + trust 8/10 (16) + 10 = 36. b: plan 12/20 (12) + trust 7/10 (14) + 10 = 36.
    const table = computeLeague(seed.league, [sq("b", 12, 7, 10), sq("a", 10, 8, 10)], ["b", "a"]);
    expect(table.map((r) => r.squadId)).toEqual(["a", "b"]);
    expect(table[0]!.movement).toBe(1);
    expect(table[1]!.movement).toBe(-1);
  });
});

describe("season shell", () => {
  it("rotates the captain every round in roster order", () => {
    const roster = ["Amal", "Badr", "Dana", "Fahad"].map((name) => ({ name, role: "KAM" }));
    expect([1, 2, 4, 5].map((r) => captainFor(roster, r)?.name)).toEqual(["Amal", "Badr", "Fahad", "Amal"]);
  });

  it("with seed content, Round 2 is the only round that can start, once Matchday 1 unlocks", () => {
    const s = newSeason("squad-3", seed);
    const unlockAt = { 1: Date.parse(seed.schedule.matchdays[0]!.unlockAt) };
    expect(nextPlayableRound(seed, s, { unlockAt, now: 0, unlockOverride: false })).toBeNull();
    const open = { unlockAt, now: 0, unlockOverride: true };
    expect(nextPlayableRound(seed, s, open)?.round).toBe(2);
    expect(fixtureStatus(seed.rounds.rounds[0]!, seed, s, open)).toBe("not-loaded");
    expect(fixtureStatus(seed.rounds.rounds[1]!, seed, s, open)).toBe("next");
  });

  it("asks for a check-in once per matchday", () => {
    const s = newSeason("squad-3", seed);
    expect(needsCheckin(s, 1)).toBe(true);
    const roster = ["A", "B", "C", "D"].map((name) => ({ name, role: "KAM" }));
    const checked = { ...s, roster, checkins: { "1": roster } };
    expect(needsCheckin(checked, 1)).toBe(false);
    expect(needsCheckin(checked, 2)).toBe(true);
  });
});

describe("content file", () => {
  it("validates: 9 rounds, 3 options each, ticket ids, weights summing to 100", () => {
    const report = validateContent(
      {
        rounds: seed.rounds,
        consequence: seed.consequence,
        league: seed.league,
        trustMeter: seed.trustMeter,
        rubric: seed.rubric,
        schedule: seed.schedule,
        squads: seed.squads,
        trustChallenge: seed.trustChallenge,
        kudos: seed.kudos,
      },
      seed.characters,
    );
    expect(report.lines.filter((l) => l.startsWith("fail"))).toEqual([]);
    expect(report.ok).toBe(true);
  });

  it("rejects league weights that do not sum to 100", () => {
    const bad = { ...seed.league, categories: seed.league.categories.slice(1) };
    const report = validateContent({ ...seed, league: bad }, seed.characters);
    expect(report.ok).toBe(false);
  });
});
