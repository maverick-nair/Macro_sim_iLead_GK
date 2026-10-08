import type { StorylineConfig } from '../config';
import { bestStyle, fitOf, needOf, type NeedKey } from '../lens';
import type { Copy } from '../copy';
import { createEngine, IntentError, type Engine, type Intent, type Result } from './engine';
import { heuristicEvaluator, type Evaluator } from './evaluator';
import { personaNpc, type NpcModel } from './live';
import { createRng, seedFrom, type Rng } from './rng';
import { planFields, templateSpeaker, type Level, type SpeakerContext, type SyntheticSpeaker } from './syntheticSpeech';
import type { Evaluation } from './types';
import type { EngineView } from './view';
import type { RunSummary } from '../report/summary';
import { StakeholderPlayer } from './stakeholderPlayers';

/**
 * Synthetic players (D112, docs/CALIBRATION-SYNTHETIC.md): four proficiency levels that play a whole
 * run, conversations included, for GenieKreator's "Test with synthetic players". Each is a policy over
 * the participant's view and intents, never the engine's hidden state, with probabilities drawn from a
 * seeded stream, so runs vary between seeds and replay exactly for one seed. They read styles, needs and
 * actions from the storyline, so they play any lens and any action set.
 *
 * What a persona does, by trait (0 to 1 are probabilities):
 *   diagnose      reads a person's need right from their profile and picks a style that fits it
 *   oneStyle      falls back to its one default style for a person, whatever they need
 *   adapt         looks again at each person every week instead of keeping last week's style
 *   events        answers an event or a message that expects an answer
 *   focus         spends its time on the person who needs it most, not on whoever comes to mind
 *   fitAction     picks the action that suits the need (coaching for skill, a 1:1 for morale)
 *   keepPromises  follows up on a promise before it is due
 *   promise       makes a promise in a conversation
 *   extras        uses spare days on team energy, training and assessing role fit
 *   waste         spends spare days on whatever is at hand (it overspends its time)
 *   turns         how many lines it says in a conversation
 *   polish        speaks at its full level in a conversation (otherwise one level lower, as on an off day)
 *   slip          says something that blames, now and then
 *   decide        makes a choice event's decision at all (otherwise its default applies, D137)
 *   weigh         weighs people, leadership and business in a decision (otherwise takes the best short term business)
 */

export const PERSONAS = ['beginner', 'developing', 'proficient', 'expert'] as const;
export type PersonaKey = (typeof PERSONAS)[number];

export interface PersonaTraits {
  diagnose: number; oneStyle: number; adapt: number; events: number; focus: number; fitAction: number;
  keepPromises: number; promise: number; extras: number; waste: number; turns: [number, number]; polish: number; slip: number;
  /** Choice events (D137): makes the decision at all, and weighs people and leadership beside business. */
  decide: number; weigh: number;
}

export const PERSONA_TRAITS: Record<PersonaKey, PersonaTraits> = {
  beginner: { diagnose: 0.1, oneStyle: 0.85, adapt: 0.2, events: 0.1, focus: 0.2, fitAction: 0.2, keepPromises: 0, promise: 0.3, extras: 0, waste: 0.9, turns: [1, 1], polish: 1, slip: 0.04, decide: 0.5, weigh: 0.05 },
  developing: { diagnose: 0.6, oneStyle: 0.15, adapt: 0.6, events: 0.5, focus: 0.6, fitAction: 0.6, keepPromises: 0.4, promise: 0.3, extras: 0.4, waste: 0.3, turns: [2, 2], polish: 0.75, slip: 0, decide: 0.8, weigh: 0.5 },
  proficient: { diagnose: 0.8, oneStyle: 0, adapt: 0.8, events: 0.8, focus: 0.75, fitAction: 0.8, keepPromises: 0.8, promise: 0.4, extras: 0.6, waste: 0.05, turns: [2, 3], polish: 0.6, slip: 0, decide: 0.95, weigh: 0.8 },
  expert: { diagnose: 0.97, oneStyle: 0, adapt: 1, events: 0.97, focus: 0.95, fitAction: 0.97, keepPromises: 1, promise: 0.5, extras: 0.9, waste: 0, turns: [3, 4], polish: 0.95, slip: 0, decide: 1, weigh: 0.97 }
};

/** English names and how each plays, for the author's screen and the AI player's prompt. */
export const PERSONA_COPY: Record<PersonaKey, { name: string; label: string; plays: string }> = {
  beginner: { name: 'Beginner', label: 'Low performer', plays: 'Uses one style for everyone, misreads what people need, gives short closed replies, ignores events and forgets promises. Spends time on whatever is at hand.' },
  developing: { name: 'Developing', label: 'Average performer', plays: 'Picks the right style about half the time, gives generic replies, answers some events and follows up sometimes.' },
  proficient: { name: 'Proficient', label: 'High performer', plays: 'Reads most needs, asks open questions, keeps most promises and adjusts style most weeks.' },
  expert: { name: 'Expert', label: 'Exceptional performer', plays: 'Reads each person\'s need and adapts every week, uncovers hidden concerns, handles events and sequences development.' }
};

export const levelOf = (p: PersonaKey): Level => PERSONAS.indexOf(p) as Level;

/**
 * A probe for dominant strategies (D114): leading everyone in one style all run with otherwise sound
 * play, or spending every day on one action. If a probe reaches the target tier, that strategy wins
 * without good leadership.
 */
export type Probe = { kind: 'style'; style: string } | { kind: 'action'; action: string };

export interface PlayOptions {
  speaker?: SyntheticSpeaker;
  evaluator?: Evaluator;
  npc?: NpcModel;
  /** How this persona plays, in the author's words (the AI player reads it). */
  describe?: string;
  probe?: Probe;
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
  persona: PersonaKey;
  seed: number;
  probe: Probe | null;
  view: EngineView;
  summary: RunSummary;
  weeks: SyntheticWeek[];
  conversations: SyntheticConversation[];
}

type Member = EngineView['members'][number];

const BAND_SCORE = { strong: 100, adequate: 70, weak: 35, harmful: 0 } as const;
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
type ChoiceOption = NonNullable<StorylineConfig['events'][number]['choice']>['options'][number];

/**
 * An option's short term business value (D137), in points: revenue as a share of a period's target, each business
 * variable's move as a share of its range (against it when less is better), sponsor confidence and the people's result.
 */
export function choiceBusiness(config: StorylineConfig, o: ChoiceOption): number {
  const perPeriod = config.money.target / config.time.period.count;
  const vars = Object.entries(o.business.variables).reduce((a, [k, d]) => {
    const v = config.variables.find(x => x.key === k);
    return v ? a + (100 * d / (v.max - v.min)) * (v.higherIsBetter ? 1 : -1) : a;
  }, 0);
  return 100 * o.business.revenue / perPeriod + vars + o.business.sponsor / 2 + o.people[2];
}
type ActionView = EngineView['actions'][number];
interface Step { action: string; option?: string; memberIds: string[]; stage?: string; why: 'event' | 'promise' | 'develop' | 'extra' | 'waste' | 'probe'; eventKey?: string }


/** Plays one run as a persona (or a probe) and records it week by week. */
export async function playSynthetic(config: StorylineConfig, persona: PersonaKey, seed: number, opts: PlayOptions = {}): Promise<SyntheticRun> {
  const evaluations: Evaluation[] = [];
  const base = opts.evaluator ?? heuristicEvaluator;
  // The engine's own evaluator, recorded: the playthrough shows what it said about each conversation.
  const evaluator: Evaluator = {
    async evaluate(input) { const e = await base.evaluate(input); evaluations.push(e); return e; },
    ...(base.reply ? { reply: (i: Parameters<NonNullable<Evaluator['reply']>>[0]) => base.reply!(i) } : {})
  };
  const engine = createEngine(config, { seed, evaluator, npc: opts.npc ?? personaNpc });
  return new Player(config, engine, persona, seed, opts, evaluations).play();
}

class Player {
  private readonly rng: Rng;
  /** Choice events draw on their own stream (D137): the same seed makes the same decisions whatever else differs. */
  private readonly choiceRng: Rng;
  private readonly t: PersonaTraits;
  private readonly level: Level;
  private readonly keys: string[];
  private readonly lens: SpeakerContext['lens'];
  private readonly speaker: SyntheticSpeaker;
  private readonly defaultStyle: string;
  private styles: Record<string, string> = {};
  private readonly weeks: SyntheticWeek[] = [];
  private readonly conversations: SyntheticConversation[] = [];
  private readonly seen = new Set<string>();
  private readonly decided = new Map<string, boolean>();
  private pending: Array<{ eventKey: string; memberId: string | null; actions: string[]; period: number; messageId: string | null }> = [];
  private readonly failed = new Set<string>();
  private assessed = false;
  private trainedAt = -10;
  private energizedAt = -10;
  /** Stakeholders outside the team (D165), played by level in their own module, on their own seeded stream. */
  private readonly stakeholderPlay: StakeholderPlayer;

  constructor(private readonly config: StorylineConfig, private readonly engine: Engine, private readonly persona: PersonaKey, private readonly seed: number, private readonly opts: PlayOptions, private readonly evaluations: Evaluation[]) {
    const probe = opts.probe;
    // A style probe plays as soundly as a Proficient player in everything but style; an action probe as a Developing one.
    const traitsOf = probe?.kind === 'style' ? 'proficient' : probe?.kind === 'action' ? 'developing' : persona;
    this.t = PERSONA_TRAITS[traitsOf];
    this.level = levelOf(traitsOf);
    this.rng = createRng((seed ^ seedFrom(`${persona}:${probe ? `${probe.kind}:${'style' in probe ? probe.style : probe.action}` : ''}`)) >>> 0);
    this.choiceRng = createRng((seed ^ seedFrom(`choices:${persona}`)) >>> 0);
    this.keys = config.lens.styles.map(s => s.key);
    this.lens = { title: config.lens.title, styles: config.lens.styles.map(s => ({ key: s.key, name: s.name, short: s.short, description: s.description })) };
    this.speaker = opts.speaker ?? templateSpeaker;
    this.defaultStyle = probe?.kind === 'style' ? probe.style : this.rng.pick(this.keys);
    this.stakeholderPlay = new StakeholderPlayer({ config, persona, level: this.level, rng: createRng((seed ^ seedFrom(`stakeholders:${persona}`)) >>> 0), send: i => this.send(i), view: () => this.engine.view(), evaluations: () => this.evaluations, english: c => this.english(c as Copy) });
  }

  /** Stakeholders (D165): the requests the persona answers or lets pass, and engaging them before anyone asks. Probes leave them alone. */
  private async stakeholderStep(v: EngineView): Promise<EngineView> {
    if (this.opts.probe || !this.config.stakeholders.length) return v;
    const r = await this.stakeholderPlay.step(v);
    this.conversations.push(...r.conversations);
    for (const q of this.stakeholderPlay.requests) {
      const w = this.week(q.period);
      const e = w.events.find(x => x.key === q.key);
      if (e) e.handled = q.handled; else w.events.push({ key: q.key, title: q.title, expected: true, handled: q.handled });
    }
    return r.view;
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

  private need(m: Member): NeedKey | null {
    return m.skill === null || m.morale === null ? null : needOf({ skill: m.skill, morale: m.morale }, this.config.thresholds.high);
  }

  private async setStyles(v: EngineView): Promise<EngineView> {
    // Every profile is opened, as a participant reading the cards would; what the player does with it is its level.
    for (const m of v.members) if (!m.statsRevealed) await this.send({ type: 'openProfile', memberId: m.id });
    v = this.engine.view();
    const chosen: Record<string, string> = {};
    for (const m of v.members) chosen[m.id] = this.chooseStyle(m);
    this.styles = chosen;
    this.weeks.push({ period: v.clock.period, styles: { ...chosen }, styleFit: null, actions: [], events: [], revenue: 0, score: null });
    return (await this.send({ type: 'confirmStyles', styles: chosen })).view;
  }

  private chooseStyle(m: Member): string {
    const probe = this.opts.probe;
    if (probe?.kind === 'style') return probe.style;
    if (probe?.kind === 'action') return this.rng.pick(this.keys);
    const need = this.need(m);
    const prev = this.styles[m.id];
    if (this.rng.chance(this.t.oneStyle)) return this.defaultStyle;
    if (prev && !this.rng.chance(this.t.adapt)) return prev;
    if (need && this.rng.chance(this.t.diagnose)) return bestStyle(this.config.lens, need);
    // A misread: most often a near miss (a style one step off), otherwise any style.
    const near = need ? this.keys.filter(k => fitOf(this.config.lens, k, need) === 1) : [];
    return near.length && this.rng.chance(0.7) ? this.rng.pick(near) : this.rng.pick(this.keys);
  }

  /** The style that fits the most people present, for a team conversation. */
  private teamStyle(v: EngineView): string {
    const here = v.members.filter(m => m.away === 0);
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
      v = await this.stakeholderStep(v);
      if (v.phase !== 'board') break;
      const step = this.next(v);
      if (!step) break;
      v = await this.take(step, v);
    }
    return v;
  }

  /** Event cards and messages: decide once whether to answer, as the persona would; replies cost no time. */
  private async answer(v: EngineView): Promise<EngineView> {
    const probe = this.opts.probe;
    v = await this.choose(v);
    for (const card of v.cards) {
      if (this.seen.has(card.id)) continue;
      this.seen.add(card.id);
      const ev = this.config.events.find(e => e.key === card.key);
      const expected = !!ev?.response;
      const respond = expected && probe?.kind !== 'action' && this.rng.chance(this.t.events);
      if (card.messageId) this.decided.set(card.messageId, respond);
      if (respond && ev?.response) this.pending.push({ eventKey: ev.key, memberId: card.memberId, actions: ev.response.actions, period: v.clock.period, messageId: card.messageId });
      // A blow to the whole team with no set answer: the stronger players talk it through with the team.
      const meet = this.config.actions.find(a => a.scope === 'team' && a.rule === 'styleOption' && a.kind !== 'static');
      if (!expected && meet && ev?.target === 'team' && (card.card === 'crisis' || card.card === 'impact') && this.level >= 2 && probe?.kind !== 'action' && this.rng.chance(this.t.events * 0.6)) {
        this.pending.push({ eventKey: ev.key, memberId: null, actions: [meet.key], period: v.clock.period, messageId: null });
      }
      this.week(v.clock.period).events.push({ key: card.key, title: this.english(card.title), expected, handled: false });
      v = (await this.send({ type: 'dismissCard', cardId: card.id })).view;
    }
    for (const m of v.inbox) {
      // A stakeholder's message is theirs to answer (stakeholderStep, D165).
      if (m.from === 'news' || m.kind === 'news' || m.state !== 'open' || this.config.stakeholders.some(s => s.key === m.from)) continue;
      // An event delivered as a chat or an email has no card: its message is the event.
      const title = this.english(m.title);
      const ev = this.config.events.find(e => e.response && e.title === title && (e.delivery === 'chat' || e.delivery === 'email'));
      if (ev && !this.seen.has(`event:${m.id}`)) {
        this.seen.add(`event:${m.id}`);
        this.week(v.clock.period).events.push({ key: ev.key, title, expected: true, handled: false });
      }
      if (!this.decided.has(m.id)) this.decided.set(m.id, probe?.kind !== 'action' && (m.briefing ? this.rng.chance(Math.max(this.t.events, 0.3)) : this.rng.chance(this.t.events)));
      if (!this.decided.get(m.id) || this.failed.has(`msg:${m.id}`)) continue;
      this.failed.add(`msg:${m.id}`);
      try {
        const o = await this.send({ type: 'openConversation', kind: m.briefing ? 'sponsor' : 'reply', messageId: m.id });
        await this.converse(o.interactionId!, { actionKey: m.briefing ? 'sponsor' : 'reply', actionName: m.briefing ? 'Sponsor briefing' : `Reply: ${title}`, memberIds: m.from === 'sponsor' ? [] : [m.from] });
        // An event that came as this message is answered by the reply.
        const done = this.pending.find(p => p.messageId === m.id);
        if (done) this.markHandled(done.eventKey, v.clock.period);
        else if (ev) this.markHandled(ev.key, v.clock.period);
      } catch (e) {
        if (!(e instanceof IntentError)) throw e;
      }
      v = this.engine.view();
    }
    return v;
  }

  /**
   * Choice events (D137), by level: a player decides at all with `decide` (otherwise the default applies); weighing
   * people and leadership beside business with `weigh`, otherwise taking the option best for business in the short
   * term. Experts then follow through with the people the choice landed on. Probes leave every choice to its default.
   * Reads the authored options, as the players read event responses (calibration, not a participant).
   */
  private async choose(v: EngineView): Promise<EngineView> {
    if (this.opts.probe) return v;
    for (const open of v.openChoices) {
      if (this.seen.has(`choice:${open.id}`)) continue;
      this.seen.add(`choice:${open.id}`);
      const ev = this.config.events.find(e => e.key === open.eventKey);
      const options = ev?.choice?.options ?? [];
      if (!ev || !options.length || !this.choiceRng.chance(this.t.decide)) continue;
      const weigh = this.choiceRng.chance(this.t.weigh);
      const scored = options.map(o => ({ o, business: choiceBusiness(this.config, o), people: o.people[0] + o.people[1] + o.people[2] / 2 + 1.5 * o.trust, lead: o.read.length ? mean(o.read.map(r => BAND_SCORE[r.band])) : 50 }));
      const best = [...scored].sort((a, b) => (weigh ? (b.lead + 3 * b.people + 0.5 * b.business) - (a.lead + 3 * a.people + 0.5 * a.business) : b.business - a.business))[0];
      try {
        v = (await this.send({ type: 'decide', choiceId: open.id, option: best.o.key })).view;
      } catch (e) {
        if (!(e instanceof IntentError)) throw e;
        continue;
      }
      // Following through: talk with the people the choice landed on.
      if (this.level >= 3 && (best.o.people.some(x => x < 0) || best.o.trust < 0 || best.o.who === 'team' || ev.target === 'team')) {
        const meet = this.config.actions.find(a => a.scope === 'team' && a.rule === 'styleOption' && a.kind !== 'static');
        const talks = this.config.actions.filter(a => a.scope === 'member' && a.rule === 'styleOption' && a.kind !== 'static').map(a => a.key);
        if (open.memberId && talks.length) this.pending.push({ eventKey: `choice:${ev.key}`, memberId: open.memberId, actions: talks, period: v.clock.period, messageId: null });
        else if (meet) this.pending.push({ eventKey: `choice:${ev.key}`, memberId: null, actions: [meet.key], period: v.clock.period, messageId: null });
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
  private stepFor(v: EngineView, key: string, memberId: string | null, why: Step['why'], style?: string): Step | null {
    const a = v.actions.find(x => x.key === key);
    if (!a) return null;
    const options = a.options.filter(o => !o.blocked && o.cost <= v.clock.capacityLeft);
    // An option that names the style the player means, else a simple option (no extra people, no stage to pick).
    const pick = (style && options.find(o => this.config.actions.find(x => x.key === key)?.options.find(c => c.key === o.key)?.style === style))
      ?? options.find(o => !o.targets && !o.pickStage) ?? options.find(o => o.pickStage && !(o.targets && o.targets[0] > 1));
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

  private stats(m: Member) { return { skill: m.skill ?? 50, morale: m.morale ?? 50, result: m.result ?? 50 }; }

  /** Who needs time most: lowest morale and result first. */
  private neediest(v: EngineView): Member[] {
    return v.members.filter(m => m.away === 0).sort((a, b) => (this.stats(a).morale + this.stats(a).result) - (this.stats(b).morale + this.stats(b).result) || a.id.localeCompare(b.id));
  }

  /** The member action that does most for this need in the player's style, from the storyline's effect tables. */
  private bestActionFor(v: EngineView, m: Member): string | null {
    const need = this.need(m);
    const style = this.styles[m.id];
    const w = need === 'highSkill_highMorale' ? [1, 1, 2] : need?.startsWith('lowSkill') ? [2, 1, 1] : [1, 2, 1];
    let best: { key: string; score: number } | null = null;
    for (const a of this.config.actions) {
      if (a.scope !== 'member' || a.kind === 'static' || a.rule !== 'styleOption') continue;
      const o = a.options.find(x => x.style === style) ?? a.options[0];
      const score = o.effects.m0[0] * w[0] + o.effects.m0[1] * w[1] + o.effects.m0[2] * w[2];
      if (this.free(v, a.key, m.id) && (!best || score > best.score)) best = { key: a.key, score };
    }
    return best?.key ?? null;
  }

  private liveLeft(v: EngineView) { return v.liveCap.used < v.liveCap.cap; }

  /** The persona's next decision on the board, or null to end the week. */
  private next(v: EngineView): Step | null {
    if (v.clock.capacityLeft < v.clock.costStep) return null;
    const probe = this.opts.probe;
    if (probe?.kind === 'action') {
      const a = v.actions.find(x => x.key === probe.action);
      if (!a) return null;
      const open = v.members.filter(m => !a.blockedFor[m.id]);
      if (a.scope === 'member' && !open.length) return null;
      const who = a.scope === 'member' ? this.rng.pick(open).id : null;
      return this.stepFor(v, probe.action, who, 'probe', who ? this.styles[who] : this.teamStyle(v));
    }

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

    // 2. A promise coming due: follow up with that person.
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

    // 3. Development: a conversation with the person who needs it, in the action that suits the need.
    if (this.liveLeft(v)) {
      const here = this.neediest(v);
      const m = this.rng.chance(this.t.focus) ? here[0] : this.rng.pick(here);
      if (m) {
        // A team meeting when one style fits most of the team, for the players who read the room.
        const team = this.teamStyle(v);
        const fits = v.members.filter(x => x.away === 0 && this.need(x) && fitOf(this.config.lens, team, this.need(x)!) === 0).length;
        if (this.level >= 2 && fits >= Math.ceil(0.7 * v.members.filter(x => x.away === 0).length)) {
          const meet = this.config.actions.find(a => a.scope === 'team' && a.rule === 'styleOption' && a.kind !== 'static');
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
      const step = this.extra(v);
      if (step) return step;
    }

    // 5. Spare days, used on whatever is at hand.
    if (this.rng.chance(this.t.waste)) {
      const any = v.actions.filter(a => a.rule !== 'fire' && a.rule !== 'hire' && (a.scope === 'team' ? !a.blocked : v.members.some(m => !a.blockedFor[m.id])));
      for (let i = 0; i < 4 && any.length; i++) {
        const a = this.rng.pick(any);
        const who = a.scope === 'member' ? this.rng.pick(v.members.filter(m => !a.blockedFor[m.id])).id : null;
        const step = this.stepFor(v, a.key, who, 'waste', who ? this.styles[who] : this.defaultStyle);
        if (step) return step;
      }
    }
    return null;
  }

  private extra(v: EngineView): Step | null {
    const period = v.clock.period;
    const fitting = (m: Member) => { const n = this.need(m); return !!n && fitOf(this.config.lens, this.styles[m.id], n) === 0; };
    const here = v.members.filter(m => m.away === 0);
    // Team energy: the effect follows each person's style fit, so only when most styles fit.
    const energize = this.config.actions.find(a => a.scope === 'team' && a.kind === 'static' && a.rule === 'weeklyStyle');
    if (energize && period - this.energizedAt >= 2 && here.filter(fitting).length >= Math.ceil(0.7 * here.length)) {
      const step = this.stepFor(v, energize.key, null, 'extra');
      if (step) { this.energizedAt = period; return step; }
    }
    // Training for the lowest skill, when the style set for them fits.
    const training = this.config.actions.find(a => a.rule === 'training');
    if (training && period - this.trainedAt >= 2) {
      const low = [...here].filter(m => this.stats(m).skill < 50 && fitting(m)).sort((a, b) => this.stats(a).skill - this.stats(b).skill)[0];
      const step = low && this.stepFor(v, training.key, low.id, 'extra');
      if (step) { this.trainedAt = period; return step; }
    }
    // Role fit: assess the person struggling most once, then move them when another stage suits them clearly better.
    const assess = this.config.actions.find(a => a.rule === 'assess');
    const struggling = [...here].sort((a, b) => this.stats(a).result - this.stats(b).result)[0];
    if (assess && !this.assessed && period >= 2 && struggling) {
      const step = this.stepFor(v, assess.key, struggling.id, 'extra');
      if (step) { this.assessed = true; return step; }
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
    const a = this.config.actions.find(x => x.key === step.action)!;
    // The option in a few words: its style's name when it has one, else its label when short.
    const o = a.options.length > 1 ? a.options.find(x => x.key === step.option) : undefined;
    const option = o ? (o.style ? this.config.lens.styles.find(s => s.key === o.style)?.name ?? null : o.label.length <= 32 ? o.label : null) : null;
    this.week(period).actions.push({ key: a.key, name: a.name, option, memberIds: step.memberIds, names: step.memberIds.map(id => this.nameOf(id)) });
    if (r.interactionId) await this.converse(r.interactionId, { actionKey: a.key, actionName: a.name, memberIds: step.memberIds });
    if (step.eventKey) this.markHandled(step.eventKey, period);
    return this.engine.view();
  }

  private nameOf(id: string) {
    return this.config.members.find(p => p.id === id)?.name ?? this.config.candidates.find(p => p.id === id)?.name ?? (id === 'sponsor' ? this.config.sponsor.name : id);
  }

  // ------------------------------------------------------------------------------------------- conversations

  private async converse(id: string, info: { actionKey: string; actionName: string; memberIds: string[] }) {
    let v = this.engine.view();
    const live = v.live;
    if (!live || live.id !== id) return;
    const format = live.format;
    const mainId = info.memberIds[0] ?? null;
    const main = mainId ? v.members.find(m => m.id === mainId) ?? null : null;
    const need = main ? this.need(main) : null;
    const probe = this.opts.probe;
    // The player speaks in the style it set for the person (or, in a team meeting, the one that fits most).
    const intent = format === 'meeting' ? (probe?.kind === 'style' ? probe.style : this.level >= 2 ? this.teamStyle(v) : this.defaultStyle) : mainId ? this.styles[mainId] ?? this.defaultStyle : null;
    const [lo, hi] = this.t.turns;
    const turns = lo + Math.floor(this.rng.next() * (hi - lo + 1));
    const promise = !!main && format !== 'email' && this.rng.chance(this.t.promise);
    const slip = this.rng.chance(this.t.slip);
    const variant = Math.floor(this.rng.next() * 1000);
    // An off day: the conversation goes as one level lower would.
    const level = (this.rng.chance(this.t.polish) ? this.level : Math.max(0, this.level - 1)) as Level;
    const before = this.evaluations.length;
    const person = this.config.members.find(p => p.id === mainId);
    const concern = !!person?.hiddenConcern && !main?.shared;
    const emailIntent: 'congratulate' | 'warn' = (() => {
      const trend = mainId ? v.trends[mainId] : undefined;
      const up = trend && trend.length >= 2 ? (trend[trend.length - 1] ?? 0) >= (trend[trend.length - 2] ?? 0) : true;
      // Beginners warn by default; the others read the trend.
      return this.level === 0 ? 'warn' : up ? 'congratulate' : 'warn';
    })();
    const ctx = (turn: number): SpeakerContext => {
      const now = this.engine.view();
      const m = mainId ? now.members.find(x => x.id === mainId) ?? null : null;
      const n = m ? this.need(m) : null;
      const total = now.money.target || 1;
      const ideal = now.funnel.filter(st => st.throughput < st.idealThroughput).length;
      return {
        persona: this.persona, level, describe: this.opts.describe ?? PERSONA_COPY[this.persona].plays, lens: this.lens, intent, format,
        action: { key: info.actionKey, name: info.actionName },
        person: m ? { id: m.id, name: m.name, first: m.name.split(' ')[0], mood: m.mood, trust: m.trust, skill: m.skill, morale: m.morale, result: m.result, needLabel: n ? this.config.lens.needs[n].label : null, concern: m.shared } : null,
        team: now.members.filter(x => x.away === 0).map(x => x.name.split(' ')[0]),
        transcript: (now.live?.turns ?? []).map(t => ({ by: t.by === 'you' ? 'player' as const : 'other' as const, name: t.by === 'you' ? 'You' : this.nameOf(t.by), text: this.english(t.text) })),
        turn, turns, promise, emailIntent, variant, slip,
        business: { share: now.money.value / total, runShare: now.clock.runShare, behind: ideal, risk: now.funnel.find(st => st.bottleneck)?.name ?? null }
      };
    };
    const say = async (turn: number) => {
      const text = (await this.speaker.say(ctx(turn))).trim();
      return text || 'Thanks.';
    };
    let turnsSeen: SyntheticConversation['turns'] = [];
    const capture = () => {
      const l = this.engine.view().live;
      if (l && l.id === id) turnsSeen = l.turns.map(t => ({ by: t.by === 'you' ? 'player' as const : 'other' as const, name: t.by === 'you' ? 'You' : this.nameOf(t.by), text: this.english(t.text) }));
    };
    try {
      if (format === 'email') {
        const text = await say(0);
        turnsSeen = [{ by: 'player', name: 'You', text }];
        await this.send({ type: 'submitInteraction', interactionId: id, text });
      } else if (format === 'plan') {
        const fields = planFields(ctx(0));
        await this.send({ type: 'submitPlan', interactionId: id, plan: fields, text: await say(0) });
        v = this.engine.view();
        if (turns > 1 && v.live && !v.live.closed && v.live.turnsLeft > 0) await this.send({ type: 'sendTurn', interactionId: id, text: await say(1) });
        capture();
        await this.send({ type: 'endInteraction', interactionId: id });
      } else if (format === 'interview') {
        const candidates = live.candidates ?? [];
        for (let c = 0; c < Math.max(1, candidates.length); c++) {
          if (c > 0) await this.send({ type: 'nextCandidate', interactionId: id });
          for (let i = 0; i < turns; i++) {
            v = this.engine.view();
            if (!v.live || v.live.closed || v.live.turnsLeft <= 0) break;
            await this.send({ type: 'sendTurn', interactionId: id, text: await say(i) });
          }
          capture();
        }
        // Choosing: the stronger players read the candidates' records; a Beginner takes the first.
        const ranked = [...candidates].sort((a, b) => {
          const pa = this.config.candidates.find(p => p.id === a.id)?.start, pb = this.config.candidates.find(p => p.id === b.id)?.start;
          return ((pb?.skill ?? 0) + (pb?.morale ?? 0)) - ((pa?.skill ?? 0) + (pa?.morale ?? 0));
        });
        const choice = this.level >= 2 ? ranked[0] : candidates[0];
        await this.send({ type: 'chooseCandidate', interactionId: id, candidateId: choice?.id ?? null });
      } else {
        for (let i = 0; i < turns; i++) {
          v = this.engine.view();
          if (!v.live || v.live.id !== id || v.live.closed || v.live.turnsLeft <= 0) break;
          await this.send({ type: 'sendTurn', interactionId: id, text: await say(i) });
        }
        capture();
        await this.send({ type: 'endInteraction', interactionId: id });
      }
    } catch (e) {
      if (!(e instanceof IntentError)) throw e;
      // Anything the engine refused leaves the conversation unfinished, as a participant walking away would.
      if (this.engine.view().live?.id === id) await this.send({ type: 'abandonInteraction', interactionId: id }).catch(() => undefined);
    }
    const evaluation = this.evaluations.length > before ? this.evaluations[this.evaluations.length - 1] : null;
    const after = mainId ? this.engine.view().members.find(m => m.id === mainId) : null;
    this.conversations.push({
      period: v.clock.period, sub: v.clock.subPeriod, actionKey: info.actionKey, actionName: info.actionName, format, memberIds: info.memberIds, names: info.memberIds.map(x => this.nameOf(x)),
      intent: format === 'sponsor' || format === 'interview' ? null : intent, need, turns: turnsSeen, evaluation,
      concern, concernSurfaced: concern && !!after?.shared
    });
  }
}
