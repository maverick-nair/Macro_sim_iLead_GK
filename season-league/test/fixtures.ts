/**
 * Test fixtures. `seedContent()` loads the real /content files. `syntheticSeason()` builds a full
 * nine-round season (test values, not case content) so every carry-forward trigger can be exercised.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ConsequenceFile,
  type Content,
  LeagueFile,
  type LoadedRound,
  RoundsFile,
  RubricFile,
  ScheduleFile,
  SquadsFile,
  TrustMeterFile,
  TrustChallengeFile,
  KudosFile,
  Character,
} from "../shared/content-schema.ts";

const CONTENT = fileURLToPath(new URL("../content/", import.meta.url));
const read = (f: string) => JSON.parse(readFileSync(join(CONTENT, f), "utf8"));

export function seedContent(): Content {
  const characters: Content["characters"] = {};
  for (const f of readdirSync(join(CONTENT, "characters")))
    characters[f.replace(/\.json$/, "")] = Character.parse(read(`characters/${f}`));
  return {
    rounds: RoundsFile.parse(read("rounds.json")),
    consequence: ConsequenceFile.parse(read("consequence.json")),
    league: LeagueFile.parse(read("league.json")),
    trustMeter: TrustMeterFile.parse(read("trust-meter.json")),
    rubric: RubricFile.parse(read("rubric.json")),
    schedule: ScheduleFile.parse(read("schedule.json")),
    squads: SquadsFile.parse(read("squads.json")),
    trustChallenge: TrustChallengeFile.parse(read("trust-challenge.json")),
    kudos: KudosFile.parse(read("kudos.json")),
    characters,
  };
}

const ev = (round: number, tag: string) =>
  [1, 2, 3].map((i) => ({
    id: `r${round}-${tag}-${i}`,
    kind: "note" as const,
    title: `Evidence ${i}`,
    text: `${tag} ${i}`,
  }));

function syntheticRound(
  round: number,
  effects: Partial<Record<"A" | "B" | "C", LoadedRound["options"][number]["effects"]>>,
): LoadedRound {
  return {
    round,
    matchday: Math.ceil(round / 3),
    title: `Round ${round}`,
    leads: ["KAM"],
    planMinutes: 10,
    onAirMinutes: 5,
    character: "nadia",
    loaded: true,
    scenario: "Test scenario",
    evidence: ev(round, "default"),
    evidenceByPriorChoice: {},
    deliverable: "Plan",
    prompt: "Prompt",
    planHeadings: ["One", "Two", "Three", "Four"],
    dueOptions: ["Day 1"],
    inject: { headline: "Inject", text: "Inject text" },
    onAir: true,
    moments: [],
    inputCards: [],
    options: (["A", "B", "C"] as const).map((id) => ({
      id,
      label: id,
      text: `Option ${id}`,
      effects: effects[id] ?? { points: id === "A" ? 10 : id === "C" ? 5 : 0 },
    })),
  };
}

/** A full test season. Option A is always the best path (10 points). */
export function syntheticSeason(): Content {
  const base = seedContent();
  const rounds = Array.from({ length: 9 }, (_, i) => syntheticRound(i + 1, {}));
  rounds[1] = {
    ...syntheticRound(2, {
      B: { points: 0, zeroPlan: true, tickets: [{ id: "T-009", status: "critical", round: 5 }] },
    }),
    evidenceByPriorChoice: { "1": { A: ev(2, "after-1A"), B: ev(2, "after-1B"), C: ev(2, "after-1C") } },
  };
  rounds[1].options[1] = {
    ...rounds[1].options[1]!,
    breaking: { round: 5, headline: "T-009 critical", text: "Round 2 comes back" },
  };
  rounds[3] = syntheticRound(4, { B: { points: 0, tickets: [{ id: "T-013", status: "added", round: 5 }] } });
  rounds[5] = { ...syntheticRound(6, {}), actionLogFeeds: 8 };
  rounds[6] = syntheticRound(7, { B: { points: 0, revenueDisputed: true } });
  rounds[8] = syntheticRound(9, {
    A: { points: 10, mandateLabel: "mandate renewed" },
    C: { points: 0, mandateLabel: "retained at a loss" },
  });
  return { ...base, rounds: { meta: { source: "test" }, rounds } };
}
