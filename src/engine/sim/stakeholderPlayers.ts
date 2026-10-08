import type { StorylineConfig } from '../config';
import type { Engine, Intent, Result } from './engine';
import { IntentError } from './errors';
import type { Rng } from './rng';
import type { Evaluation } from './types';
import type { EngineView } from './view';

/**
 * Automated players and stakeholders (D165). Kept apart from the players' own files so a storyline without
 * stakeholders plays exactly as before (nothing here draws a number or sends an intent then):
 *
 *   calibration   `policyStakeholders`, for the calibration players (policies.ts): good answers every request
 *                 and engages the stakeholder whose relationship is weakest once a week; random does either
 *                 half the time with any words; passive and careless never do.
 *   synthetic     `StakeholderPlayer`, for the synthetic players (synthetic.ts), by the policy's `stakeholders`
 *                 traits (D152, D166): a level's from `STAKEHOLDER_TRAITS` (a Beginner neglects stakeholders and,
 *                 when it does answer, escalates poorly; an Expert answers every request in time and manages up
 *                 and across before anyone asks), a player type's own, or none for a probe.
 *
 * The words are templates that the evaluator reads like any participant's (the same rubric cues), so what a
 * stronger player says rates higher. With an AI speaker the team conversations use it; these stay templates.
 */

type Sh = EngineView['stakeholders'][number];
type Type = Sh['interactions'][number]['type'] | 'reply';
type Level = 0 | 1 | 2 | 3;

/** What each level says, by the conversation's type: Expert and Proficient lines carry the rubric's cues. */
const LINES: Record<Level, Record<Type, string>> = {
  3: {
    meet: 'Thank you for making time. What matters most to you this quarter? I hear you. I propose we agree one next step: I will send you the plan by Friday, because it means fewer surprises for your team.',
    present: 'Honestly, we are at 92% of plan and behind on 2 stages, and I own that. The biggest risk is the proposal stage. Here is the plan: first the call lists, then the demos by Friday. What I need from you is support with two key accounts.',
    negotiate: 'What matters most to you here? We could move the date, or if you can give us 2 more days, we will commit to the release. Agreed: I will confirm by Friday.',
    email: 'Thank you for raising this. Specifically, we will deliver the fix by Friday because the release depends on it, and I will confirm the date with you this week. Please let me know what else you need.',
    reply: 'Thank you, I understand. Here is the plan: I will send it to you today, and we will agree the next step by Friday. What else do you need?'
  },
  2: {
    meet: 'Thanks for your time. What do you need from us this month? I will send the plan by Friday.',
    present: 'We are at 90% of plan and I own the gap. The risk is proposals. The plan is to coach two people this week, and I need your support on one account.',
    negotiate: 'What do you need from your side? We could split the work. I will confirm by Friday.',
    email: 'Thanks for the note. Specifically, we will have it ready by Friday. Please let me know if anything changes.',
    reply: 'Thanks, I understand. I will come back to you by Friday with the plan.'
  },
  1: {
    meet: 'Thanks for meeting. We are working on it and will get back to you this week.',
    present: 'Things are going okay overall. We are working hard and should be fine.',
    negotiate: 'We really need this. Can you help us out?',
    email: 'Thanks for the update. We will look into it.',
    reply: 'Thanks for the update. We will look into it and get back to you this week.'
  },
  0: {
    meet: 'Look, we are doing our best. The team keeps missing things, so I will just escalate it to Dana.',
    present: 'It is fine. Some people on my team are not pulling their weight.',
    negotiate: 'We need it. Just approve it.',
    email: 'Noted.',
    reply: 'Noted. I will pass it on.'
  }
};
/** What a careless calibration player says: nothing the rubric reads. */
const PLAIN = 'Please do better this week.';

const ok = (e: unknown) => { if (!(e instanceof IntentError)) throw e; };
const relation = (s: Sh) => (s.trust + s.satisfaction) / 2;

/** One conversation, said in a line (or a few for a conversation), then ended. Returns the evaluation's band, if any. */
async function speak(send: (i: Intent) => Promise<Result>, view: () => EngineView, id: string, text: string, turns = 1): Promise<void> {
  const live = view().live;
  if (!live || live.id !== id) return;
  if (live.oneShot) { await send({ type: 'submitInteraction', interactionId: id, text }); return; }
  for (let i = 0; i < turns; i++) {
    const l = view().live;
    if (!l || l.id !== id || l.closed || l.turnsLeft <= 0) break;
    await send({ type: 'sendTurn', interactionId: id, text });
  }
  await send({ type: 'endInteraction', interactionId: id });
}

/** The interaction a player picks for a stakeholder: a negotiation once the relationship can carry it, a presentation for a senior one, else a meeting. */
function pickInteraction(s: Sh, strong: boolean) {
  const open = s.interactions.filter(x => !x.blocked);
  if (!open.length) return null;
  const by = (t: Type) => open.find(x => x.type === t);
  if (!strong) return open[0];
  return (relation(s) >= 50 ? by('negotiate') : undefined) ?? (s.kind === 'executive' || s.kind === 'board' ? by('present') : undefined) ?? by('meet') ?? open[0];
}

/** A static option: the one with the best leadership read the author gave, as the good player reads choices. */
function bestOption(config: StorylineConfig, s: Sh, key: string): string | undefined {
  const x = config.stakeholders.find(y => y.key === s.key)?.interactions.find(y => y.key === key);
  const score = { strong: 3, adequate: 2, weak: 1, harmful: 0 } as const;
  const rank = (o: NonNullable<typeof x>['options'] extends (infer T)[] | undefined ? T : never) => (o.read.length ? o.read.reduce((a, r) => a + score[r.band], 0) / o.read.length : 1.5);
  return x?.options ? [...x.options].sort((a, b) => rank(b) - rank(a))[0]?.key : undefined;
}

// ------------------------------------------------------------------------------------- calibration players

/**
 * The calibration players and stakeholders (policies.ts): good answers every request and engages the weakest
 * relationship once a week; random answers and engages half the time; passive and careless never do.
 */
export async function policyStakeholders(engine: Engine, config: StorylineConfig, v: EngineView, policy: string, rng: Rng, done: Map<string, boolean>): Promise<EngineView> {
  if (!config.stakeholders.length || policy === 'passive' || policy === 'careless' || v.phase !== 'board') return v;
  const good = policy !== 'random';
  const send = (i: Intent) => engine.dispatch(i);
  const say = (t: Type) => (good ? LINES[3][t] : rng.pick([PLAIN, LINES[3][t]]));
  // Requests first, before their deadline: decided once each, tried until answered (a meeting needs a day).
  for (const s of v.stakeholders) {
    const r = s.request;
    if (!r) continue;
    if (!done.has(r.id)) done.set(r.id, good || rng.chance(0.5));
    if (!done.get(r.id)) continue;
    try {
      const o = await send({ type: 'openConversation', kind: 'reply', messageId: r.messageId });
      const type = engine.view().live?.stakeholder?.type ?? 'reply';
      await speak(send, () => engine.view(), o.interactionId!, say(type));
      done.set(r.id, false);
    } catch (e) { ok(e); }
  }
  // Once a week, the stakeholder whose relationship is weakest.
  v = engine.view();
  const week = `week:${v.clock.period}`;
  if (done.has(week) || v.clock.capacityLeft < 1) return v;
  done.set(week, true);
  if (!good && rng.chance(0.6)) return v;
  const free = v.stakeholders.filter(s => !s.engaged && s.interactions.some(x => !x.blocked));
  const s = good ? [...free].sort((a, b) => relation(a) - relation(b))[0] : free.length ? rng.pick(free) : undefined;
  const x = s && (good ? pickInteraction(s, true) : rng.pick(s.interactions.filter(y => !y.blocked)));
  if (!s || !x) return v;
  try {
    const option = x.kind === 'static' ? (good ? bestOption(config, s, x.key) : rng.pick(x.options ?? []).key) : undefined;
    const r = await send({ type: 'engageStakeholder', stakeholder: s.key, interaction: x.key, ...(option ? { option } : null) });
    if (r.interactionId) await speak(send, () => engine.view(), r.interactionId, say(x.type));
  } catch (e) { ok(e); }
  return engine.view();
}

// ------------------------------------------------------------------------------------- synthetic personas

/** How a player treats stakeholders (D165): answers a request at all, engages before anyone asks, and lines said. */
export interface StakeholderTraits { answer: number; proactive: number; turns: number }

/** Each level's stakeholder traits; a player type's policy carries its own (D152). */
export const STAKEHOLDER_TRAITS: Record<'beginner' | 'developing' | 'proficient' | 'expert', StakeholderTraits> = {
  beginner: { answer: 0.3, proactive: 0.05, turns: 1 },
  developing: { answer: 0.6, proactive: 0.25, turns: 2 },
  proficient: { answer: 0.9, proactive: 0.6, turns: 2 },
  expert: { answer: 1, proactive: 0.95, turns: 3 }
};

/** A stakeholder conversation as the synthetic run records it (the shape of `SyntheticConversation`). */
export interface StakeholderConversation {
  period: number; sub: number; actionKey: string; actionName: string; format: string; memberIds: string[]; names: string[];
  intent: null; need: null; turns: Array<{ by: 'player' | 'other'; name: string; text: string }>; evaluation: Evaluation | null; concern: boolean; concernSurfaced: boolean;
}

export interface StakeholderHooks {
  config: StorylineConfig;
  /** The player's stakeholder traits: its level's, or its player type's (D152). */
  traits: StakeholderTraits;
  level: Level;
  rng: Rng;
  send: (i: Intent) => Promise<Result>;
  view: () => EngineView;
  /** The evaluations the run has recorded so far, to read the one a conversation adds. */
  evaluations: () => Evaluation[];
  english: (c: unknown) => string;
}

/**
 * A synthetic persona's stakeholder play (D165), called each step on the board: it answers requests the persona
 * chooses to answer and, once a week, engages a stakeholder before anyone asks. It returns the conversations it
 * held and the requests it met or let pass, for the run's record.
 */
export class StakeholderPlayer {
  private readonly seen = new Set<string>();
  /** Whether the persona answers each request, decided once; cleared once answered. */
  private readonly answering = new Map<string, boolean>();
  readonly requests: Array<{ key: string; title: string; period: number; handled: boolean }> = [];
  constructor(private readonly h: StakeholderHooks) {}

  async step(v: EngineView): Promise<{ view: EngineView; conversations: StakeholderConversation[] }> {
    const out: StakeholderConversation[] = [];
    const { config, rng } = this.h;
    if (!config.stakeholders.length || v.phase !== 'board') return { view: v, conversations: out };
    const t = this.h.traits;
    for (const s of v.stakeholders) {
      const r = s.request;
      if (!r) continue;
      if (!this.answering.has(r.id)) {
        this.answering.set(r.id, rng.chance(t.answer));
        this.requests.push({ key: `request:${r.id}`, title: this.h.english(r.title), period: v.clock.period, handled: false });
      }
      if (!this.answering.get(r.id)) continue;
      const c = await this.converse(s, () => this.h.send({ type: 'openConversation', kind: 'reply', messageId: r.messageId }));
      if (c) {
        out.push(c);
        this.answering.set(r.id, false);
        const rec = this.requests.find(x => x.key === `request:${r.id}`);
        if (rec) rec.handled = true;
      }
    }
    v = this.h.view();
    const week = `week:${v.clock.period}`;
    if (this.seen.has(week) || v.clock.capacityLeft < 1) return { view: v, conversations: out };
    this.seen.add(week);
    if (!rng.chance(t.proactive)) return { view: v, conversations: out };
    const strong = this.h.level >= 2;
    const free = v.stakeholders.filter(s => !s.engaged && s.interactions.some(x => !x.blocked));
    // The stronger players go to the relationship that needs it; the others to whoever comes to mind.
    const s = strong ? [...free].sort((a, b) => relation(a) - relation(b))[0] : free.length ? rng.pick(free) : undefined;
    const x = s && pickInteraction(s, strong);
    if (!s || !x) return { view: this.h.view(), conversations: out };
    const option = x.kind === 'static' ? (strong ? bestOption(config, s, x.key) : rng.pick(x.options ?? []).key) : undefined;
    const c = await this.converse(s, () => this.h.send({ type: 'engageStakeholder', stakeholder: s.key, interaction: x.key, ...(option ? { option } : null) }));
    if (c) out.push(c);
    return { view: this.h.view(), conversations: out };
  }

  private async converse(s: Sh, open: () => Promise<Result>): Promise<StakeholderConversation | null> {
    const before = this.h.evaluations().length;
    let r: Result;
    try { r = await open(); } catch (e) { ok(e); return null; }
    const v = this.h.view();
    if (!r.interactionId) return null;
    const live = v.live!;
    const type: Type = live.stakeholder?.type ?? 'reply';
    const words = LINES[this.h.level][type];
    let turns: StakeholderConversation['turns'] = [];
    try {
      const first = this.h.view().live;
      await speak(this.h.send, this.h.view, r.interactionId, words, this.h.traits.turns);
      turns = (first?.turns ?? []).map(t => ({ by: t.by === 'you' ? 'player' as const : 'other' as const, name: t.by === 'you' ? 'You' : s.name, text: this.h.english(t.text) }));
      turns.push({ by: 'player', name: 'You', text: words });
    } catch (e) {
      ok(e);
      if (this.h.view().live?.id === r.interactionId) await this.h.send({ type: 'abandonInteraction', interactionId: r.interactionId }).catch(() => undefined);
    }
    const evaluation = this.h.evaluations().length > before ? this.h.evaluations()[this.h.evaluations().length - 1] : null;
    return {
      period: v.clock.period, sub: v.clock.subPeriod, actionKey: live.actionKey, actionName: this.h.english(live.actionName ?? type), format: live.format, memberIds: [], names: [s.name],
      intent: null, need: null, turns, evaluation, concern: false, concernSurfaced: false
    };
  }
}
