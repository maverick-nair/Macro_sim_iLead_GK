import type { StorylineConfig } from '../config';
import { bestStyle, needOf, type Lens } from '../lens';
import { DEFAULT_LENS } from '../lensLibrary';
import { createEngine, type Engine } from './engine';
import type { Rng } from './rng';
import { createRng } from './rng';
import type { Style } from './rules';
import type { EngineView } from './view';

/**
 * Automated players for calibration and tests (docs/SIMULATION.md section 9).
 * - passive: keeps the first styles it sets, takes no actions.
 * - random: random styles and random affordable actions, plain conversations.
 * - good: sets the style that fits each member's need and addresses the weakest member with a fitting conversation.
 *
 * "good" reads skill and morale from the view to work out each need, exactly as a sharp participant
 * would from the cards, and picks the style with the lens's fit table. It never reads hidden engine state.
 */
export type Policy = 'passive' | 'random' | 'good';

type LensLike = Pick<Lens, 'styles' | 'fit'>;

/** What the good player says in each Readiness Based style. */
const SAY: Record<string, string> = {
  D: 'I hear you, thank you for being honest. Here is the plan, step by step: first the call list, then the follow ups. I need you to send me the CRM update by tomorrow. What is getting in the way?',
  G: 'Thank you, I appreciate the effort. Let me explain why this matters for the funnel, and I will coach you on the next two calls. Does that make sense? What would help you most?',
  P: 'I understand, that sounds hard. Let us work this out together. What do you think we should change? How can I help this week? Let us agree the next step by Friday.',
  E: 'Thank you, I trust you with this. It is your call how you want to run the account; I will step back. What do you need from me? Let me know your next step this week.'
};
/** In any other lens: the style's own words, with an acknowledgement, a question and a next step. */
const say = (lens: LensLike, key: Style) => {
  if (SAY[key]) return SAY[key];
  const s = lens.styles.find(x => x.key === key);
  return `Thank you, I hear you. ${s ? `${s.name}. ${s.short}` : ''} What would help you most? Let me know your next step this week.`;
};
const PLAIN = 'Please do better this week.';
/** A sponsor briefing as the good player gives it: owns the number, names the risk, asks for what is needed. */
const BRIEF = 'Honestly, we are behind on 2 stages and I own that. The biggest risk is the proposal stage. I will coach the team through it, and here is the plan: first the call lists, then the demos by Friday. What I need from you is support with two key accounts.';

/**
 * Opens every profile not opened yet, as a participant reading the cards would, then picks the style
 * that fits each need from the stats the view now shows, with the storyline's lens. The view never shows
 * stats before that (D39), nor the fit table.
 */
export async function neededStyles(engine: Engine, high = 70, lens: LensLike = DEFAULT_LENS): Promise<Record<string, Style>> {
  for (const m of engine.view().members) if (!m.statsRevealed) await engine.dispatch({ type: 'openProfile', memberId: m.id });
  return Object.fromEntries(engine.view().members.map(m => [m.id, bestStyle(lens, needOf({ skill: m.skill ?? 0, morale: m.morale ?? 0 }, high))]));
}

const statsOf = (m: EngineView['members'][number]) => ({ skill: m.skill ?? 0, morale: m.morale ?? 0, result: m.result ?? 0 });

async function setStyles(engine: Engine, v: EngineView, pick: (m: EngineView['members'][number]) => Style) {
  return engine.dispatch({ type: 'confirmStyles', styles: Object.fromEntries(v.members.map(m => [m.id, pick(m)])) });
}

export async function play(config: StorylineConfig, policy: Policy, seed: number) {
  const engine = createEngine(config, { seed });
  const rng: Rng = createRng(seed ^ 0x9e3779b9);
  const first: Record<string, Style> = {};
  const lens = config.lens;
  const keys = lens.styles.map(s => s.key);
  let v = engine.view();
  const high = config.thresholds.high;
  while (v.phase !== 'ended') {
    if (v.phase === 'style') {
      const good = policy === 'good' ? await neededStyles(engine, high, lens) : {};
      v = engine.view();
      v = (await setStyles(engine, v, m => {
        if (policy === 'good') return good[m.id];
        if (policy === 'passive') return (first[m.id] ??= rng.pick(keys));
        return rng.pick(keys);
      })).view;
    }
    if (policy !== 'passive') {
      let guard = 20;
      while (v.clock.capacityLeft >= 1 && guard-- > 0) {
        const step = policy === 'good' ? goodStep(v, high, lens) : randomStep(v, rng, lens);
        if (!step) break;
        const r = await engine.dispatch({ type: 'planAction', ...step.intent });
        v = r.view;
        if (r.interactionId) v = (await engine.dispatch({ type: 'submitInteraction', interactionId: r.interactionId, text: step.say })).view;
      }
      for (const msg of v.inbox.filter(x => x.from !== 'news' && x.kind !== 'news')) {
        if (policy === 'random' && rng.chance(0.5)) continue;
        const o = await engine.dispatch({ type: 'openConversation', kind: msg.briefing ? 'sponsor' : 'reply', messageId: msg.id });
        v = (await engine.dispatch({ type: 'submitInteraction', interactionId: o.interactionId!, text: policy === 'good' ? (msg.briefing ? BRIEF : SAY.P) : PLAIN })).view;
      }
    }
    const end = await engine.dispatch({ type: 'endPeriod' });
    v = end.view;
    if (v.pendingReward) v = (await engine.dispatch({ type: 'chooseReward', reward: v.pendingReward[0] })).view;
    if (v.phase === 'periodEnd') v = (await engine.dispatch({ type: 'startNextPeriod' })).view;
  }
  return { view: v, share: v.money.value / config.money.target, engine };
}

type Step = { intent: { action: string; option?: string; memberIds: string[] }; say: string };

/** The team meeting line: Partnering in Readiness Based Leadership, otherwise the style that fits capable but cautious people. */
const teamSay = (lens: LensLike) => (lens.styles.some(s => s.key === 'P') ? SAY.P : say(lens, bestStyle(lens, 'highSkill_lowMorale')));

function goodStep(v: EngineView, high: number, lens: LensLike): Step | null {
  const free = (key: string, id?: string) => {
    const a = v.actions.find(x => x.key === key);
    return a && (id ? !a.blockedFor[id] : !a.blocked);
  };
  // Help the weakest available member with a fitting one to one.
  const weakest = [...v.members].filter(m => m.away === 0).sort((a, b) => (statsOf(a).morale + statsOf(a).result) - (statsOf(b).morale + statsOf(b).result))[0];
  if (!weakest) return null;
  const words = say(lens, bestStyle(lens, needOf(statsOf(weakest), high)));
  if (statsOf(weakest).skill < 50 && free('coach', weakest.id)) return { intent: { action: 'coach', memberIds: [weakest.id] }, say: words };
  if (free('f2f', weakest.id)) return { intent: { action: 'f2f', memberIds: [weakest.id] }, say: words };
  if (free('meet')) return { intent: { action: 'meet', memberIds: [] }, say: teamSay(lens) };
  if (free('goals', weakest.id)) return { intent: { action: 'goals', memberIds: [weakest.id] }, say: words };
  return null;
}

function randomStep(v: EngineView, rng: Rng, lens: LensLike): Step | null {
  const candidates = v.actions.filter(a => a.cost <= v.clock.capacityLeft && a.key !== 'fire' && a.key !== 'hire' && a.key !== 'swap');
  const keys = lens.styles.map(s => s.key);
  for (let i = 0; i < 6; i++) {
    const a = rng.pick(candidates);
    if (a.scope === 'team') {
      const opts = a.options.filter(o => !o.blocked && o.cost <= v.clock.capacityLeft);
      // A plain line, or the first or last style (Directing or Entrusting by default).
      if (!a.blocked && opts.length) return { intent: { action: a.key, option: rng.pick(opts).key, memberIds: [] }, say: rng.pick([PLAIN, say(lens, keys[0]), say(lens, keys[keys.length - 1])]) };
      continue;
    }
    const m = rng.pick(v.members);
    const opts = a.options.filter(o => o.cost <= v.clock.capacityLeft && !o.targets && !o.pickStage);
    if (!a.blockedFor[m.id] && opts.length) return { intent: { action: a.key, option: rng.pick(opts).key, memberIds: [m.id] }, say: rng.pick([PLAIN, say(lens, rng.pick(keys))]) };
  }
  return null;
}
