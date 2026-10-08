import type { StorylineConfig } from '../config';
import { bestStyle, fitOf, needOf, type NeedKey } from '../lens';
import type { Copy } from '../copy';
import { createEngine, IntentError, type Engine, type Intent, type Result } from './engine';
import { heuristicEvaluator, type Evaluator } from './evaluator';
import { personaNpc, type NpcModel } from './live';
import { createRng, seedFrom, type Rng } from './rng';
import { ARCHETYPE_COPY, ARCHETYPE_POLICIES, ARCHETYPES, type ArchetypeKey } from './syntheticArchetypes';
import { energizeAction, LEVELS, levelPolicy, meetingAction, PERSONA_TRAITS, present, type ActionView, type LevelKey, type Member, type PersonaTraits, type PlayerApi, type Policy, type Respond, type Step } from './syntheticPolicy';
import { probeKey, probePolicy, type Probe } from './syntheticProbes';
import { planFields, templateSpeaker, type Level, type SpeakerContext, type SyntheticSpeaker } from './syntheticSpeech';
import type { Evaluation } from './types';
import type { EngineView } from './view';
import type { RunSummary } from '../report/summary';

/**
 * Synthetic players (D112, D149 to D151, docs/CALIBRATION-SYNTHETIC.md): four proficiency levels and four
 * player types that play a whole run, conversations included, for GenieKreator's "Test with synthetic
 * players", and the probes that look for dominant strategies. Each is a policy over the participant's view
 * and intents, never the engine's hidden state, with probabilities drawn from a seeded stream, so runs vary
 * between seeds and replay exactly for one seed. They read styles, needs and actions from the storyline, so
 * they play any lens and any action set.
 *
 * The parts live apart so each can change on its own: the traits and the policy hooks in
 * `./syntheticPolicy`, the player types in `./syntheticArchetypes`, the probes in `./syntheticProbes`, the
 * words in `./syntheticSpeech`. This file is the player that runs a policy through the engine.
 */

export const PERSONAS = LEVELS;
export type PersonaKey = LevelKey;
/** Every synthetic player: the four levels, then the four player types. */
export const PLAYERS = [...LEVELS, ...ARCHETYPES] as const;
export type PlayerKey = LevelKey | ArchetypeKey;
export { ARCHETYPES, PERSONA_TRAITS, type ArchetypeKey, type PersonaTraits, type Policy, type Probe };
export { levelOf } from './syntheticPolicy';

/** English names and how each plays, for the author's screen and the AI player's prompt. */
export const PERSONA_COPY: Record<PlayerKey, { name: string; label: string; plays: string }> = {
  beginner: { name: 'Beginner', label: 'Low performer', plays: 'Uses one style for everyone, misreads what people need, gives short closed replies, ignores events and forgets promises. Spends time on whatever is at hand.' },
  developing: { name: 'Developing', label: 'Average performer', plays: 'Picks the right style about half the time, gives generic replies, answers some events and follows up sometimes.' },
  proficient: { name: 'Proficient', label: 'High performer', plays: 'Reads most needs, asks open questions, keeps most promises and adjusts style most weeks.' },
  expert: { name: 'Expert', label: 'Exceptional performer', plays: 'Reads each person\'s need and adapts every week, uncovers hidden concerns, handles events and sequences development.' },
  ...ARCHETYPE_COPY
};

export const isLevel = (p: string): p is LevelKey => (LEVELS as readonly string[]).includes(p);

/** The policy a player plays by: a level's traits, or a player type's traits and hooks. */
export const policyOf = (p: PlayerKey): Policy => (isLevel(p) ? levelPolicy(p) : ARCHETYPE_POLICIES[p]);

export interface PlayOptions {
  speaker?: SyntheticSpeaker;
  evaluator?: Evaluator;
  npc?: NpcModel;
  /** How this persona plays, in the author's words (the AI player reads it). */
  describe?: string;
  /** A probe for a dominant strategy (`./syntheticProbes`): its policy replaces the persona's. */
  probe?: Probe;
  /** Tests: play by this policy instead of the persona's (the trait monotonicity test). */
  policy?: Policy;
  signal?: AbortSignal;
  /**
   * Words engine copy (message codes) as English text for the transcript and the AI player: pass
   * `wordEnglish` (src/i18n/engineCopyEn) or the app's `wordCopy`. Left out, a message shows as its code.
   * Injected so the engine stays free of the copy catalog and the app's first load is not split for it.
   */
  word?: (c: Copy) => string;
}

/** One conversation as it happened, with the evaluator's reading. */
export interface SyntheticConversation {
  period: number;
  sub: number;
  actionKey: string;
  actionName: string;
  format: string;
  memberIds: string[];
  names: string[];
  /** The style the player meant to show, and the person's need when the player spoke (from their profile). */
  intent: string | null;
  need: NeedKey | null;
  turns: Array<{ by: 'player' | 'other'; name: string; text: string }>;
  evaluation: Evaluation | null;
  /** The person had a hidden concern, and whether it surfaced here. */
  concern: boolean;
  concernSurfaced: boolean;
}

export interface SyntheticWeek {
  period: number;
  styles: Record<string, string>;
  /** How many of the styles set fit the need (from the engine's week summary). */
  styleFit: { correct: number; total: number } | null;
  actions: Array<{ key: string; name: string; option: string | null; memberIds: string[]; names: string[] }>;
  events: Array<{ key: string; title: string; expected: boolean; handled: boolean }>;
  revenue: number;
  score: number | null;
}

export interface SyntheticRun {
  persona: PlayerKey;
  seed: number;
  probe: Probe | null;
  view: EngineView;
  summary: RunSummary;
  weeks: SyntheticWeek[];
  conversations: SyntheticConversation[];
}

/** Plays one run as a persona (or a probe) and records it week by week. */
export async function playSynthetic(config: StorylineConfig, persona: PlayerKey, seed: number, opts: PlayOptions = {}): Promise<SyntheticRun> {
  const evaluations: Evaluation[] = [];
  const base = opts.evaluator ?? heuristicEvaluator;
  // A probe tests mechanics, not words (D149): what it says shows the style it means, whatever the evaluator reads.
  const meant = { style: null as string | null };
  // The engine's own evaluator, recorded: the playthrough shows what it said about each conversation.
  const evaluator: Evaluator = {
    async evaluate(input) {
      const read = await base.evaluate(input);
      const e = opts.probe && meant.style ? { ...read, styleUsed: meant.style } : read;
      evaluations.push(e);
      return e;
    },
    ...(base.reply ? { reply: (i: Parameters<NonNullable<Evaluator['reply']>>[0]) => base.reply!(i) } : {})
  };
  const engine = createEngine(config, { seed, evaluator, npc: opts.npc ?? personaNpc });
  return new Player(config, engine, persona, seed, opts, evaluations, meant).play();
}

class Player implements PlayerApi {
  readonly rng: Rng;
  readonly t: PersonaTraits;
  readonly level: Level;
  readonly keys: string[];
  readonly memo = new Map<string, number>();
  styles: Record<string, string> = {};
  private readonly policy: Policy;
  private readonly lens: SpeakerContext['lens'];
  private readonly speaker: SyntheticSpeaker;
  private readonly defaultStyle: string;
  private readonly weeks: SyntheticWeek[] = [];
  private readonly conversations: SyntheticConversation[] = [];
  private readonly seen = new Set<string>();
  private readonly decided = new Map<string, boolean>();
  private pending: Array<{ eventKey: string; memberId: string | null; actions: string[]; period: number; messageId: string | null }> = [];
  private readonly failed = new Set<string>();
  /** Actions of its own taken this week (events and promises not counted), for a policy's budget. */
  private own = 0;

  constructor(readonly config: StorylineConfig, private readonly engine: Engine, private readonly persona: PlayerKey, private readonly seed: number, private readonly opts: PlayOptions, private readonly evaluations: Evaluation[], private readonly meant: { style: string | null }) {
    const probe = opts.probe;
    this.policy = opts.policy ?? (probe ? probePolicy(probe, config) : policyOf(persona));
    this.t = this.policy.traits;
    this.level = this.policy.level;
    this.rng = createRng((seed ^ seedFrom(`${persona}:${probe ? `${probe.kind}:${probeKey(probe)}` : ''}`)) >>> 0);
    this.keys = config.lens.styles.map(s => s.key);
    this.lens = { title: config.lens.title, styles: config.lens.styles.map(s => ({ key: s.key, name: s.name, short: s.short, description: s.description })) };
    this.speaker = opts.speaker ?? templateSpeaker;
    this.defaultStyle = probe && 'style' in probe ? probe.style : this.rng.pick(this.keys);
  }

  private english(c: Copy | null | undefined): string {
    if (c === null || c === undefined) return '';
    if (typeof c === 'string') return c;
    return this.opts.word ? this.opts.word(c) : 'code' in c ? c.code : c.template;
  }

  private async send(intent: Intent): Promise<Result> {
    if (this.opts.signal?.aborted) throw Object.assign(new Error('Calibration cancelled'), { name: 'AbortError' });
    return this.engine.dispatch(intent);
  }

  async play(): Promise<SyntheticRun> {
    let v = this.engine.view();
    for (let guard = 0; v.phase !== 'ended' && guard < 400; guard++) {
      if (v.phase === 'style') v = await this.setStyles(v);
      else if (v.phase === 'board') {
        this.own = 0;
        v = await this.board(v);
        const period = v.clock.period;
        v = (await this.send({ type: 'endPeriod' })).view;
        const week = this.weeks.find(w => w.period === period);
        const sum = v.periods.find(p => p.period === period);
        if (week && sum) Object.assign(week, { styleFit: { correct: sum.week.styleFit.correct, total: sum.week.styleFit.total }, revenue: Math.round(sum.valueThisPeriod), score: sum.week.score });
        this.pending = this.pending.filter(p => p.period > period);
      } else if (v.phase === 'periodEnd') {
        if (v.pendingReward?.length) v = (await this.send({ type: 'chooseReward', reward: v.pendingReward[0] })).view;
        if (v.phase === 'periodEnd') v = (await this.send({ type: 'startNextPeriod' })).view;
      } else break;
    }
    return { persona: this.persona, seed: this.seed, probe: this.opts.probe ?? null, view: v, summary: this.engine.summary(), weeks: this.weeks, conversations: this.conversations };
  }

  // ------------------------------------------------------------------------------------------- styles

  need(m: Member): NeedKey | null {
    return m.skill === null || m.morale === null ? null : needOf({ skill: m.skill, morale: m.morale }, this.config.thresholds.high);
  }

  private async setStyles(v: EngineView): Promise<EngineView> {
    // Every profile is opened, as a participant reading the cards would; what the player does with it is its level.
    for (const m of v.members) if (!m.statsRevealed) v = (await this.send({ type: 'openProfile', memberId: m.id })).view;
    const chosen: Record<string, string> = {};
    for (const m of v.members) chosen[m.id] = this.chooseStyle(m);
    this.styles = chosen;
    this.weeks.push({ period: v.clock.period, styles: { ...chosen }, styleFit: null, actions: [], events: [], revenue: 0, score: null });
    return (await this.send({ type: 'confirmStyles', styles: chosen })).view;
  }

  private chooseStyle(m: Member): string {
    const need = this.need(m);
    const prev = this.styles[m.id];
    const own = this.policy.style?.(this, m, need, prev);
    if (own) return own;
    if (this.rng.chance(this.t.oneStyle)) return this.defaultStyle;
    if (prev && !this.rng.chance(this.t.adapt)) return prev;
    if (need && this.rng.chance(this.t.diagnose)) return bestStyle(this.config.lens, need);
    // A misread: a Beginner guesses; the others most often land a near miss (a style one step off), otherwise any style.
    const near = need && this.level > 0 ? this.keys.filter(k => fitOf(this.config.lens, k, need) === 1) : [];
    return near.length && this.rng.chance(0.7) ? this.rng.pick(near) : this.rng.pick(this.keys);
  }

  /** The style that fits the most people present, for a team conversation. */
  teamStyle(v: EngineView): string {
    const here = present(v);
    const cost = (k: string) => here.reduce((s, m) => { const n = this.need(m); return s + (n ? fitOf(this.config.lens, k, n) : 1); }, 0);
    return [...this.keys].sort((a, b) => cost(a) - cost(b))[0];
  }

  // ------------------------------------------------------------------------------------------- board

  private week(period: number) {
    return this.weeks.find(w => w.period === period) ?? this.weeks[this.weeks.length - 1];
  }

  private async board(v: EngineView): Promise<EngineView> {
    for (let steps = 0; steps < 40 && v.phase === 'board'; steps++) {
      v = await this.answer(v);
      if (v.phase !== 'board') break;
      const step = this.next(v);
      if (!step) break;
      v = await this.take(step, v);
    }
    return v;
  }

  private respond(kind: Respond, briefing = false): boolean {
    const p = this.policy.respond ? this.policy.respond(kind) : briefing ? Math.max(this.t.events, 0.3) : this.t.events;
    return this.rng.chance(p);
  }

  /** Event cards and messages: decide once whether to answer, as the persona would; replies cost no time. */
  private async answer(v: EngineView): Promise<EngineView> {
    for (const card of v.cards) {
      if (this.seen.has(card.id)) continue;
      this.seen.add(card.id);
      const ev = this.config.events.find(e => e.key === card.key);
      const expected = !!ev?.response;
      const respond = expected && this.respond(ev?.target === 'team' ? 'team' : 'member');
      if (card.messageId) this.decided.set(card.messageId, respond);
      if (respond && ev?.response) this.pending.push({ eventKey: ev.key, memberId: card.memberId, actions: ev.response.actions, period: v.clock.period, messageId: card.messageId });
      // A blow to the whole team with no set answer: the stronger players talk it through with the team.
      const meet = meetingAction(this.config);
      if (!expected && meet && ev?.target === 'team' && (card.card === 'crisis' || card.card === 'impact') && this.level >= 2 && this.policy.meetings !== false && this.rng.chance(this.t.events * 0.6)) {
        this.pending.push({ eventKey: ev.key, memberId: null, actions: [meet.key], period: v.clock.period, messageId: null });
      }
      this.week(v.clock.period).events.push({ key: card.key, title: this.english(card.title), expected, handled: false });
      v = (await this.send({ type: 'dismissCard', cardId: card.id })).view;
    }
    for (const m of v.inbox) {
      if (m.from === 'news' || m.kind === 'news' || m.state !== 'open') continue;
      // An event delivered as a chat or an email has no card: its message is the event.
      const title = this.english(m.title);
      const ev = this.config.events.find(e => e.response && e.title === title && (e.delivery === 'chat' || e.delivery === 'email'));
      if (ev && !this.seen.has(`event:${m.id}`)) {
        this.seen.add(`event:${m.id}`);
        this.week(v.clock.period).events.push({ key: ev.key, title, expected: true, handled: false });
      }
      if (!this.decided.has(m.id)) this.decided.set(m.id, this.respond(m.briefing || m.from === 'sponsor' ? 'sponsor' : 'member', !!m.briefing));
      if (!this.decided.get(m.id) || this.failed.has(`msg:${m.id}`)) continue;
      this.failed.add(`msg:${m.id}`);
      try {
        const o = await this.send({ type: 'openConversation', kind: m.briefing ? 'sponsor' : 'reply', messageId: m.id });
        const period = v.clock.period;
        v = await this.converse(o.interactionId!, { actionKey: m.briefing ? 'sponsor' : 'reply', actionName: m.briefing ? 'Sponsor briefing' : `Reply: ${title}`, memberIds: m.from === 'sponsor' ? [] : [m.from] }, o.view);
        // An event that came as this message is answered by the reply.
        const done = this.pending.find(p => p.messageId === m.id);
        if (done) this.markHandled(done.eventKey, period);
        else if (ev) this.markHandled(ev.key, period);
      } catch (e) {
        if (!(e instanceof IntentError)) throw e;
        v = this.engine.view();
      }
    }
    return v;
  }

  private markHandled(eventKey: string, period: number) {
    this.pending = this.pending.filter(p => p.eventKey !== eventKey);
    const e = this.week(period).events.find(x => x.key === eventKey) ?? this.weeks.flatMap(w => w.events).find(x => x.key === eventKey);
    if (e) e.handled = true;
  }

  private free(v: EngineView, key: string, memberId?: string | null, option?: string): ActionView | null {
    const a = v.actions.find(x => x.key === key);
    if (!a || this.failed.has(`${v.clock.period}:${key}:${memberId ?? ''}`)) return null;
    if (a.scope === 'member') { if (!memberId || a.blockedFor[memberId]) return null; } else if (a.blocked) return null;
    const o = option ? a.options.find(x => x.key === option) : a.options[0];
    if (!o || o.blocked || o.cost > v.clock.capacityLeft) return null;
    if (o.targets && o.targets[0] > 1) return null;
    return a;
  }

  private live(a: ActionView) { return a.kind !== 'static'; }

  /** A valid intent for an action with a person (or the team), or null when none can be made. */
  stepFor(v: EngineView, key: string, memberId: string | null, why: Step['why'], style?: string): Step | null {
    const a = v.actions.find(x => x.key === key);
    if (!a) return null;
    const options = a.options.filter(o => !o.blocked && o.cost <= v.clock.capacityLeft);
    const simple = options.filter(o => !o.targets && !o.pickStage);
    // The policy's taste: the first simple option, or the costliest, or the cheapest.
    const taste = this.policy.option === 'boldest' ? [...simple].sort((x, y) => y.cost - x.cost)[0] : this.policy.option === 'safest' ? [...simple].sort((x, y) => x.cost - y.cost)[0] : simple[0];
    // An option that names the style the player means, else a simple option (no extra people, no stage to pick).
    const pick = (style && options.find(o => this.config.actions.find(x => x.key === key)?.options.find(c => c.key === o.key)?.style === style))
      ?? taste ?? options.find(o => o.pickStage && !(o.targets && o.targets[0] > 1));
    if (!pick) return null;
    if (!this.free(v, key, a.scope === 'member' ? memberId : null, pick.key)) return null;
    const step: Step = { action: key, option: pick.key, memberIds: a.scope === 'member' && memberId ? [memberId] : [], why };
    if (pick.pickStage) {
      const m = v.members.find(x => x.id === memberId);
      const room = v.funnel.filter(st => st.key !== m?.stage && st.members < v.maxPerStage);
      if (!room.length) return null;
      step.stage = room[0].key;
    }
    return step;
  }

  stats(m: Member) { return { skill: m.skill ?? 50, morale: m.morale ?? 50, result: m.result ?? 50 }; }

  /** Who needs time most: the policy's order, else lowest morale and result first. */
  neediest(v: EngineView): Member[] {
    if (this.policy.neediest) return this.policy.neediest(this, v);
    return present(v).sort((a, b) => (this.stats(a).morale + this.stats(a).result) - (this.stats(b).morale + this.stats(b).result) || a.id.localeCompare(b.id));
  }

  /** The member action that does most for this need in the player's style, from the storyline's effect tables. */
  bestActionFor(v: EngineView, m: Member): string | null {
    const need = this.need(m);
    const style = this.styles[m.id];
    const w = this.policy.weights?.(need) ?? (need === 'highSkill_highMorale' ? [1, 1, 2] : need?.startsWith('lowSkill') ? [2, 1, 1] : [1, 2, 1]);
    let best: { key: string; score: number } | null = null;
    for (const a of this.config.actions) {
      if (a.scope !== 'member' || a.kind === 'static' || a.rule !== 'styleOption') continue;
      const o = a.options.find(x => x.style === style) ?? a.options[0];
      const score = o.effects.m0[0] * w[0] + o.effects.m0[1] * w[1] + o.effects.m0[2] * w[2];
      if (this.free(v, a.key, m.id) && (!best || score > best.score)) best = { key: a.key, score };
    }
    return best?.key ?? null;
  }

  liveLeft(v: EngineView) { return v.liveCap.used < v.liveCap.cap; }

  /** The persona's next decision on the board, or null to end the week. */
  private next(v: EngineView): Step | null {
    if (v.clock.capacityLeft < v.clock.costStep) return null;
    if (this.policy.next) return this.policy.next(this, v);

    // 1. An event the player chose to answer, with the action it calls for.
    for (const p of this.pending) {
      for (const key of p.actions) {
        if (key === 'reply') continue;
        const a = v.actions.find(x => x.key === key);
        if (!a) continue;
        const who = a.scope === 'member' ? p.memberId ?? this.neediest(v)[0]?.id ?? null : null;
        const style = who ? this.styles[who] : this.teamStyle(v);
        const step = this.stepFor(v, key, who, 'event', style);
        if (step) return { ...step, eventKey: p.eventKey };
      }
    }

    // 2. A promise coming due: follow up with that person, in the action that suits them.
    for (const pr of v.promises.filter(x => x.state === 'open' && x.dueInSubPeriods <= 3)) {
      const id = `promise:${pr.id}`;
      if (!this.decided.has(id)) this.decided.set(id, this.rng.chance(this.t.keepPromises));
      if (!this.decided.get(id)) continue;
      const m = v.members.find(x => x.id === pr.memberId);
      if (!m) continue;
      const key = this.bestActionFor(v, m);
      const step = key && this.stepFor(v, key, m.id, 'promise', this.styles[m.id]);
      if (step) return step;
    }

    if (this.policy.budget !== undefined && this.own >= this.policy.budget) return null;
    const first = this.policy.first?.(this, v);
    if (first) return first;

    // 3. Development: a conversation with the person who needs it, in the action that suits the need.
    if (this.liveLeft(v)) {
      const here = this.neediest(v);
      const m = this.rng.chance(this.t.focus) ? here[0] : this.rng.pick(here);
      if (m) {
        // A team meeting when one style fits most of the team, for the players who read the room.
        const team = this.teamStyle(v);
        const fits = present(v).filter(x => this.need(x) && fitOf(this.config.lens, team, this.need(x)!) === 0).length;
        if (this.level >= 2 && this.policy.meetings !== false && fits >= Math.ceil(0.7 * present(v).length)) {
          const meet = meetingAction(this.config);
          const step = meet && this.stepFor(v, meet.key, null, 'develop', team);
          if (step) return step;
        }
        if (this.rng.chance(this.t.fitAction)) {
          const key = this.bestActionFor(v, m);
          const step = key && this.stepFor(v, key, m.id, 'develop', this.styles[m.id]);
          if (step) return step;
        } else {
          const liveOnes = v.actions.filter(a => this.live(a) && a.scope === 'member' && !['fire', 'hire'].includes(a.rule) && this.free(v, a.key, m.id));
          if (liveOnes.length) {
            const step = this.stepFor(v, this.rng.pick(liveOnes).key, m.id, 'develop', this.styles[m.id]);
            if (step) return step;
          }
        }
      }
    }

    // 4. Spare days, used well: team energy when most styles fit, training for low skill, role fit and a hire.
    if (this.rng.chance(this.t.extras)) {
      const step = this.policy.extra ? this.policy.extra(this, v) : this.extra(v);
      if (step) return step;
    }

    // 5. Spare days, used on whatever is at hand: a person action with anyone, in any style, with no thought for
    // what they need (D151). Team wide actions are deliberate choices, never at hand.
    if (this.rng.chance(this.t.waste)) {
      const any = v.actions.filter(a => a.scope === 'member' && a.rule !== 'fire' && a.rule !== 'hire' && v.members.some(m => !a.blockedFor[m.id]));
      for (let i = 0; i < 4 && any.length; i++) {
        const a = this.rng.pick(any);
        const who = this.rng.pick(v.members.filter(m => !a.blockedFor[m.id])).id;
        const step = this.stepFor(v, a.key, who, 'waste', this.rng.pick(this.keys));
        if (step) return step;
      }
    }
    return null;
  }

  extra(v: EngineView): Step | null {
    const period = v.clock.period;
    const fitting = (m: Member) => { const n = this.need(m); return !!n && fitOf(this.config.lens, this.styles[m.id], n) === 0; };
    const here = present(v);
    // Team energy: the effect follows each person's style fit, so only when most styles fit.
    const energize = energizeAction(this.config);
    if (energize && period - (this.memo.get('energized') ?? -10) >= 2 && here.filter(fitting).length >= Math.ceil(0.7 * here.length)) {
      const step = this.stepFor(v, energize.key, null, 'extra');
      if (step) { this.memo.set('energized', period); return step; }
    }
    // Training for the lowest skill, when the style set for them fits.
    const training = this.config.actions.find(a => a.rule === 'training');
    if (training && period - (this.memo.get('trained') ?? -10) >= 2) {
      const low = [...here].filter(m => this.stats(m).skill < 50 && fitting(m)).sort((a, b) => this.stats(a).skill - this.stats(b).skill)[0];
      const step = low && this.stepFor(v, training.key, low.id, 'extra');
      if (step) { this.memo.set('trained', period); return step; }
    }
    // Role fit: assess the person struggling most once, then move them when another stage suits them clearly better.
    const assess = this.config.actions.find(a => a.rule === 'assess');
    const struggling = [...here].sort((a, b) => this.stats(a).result - this.stats(b).result)[0];
    if (assess && !this.memo.has('assessed') && period >= 2 && struggling) {
      const step = this.stepFor(v, assess.key, struggling.id, 'extra');
      if (step) { this.memo.set('assessed', period); return step; }
    }
    const swap = this.config.actions.find(a => a.rule === 'swap');
    if (swap && this.liveLeft(v)) {
      for (const m of here) {
        const better = Object.entries(m.assessments ?? {}).filter(([st, s]) => st !== m.stage && s.result >= this.stats(m).result + 15 && (v.funnel.find(f => f.key === st)?.members ?? 99) < v.maxPerStage);
        if (!better.length) continue;
        const step = this.stepFor(v, swap.key, m.id, 'extra');
        if (step?.stage !== undefined) return { ...step, stage: better[0][0] };
      }
    }
    // A hire when someone has left the team.
    const hire = this.config.actions.find(a => a.rule === 'hire');
    if (hire && v.members.length < this.config.members.length && this.liveLeft(v)) {
      const step = this.stepFor(v, hire.key, null, 'extra');
      if (step) return step;
    }
    return null;
  }

  private async take(step: Step, v: EngineView): Promise<EngineView> {
    const period = v.clock.period;
    let r: Result;
    try {
      r = await this.send({ type: 'planAction', action: step.action, option: step.option, memberIds: step.memberIds, ...(step.stage ? { stage: step.stage } : {}) });
    } catch (e) {
      if (!(e instanceof IntentError)) throw e;
      this.failed.add(`${period}:${step.action}:${step.memberIds[0] ?? ''}`);
      return this.engine.view();
    }
    if (step.why !== 'event' && step.why !== 'promise') this.own++;
    const a = this.config.actions.find(x => x.key === step.action)!;
    // The option in a few words: its style's name when it has one, else its label when short.
    const o = a.options.length > 1 ? a.options.find(x => x.key === step.option) : undefined;
    const option = o ? (o.style ? this.config.lens.styles.find(s => s.key === o.style)?.name ?? null : o.label.length <= 32 ? o.label : null) : null;
    this.week(period).actions.push({ key: a.key, name: a.name, option, memberIds: step.memberIds, names: step.memberIds.map(id => this.nameOf(id)) });
    const after = r.interactionId ? await this.converse(r.interactionId, { actionKey: a.key, actionName: a.name, memberIds: step.memberIds }, r.view) : r.view;
    if (step.eventKey) this.markHandled(step.eventKey, period);
    return after;
  }

  private nameOf(id: string) {
    return this.config.members.find(p => p.id === id)?.name ?? this.config.candidates.find(p => p.id === id)?.name ?? (id === 'sponsor' ? this.config.sponsor.name : id);
  }

  // ------------------------------------------------------------------------------------------- conversations

  /** Plays a conversation to its end and returns the view after it. Each intent's own view is reused. */
  private async converse(id: string, info: { actionKey: string; actionName: string; memberIds: string[] }, start: EngineView): Promise<EngineView> {
    const v = start;
    let now = start;
    const act = async (intent: Intent) => { now = (await this.send(intent)).view; return now; };
    const live = v.live;
    if (!live || live.id !== id) return now;
    const format = live.format;
    const mainId = info.memberIds[0] ?? null;
    const main = mainId ? v.members.find(m => m.id === mainId) ?? null : null;
    const need = main ? this.need(main) : null;
    // The player speaks in the style it set for the person (or, in a team meeting, the one that fits most).
    const intent = format === 'meeting' ? (this.policy.meetingStyle?.(this, v) ?? (this.level >= 2 ? this.teamStyle(v) : this.defaultStyle)) : mainId ? this.styles[mainId] ?? this.defaultStyle : null;
    const [lo, hi] = this.t.turns;
    const turns = lo + Math.floor(this.rng.next() * (hi - lo + 1));
    const promise = !!main && format !== 'email' && this.rng.chance(this.t.promise);
    const slip = this.rng.chance(this.t.slip);
    const variant = Math.floor(this.rng.next() * 1000);
    // An off day: the conversation goes as one level lower would.
    const level = (this.rng.chance(this.t.polish) ? this.level : Math.max(0, this.level - 1)) as Level;
    const before = this.evaluations.length;
    this.meant.style = intent;
    const person = this.config.members.find(p => p.id === mainId);
    const concern = !!person?.hiddenConcern && !main?.shared;
    const emailIntent: 'congratulate' | 'warn' = this.policy.email ?? (() => {
      const trend = mainId ? v.trends[mainId] : undefined;
      const up = trend && trend.length >= 2 ? (trend[trend.length - 1] ?? 0) >= (trend[trend.length - 2] ?? 0) : true;
      // Beginners warn by default; the others read the trend.
      return this.level === 0 ? 'warn' : up ? 'congratulate' : 'warn';
    })();
    // What the player has said so far in this conversation, so a line is never said twice (D151).
    const said: string[] = [];
    const ctx = (turn: number): SpeakerContext => {
      const m = mainId ? now.members.find(x => x.id === mainId) ?? null : null;
      const n = m ? this.need(m) : null;
      const total = now.money.target || 1;
      const ideal = now.funnel.filter(st => st.throughput < st.idealThroughput).length;
      return {
        persona: this.persona, level, describe: this.opts.describe ?? PERSONA_COPY[this.persona].plays, lens: this.lens, intent, format,
        action: { key: info.actionKey, name: info.actionName },
        person: m ? { id: m.id, name: m.name, first: m.name.split(' ')[0], mood: m.mood, trust: m.trust, skill: m.skill, morale: m.morale, result: m.result, needLabel: n ? this.config.lens.needs[n].label : null, concern: m.shared } : null,
        team: present(now).map(x => x.name.split(' ')[0]),
        transcript: (now.live?.turns ?? []).map(t => ({ by: t.by === 'you' ? 'player' as const : 'other' as const, name: t.by === 'you' ? 'You' : this.nameOf(t.by), text: this.english(t.text) })),
        turn, turns, promise, emailIntent, variant, slip, said,
        business: { share: now.money.value / total, runShare: now.clock.runShare, behind: ideal, risk: now.funnel.find(st => st.bottleneck)?.name ?? null }
      };
    };
    const say = async (turn: number) => {
      const text = (await this.speaker.say(ctx(turn))).trim() || 'Thanks.';
      said.push(text);
      return text;
    };
    let turnsSeen: SyntheticConversation['turns'] = [];
    const capture = () => {
      const l = now.live;
      if (l && l.id === id) turnsSeen = l.turns.map(t => ({ by: t.by === 'you' ? 'player' as const : 'other' as const, name: t.by === 'you' ? 'You' : this.nameOf(t.by), text: this.english(t.text) }));
    };
    try {
      if (format === 'email') {
        const text = await say(0);
        turnsSeen = [{ by: 'player', name: 'You', text }];
        await act({ type: 'submitInteraction', interactionId: id, text });
      } else if (format === 'plan') {
        const fields = planFields(ctx(0));
        await act({ type: 'submitPlan', interactionId: id, plan: fields, text: await say(0) });
        if (turns > 1 && now.live && !now.live.closed && now.live.turnsLeft > 0) await act({ type: 'sendTurn', interactionId: id, text: await say(1) });
        capture();
        await act({ type: 'endInteraction', interactionId: id });
      } else if (format === 'interview') {
        const candidates = live.candidates ?? [];
        for (let c = 0; c < Math.max(1, candidates.length); c++) {
          if (c > 0) { await act({ type: 'nextCandidate', interactionId: id }); said.length = 0; }
          for (let i = 0; i < turns; i++) {
            if (!now.live || now.live.closed || now.live.turnsLeft <= 0) break;
            await act({ type: 'sendTurn', interactionId: id, text: await say(i) });
          }
          capture();
        }
        // Choosing: the stronger players read the candidates' records; a Beginner takes the first.
        const ranked = [...candidates].sort((a, b) => {
          const pa = this.config.candidates.find(p => p.id === a.id)?.start, pb = this.config.candidates.find(p => p.id === b.id)?.start;
          return ((pb?.skill ?? 0) + (pb?.morale ?? 0)) - ((pa?.skill ?? 0) + (pa?.morale ?? 0));
        });
        const choice = this.level >= 2 ? ranked[0] : candidates[0];
        await act({ type: 'chooseCandidate', interactionId: id, candidateId: choice?.id ?? null });
      } else {
        for (let i = 0; i < turns; i++) {
          if (!now.live || now.live.id !== id || now.live.closed || now.live.turnsLeft <= 0) break;
          await act({ type: 'sendTurn', interactionId: id, text: await say(i) });
        }
        capture();
        await act({ type: 'endInteraction', interactionId: id });
      }
    } catch (e) {
      if (!(e instanceof IntentError)) throw e;
      // Anything the engine refused leaves the conversation unfinished, as a participant walking away would.
      now = this.engine.view();
      if (now.live?.id === id) await act({ type: 'abandonInteraction', interactionId: id }).catch(() => undefined);
    }
    this.meant.style = null;
    const evaluation = this.evaluations.length > before ? this.evaluations[this.evaluations.length - 1] : null;
    const after = mainId ? now.members.find(m => m.id === mainId) : null;
    this.conversations.push({
      period: v.clock.period, sub: v.clock.subPeriod, actionKey: info.actionKey, actionName: info.actionName, format, memberIds: info.memberIds, names: info.memberIds.map(x => this.nameOf(x)),
      intent: format === 'sponsor' || format === 'interview' ? null : intent, need, turns: turnsSeen, evaluation,
      concern, concernSurfaced: concern && !!after?.shared
    });
    return now;
  }
}
