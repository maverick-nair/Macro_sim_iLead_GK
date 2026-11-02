/** Reads every content file from /content for the CLI scripts. */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export const CONTENT_DIR = process.env.CONTENT_DIR
  ? `${process.env.CONTENT_DIR.replace(/\/$/, "")}/`
  : fileURLToPath(new URL("../content/", import.meta.url));

export function readContentFiles() {
  const read = (f: string) => JSON.parse(readFileSync(join(CONTENT_DIR, f), "utf8")) as unknown;
  const raw: Record<string, unknown> = {
    rounds: read("rounds.json"),
    consequence: read("consequence.json"),
    league: read("league.json"),
    trustMeter: read("trust-meter.json"),
    rubric: read("rubric.json"),
    schedule: read("schedule.json"),
    squads: read("squads.json"),
  };
  const characters: Record<string, unknown> = {};
  const dir = join(CONTENT_DIR, "characters");
  if (existsSync(dir))
    for (const f of readdirSync(dir))
      if (f.endsWith(".json")) characters[f.replace(/\.json$/, "")] = read(`characters/${f}`);
  return { raw, characters };
}
