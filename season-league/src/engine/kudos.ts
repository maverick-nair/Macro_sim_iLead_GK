/** Kudos rules (pure). Placeholder from the foundation; the season shell feature fills it in. */
import type { Content } from "../../shared/content-schema.ts";
import type { SeasonState } from "./types.ts";

/** The matchday whose kudos step is due now (all its loaded rounds played, not yet closed), or null. */
export function kudosDue(_content: Content, _state: SeasonState): number | null {
  return null;
}
