import { styleCues } from './evaluator';
import type { PlanFields } from './types';

/**
 * What a synthetic player says (D110, docs/CALIBRATION-SYNTHETIC.md). The policies in `./synthetic`
 * decide what to do; a `SyntheticSpeaker` decides the words. Offline the words come from the
 * deterministic templates below, one script per proficiency level, format and style intent. With AI
 * configured, the server passes the `ai/` module's `createSyntheticPlayer`, which writes the line from the
 * same context. Either way the words go through the engine's evaluator like a participant's, so the
 * scoring pipeline is what is under test.
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
}

export interface SyntheticSpeaker {
  /** The player's next line. */
  say(ctx: SpeakerContext): string | Promise<string>;
}

// ---------------------------------------------------------------------------------------------- lens kit

/** Readiness Based Leadership's styles, written to read clearly as each style. */
const RBL: Record<string, { lines: [string, string]; crude: string }> = {
  D: { lines: ['Here is the plan, step by step: first the call list, then the follow ups.', 'I need you to send me the update by tomorrow, and I will check in daily.'], crude: 'I need you to do better this week.' },
  G: { lines: ['Let me explain why this matters for the funnel, and the reason behind each step.', 'I will coach you on the next two calls. Does that make sense?'], crude: 'Let me explain how it works, just follow it.' },
  P: { lines: ["Let's work this out together. What do you think we should change?", 'How can I help this week? Your ideas matter here.'], crude: "Let's just get on with it." },
  E: { lines: ['I trust you with this, and it is your call how you run the account.', 'You decide the next step, and I will step back.'], crude: 'It is up to you, sort it out.' }
};
const RBL_NAMES: Record<string, string> = { D: 'Directing', G: 'Guiding', P: 'Partnering', E: 'Entrusting' };

/** A lens style's line in the first person: "You set the task" reads "I will set the task". */
export function firstPerson(line: string): string {
  const t = line.trim().replace(/^You\s+/i, 'I will ').replace(/\bthemselves\b/gi, 'yourself').replace(/\btheir\b/gi, 'your').replace(/\bthem\b/gi, 'you').replace(/\bthey\b/gi, 'you');
  return /[.?!]$/.test(t) ? t : `${t}.`;
}

interface Kit {
  cues: Array<[string, RegExp[]]>;
  /** Cue hits per style for a piece of text. */
  hits(text: string): Map<string, number>;
  /** Two sentences that read as the style, and a short blunt one. */
  style(key: string | null): { lines: [string, string]; crude: string };
}

const kits = new WeakMap<object, Kit>();

/** Built once per lens: the style cues the offline evaluator reads, and each style's sentences. */
function kitFor(lens: SpeakerContext['lens']): Kit {
  const cached = kits.get(lens);
  if (cached) return cached;
  const cues = styleCues(lens.styles);
  const hits = (text: string) => new Map(cues.map(([k, rxs]) => [k, rxs.filter(rx => rx.test(text)).length]));
  const wins = (key: string, text: string) => {
    const h = hits(text);
    const mine = h.get(key) ?? 0;
    return mine > 0 && [...h].every(([k, n]) => k === key || n < mine);
  };
  const styles = new Map<string, { lines: [string, string]; crude: string }>();
  for (const s of lens.styles) {
    // A key of Readiness Based Leadership keeps its own sentences when it means the same style.
    const rbl = RBL[s.key] && RBL_NAMES[s.key] === s.name ? RBL[s.key] : null;
    if (rbl) { styles.set(s.key, rbl); continue; }
    const candidates = [firstPerson(s.short), firstPerson(s.description), `I will lead this as a ${s.name.toLowerCase()} would.`];
    const good = candidates.filter(c => wins(s.key, c));
    const lines = (good.length >= 2 ? good : [...good, ...candidates.filter(c => !good.includes(c))]).slice(0, 2) as [string, string];
    styles.set(s.key, { lines, crude: lines[0] });
  }
  const none = { lines: ['Here is what I think we should do this week.', 'Keep me posted.'] as [string, string], crude: 'Just get on with it.' };
  const kit: Kit = { cues, hits, style: key => (key && styles.get(key)) || none };
  kits.set(lens, kit);
  return kit;
}

/**
 * The alternative with the fewest style cues, so the plain parts of a line never tip the style the
 * evaluator reads. Ties go by the seeded variant.
 */
function plain(kit: Kit, variant: number, ...alternatives: string[]): string {
  const scored = alternatives.map(a => [a, [...kit.hits(a).values()].reduce((x, y) => x + y, 0)] as const);
  const least = Math.min(...scored.map(([, n]) => n));
  const best = scored.filter(([, n]) => n === least).map(([a]) => a);
  return best[variant % best.length];
}

const join = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();

// ---------------------------------------------------------------------------------------------- scripts

/** Every line the player means to say in this conversation, one per turn, at the most turns its level takes. */
export function script(ctx: SpeakerContext): string[] {
  const kit = kitFor(ctx.lens);
  const v = ctx.variant;
  const st = kit.style(ctx.intent);
  const name = ctx.person?.first ?? '';
  const promise = ctx.promise ? plain(kit, v, 'I will check in with you by Friday.', 'I will follow up with you by Friday.') : null;
  const thanks = plain(kit, v, 'Thanks for your time.', 'Thanks for your time today.');

  if (ctx.slip) return ['Honestly, this is your fault. Fix it.'];

  switch (ctx.format) {
    case 'sponsor': return sponsor(ctx, kit);
    case 'interview': return interview(ctx);
    case 'email': return [email(ctx, kit, st)];
    case 'meeting': return meeting(ctx, kit, st, promise);
    case 'plan': return planLines(ctx, kit, st);
    default: break;
  }
  // A reply to the sponsor's call has no person: brief, owning the number.
  if (!ctx.person) return sponsor(ctx, kit);

  switch (ctx.level) {
    case 0: return [join(st.crude, ctx.promise && 'I will look into it this week.')];
    case 1: return [
      join(plain(kit, v, `Thanks for the update, ${name}.`, `Thanks, ${name}.`), st.lines[0]),
      join(plain(kit, v, 'Okay, keep going and let me know how it goes this week.', 'Okay, keep me posted this week.'), promise)
    ];
    case 2: return [
      join(plain(kit, v, `Thanks for making time, ${name}.`, `Thanks for coming in, ${name}.`), plain(kit, v, 'How are things going with your work this week?', 'How is your week going so far?')),
      join('I understand.', st.lines[0], st.lines[1]),
      join(plain(kit, v, 'What would help you most?', 'What would make the biggest difference for you?'), 'Can we agree the next step by Friday?', promise)
    ];
    default: return [
      join(plain(kit, v, `Thanks for making time, ${name}, I appreciate it.`, `Thank you for coming in, ${name}, I appreciate it.`), 'What is on your mind this week?'),
      join('Thank you for telling me, that sounds hard.', plain(kit, v, 'Given where you are right now, here is my approach.', 'From where you are right now, here is my approach.', 'For now, here is my approach.'), st.lines[0]),
      join(st.lines[1], plain(kit, v, 'I noticed the follow ups slipped last week, because the calls ran long.', 'I noticed two calls slipped last week, because the day ran long.'), plain(kit, v, 'What would you change so that you can learn from it?', 'What would you change next time, so that it gets easier?')),
      join(plain(kit, v, 'How would you like to start?', 'How would you like to begin?'), 'Can we agree the next step by Friday?', promise, thanks)
    ];
  }
}

function sponsor(ctx: SpeakerContext, kit: Kit): string[] {
  const b = ctx.business ?? { share: 0, runShare: 0, behind: 0, risk: null };
  const share = Math.round(b.share * 100);
  const risk = b.risk ? `the ${b.risk} stage` : 'the pipeline';
  switch (ctx.level) {
    case 0: return ['Things are fine. The team just needs to work harder.'];
    case 1: return ['We are a bit behind, but I will push the team this week.', 'I think we will get there.'];
    case 2: return [
      `Honestly, we are at ${share}% of target and behind on ${b.behind} stages.`,
      `The biggest risk is ${risk}. I will coach the team, and here is the plan: first the call lists, then the demos by Friday.`,
      'What I need from you is support with two key accounts.'
    ];
    default: return [
      `Honestly, we are at ${share}% of target with ${Math.round(b.runShare * 100)}% of the run gone, and I own that.`,
      `The biggest risk is ${risk}. Here is the plan: first the call lists, then the demos by Friday, and I will track it daily.`,
      join('What I need from you is support with two key accounts.', plain(kit, ctx.variant, 'I will update you by Friday.', 'I will send you an update by Friday.'))
    ];
  }
}

function interview(ctx: SpeakerContext): string[] {
  switch (ctx.level) {
    case 0: return ['So, why do you want this job?'];
    case 1: return ['Tell me about your experience.', 'What are you good at?'];
    case 2: return ['Thanks for coming in. Tell me about your background.', 'Tell me about a time you won a difficult deal. What happened next?', 'Why do you want to join this team?'];
    default: return [
      'Thanks for coming in, I appreciate it. Walk me through your background.',
      'Tell me about a time you won back a lost client. What happened next, and what did you learn?',
      'Give me an example of a time you missed a target. How did you respond?',
      'Next question: what do you need from a manager to do your best work?'
    ];
  }
}

function email(ctx: SpeakerContext, kit: Kit, st: { lines: [string, string] }): string {
  const name = ctx.person?.first ?? 'there';
  const warn = ctx.emailIntent === 'warn';
  switch (ctx.level) {
    case 0: return warn ? 'Your numbers are not acceptable. You need to improve.' : 'Well done. Keep it up.';
    case 1: return warn
      ? join(`Hi ${name}, I am concerned about your results this week.`, st.lines[0], 'You need to improve by Friday.')
      : join(`Hi ${name}, thank you for your work this week. Well done, keep it up.`, st.lines[0]);
    case 2: return warn
      ? join(`Hi ${name}, thank you for your effort. I am concerned that your results fell this week, because two deals slipped.`, st.lines[0], 'Can we agree the next step by Friday?')
      : join(`Hi ${name}, thank you for your work this week. Well done on the progress in your stage, because the pipeline moved.`, st.lines[0], 'Let me know what would help by Friday.');
    default: return warn
      ? join(`Hi ${name}, thank you for your effort this week, I appreciate it. I am concerned that your results fell, because 2 deals slipped at the proposal stage.`, 'For example, the follow ups waited three days.', st.lines[0], st.lines[1], plain(kit, ctx.variant, 'Can we agree the next step by Friday? I will check in with you by Friday.'))
      : join(`Hi ${name}, thank you for your work this week. Well done: specifically, the 3 follow ups you closed moved the whole team forward, because the proposal stage was stuck.`, st.lines[0], 'Let me know what would help by Friday.');
  }
}

function meeting(ctx: SpeakerContext, kit: Kit, st: { lines: [string, string]; crude: string }, promise: string | null): string[] {
  const v = ctx.variant;
  const someone = ctx.team.length ? ctx.team[v % ctx.team.length] : null;
  switch (ctx.level) {
    case 0: return [join('Team, we need better numbers this week. That is all.', st.crude)];
    case 1: return [join('Thanks for coming, everyone.', st.lines[0]), 'Let me know how it goes this week.'];
    case 2: return [
      'Thanks for coming, everyone. Today we have three things: the pipeline, the risks and the next steps.',
      join(st.lines[0], st.lines[1]),
      join('What do you all think? Can we agree the next steps by Friday?', promise)
    ];
    default: return [
      'Thanks for coming, everyone, I appreciate it. Today we have three things: the pipeline, the risks and the next steps. The goal is to protect the target.',
      someone ? `${someone}, what is the pipeline looking like from where you sit?` : 'What is the pipeline looking like from where you sit?',
      join(st.lines[0], st.lines[1], plain(kit, v, 'What do you all think?', 'Does anyone see it differently?')),
      join('Can we agree the next steps by Friday? Thanks, everyone, for your time.', promise)
    ];
  }
}

function planLines(ctx: SpeakerContext, kit: Kit, st: { lines: [string, string] }): string[] {
  switch (ctx.level) {
    case 0: return ['Here are your goals.'];
    case 1: return ['Here is the plan for this week.', 'Let me know how it goes.'];
    default: return [join('Here is the plan we talked about.', st.lines[0]), plain(kit, ctx.variant, 'What would you change in this plan?', 'Is anything missing from this plan?')];
  }
}

/** A written plan's fields as each level writes them (D85): vague at first, specific and measurable at the top. */
export function planFields(ctx: SpeakerContext): PlanFields {
  const kit = kitFor(ctx.lens);
  const st = kit.style(ctx.intent);
  const owner = ctx.person?.first ?? 'You';
  switch (ctx.level) {
    case 0: return { goals: 'Do better', measures: 'More sales', owner: 'You', due: null, support: '' };
    case 1: return { goals: 'Close more deals this week', measures: 'More deals than last week', owner, due: null, support: '' };
    case 2: return { goals: 'Move three qualified leads to the next stage this week', measures: '3 proposals sent and 2 follow up calls', owner, due: 3, support: st.lines[0] };
    default: return { goals: 'Move three qualified leads to the next stage and close one deal this week', measures: '3 proposals sent, 2 follow up calls and 1 deal closed, tracked daily', owner, due: 3, support: join(st.lines[0], st.lines[1]) };
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
