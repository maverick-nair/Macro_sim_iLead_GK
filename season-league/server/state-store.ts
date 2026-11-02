/**
 * Server-held game data, kept as JSON files under DATA_DIR (default server/data). One store for every
 * feature: squad state with device binding, round snapshots, league results, kudos, imported mission
 * results, the shared screen feed and the setup lock.
 *
 * Writes are synchronous and atomic (write to a temp file, then rename), which is enough for the scale in
 * the PRD (up to 6 squads, one shared screen).
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export const DATA_DIR = process.env.DATA_DIR
  ? process.env.DATA_DIR.replace(/\/$/, "")
  : fileURLToPath(new URL("./data", import.meta.url));

mkdirSync(DATA_DIR, { recursive: true });

function readJson<T>(file: string, fallback: T): T {
  const path = join(DATA_DIR, file);
  if (!existsSync(path)) return fallback;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch {
    return fallback;
  }
}

function writeJson(file: string, value: unknown) {
  const path = join(DATA_DIR, file);
  mkdirSync(join(path, ".."), { recursive: true });
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(value, null, 2));
  renameSync(tmp, path);
}

/** ISO time in KSA (UTC+3), for the audit log and stored timestamps. */
export function ksaNow(ms = Date.now()): string {
  return new Date(ms + 3 * 3600_000).toISOString().replace(/\.\d+Z$/, "+03:00");
}

// Squad state and device binding (F1, F10)

export interface StoredSquad {
  squadId: string;
  /** The device currently allowed to write. Another device claiming the squad takes it over. */
  deviceId: string | null;
  revision: number;
  /** The SeasonState, stored as sent by the device. */
  state: unknown;
  updatedAt: string;
}

export function getSquad(squadId: string): StoredSquad | null {
  return readJson<StoredSquad | null>(`squads/${squadId}.json`, null);
}

export function putSquad(entry: StoredSquad) {
  writeJson(`squads/${entry.squadId}.json`, entry);
}

export function listSquads(): StoredSquad[] {
  const dir = join(DATA_DIR, "squads");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => readJson<StoredSquad | null>(`squads/${f}`, null))
    .filter((s): s is StoredSquad => s !== null);
}

/** Recovery: a snapshot of the squad state after every round (NFR Recovery). */
export function saveSnapshot(squadId: string, label: string, state: unknown) {
  writeJson(`snapshots/${squadId}/${label}.json`, { at: ksaNow(), state });
}

export function listSnapshots(squadId: string): string[] {
  const dir = join(DATA_DIR, "snapshots", squadId);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(/\.json$/, ""))
    .sort();
}

export function getSnapshot(squadId: string, label: string): { at: string; state: unknown } | null {
  return readJson(`snapshots/${squadId}/${label}.json`, null);
}

// League results, as pushed by each squad device

export function getResults(): Record<string, unknown> {
  return readJson("results.json", {});
}

export function putResults(squadId: string, results: unknown) {
  writeJson("results.json", { ...getResults(), [squadId]: results });
}

// Kudos (F16): giver squad id, then matchday, then receiving squad id

export type KudosLedger = Record<string, Record<string, Record<string, number>>>;

export function getKudos(): KudosLedger {
  return readJson("kudos.json", {});
}

export function putKudos(ledger: KudosLedger) {
  writeJson("kudos.json", ledger);
}

// Imported mission and application check results (0 to 100 per squad)

export interface MissionResult {
  squadId: string;
  missions: number | null;
  applicationCheck: number | null;
  importedAt: string;
}

export function getMissions(): Record<string, MissionResult> {
  return readJson("missions.json", {});
}

export function putMissions(rows: Record<string, MissionResult>) {
  writeJson("missions.json", rows);
}

// Shared screen feed

export interface Feed {
  breaking: unknown;
  trust: unknown;
  updatedAt: string | null;
}

export function getFeed(): Feed {
  return readJson("feed.json", { breaking: null, trust: null, updatedAt: null });
}

export function putFeed(feed: Feed) {
  writeJson("feed.json", feed);
}

/** Setup locks when a session starts: any squad with a kicked-off or completed round. */
export function sessionStarted(): boolean {
  return listSquads().some((sq) => {
    const st = sq.state as { live?: unknown; records?: Record<string, unknown> } | null;
    if (!st) return false;
    return (st.live !== null && st.live !== undefined) || Object.keys(st.records ?? {}).length > 0;
  });
}
