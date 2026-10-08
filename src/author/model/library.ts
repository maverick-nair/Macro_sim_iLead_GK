import type { LensId } from '../../engine/lens';
import type { Plays } from './draft';

/**
 * The action library (docs/design/genie/LibraryAdmin.dc.html, D108): the interaction types the platform
 * can run, and the action templates authors pick from. Every template plays as one of Sales Elevator's
 * tested engine actions (`template`), so a new action arrives with working rules; the author renames
 * and rewords it. Core actions are always included; optional ones start on or off.
 */

export interface InteractionType {
  key: string;
  name: string;
  how: string;
  scoredBy: string;
  status: 'live' | 'beta';
}

export const INTERACTION_TYPES: InteractionType[] = [
  { key: 'live_1to1', name: 'Live 1:1', how: 'Voice or text conversation', scoredBy: 'AI evaluator', status: 'live' },
  { key: 'meeting', name: 'Team meeting', how: 'Several AI characters, raised hands', scoredBy: 'AI evaluator', status: 'live' },
  { key: 'message', name: 'Written message', how: 'Email or chat', scoredBy: 'AI evaluator', status: 'live' },
  { key: 'plan', name: 'Written plan', how: 'Structured fields', scoredBy: 'AI evaluator', status: 'live' },
  { key: 'interview', name: 'Interview', how: 'Candidate conversation', scoredBy: 'AI evaluator', status: 'live' },
  { key: 'static', name: 'Static decision', how: 'Pick an option', scoredBy: 'Style fit rules', status: 'live' },
  { key: 'hybrid', name: 'Decision, then a conversation', how: 'Pick, then explain live', scoredBy: 'Rules and AI', status: 'live' },
  { key: 'video', name: 'Video role play', how: 'Camera on, face to face', scoredBy: 'AI evaluator', status: 'beta' }
];

export const PLAYS_LABEL: Record<Plays, string> = { static: 'Static decision', live: 'Live AI conversation', hybrid: 'Decision, then a conversation' };

export interface ActionTemplate {
  key: string;
  name: string;
  description: string;
  /** An interaction type key. */
  type: string;
  plays: Plays;
  /** The Sales Elevator action whose rules it plays with. */
  template: string;
  group: 'team' | 'person';
  inNew: 'core' | 'on' | 'off';
  version: number;
  /** The format line in the list ("1:1", "Team meeting"). */
  format: string;
  /** Lenses whose authors see it under "Suggested for your lens". */
  lenses?: LensId[];
}

/** Sales Elevator's thirteen actions, as the library holds them. */
export const ENGINE_TEMPLATES: ActionTemplate[] = [
  { key: 'meet', name: 'Meet the team', description: 'Meet the whole team and set out your goals for the weeks ahead.', type: 'meeting', plays: 'live', template: 'meet', group: 'team', inNew: 'core', version: 4, format: 'Team meeting' },
  { key: 'energize', name: 'Energize the team', description: 'A team lunch, or a two day team building activity.', type: 'static', plays: 'static', template: 'energize', group: 'team', inNew: 'on', version: 3, format: '3 options' },
  { key: 'hire', name: 'Hire member', description: 'Interview candidates for an open seat.', type: 'interview', plays: 'live', template: 'hire', group: 'team', inNew: 'on', version: 3, format: 'Interview' },
  { key: 'f2f', name: 'Meet face to face', description: 'A one to one conversation.', type: 'live_1to1', plays: 'live', template: 'f2f', group: 'person', inNew: 'core', version: 4, format: '1:1' },
  { key: 'coach', name: 'Coach member', description: 'Work through the job with them.', type: 'live_1to1', plays: 'live', template: 'coach', group: 'person', inNew: 'core', version: 4, format: '1:1' },
  { key: 'feedback', name: 'Give feedback', description: 'Tell them how it is going and agree what changes.', type: 'message', plays: 'live', template: 'feedback', group: 'person', inNew: 'core', version: 3, format: 'Chat' },
  { key: 'goals', name: 'Set goals', description: 'Agree goals, measures and support for the week.', type: 'plan', plays: 'live', template: 'goals', group: 'person', inNew: 'core', version: 3, format: 'Written plan' },
  { key: 'email', name: 'Send email', description: 'Write to up to 3 people. Congratulate or warn; replies arrive in the inbox.', type: 'message', plays: 'live', template: 'email', group: 'person', inNew: 'on', version: 3, format: 'Written' },
  { key: 'training', name: 'Send for training', description: 'Build skill away from the desk. Up to 3 people.', type: 'static', plays: 'static', template: 'training', group: 'person', inNew: 'on', version: 3, format: '3 courses' },
  { key: 'assess', name: 'Assess member', description: 'See how this person would do in another stage. No effect on them.', type: 'static', plays: 'static', template: 'assess', group: 'person', inNew: 'on', version: 2, format: 'Instant' },
  { key: 'reward', name: 'Reward member', description: 'Recognize someone, then tell them why.', type: 'hybrid', plays: 'hybrid', template: 'reward', group: 'person', inNew: 'on', version: 3, format: 'Decide, then talk' },
  { key: 'swap', name: 'Swap roles', description: 'Move people between stages, then explain the decision to them.', type: 'hybrid', plays: 'hybrid', template: 'swap', group: 'person', inNew: 'on', version: 2, format: 'Pick 2, then talk' },
  { key: 'fire', name: 'Let go', description: 'Remove someone from the team, then have the exit conversation.', type: 'hybrid', plays: 'hybrid', template: 'fire', group: 'person', inNew: 'off', version: 2, format: 'Decide, then talk' }
];

/** Templates beyond Sales Elevator's: each plays with the rules of an engine action. */
export const EXTRA_TEMPLATES: ActionTemplate[] = [
  { key: 'skip_level', name: 'Skip level check in', description: 'A short talk with someone two levels down, with their manager\'s permission.', type: 'live_1to1', plays: 'live', template: 'f2f', group: 'person', inNew: 'off', version: 1, format: '1:1', lenses: ['servant', 'team_amplifier'] },
  { key: 'delegate', name: 'Delegate an account', description: 'Choose who takes a key account, then brief them.', type: 'hybrid', plays: 'hybrid', template: 'goals', group: 'person', inNew: 'off', version: 1, format: 'Decide, then talk', lenses: ['readiness_based', 'team_amplifier', 'servant'] },
  { key: 'mentor', name: 'Pair with a mentor', description: 'Match two people for four weeks; skill grows slowly.', type: 'static', plays: 'static', template: 'coach', group: 'person', inNew: 'off', version: 1, format: 'Pick 2', lenses: ['readiness_based', 'servant'] },
  { key: 'difficult', name: 'Difficult conversation', description: 'Address a behavior issue in a 1:1.', type: 'live_1to1', plays: 'live', template: 'feedback', group: 'person', inNew: 'off', version: 2, format: '1:1', lenses: ['six_styles', 'inspire_deliver'] },
  { key: 'recognize', name: 'Recognize in the team channel', description: 'Public praise, then a word with them; lifts morale, can cause envy.', type: 'hybrid', plays: 'hybrid', template: 'reward', group: 'person', inNew: 'off', version: 1, format: 'Decide, then talk', lenses: ['inspire_deliver', 'five_practices'] },
  { key: 'career', name: 'Career conversation', description: 'Explore goals; can surface a hidden concern.', type: 'live_1to1', plays: 'live', template: 'f2f', group: 'person', inNew: 'off', version: 2, format: '1:1', lenses: ['readiness_based', 'five_practices', 'servant'] },
  { key: 'town_hall', name: 'Pricing town hall', description: 'Bring the team together on a pricing change and hear their concerns.', type: 'meeting', plays: 'live', template: 'meet', group: 'team', inNew: 'off', version: 1, format: 'Team meeting', lenses: ['adaptive', 'five_practices'] },
  { key: 'discount', name: 'Discount approval', description: 'Approve or refuse a discount a rep asks for, then explain the decision.', type: 'hybrid', plays: 'hybrid', template: 'reward', group: 'person', inNew: 'off', version: 1, format: 'Decide, then talk', lenses: ['inspire_deliver', 'six_styles'] },
  { key: 'retro', name: 'Run a retrospective', description: 'Ask the team what helped and what got in the way this week.', type: 'meeting', plays: 'live', template: 'meet', group: 'team', inNew: 'off', version: 1, format: 'Team meeting', lenses: ['servant', 'adaptive', 'team_amplifier'] },
  { key: 'stretch', name: 'Offer a stretch assignment', description: 'Give someone a task just beyond what they can do today.', type: 'hybrid', plays: 'hybrid', template: 'goals', group: 'person', inNew: 'off', version: 1, format: 'Decide, then talk', lenses: ['team_amplifier', 'readiness_based'] }
];

export const ACTION_TEMPLATES: ActionTemplate[] = [...ENGINE_TEMPLATES, ...EXTRA_TEMPLATES];

/** The ways an engine rule can play: style based actions play any way; the others keep their rule's way. */
export function canPlay(rule: string, plays: Plays): Plays[] {
  return rule === 'styleOption' ? ['static', 'live', 'hybrid'] : [plays];
}

/** How many templates use an interaction type. */
export const usingType = (type: string) => ACTION_TEMPLATES.filter(t => t.type === type).length;
