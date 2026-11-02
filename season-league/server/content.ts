/**
 * Runtime content. The server reads the content files from CONTENT_DIR (default ./content) and serves
 * them to the game at /api/content, so a new cohort is a content change, not a code change (F22).
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Express } from "express";
import { CONTENT_FILES, validateContent } from "../shared/content-schema.ts";

export const CONTENT_DIR = process.env.CONTENT_DIR
  ? process.env.CONTENT_DIR.replace(/\/$/, "")
  : fileURLToPath(new URL("../content", import.meta.url));

export function readContentRaw(): { raw: Record<string, unknown>; characters: Record<string, unknown> } {
  const read = (f: string) => JSON.parse(readFileSync(join(CONTENT_DIR, f), "utf8")) as unknown;
  const raw: Record<string, unknown> = {};
  for (const [key, file] of Object.entries(CONTENT_FILES))
    raw[key] = existsSync(join(CONTENT_DIR, file)) ? read(file) : undefined;
  const characters: Record<string, unknown> = {};
  const dir = join(CONTENT_DIR, "characters");
  if (existsSync(dir))
    for (const f of readdirSync(dir))
      if (f.endsWith(".json")) characters[f.replace(/\.json$/, "")] = read(`characters/${f}`);
  return { raw, characters };
}

/** Writes one content file (setup only). The caller validates the whole set afterwards. */
export function writeContentFile(relative: string, value: unknown) {
  const path = join(CONTENT_DIR, relative);
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

export function registerContent(app: Express) {
  app.get("/api/content", (_req, res) => {
    try {
      const { raw, characters } = readContentRaw();
      const report = validateContent(raw, characters);
      res.json({ ok: report.ok, report: report.lines, raw, characters });
    } catch (err) {
      res.status(500).json({ ok: false, report: [String(err)] });
    }
  });
}
