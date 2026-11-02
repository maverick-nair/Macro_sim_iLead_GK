/** Round moment actions. Placeholder from the foundation; the moments feature fills it in. */
import type { LiveRound } from "../engine/types.ts";

/**
 * Called by the game store whenever the live round changes. Opens a moment (character's first line)
 * when one starts, and runs its scorer when its status turns to "scoring".
 */
export function onLiveChange(_before: LiveRound | null, _after: LiveRound | null): void {}
