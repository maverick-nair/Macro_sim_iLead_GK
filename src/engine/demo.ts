import type { Intent } from './contract';

/**
 * The demo round (D92): an unscored walk through one decision before the run, on an engine of its own
 * (the same storyline, a fixed seed), so the real run's state, log and score are never touched. It
 * teaches the board: setting a style, selecting someone, an instant action and its impact. Conversations
 * are left to the Week 0 practice (D84), so the demo takes these intents only, on the server and the
 * mock alike.
 */
export const DEMO_INTENTS = new Set<Intent['type']>(['confirmStyles', 'openProfile', 'planAction', 'clearOutcome', 'dismissCard']);

/** The seed every demo plays with, so it reads the same for everyone. */
export const DEMO_SEED = 7;

/**
 * Why the demo refuses an intent, or null when it takes it: anything outside `DEMO_INTENTS`, and any
 * action that is not instant (a conversation would open the live screen).
 */
export function demoRefusal(intent: Intent, actionKind: (key: string) => 'live' | 'static' | 'hybrid' | undefined): string | null {
  if (!DEMO_INTENTS.has(intent.type)) return 'notInDemo';
  if (intent.type === 'planAction' && actionKind(intent.action) !== 'static') return 'notInDemo';
  return null;
}
