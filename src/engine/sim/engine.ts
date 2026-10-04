import type { StorylineConfig } from '../config';
import { confirmStyles, IntentError, openConversation, planAction, submitInteraction } from './actions';
import { heuristicEvaluator, type Evaluator } from './evaluator';
import { chooseReward, endPeriod, startNextPeriod } from './period';
import { createRng } from './rng';
import type { Style } from './rules';
import { createSim, member } from './sim';
import type { Change, Outcome, PeriodSummary, Turn } from './types';
import * as live from './live';
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
  | { type: 'sendTurn'; interactionId: string; text: string; usedVoice?: boolean }
  | { type: 'interruptTurn'; interactionId: string; turnId: string; shownChars: number }
  | { type: 'requestHint'; interactionId: string }
  | { type: 'nextCandidate'; interactionId: string }
  | { type: 'chooseCandidate'; interactionId: string; candidateId: string | null }
  | { type: 'endInteraction'; interactionId: string }
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
  /** sendTurn: the NPC's answer, which the client streams. */
  turn?: Turn;
  /** requestHint: the coaching tip. */
  hint?: string;
}

export interface Engine {
  view(): EngineView;
  dispatch(intent: Intent): Promise<Result>;
}

export { IntentError };

export function createEngine(config: StorylineConfig, opts: { seed: number; evaluator?: Evaluator; npc?: live.NpcModel }): Engine {
  const sim = createSim(config, opts.seed);
  const rng = createRng(opts.seed);
  const evaluator = opts.evaluator ?? heuristicEvaluator;
  const npc = opts.npc ?? live.personaNpc;
  const rubric = (actionKey: string) => config.actions.find(a => a.key === actionKey)?.live.rubric;

  /** Evaluates everything the participant said, applies the band's consequences, closes the interaction. */
  async function finish(id: string, extra?: { text: string; usedVoice?: boolean }, npcReply?: string): Promise<Result> {
    const it = sim.interactions[id];
    if (!it) throw new IntentError('Unknown or finished interaction', 'unknownInteraction');
    if (extra) it.turns.push({ id: `t${++sim.seq}`, by: 'you', text: extra.text, voice: extra.usedVoice });
    const text = live.participantText(it);
    if (!text.trim()) throw new IntentError('Say something first', 'empty');
    const ev = await evaluator.evaluate({ format: it.format, text, usedVoice: extra?.usedVoice ?? it.turns.some(t => t.voice), rubric: rubric(it.actionKey) });
    const reply = npcReply ?? (live.lastNpcWords(it) || ((await evaluator.reply?.({ format: it.format, text, band: ev.band })) ?? ''));
    const outcome = submitInteraction(sim, rng, id, ev, reply);
    return { view: buildView(sim), changes: outcome.changes, outcome };
  }
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
        if (r.interactionId) await live.opening(sim, npc, r.interactionId);
        return { view: buildView(sim), changes: r.changes, interactionId: r.interactionId ?? undefined };
      }
      case 'openConversation': {
        const id = openConversation(sim, intent.kind, intent.messageId);
        await live.opening(sim, npc, id);
        return { view: buildView(sim), changes: [], interactionId: id };
      }
      case 'submitInteraction':
        // One shot formats, and any interaction ended with a last word.
        return finish(intent.interactionId, { text: intent.text, usedVoice: intent.usedVoice }, intent.npcReply);
      case 'sendTurn': {
        const turn = await live.sendTurn(sim, npc, intent.interactionId, intent.text, intent.usedVoice);
        return { view: buildView(sim), changes: [], turn };
      }
      case 'interruptTurn':
        live.interruptTurn(sim, intent.interactionId, intent.turnId, intent.shownChars);
        return { view: buildView(sim), changes: [] };
      case 'requestHint': {
        const hint = live.requestHint(sim, intent.interactionId);
        return { view: buildView(sim), changes: [], hint };
      }
      case 'nextCandidate':
        await live.nextCandidate(sim, npc, intent.interactionId);
        return { view: buildView(sim), changes: [] };
      case 'chooseCandidate': {
        const it = sim.interactions[intent.interactionId];
        if (!it?.candidates) throw new IntentError('Not an interview', 'notInterview');
        if (intent.candidateId && !it.candidates.includes(intent.candidateId)) throw new IntentError('Not one of the candidates', 'unknownCandidate');
        it.memberIds = intent.candidateId ? [intent.candidateId] : [];
        return finish(intent.interactionId);
      }
      case 'endInteraction':
        return finish(intent.interactionId);
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
