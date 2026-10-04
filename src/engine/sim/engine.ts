import type { StorylineConfig } from '../config';
import { confirmStyles, IntentError, openConversation, planAction, submitInteraction } from './actions';
import { heuristicEvaluator, type Evaluator } from './evaluator';
import { chooseReward, endPeriod, startNextPeriod } from './period';
import { createRng } from './rng';
import type { Style } from './rules';
import { createSim, member } from './sim';
import type { Change, Outcome, PeriodSummary } from './types';
import { buildView, type EngineView } from './view';

/**
 * The iLead engine. Authoritative: the UI sends intents and renders the returned view.
 * In production this runs on the server; the mock engine runs the same code in the browser.
 */
export type Intent =
  | { type: 'confirmStyles'; styles: Record<string, Style>; notes?: Record<string, string> }
  | { type: 'openProfile'; memberId: string }
  | { type: 'planAction'; action: string; option?: string; memberIds: string[]; stage?: string }
  | { type: 'openConversation'; kind: 'reply' | 'sponsor'; messageId?: string }
  | { type: 'submitInteraction'; interactionId: string; text: string; usedVoice?: boolean; npcReply?: string }
  | { type: 'dismissCard'; cardId: string }
  | { type: 'clearOutcome' }
  | { type: 'endPeriod' }
  | { type: 'chooseReward'; reward: string }
  | { type: 'startNextPeriod' };

export interface Result {
  view: EngineView;
  changes: Change[];
  outcome?: Outcome;
  interactionId?: string;
  summary?: PeriodSummary;
}

export interface Engine {
  view(): EngineView;
  dispatch(intent: Intent): Promise<Result>;
}

export { IntentError };

export function createEngine(config: StorylineConfig, opts: { seed: number; evaluator?: Evaluator }): Engine {
  const sim = createSim(config, opts.seed);
  const rng = createRng(opts.seed);
  const evaluator = opts.evaluator ?? heuristicEvaluator;
  let queue = Promise.resolve();

  async function run(intent: Intent): Promise<Result> {
    switch (intent.type) {
      case 'confirmStyles': {
        const changes = confirmStyles(sim, rng, intent.styles, intent.notes);
        return { view: buildView(sim), changes };
      }
      case 'openProfile': {
        const m = member(sim, intent.memberId);
        if (m) m.revealed = true;
        return { view: buildView(sim), changes: [] };
      }
      case 'planAction': {
        const r = planAction(sim, rng, intent);
        return { view: buildView(sim), changes: r.changes, interactionId: r.interactionId ?? undefined };
      }
      case 'openConversation':
        return { view: buildView(sim), changes: [], interactionId: openConversation(sim, intent.kind, intent.messageId) };
      case 'submitInteraction': {
        const it = sim.interactions[intent.interactionId];
        if (!it) throw new IntentError('Unknown or finished interaction', 'unknownInteraction');
        const ev = await evaluator.evaluate({ format: it.format, text: intent.text, usedVoice: intent.usedVoice });
        const reply = intent.npcReply ?? (await evaluator.reply?.({ format: it.format, text: intent.text, band: ev.band })) ?? '';
        const outcome = submitInteraction(sim, rng, intent.interactionId, ev, reply);
        return { view: buildView(sim), changes: outcome.changes, outcome };
      }
      case 'dismissCard':
        sim.cards = sim.cards.filter(c => c.id !== intent.cardId);
        return { view: buildView(sim), changes: [] };
      case 'clearOutcome':
        sim.outcome = null;
        return { view: buildView(sim), changes: [] };
      case 'endPeriod': {
        const summary = endPeriod(sim, rng);
        return { view: buildView(sim), changes: [], summary };
      }
      case 'chooseReward':
        chooseReward(sim, intent.reward);
        return { view: buildView(sim), changes: [] };
      case 'startNextPeriod':
        startNextPeriod(sim);
        return { view: buildView(sim), changes: [] };
    }
  }

  return {
    view: () => buildView(sim),
    // Intents apply strictly in order, even when an evaluation is asynchronous.
    dispatch(intent) {
      const next = queue.then(() => run(intent));
      queue = next.then(() => undefined, () => undefined);
      return next;
    }
  };
}
