/**
 * Squad state storage. localStorage today, behind an interface so a server store can replace it.
 * Every access is wrapped: private windows and blocked storage must not stop the game.
 */
import { migrateSeason } from "../engine/season.ts";
import type { SeasonState } from "../engine/types.ts";

export interface SquadStorage {
  load(squadId: string): SeasonState | null;
  save(state: SeasonState): void;
  currentSquad(): string | null;
  setCurrentSquad(squadId: string | null): void;
  getQueue(): unknown[];
  setQueue(items: unknown[]): void;
  getSetting<T>(key: string, fallback: T): T;
  setSetting(key: string, value: unknown): void;
}

const PREFIX = "season-league:";

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(PREFIX + key);
    else localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* storage unavailable: keep playing in memory */
  }
}

export const localStore: SquadStorage = {
  load: (id) => migrateSeason(read<unknown>(`squad:${id}`, null)),
  save: (state) => write(`squad:${state.squadId}`, state),
  currentSquad: () => read<string | null>("current", null),
  setCurrentSquad: (id) => write("current", id),
  getQueue: () => read<unknown[]>("queue", []),
  setQueue: (items) => write("queue", items),
  getSetting: (key, fallback) => read(`setting:${key}`, fallback),
  setSetting: (key, value) => write(`setting:${key}`, value),
};
