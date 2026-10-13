import type { StorylineConfig } from '../config';
import { bestStyle, fitOf, needOf, type Lens } from '../lens';
import { createEngine } from './engine';
import { neededStyles } from './policies';
import type { Style } from './rules';
import type { EngineView } from './view';

/**
 * Four scripted players with contrasting ways of leading, for the report's narrative tests (D143 to D145).
 * They follow the strategies of the report audit: each plays the whole run deterministically from the
 * seed, reading only what the view shows a participant.
 * - coach: people first. Fits each person's style, coaches and meets the weakest person in the style
 *   they need, with warm words, and answers every message.
 * - driver: results first. Directs everyone every week, sets goals and gives directive feedback with
 *   blunt, numbers first words, and briefs the sponsor on the numbers.
 * - bystander: reads people and then does nothing. Opens every profile, sets the fitting style each
 *   week, and takes no action and answers nothing.
 * - warmMismatch: warm words, wrong styles. Picks the style that fits each person least, every week and
 *   in every conversation, and says caring, partnering words.
 */
export type Strategy = 'coach' | 'driver' | 'bystander' | 'warmMismatch';
export const STRATEGIES: Strategy[] = ['coach', 'driver', 'bystander', 'warmMismatch'];

type LensLike = Pick<Lens, 'styles' | 'fit'>;
type Member = EngineView['members'][number];

const WARM = 'I hear you, and thank you for telling me. How are you finding things this week? What would help you most? Let us work this out together and agree the next step by Friday.';
const BLUNT = 'The numbers are behind and that is not acceptable. Hit your call targets this week. I need the CRM updated by tomorrow. No excuses.';
const COACH_SAY: Record<string, string> = {
  D: 'I hear you, thank you for being honest. Here is the plan, step by step: first the call list, then the follow ups. I need you to send me the CRM update by tomorrow. What is getting in the way?',
  G: 'Thank you, I appreciate the effort. Let me explain why this matters for the funnel, and I will coach you on the next two calls. Does that make sense? What would help you most?',
  P: 'I understand, that sounds hard. Let us work this out together. What do you think we should change? How can I help this week? Let us agree the next step by Friday.',
  E: 'Thank you, I trust you with this. It is your call how you want to run the account; I will step back. What do you need from me? Let me know your next step this week.'
};
const BRIEF = 'Honestly, we are behind on 2 stages and I own that. The biggest risk is the proposal stage. I will coach the team through it, and here is the plan: first the call lists, then the demos by Friday. What I need from you is support with two key accounts.';
const DRIVER_BRIEF = 'Revenue is the only thing that matters. I have told the team to push harder and I am holding them to their numbers every day.';

const stats = (m: Member) => ({ skill: m.skill ?? 0, morale: m.morale ?? 0, result: m.result ?? 0 });
/** The style that fits a need least: a clear miss, the last in lens order. */
const worstStyle = (lens: LensLike, need: ReturnType<typeof needOf>) => [...lens.styles].reverse().find(s => fitOf(lens, s.key, need) === 2)?.key ?? lens.styles[lens.styles.length - 1].key;
const optionFor = (v: EngineView, action: string, style: Style) => v.actions.find(a => a.key === action)?.options.find(o => o.key === ({ D: 'directing', G: 'guiding', P: 'partnering', E: 'entrusting' } as Record<string, string>)[style])?.key;

/** Plays a whole run with one scripted strategy. */
export async function playStrategy(config: StorylineConfig, strategy: Strategy, seed: number) {
  const engine = createEngine(config, { seed });
  const lens = config.lens;
  const high = config.thresholds.high;
  let v = engine.view();
  const free = (key: string, id?: string) => {
    const a = v.actions.find(x => x.key === key);
    return !!a && a.cost <= v.clock.capacityLeft && (id ? !a.blockedFor[id] : !a.blocked);
  };
  const act = async (action: string, memberIds: string[], say: string, style?: Style) => {
    const option = style ? optionFor(v, action, style) : undefined;
    const r = await engine.dispatch({ type: 'planAction', action, memberIds, ...(option ? { option } : {}) });
    v = r.view;
    if (r.interactionId) v = (await engine.dispatch({ type: 'submitInteraction', interactionId: r.interactionId, text: say })).view;
  };
  while (v.phase !== 'ended') {
    if (v.phase === 'style') {
      const fits = await neededStyles(engine, high, lens);
      v = engine.view();
      const pick = (m: Member): Style => strategy === 'driver' ? 'D' : strategy === 'warmMismatch' ? worstStyle(lens, needOf(stats(m), high)) : fits[m.id];
      v = (await engine.dispatch({ type: 'confirmStyles', styles: Object.fromEntries(v.members.map(m => [m.id, pick(m)])) })).view;
    }
    if (strategy !== 'bystander') {
      let guard = 20;
      while (v.clock.capacityLeft >= 1 && guard-- > 0) {
        const present = v.members.filter(m => m.away === 0);
        const weakest = [...present].sort((a, b) => (stats(a).morale + stats(a).result) - (stats(b).morale + stats(b).result))[0];
        if (!weakest) break;
        const need = needOf(stats(weakest), high);
        if (strategy === 'coach') {
          const style = bestStyle(lens, need);
          const words = COACH_SAY[style] ?? WARM;
          if (stats(weakest).skill < 50 && free('coach', weakest.id)) await act('coach', [weakest.id], words, style);
          else if (free('f2f', weakest.id)) await act('f2f', [weakest.id], words, style);
          else if (free('meet')) await act('meet', [], COACH_SAY.P, 'P');
          else if (free('goals', weakest.id)) await act('goals', [weakest.id], words, style);
          else break;
        } else if (strategy === 'driver') {
          // The weakest result first: goals, then feedback, then a team meeting, all directing.
          const lowest = [...present].sort((a, b) => stats(a).result - stats(b).result)[0];
          if (free('goals', lowest.id)) await act('goals', [lowest.id], BLUNT, 'D');
          else if (free('feedback', lowest.id)) await act('feedback', [lowest.id], BLUNT, 'D');
          else if (free('meet')) await act('meet', [], BLUNT, 'D');
          else break;
        } else {
          const style = worstStyle(lens, need);
          if (free('f2f', weakest.id)) await act('f2f', [weakest.id], WARM, style);
          else if (free('coach', weakest.id)) await act('coach', [weakest.id], WARM, style);
          else if (free('meet')) await act('meet', [], WARM, worstStyle(lens, 'highSkill_lowMorale'));
          else break;
        }
      }
      for (const message of v.inbox.filter(x => x.from !== 'news' && x.kind !== 'news')) {
        const o = await engine.dispatch({ type: 'openConversation', kind: message.briefing ? 'sponsor' : 'reply', messageId: message.id });
        const words = message.briefing ? (strategy === 'driver' ? DRIVER_BRIEF : BRIEF) : strategy === 'driver' ? BLUNT : strategy === 'coach' ? COACH_SAY.P : WARM;
        v = (await engine.dispatch({ type: 'submitInteraction', interactionId: o.interactionId!, text: words })).view;
      }
    }
    v = (await engine.dispatch({ type: 'endPeriod' })).view;
    if (v.pendingReward) v = (await engine.dispatch({ type: 'chooseReward', reward: v.pendingReward[0] })).view;
    if (v.phase === 'periodEnd') v = (await engine.dispatch({ type: 'startNextPeriod' })).view;
  }
  return { view: v, engine };
}
