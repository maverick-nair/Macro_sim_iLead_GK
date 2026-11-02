/** Round moment rules (pure). Placeholder from the foundation; the moments feature fills it in. */
import type { Content } from "../../shared/content-schema.ts";
import type { SeasonState } from "./types.ts";

/** League value for the Challenges category (Lift, Faisal), 0 to 1, or undefined while none is scored. */
export function challengesValue(_state: SeasonState): number | undefined {
  return undefined;
}

/** League value for the Boardroom category, 0 to 1, or undefined until the boardroom is scored. */
export function boardroomValue(_state: SeasonState): number | undefined {
  return undefined;
}

/** Most Improved: replay Trust Meter minus the original conversation's Trust Meter, or null. */
export function mostImproved(_state: SeasonState, _content: Content): number | null {
  return null;
}
