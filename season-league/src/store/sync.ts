/**
 * Server sync for squad state (F1 one device at a time, F10 server-held state and offline queue).
 * Placeholder from the foundation; the sync feature fills it in. The game store calls:
 * - claim() on check-in and on start-up, to bind this device and pick the newest state;
 * - push() after every save;
 * - flush() on every tick, to send anything queued while offline.
 */
import type { SeasonState } from "../engine/types.ts";

/** Binds this device to the squad and returns the newest state (server or local), or null if none. */
export async function claim(_squadId: string, local: SeasonState | null): Promise<SeasonState | null> {
  return local;
}

/** Queues the state for the server. */
export function push(_state: SeasonState): void {}

/** Sends queued state. Safe to call often. */
export async function flush(): Promise<void> {}
