import type { ChoiceOption, StorylineConfig } from '../config';
import type { NeedKey } from '../lens';
import type { Rng } from './rng';
import type { StakeholderTraits } from './stakeholderPlayers';
import type { Level } from './syntheticSpeech';
import type { EngineView } from './view';

/**
 * How a synthetic player decides (D112, D149): a `Policy` is a set of traits and, optionally, hooks that
 * replace one part of the level's way of playing. The four levels are traits only; the archetypes
 * (`./syntheticArchetypes`) and the probes (`./syntheticProbes`) add hooks. The player in `./synthetic`
 * asks its policy at each decision and falls back to the level's play when a hook is absent or answers
 * null. Hooks see the participant's view and the player's own notes, never the engine's hidden state.
 */

export const LEVELS = ['beginner', 'developing', 'proficient', 'expert'] as const;
export type LevelKey = (typeof LEVELS)[number];

/**
 * A level's traits (0 to 1 are probabilities):
 *   diagnose      reads a person's need right from their profile and picks a style that fits it
 *   oneStyle      falls back to its one default style for a person, whatever they need
 *   adapt         looks again at each person every week instead of keeping last week's style
 *   events        answers an event or a message that expects an answer
 *   focus         spends its time on the person who needs it most, not on whoever comes to mind
 *   fitAction     picks the action that suits the need (coaching for skill, a 1:1 for morale)
 *   keepPromises  follows up on a promise before it is due
 *   promise       makes a promise in a conversation
 *   extras        uses spare days on team energy, training and assessing role fit
 *   waste         spends spare days on whatever is at hand, in any style (it overspends its time)
 *   turns         how many lines it says in a conversation
 *   polish        speaks at its full level in a conversation (otherwise one level lower, as on an off day)
 *   slip          says something that blames, now and then
 *   decide        makes a choice event's decision at all (otherwise its default applies, D137)
 *   weigh         weighs people, leadership and business in a decision (otherwise takes the best short term business)
 *
 * Every trait but `promise` and `turns` is a skill: moving one level's value to the next level's never
 * lowers the score (D151, the monotonicity test in synthetic.test.ts). `promise` and `turns` are habits.
 */
export interface PersonaTraits {
  diagnose: number; oneStyle: number; adapt: number; events: number; focus: number; fitAction: number;
  keepPromises: number; promise: number; extras: number; waste: number; turns: [number, number]; polish: number; slip: number;
  /** Choice events (D137, D140): makes the decision at all, and weighs people and leadership beside business. */
  decide: number; weigh: number;
}

/** The traits that are skills, with the direction that is better. */
export const SKILL_TRAITS: ReadonlyArray<[keyof PersonaTraits, 1 | -1]> = [
  ['diagnose', 1], ['oneStyle', -1], ['adapt', 1], ['events', 1], ['focus', 1], ['fitAction', 1], ['keepPromises', 1], ['extras', 1], ['waste', -1], ['polish', 1], ['slip', -1], ['decide', 1], ['weigh', 1]
];

/** D151: polish rises with the level (Proficient was below Developing). */
export const PERSONA_TRAITS: Record<LevelKey, PersonaTraits> = {
  beginner: { diagnose: 0.1, oneStyle: 0.85, adapt: 0.2, events: 0.1, focus: 0.2, fitAction: 0.2, keepPromises: 0, promise: 0.3, extras: 0, waste: 0.9, turns: [1, 1], polish: 0.6, slip: 0.04, decide: 0.5, weigh: 0.05 },
  developing: { diagnose: 0.6, oneStyle: 0.15, adapt: 0.6, events: 0.5, focus: 0.6, fitAction: 0.6, keepPromises: 0.4, promise: 0.3, extras: 0.4, waste: 0.3, turns: [2, 2], polish: 0.7, slip: 0, decide: 0.8, weigh: 0.5 },
  proficient: { diagnose: 0.8, oneStyle: 0, adapt: 0.8, events: 0.8, focus: 0.75, fitAction: 0.8, keepPromises: 0.8, promise: 0.4, extras: 0.6, waste: 0.05, turns: [2, 3], polish: 0.85, slip: 0, decide: 0.95, weigh: 0.8 },
  expert: { diagnose: 0.97, oneStyle: 0, adapt: 1, events: 0.97, focus: 0.95, fitAction: 0.97, keepPromises: 1, promise: 0.5, extras: 0.9, waste: 0, turns: [3, 4], polish: 0.95, slip: 0, decide: 1, weigh: 0.97 }
};

export type Member = EngineView['members'][number];
export type ActionView = EngineView['actions'][number];

/** One decision on the board. */
export interface Step { action: string; option?: string; memberIds: string[]; stage?: string; why: 'event' | 'promise' | 'develop' | 'extra' | 'waste' | 'probe'; eventKey?: string }

/** What a hook may read and do: the player's view helpers and its own notes. */
export interface PlayerApi {
  readonly config: StorylineConfig;
  readonly rng: Rng;
  /** Choice events draw on their own stream (D137): the same seed makes the same decisions whatever else differs. */
  readonly choiceRng: Rng;
  readonly keys: string[];
  readonly level: Level;
  readonly t: PersonaTraits;
  /** The style set for each person this week. */
  readonly styles: Record<string, string>;
  /** The player's own notes between decisions (what it did and when). */
  readonly memo: Map<string, number>;
  need(m: Member): NeedKey | null;
  stats(m: Member): { skill: number; morale: number; result: number };
  stepFor(v: EngineView, key: string, memberId: string | null, why: Step['why'], style?: string): Step | null;
  liveLeft(v: EngineView): boolean;
  neediest(v: EngineView): Member[];
  bestActionFor(v: EngineView, m: Member): string | null;
  teamStyle(v: EngineView): string;
  /** The level's own spare day choices (team energy, training, role fit, a hire). */
  extra(v: EngineView): Step | null;
}

export type Respond = 'member' | 'team' | 'sponsor';

export interface Policy {
  traits: PersonaTraits;
  level: Level;
  /** A style for this person this week, or null to choose as the level does. */
  style?(p: PlayerApi, m: Member, need: NeedKey | null, prev: string | undefined): string | null;
  /** The style a team meeting is held in, or null for the level's choice. */
  meetingStyle?(p: PlayerApi, v: EngineView): string | null;
  /** Weights of skill, morale and result when picking the action that does most for a person. */
  weights?(need: NeedKey | null): [number, number, number];
  /** The chance of answering an event or message, by who it comes from; left out, the `events` trait. */
  respond?(kind: Respond): number;
  /** Replaces every board decision (the probes): a step, or null to end the week. */
  next?(p: PlayerApi, v: EngineView): Step | null;
  /** Comes first on the board, before events and development. */
  first?(p: PlayerApi, v: EngineView): Step | null;
  /** Replaces the level's spare days used well. */
  extra?(p: PlayerApi, v: EngineView): Step | null;
  /** Who needs time most, first. */
  neediest?(p: PlayerApi, v: EngineView): Member[];
  /** Which option of an action: the first simple one (default), the costliest or the cheapest. */
  option?: 'first' | 'boldest' | 'safest';
  /** What every email does, instead of reading the trend. */
  email?: 'warn' | 'congratulate';
  /** False: never calls a team meeting on its own. */
  meetings?: boolean;
  /** At most this many actions of its own a week; events it answers and promises it keeps come on top. */
  budget?: number;
  /**
   * A choice event (D137, D152): the option to decide, false to leave it to its default, or null to decide as
   * the level does (`levelChoice` in `./syntheticChoices`).
   */
  choose?(p: PlayerApi, event: { key: string; default?: string }, options: ChoiceOption[]): ChoiceOption | false | null;
  /**
   * Stakeholders outside the team (D165, D152): how often it answers their requests, engages them before anyone
   * asks, and how many lines it says; left out, the level's (`STAKEHOLDER_TRAITS`); false leaves them alone (probes).
   */
  stakeholders?: StakeholderTraits | false;
}

export const levelOf = (k: LevelKey): Level => LEVELS.indexOf(k) as Level;

export const levelPolicy = (k: LevelKey): Policy => ({ traits: PERSONA_TRAITS[k], level: levelOf(k) });

/** The first action of the storyline with this rule (and scope), if any. */
export function ruleAction(config: StorylineConfig, rule: string, scope?: 'member' | 'team') {
  return config.actions.find(a => a.rule === rule && (!scope || a.scope === scope));
}

/** The team action whose effect follows each person's weekly style fit (team energy), if any. */
export const energizeAction = (config: StorylineConfig) => config.actions.find(a => a.scope === 'team' && a.kind === 'static' && a.rule === 'weeklyStyle');

/** The team conversation held in a style (the team meeting), if any. */
export const meetingAction = (config: StorylineConfig) => config.actions.find(a => a.scope === 'team' && a.rule === 'styleOption' && a.kind !== 'static');

export const present = (v: EngineView) => v.members.filter(m => m.away === 0);
