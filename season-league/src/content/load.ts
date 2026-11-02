/**
 * Content loading. The game asks the server for the content files at start-up (/api/content), so a new
 * cohort is a content change only. If the server cannot be reached, it falls back to the copy bundled at
 * build time. Either way everything is validated before the game starts.
 */
import { type Content, parseContent } from "../../shared/content-schema.ts";
import rounds from "../../content/rounds.json";
import consequence from "../../content/consequence.json";
import league from "../../content/league.json";
import trustMeter from "../../content/trust-meter.json";
import rubric from "../../content/rubric.json";
import schedule from "../../content/schedule.json";
import squads from "../../content/squads.json";
import trustChallenge from "../../content/trust-challenge.json";
import kudos from "../../content/kudos.json";

const characterFiles = import.meta.glob("../../content/characters/*.json", {
  eager: true,
  import: "default",
});

export interface LoadedContent {
  content: Content;
  unlockAt: Record<number, number>;
  gapUnlockAt: number | undefined;
  finalUnlockAt: number | undefined;
  source: "server" | "bundled";
}

export type LoadResult = ({ ok: true } & LoadedContent) | { ok: false; errors: string[] };

function finish(content: Content, source: LoadedContent["source"]): LoadResult {
  const unlockAt: Record<number, number> = {};
  for (const m of content.schedule.matchdays) unlockAt[m.matchday] = Date.parse(m.unlockAt);
  const at = (v: string | undefined) => (v ? Date.parse(v) : undefined);
  return {
    ok: true,
    content,
    unlockAt,
    gapUnlockAt: at(content.schedule.gapWeek.unlockAt),
    finalUnlockAt: at(content.schedule.final.unlockAt),
    source,
  };
}

export function loadBundledContent(): LoadResult {
  const characters: Record<string, unknown> = {};
  for (const [path, value] of Object.entries(characterFiles))
    characters[(path.split("/").pop() ?? path).replace(/\.json$/, "")] = value;
  const parsed = parseContent(
    { rounds, consequence, league, trustMeter, rubric, schedule, squads, trustChallenge, kudos },
    characters,
  );
  return parsed.ok ? finish(parsed.content, "bundled") : { ok: false, errors: parsed.errors };
}

export async function loadContent(): Promise<LoadResult> {
  try {
    const res = await fetch("/api/content");
    if (res.ok) {
      const body = (await res.json()) as {
        ok: boolean;
        report: string[];
        raw: Record<string, unknown>;
        characters: Record<string, unknown>;
      };
      if (!body.ok) return { ok: false, errors: body.report.filter((l) => l.startsWith("fail")) };
      const parsed = parseContent(body.raw, body.characters);
      return parsed.ok ? finish(parsed.content, "server") : { ok: false, errors: parsed.errors };
    }
  } catch {
    /* server unreachable: use the bundled copy */
  }
  return loadBundledContent();
}
