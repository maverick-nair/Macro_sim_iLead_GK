import { hear, isNegative, lastHeard, type Heard } from './syntheticListen';
import * as P from './syntheticPhrases';
import type { PlanFields } from './types';

/**
 * What a synthetic player says (D112, D151, docs/CALIBRATION-SYNTHETIC.md). The policies in `./synthetic`
 * decide what to do; a `SyntheticSpeaker` decides the words. Offline the words come from the templates
 * below: banks of phrasings per level, style and format (`./syntheticPhrases`), picked by a seeded choice
 * that never repeats a phrasing in one conversation, and conditioned on what the other person just said
 * (`./syntheticListen`), their mood and any worry they shared. With AI configured, the server passes the
 * `ai/` module's `createSyntheticPlayer`, which writes the line from the same context. Either way the words
 * go through the engine's evaluator like a participant's, so the scoring pipeline is what is under test.
 *
 * The phrasings are written apart from the evaluator's cue lists, so how often the evaluator reads a line as
 * the style meant is measured (evaluator agreement), not built in. This module imports nothing from the
 * evaluator (a test checks it).
 */

/** 0 Beginner, 1 Developing, 2 Proficient, 3 Expert. */
export type Level = 0 | 1 | 2 | 3;

export interface SpeakerStyle { key: string; name: string; short: string; description: string }

export interface SpeakerContext {
  /** The persona's key and level, and how it plays in plain words (the author can edit it for AI players). */
  persona: string;
  level: Level;
  describe: string;
  lens: { title: string; styles: SpeakerStyle[] };
  /** The style the player means to show, or null when it has none in mind. */
  intent: string | null;
  format: string;
  action: { key: string; name: string };
  /** The person the player is talking to; null for the sponsor and the whole team. */
  person: {
    id: string; name: string; first: string; mood: string | null; trust: number | null;
    skill: number | null; morale: number | null; result: number | null;
    /** The need as the player reads it, in the lens's words. */
    needLabel: string | null;
    /** What the person has shared about what is bothering them, once it surfaced. */
    concern: string | null;
  } | null;
  /** Team meeting: the first names of everyone present. */
  team: string[];
  /** The conversation so far, oldest first. */
  transcript: Array<{ by: 'player' | 'other'; name: string; text: string }>;
  /** This line's index among the player's turns, and how many turns the player means to take. */
  turn: number;
  turns: number;
  /** Whether the player makes a promise in this conversation. */
  promise: boolean;
  /** Email: what the player means to do. */
  emailIntent?: 'congratulate' | 'warn';
  /** Sponsor briefing: where the business stands. */
  business?: { share: number; runShare: number; behind: number; risk: string | null };
  /** A seeded number for wording variety, so a run replays exactly. */
  variant: number;
  /** A Beginner's bad moment: says something that blames. */
  slip: boolean;
  /** What the player already said in this conversation: no phrasing is used twice. */
  said?: string[];
}

export interface SyntheticSpeaker {
  /** The player's next line. */
  say(ctx: SpeakerContext): string | Promise<string>;
}

// ---------------------------------------------------------------------------------------------- choosing words

function hash(...parts: Array<string | number>): number {
  let h = 2166136261;
  for (const ch of parts.join('|')) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

/** Picks phrasings for one line: seeded by the conversation's variant, never one already said or picked. */
class Words {
  private readonly used: string;
  private readonly picked: string[] = [];
  constructor(private readonly ctx: SpeakerContext) { this.used = (ctx.said ?? []).join(' \n '); }
  pick(bank: readonly string[], slot: string): string {
    const pool = bank.filter(Boolean);
    if (!pool.length) return '';
    const start = hash(this.ctx.variant, this.ctx.persona, slot) % pool.length;
    const fresh = (s: string) => !this.used.includes(this.fill(s)) && !this.picked.includes(s);
    for (let i = 0; i < pool.length; i++) {
      const c = pool[(start + i) % pool.length];
      if (fresh(c)) { this.picked.push(c); return this.fill(c); }
    }
    return this.fill(pool[start]);
  }
  fill(s: string): string {
    const b = this.ctx.business;
    return s.replace(/\{name\}/g, this.ctx.person?.first ?? 'there')
      .replace(/\{share\}/g, String(Math.round((b?.share ?? 0) * 100)))
      .replace(/\{run\}/g, String(Math.round((b?.runShare ?? 0) * 100)))
      .replace(/\{behind\}/g, String(b?.behind ?? 0))
      .replace(/\{risk\}/g, b?.risk ? `the ${b.risk} stage` : 'the pipeline');
  }
}

const join = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();

// ---------------------------------------------------------------------------------------------- the lens

/** A lens style's line in the first person: "You set the task" reads "I will set the task". */
export function firstPerson(line: string): string {
  const t = line.trim().replace(/^You\s+/i, 'I will ').replace(/\bthemselves\b/gi, 'yourself').replace(/\btheir\b/gi, 'your').replace(/\bthem\b/gi, 'you').replace(/\bthey\b/gi, 'you');
  return /[.?!]$/.test(t) ? t : `${t}.`;
}

const kits = new WeakMap<object, Map<string, { full: string[]; blunt: string[] }>>();

/**
 * Each style's lines, once per lens: the written lines when the style is one of Readiness Based Leadership's
 * (by name), else the style's own short line and description from the lens, in the first person and in a
 * few frames. Never the evaluator's cues.
 */
function styleLines(lens: SpeakerContext['lens']): Map<string, { full: string[]; blunt: string[] }> {
  const cached = kits.get(lens);
  if (cached) return cached;
  const out = new Map<string, { full: string[]; blunt: string[] }>();
  for (const s of lens.styles) {
    const written = P.STYLE_LINES[s.name];
    if (written) { out.set(s.key, written); continue; }
    const own = [firstPerson(s.short), firstPerson(s.description)];
    const lower = (t: string) => t.charAt(0).toLowerCase() + t.slice(1);
    const full = [...new Set(P.STYLE_FRAMES.flatMap(f => own.map(line => f.replace('{line}', line).replace('{lower}', lower(line)))))];
    out.set(s.key, { full, blunt: [own[0]] });
  }
  kits.set(lens, out);
  return out;
}

const NONE = { full: ['Here is what I think we should do this week.', 'This is the plan as I see it.', 'Here is where I would like us to go.'], blunt: ['Just get on with it.', 'Do what needs doing.'] };

// ---------------------------------------------------------------------------------------------- what to say

/** What the player heard last, and how the person seems. */
function listening(ctx: SpeakerContext) {
  const last = lastHeard(ctx.transcript);
  const heard: Heard = hear(last);
  const mood = ctx.person?.mood ?? null;
  const uneasy = mood === 'concerned' || mood === 'frustrated';
  return { last, heard, negative: isNegative(last), uneasy, opening: ctx.transcript.filter(t => t.by === 'player').length === 0 };
}

/** The reply to what was just said, at this level ('' when nothing was said). */
function react(w: Words, l: ReturnType<typeof listening>, level: Level): string {
  if (l.heard === 'none') return '';
  if (l.heard === 'emotional' && !l.negative) return level >= 2 ? w.pick(level === 3 ? ['I mean it.', 'You have earned it.', 'Glad to hear it.'] : ['Glad to hear it.', 'Good.'], 'react') : w.pick(P.REACT.agreement[level], 'react');
  return w.pick(P.REACT[l.heard][level], 'react');
}

/** The opening move: a greeting that answers how the person opened. */
function opening(w: Words, l: ReturnType<typeof listening>, level: Level): string {
  const answer = l.heard === 'question' ? w.pick(P.ANSWER_OPENING[level], 'answer') : l.heard === 'concern' || (l.heard === 'emotional' && l.negative) ? w.pick(P.MEET_FEELING[level], 'feeling') : '';
  return join(level >= 1 && w.pick(P.GREET[level], 'greet'), answer);
}

/**
 * Every line the player means to say in this conversation, one per turn, at the most turns its level takes.
 * Lines already said are not repeated; the line for this turn answers what was just said.
 */
export function script(ctx: SpeakerContext): string[] {
  const w = new Words(ctx);
  if (ctx.slip) return [w.pick(P.SLIP, 'slip')];
  switch (ctx.format) {
    case 'sponsor': return sponsor(w, ctx);
    case 'interview': return interview(w, ctx);
    case 'email': return [email(w, ctx)];
    case 'meeting': return meeting(w, ctx);
    case 'plan': return planLines(w, ctx);
    default: break;
  }
  // A reply to the sponsor's call has no person: brief, owning the number.
  if (!ctx.person) return sponsor(w, ctx);
  return oneToOne(w, ctx);
}

/** Puts what was just heard in front of the line said now (turn 1 on), once. */
function answering(lines: string[], ctx: SpeakerContext, reply: string): string[] {
  if (ctx.turn === 0 || !reply || !lines.length) return lines;
  const at = Math.min(ctx.turn, lines.length - 1);
  return lines.map((line, i) => (i === at ? join(reply, line) : line));
}

/** Lines in the order they will be said from this turn on, aligned to turns: earlier slots stay empty. */
function from(ctx: SpeakerContext, n: number, rest: string[]): string[] {
  const out = Array.from({ length: n }, () => '');
  const at = Math.min(ctx.turn, n - 1);
  rest.filter(Boolean).forEach((line, k) => { const i = Math.min(at + k, n - 1); out[i] = join(out[i], line); });
  return out;
}

function oneToOne(w: Words, ctx: SpeakerContext): string[] {
  const l = listening(ctx);
  const level = ctx.level;
  const st = styleLines(ctx.lens).get(ctx.intent ?? '') ?? NONE;
  const promise = ctx.promise ? w.pick(P.PROMISE[level], 'promise') : null;
  const reply = react(w, l, level);
  switch (level) {
    case 0: return [join(l.opening ? opening(w, l, 0) : reply, w.pick(st.blunt, 'style'), promise)];
    case 1: return answering([
      join(opening(w, l, 1), w.pick(st.full, 'style')),
      join(w.pick(P.NEXT_STEP[1], 'close'), promise)
    ], ctx, reply);
    case 2: return answering([
      join(opening(w, l, 2), w.pick(P.OPEN_QUESTION, 'ask')),
      join(w.pick(st.full, 'style'), w.pick(st.full, 'style2')),
      join(w.pick(P.INVITE, 'invite'), w.pick(P.NEXT_STEP[2], 'step'), promise)
    ], ctx, reply);
    default: {
      const p = ctx.person;
      const said = (ctx.said ?? []).join(' ');
      // Someone who seems uneasy and has only given an update gets one gentle question more, before the plan.
      const deeperNow = ctx.turn === 1 && !p?.concern && l.uneasy && (l.heard === 'update' || l.heard === 'agreement');
      const deeper = deeperNow || P.DEEPER.some(q => said.includes(q));
      const ask = p?.concern ? w.pick(P.FOLLOW_CONCERN, 'ask') : w.pick(P.CONCERN_QUESTION, 'ask');
      const observe = w.pick(p && (p.result ?? 50) < 45 ? P.OBSERVE.result : p && (p.morale ?? 50) < 45 ? P.OBSERVE.morale : P.OBSERVE.strong, 'observe');
      const plan = join(w.pick(P.ADAPT, 'adapt'), w.pick(st.full, 'style'));
      return answering([
        join(opening(w, l, 3), ask),
        deeper ? w.pick(P.DEEPER, 'deeper') : plan,
        join(deeper && plan, w.pick(st.full, 'style2'), observe, w.pick(P.REFLECT, 'reflect')),
        join(w.pick(P.START, 'start'), w.pick(P.NEXT_STEP[3], 'step'), promise, w.pick(P.THANKS, 'thanks'))
      ], ctx, reply);
    }
  }
}

type Topic = 'state' | 'risk' | 'need' | 'people';
const SPONSOR_TOPICS: Record<Topic, readonly [string[], string[], string[], string[]]> = { state: P.SPONSOR, risk: P.SPONSOR_RISK, need: P.SPONSOR_NEED, people: P.SPONSOR_PEOPLE };

/** What the sponsor just asked about, if anything. */
function askedAbout(line: string | null): Topic | null {
  if (!line || !/\?/.test(line)) return null;
  if (/\brisk\b/i.test(line)) return 'risk';
  if (/\bworried\b|\bwho on the team\b/i.test(line)) return 'people';
  if (/\bneed\b/i.test(line)) return 'need';
  return null;
}

function sponsor(w: Words, ctx: SpeakerContext): string[] {
  const level = ctx.level;
  if (level === 0) return [w.pick(P.SPONSOR[0], 'state')];
  if (level === 1) return [w.pick(P.SPONSOR[1], 'state'), w.pick(P.SPONSOR_CLOSE[1], 'close')];
  // Answer what the sponsor asked first, then what has not been covered yet, then close.
  const said = (ctx.said ?? []).join(' ');
  const covered = (t: Topic) => SPONSOR_TOPICS[t][level].some(x => said.includes(w.fill(x)));
  const asked = askedAbout(lastHeard(ctx.transcript));
  const order: Topic[] = [...(asked && !covered(asked) ? [asked] : []), ...(['state', 'risk', 'need'] as Topic[]).filter(t => t !== asked && !covered(t))];
  return from(ctx, 3, [...order.map(t => w.pick(SPONSOR_TOPICS[t][level], t)), w.pick(P.SPONSOR_CLOSE[level], 'close')]);
}

function interview(w: Words, ctx: SpeakerContext): string[] {
  const level = ctx.level;
  const n = level + 1;
  const questions = Array.from({ length: n }, (_, i) => w.pick(P.INTERVIEW[level], `q${i}`));
  // The stronger interviewers thank the candidate for the last answer before the next question.
  return level >= 2 ? answering(questions, ctx, w.pick(P.INTERVIEW_REACT, 'react')) : questions;
}

function email(w: Words, ctx: SpeakerContext): string {
  const level = ctx.level;
  const st = styleLines(ctx.lens).get(ctx.intent ?? '') ?? NONE;
  const warn = ctx.emailIntent === 'warn';
  const body = w.pick(warn ? P.EMAIL_WARN[level] : P.EMAIL_WELL[level], 'body');
  if (level === 0) return body;
  return join(body, w.pick(st.full, 'style'), level === 3 && warn && w.pick(st.full, 'style2'), w.pick(P.EMAIL_CLOSE[level].filter(c => warn || !/improve/.test(c)), 'close'));
}

function meeting(w: Words, ctx: SpeakerContext): string[] {
  const level = ctx.level;
  const l = listening(ctx);
  const st = styleLines(ctx.lens).get(ctx.intent ?? '') ?? NONE;
  const promise = ctx.promise ? w.pick(P.PROMISE[level], 'promise') : null;
  const someone = ctx.team.length ? ctx.team[ctx.variant % ctx.team.length] : null;
  const reply = react(w, l, level);
  switch (level) {
    case 0: return [join(w.pick(P.MEETING_OPEN[0], 'open'), w.pick(st.blunt, 'style'))];
    case 1: return answering([join(w.pick(P.MEETING_OPEN[1], 'open'), w.pick(st.full, 'style')), w.pick(P.MEETING_CLOSE[1], 'close')], ctx, reply);
    case 2: return answering([
      w.pick(P.MEETING_OPEN[2], 'open'),
      join(w.pick(st.full, 'style'), w.pick(st.full, 'style2')),
      join(w.pick(P.MEETING_CLOSE[2], 'close'), promise)
    ], ctx, reply);
    default: return answering([
      w.pick(P.MEETING_OPEN[3], 'open'),
      someone ? w.pick(P.MEETING_FLOOR, 'floor').replace('{name}', someone) : w.pick(P.MEETING_INVITE, 'floor'),
      join(w.pick(st.full, 'style'), w.pick(st.full, 'style2'), w.pick(P.MEETING_INVITE, 'invite')),
      join(w.pick(P.MEETING_CLOSE[3], 'close'), promise)
    ], ctx, reply);
  }
}

function planLines(w: Words, ctx: SpeakerContext): string[] {
  const level = ctx.level;
  const l = listening(ctx);
  const st = styleLines(ctx.lens).get(ctx.intent ?? '') ?? NONE;
  const first = level >= 2 ? join(w.pick(P.PLAN_LINES[level], 'plan'), w.pick(st.full, 'style')) : w.pick(P.PLAN_LINES[level], 'plan');
  if (level === 0) return [first];
  // The check in answers the person: a request to make the plan clearer gets a specific fix.
  const fix = level >= 2 && (l.heard === 'question' || l.heard === 'concern' || l.heard === 'pushback') ? w.pick(P.PLAN_FIX, 'fix') : '';
  return [first, join(fix || react(w, l, level), w.pick(P.PLAN_CHECK[level], 'check'))];
}

/** A written plan's fields as each level writes them (D85): vague at first, specific and measurable at the top. */
export function planFields(ctx: SpeakerContext): PlanFields {
  const w = new Words(ctx);
  const st = styleLines(ctx.lens).get(ctx.intent ?? '') ?? NONE;
  const owner = ctx.person?.first ?? 'You';
  switch (ctx.level) {
    case 0: return { goals: w.pick(['Do better', 'Sell more', 'Improve'], 'goals'), measures: w.pick(['More sales', 'Better numbers'], 'measures'), owner: 'You', due: null, support: '' };
    case 1: return { goals: w.pick(['Close more deals this week', 'Move more leads forward this week'], 'goals'), measures: w.pick(['More deals than last week', 'More proposals than last week'], 'measures'), owner, due: null, support: '' };
    case 2: return { goals: 'Move three qualified leads to the next stage this week', measures: w.pick(['3 proposals sent and 2 follow up calls', '3 proposals out and 2 follow up calls made'], 'measures'), owner, due: 3, support: w.pick(st.full, 'support') };
    default: return { goals: 'Move three qualified leads to the next stage and close one deal this week', measures: w.pick(['3 proposals sent, 2 follow up calls and 1 deal closed, tracked daily', '3 proposals, 2 follow up calls and 1 closed deal, tracked each day'], 'measures'), owner, due: 3, support: join(w.pick(st.full, 'support'), w.pick(st.full, 'support2')) };
  }
}

/**
 * Spreads a script over the turns the player takes: one line a turn, and the rest said together in the
 * last turn, so a shorter conversation keeps its close (the next step, the promise).
 */
export function lineFor(lines: string[], turn: number, turns: number): string {
  const n = Math.max(1, Math.min(turns, lines.length));
  if (turn < n - 1) return lines[turn] ?? lines[lines.length - 1];
  return join(...lines.slice(Math.min(turn, n - 1)));
}

/** The offline speaker: the scripts above, turn by turn. */
export const templateSpeaker: SyntheticSpeaker = {
  say: ctx => lineFor(script(ctx), ctx.turn, ctx.turns)
};
