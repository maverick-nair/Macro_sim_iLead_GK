import { parseStoryline, type StorylineConfig } from '../../../src/engine/config';
import salesElevator from '../../../src/engine/storylines/sales-elevator.json';
import type { ModelEvaluation } from '../evaluator/schema';
import type { NpcTurnContext } from '../types';

/** Shared test fixtures: the Sales Elevator storyline, an NPC turn and a recorded evaluator answer. */

const parsed = parseStoryline(salesElevator);
if (!parsed.ok) throw new Error(parsed.issues.join('\n'));
export const config: StorylineConfig = parsed.config;

export const person = (id: string) => config.members.find(m => m.id === id)!;

export function kentTurn(over: Partial<NpcTurnContext> = {}): NpcTurnContext {
  const kent = person('kent');
  return {
    format: 'roleplay', actionName: 'Meet face to face', said: 'How are you doing? What is on your mind?', turnsSoFar: 1, turnsLeft: 10, concernRevealed: false,
    speaker: { id: 'kent', name: kent.name, persona: kent, mood: 'concerned', trust: 50 },
    locale: 'en-US', history: [{ by: 'kent', name: kent.name, text: 'You wanted to see me?' }],
    story: { organisation: 'Innov8', sponsor: { name: 'Paula Jacob', title: 'Regional Sales Director' } },
    ...over
  };
}

export const PARTICIPANT = 'Thanks for making time, Kent. How are you finding the role so far?\nI hear you. Let us agree one change together, and I will come back to you by Friday.';

/** A recorded, valid evaluator answer for `PARTICIPANT` on the roleplay rubric with one skill. */
export function recordedEvaluation(over: Partial<ModelEvaluation> = {}): ModelEvaluation {
  return {
    dimensions: [
      { key: 'listening', band: 'strong', reason: 'Asked an open question and acknowledged him.', quotes: ['How are you finding the role so far?', 'I hear you.'] },
      { key: 'clarity', band: 'strong', reason: 'Set a dated next step.', quotes: ['I will come back to you by Friday'] },
      { key: 'involvement', band: 'adequate', reason: 'Proposed agreeing a change together.', quotes: ['Let us agree one change together'] }
    ],
    skills: [{ key: 'coaching_for_growth', band: 'adequate', quotes: ['How are you finding the role so far?'] }],
    style: { key: 'P', confidence: 0.7 },
    flags: { openQuestions: 1, acknowledged: true, invitedContribution: false, specificNextStep: true, concernSurfaced: true },
    redFlags: [],
    promise: { quote: 'I will come back to you by Friday', dueInSubPeriods: 3, fulfilledBy: ['f2f'] },
    emailIntent: null,
    ...over
  };
}
