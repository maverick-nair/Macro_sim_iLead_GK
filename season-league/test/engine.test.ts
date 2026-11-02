import { describe, expect, it } from "vitest";
import type { OptionId } from "../shared/content-schema.ts";
import {
  applyMetricEffects,
  carriedPromises,
  commitRound,
  decisionDisplay,
  evidenceFor,
  leadershipScore,
  resolveRound,
  revealsDue,
  ticketsInRound,
} from "../src/engine/consequences.ts";
import { newSeason } from "../src/engine/season.ts";
import type { RoundRecord, SeasonState } from "../src/engine/types.ts";
import { seedContent, syntheticSeason } from "./fixtures.ts";

const seed = seedContent();

function play(content = syntheticSeason(), choices: Record<number, OptionId>, planScore = 15): SeasonState {
  let state = newSeason("squad-test", content);
  for (const r of content.rounds.rounds) {
    if (!r.loaded) continue;
    const decision = choices[r.round] ?? "A";
    const outcome = resolveRound(state, { round: r, decision, planScore }, content.consequence);
    const record: RoundRecord = {
      round: r.round,
      decision,
      decisionPoints: outcome.decisionPoints,
      planScore: outcome.planScore,
      rubric: null,
      trust: null,
      metricsBefore: state.metrics,
      metricsAfter: outcome.metricsAfter,
      promises: [{ action: `Action from round ${r.round}`, owner: "KAM", due: "Day 1" }],
      transcript: [],
      autoSubmitted: false,
      challenge: null,
      momentResults: [],
      captain: "Test",
      completedAt: "2026-11-22T09:00:00+03:00",
    };
    state = commitRound(state, record, outcome, content.consequence);
  }
  return state;
}

describe("decision points", () => {
  it("shows 10, 5 and 0 as +5, 0 and minus 5", () => {
    expect(decisionDisplay(10, seed.consequence)).toBe("+5");
    expect(decisionDisplay(5, seed.consequence)).toBe("0");
    expect(decisionDisplay(0, seed.consequence)).toBe("minus 5");
  });
});

describe("dashboard metrics", () => {
  it("start at 6.0, 6.0 and 80% of SAR 2.00m", () => {
    const s = newSeason("x", seed);
    expect(s.metrics).toEqual({ implementationSurvey: 6, sixMonthSurvey: 6, revenuePct: 80 });
    expect(seed.consequence.revenueCommitment).toEqual({ currency: "SAR", amountMillions: 2 });
  });

  it("keep surveys between 0 and 10 and cap revenue at 100%", () => {
    const m = applyMetricEffects(
      { implementationSurvey: 9.5, sixMonthSurvey: 0.5, revenuePct: 98 },
      { points: 10, implementationSurvey: 2, sixMonthSurvey: -3, revenuePct: 10 },
      seed.consequence,
    );
    expect(m).toEqual({ implementationSurvey: 10, sixMonthSurvey: 0, revenuePct: 100 });
  });
});

describe("leadership score", () => {
  it("reads 50 before Round 1", () => {
    expect(leadershipScore(0, 0, seed.consequence)).toBe(50);
  });

  it("is points earned over points available (20 plan plus 10 decision per round)", () => {
    expect(leadershipScore(25, 30)).toBe(83);
    expect(leadershipScore(15, 30)).toBe(50);
  });

  it("best path with plans averaging 15 of 20 ends at 83", () => {
    expect(leadershipScore(play(undefined, {}).pointsEarned, play(undefined, {}).pointsAvailable)).toBe(83);
  });

  it("Round 2 B, Round 7 B and Round 9 C ends at 67", () => {
    const s = play(undefined, { 2: "B", 7: "B", 9: "C" });
    expect(s.pointsAvailable).toBe(270);
    expect(leadershipScore(s.pointsEarned, s.pointsAvailable)).toBe(67);
  });
});

describe("carry-forward triggers", () => {
  const content = syntheticSeason();

  it("Round 1 choice sets Round 2 evidence", () => {
    const r2 = content.rounds.rounds[1]!;
    if (!r2.loaded) throw new Error("fixture");
    for (const choice of ["A", "B", "C"] as const) {
      const s = play(
        {
          ...content,
          rounds: {
            ...content.rounds,
            rounds: content.rounds.rounds.map((r) => (r.round === 1 ? r : { ...r, loaded: false as const })),
          },
        },
        { 1: choice },
      );
      expect(evidenceFor(r2, s)[0]?.text).toBe(`after-1${choice} 1`);
    }
    expect(evidenceFor(r2, newSeason("x", content))[0]?.text).toBe("default 1");
  });

  it("Round 2 B zeroes that round's plan score and makes T-009 critical in Round 5", () => {
    const s = play(content, { 2: "B" });
    expect(s.records["2"]?.planScore).toBe(0);
    expect(s.records["2"]?.decisionPoints).toBe(0);
    expect(ticketsInRound(s, 4).find((t) => t.id === "T-009")).toBeUndefined();
    expect(ticketsInRound(s, 5).find((t) => t.id === "T-009")?.status).toBe("critical");
    expect(revealsDue(s, 5).map((r) => r.headline)).toEqual(["T-009 critical"]);
    expect(revealsDue(s, 4)).toEqual([]);
  });

  it("Round 4 B adds T-013", () => {
    expect(play(content, { 4: "B" }).tickets.map((t) => t.id)).toContain("T-013");
    expect(play(content, {}).tickets).toEqual([]);
  });

  it("the Round 6 action log feeds Round 8", () => {
    const s = play(content, {});
    expect(carriedPromises(s, 8).map((p) => p.action)).toEqual(["Action from round 6"]);
    expect(carriedPromises(s, 7)).toEqual([]);
  });

  it("Round 7 B shows revenue as disputed", () => {
    expect(play(content, { 7: "B" }).flags.revenueDisputed).toBe(true);
    expect(play(content, {}).flags.revenueDisputed).toBe(false);
  });

  it("Round 9 sets the mandate label", () => {
    expect(play(content, { 9: "C" }).flags.mandateLabel).toBe("retained at a loss");
    expect(play(content, {}).flags.mandateLabel).toBe("mandate renewed");
  });

  it("no play called earns 0 and leaves the dashboard as it was", () => {
    const s = newSeason("x", seed);
    const r2 = seed.rounds.rounds[1]!;
    if (!r2.loaded) throw new Error("seed");
    const o = resolveRound(s, { round: r2, decision: null, planScore: 12 }, seed.consequence);
    expect(o.decisionPoints).toBe(0);
    expect(o.planScore).toBe(12);
    expect(o.metricsAfter).toEqual(s.metrics);
  });
});

describe("Round 2 seed effects", () => {
  const r2 = seed.rounds.rounds[1]!;
  if (!r2.loaded) throw new Error("Round 2 must be loaded in the seed");
  const s = newSeason("x", seed);
  const run = (d: OptionId) => resolveRound(s, { round: r2, decision: d, planScore: 15 }, seed.consequence);

  it("A earns 10 and lifts the implementation survey by 1", () => {
    expect(run("A")).toMatchObject({
      decisionPoints: 10,
      planScore: 15,
      metricsAfter: { implementationSurvey: 7, sixMonthSurvey: 6, revenuePct: 80 },
    });
  });
  it("B earns 0, +0.5 implementation, minus 1 six-month, zero plan, T-009 critical in Round 5", () => {
    const o = run("B");
    expect(o).toMatchObject({
      decisionPoints: 0,
      planScore: 0,
      metricsAfter: { implementationSurvey: 6.5, sixMonthSurvey: 5, revenuePct: 80 },
    });
    expect(o.tickets).toEqual([{ id: "T-009", status: "critical", round: 5, fromRound: 2 }]);
  });
  it("C earns 5 with no survey or revenue change", () => {
    expect(run("C")).toMatchObject({ decisionPoints: 5, metricsAfter: s.metrics });
  });
});

// The full worked examples need workbook v1.1 for every round's survey and revenue effects.
const workbookLoaded = seed.rounds.meta.source === "workbook";
describe.skipIf(!workbookLoaded)("worked examples with the full workbook", () => {
  it("best path, plans averaging 15: 83, 9.0, 10, 92%", () => {
    const s = play(seed, {});
    expect([
      leadershipScore(s.pointsEarned, s.pointsAvailable),
      s.metrics.implementationSurvey,
      s.metrics.sixMonthSurvey,
      s.metrics.revenuePct,
    ]).toEqual([83, 9, 10, 92]);
  });
  it("Round 2 B, Round 7 B, Round 9 C: 67, 8.5, 7.0, 74%, retained at a loss", () => {
    const s = play(seed, { 2: "B", 7: "B", 9: "C" });
    expect([
      leadershipScore(s.pointsEarned, s.pointsAvailable),
      s.metrics.implementationSurvey,
      s.metrics.sixMonthSurvey,
      s.metrics.revenuePct,
    ]).toEqual([67, 8.5, 7, 74]);
    expect(s.flags.mandateLabel).toBe("retained at a loss");
  });
});
