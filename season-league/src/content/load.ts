/**
 * Loads and validates the content files at build time. Nothing about the case lives in components.
 */
import {
  Character,
  ConsequenceFile,
  type Content,
  LeagueFile,
  RoundsFile,
  RubricFile,
  ScheduleFile,
  SquadsFile,
  TrustMeterFile,
} from "../../shared/content-schema.ts";
import rounds from "../../content/rounds.json";
import consequence from "../../content/consequence.json";
import league from "../../content/league.json";
import trustMeter from "../../content/trust-meter.json";
import rubric from "../../content/rubric.json";
import schedule from "../../content/schedule.json";
import squads from "../../content/squads.json";

const characterFiles = import.meta.glob("../../content/characters/*.json", {
  eager: true,
  import: "default",
});

export type LoadResult =
  { ok: true; content: Content; unlockAt: Record<number, number> } | { ok: false; errors: string[] };

export function loadContent(): LoadResult {
  const errors: string[] = [];
  const parse = <T>(
    name: string,
    schema: {
      safeParse: (
        v: unknown,
      ) =>
        | { success: true; data: T }
        | { success: false; error: { issues: { path: PropertyKey[]; message: string }[] } };
    },
    value: unknown,
  ): T | undefined => {
    const r = schema.safeParse(value);
    if (r.success) return r.data;
    for (const i of r.error.issues) errors.push(`${name} ${i.path.join(".")}: ${i.message}`);
    return undefined;
  };
  const characters: Content["characters"] = {};
  for (const [path, value] of Object.entries(characterFiles)) {
    const c = parse(path.split("/").pop() ?? path, Character, value);
    if (c) characters[c.id] = c;
  }
  const content = {
    rounds: parse("rounds.json", RoundsFile, rounds),
    consequence: parse("consequence.json", ConsequenceFile, consequence),
    league: parse("league.json", LeagueFile, league),
    trustMeter: parse("trust-meter.json", TrustMeterFile, trustMeter),
    rubric: parse("rubric.json", RubricFile, rubric),
    schedule: parse("schedule.json", ScheduleFile, schedule),
    squads: parse("squads.json", SquadsFile, squads),
    characters,
  };
  if (errors.length) return { ok: false, errors };
  const c = content as Content;
  const unlockAt: Record<number, number> = {};
  for (const m of c.schedule.matchdays) unlockAt[m.matchday] = Date.parse(m.unlockAt);
  return { ok: true, content: c, unlockAt };
}
