import type { EngineView } from '../../engine/contract';

/**
 * The Actions panel's groups (D234), apart from the fits now rules (`guidance.ts`): the board needs these on its
 * first paint, the rules only once a person is chosen, so the rules load on demand and stay out of the first load.
 */

/** What an action is for, in the panel's order: live conversations, growing the person, role decisions, the whole team. */
export const INTENTS = ['talk', 'develop', 'decide', 'team'] as const;
export type Intent = (typeof INTENTS)[number];

type ActionV = EngineView['actions'][number];

/** By the engine's rule; a whole team action is Team whatever its rule. */
const BY_RULE: Record<ActionV['rule'], Intent> = {
  styleOption: 'talk', weeklyStyle: 'talk', trend: 'talk',
  training: 'develop', assess: 'develop', reward: 'develop',
  swap: 'decide', fire: 'decide', hire: 'decide'
};
export const intentOf = (a: Pick<ActionV, 'rule' | 'scope'>): Intent => (a.scope === 'team' ? 'team' : BY_RULE[a.rule] ?? 'decide');

/** Items in intent order, keeping the authored order inside each group. */
export function byIntent<T>(items: T[], of: (item: T) => Intent): T[] {
  return items.map((item, i) => ({ item, i, at: INTENTS.indexOf(of(item)) })).sort((a, b) => a.at - b.at || a.i - b.i).map(x => x.item);
}
