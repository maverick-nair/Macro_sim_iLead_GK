import type { EngineView } from '../engine/contract';

/**
 * A run is in progress past onboarding: anything after the first style setting, or style setting
 * with history. The app then opens on the board instead of onboarding.
 */
export const runInProgress = (v: EngineView) => v.phase !== 'style' || v.history.length > 0;
/** The welcome back recap shows when the run is on the board, or in style setting with history. */
export const showsRecap = (v: EngineView) => v.phase === 'board' || (v.phase === 'style' && v.history.length > 0);
