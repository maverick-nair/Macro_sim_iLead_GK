/** Trust Challenge rules (pure). Placeholder from the foundation; the Trust Challenge feature fills it in. */
import type { Content } from "../../shared/content-schema.ts";
import type { SeasonState } from "./types.ts";

/** League value for the Trust Challenge category, 0 to 1, or undefined while no sitting is scored. */
export function trustChallengeValue(_state: SeasonState, _content: Content): number | undefined {
  return undefined;
}
