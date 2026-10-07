import type { StorylineConfig } from '../config';

type Person = StorylineConfig['members'][number];
import { IntentError } from './actions';
import { firstName, member, nextId, person } from './sim';
import type { Interaction, Mood, Sim, Turn } from './types';
import { msg, type Copy } from '../copy';
import { moodOf } from './view';

/**
 * Live interactions as conversations (Design doc, Evaluation pipeline; spec, Live interaction
 * screens). An interaction holds the turns so far; the participant sends turns, the NPC answers in
 * persona, and ending it runs the evaluator over everything the participant said. Email and written
 * plan are one shot: the participant submits once.
 *
 * The NPC's words come from an `NpcModel`. In production that is an AI model on the server, streamed
 * to the client; `personaNpc` is the transparent stand in for the mock engine, tests and calibration.
 * Either way the NPC only talks: consequences come from the rubric and the authored tables.
 */
export interface NpcContext {
  format: string;
  /** Who is speaking: a member, a candidate, or 'sponsor'. */
  speaker: { id: string; name: string; persona: Person | null; mood: Mood; trust: number };
  /** The participant's last turn, or null for the opening line. */
  said: string | null;
  turnsSoFar: number;
  turnsLeft: number;
  concernRevealed: boolean;
  actionName: string;
  /** Body of the message being replied to (chat replies open with it). */
  replyTo?: Copy;
}

export interface NpcReply { text: Copy; revealsConcern?: boolean; signsOff?: boolean }

export interface NpcModel {
  reply(ctx: NpcContext): NpcReply | Promise<NpcReply>;
}

/** One shot formats: the participant writes once, then the interaction ends. A written plan is sent as a turn, then the check in. */
export const ONE_SHOT = new Set(['email']);
/** Formats with no style tag (scoring-and-report.md 3): they never count as a style choice. */
export const UNTAGGED = new Set(['meeting', 'sponsor', 'interview']);

const OPEN_Q = /\b(?:what|how|why|tell me|walk me through)\b[^?]*\?/i;
const CONCERN_Q = /\b(?:what'?s on your mind|what is on your mind|what'?s bothering|how are you (?:feeling|doing)|what'?s really going on|is something wrong|anything (?:else )?on your mind|how can i help)\b/i;
const ACK = /\b(?:sorry|thank(?:s| you)|appreciate|i hear you|i understand|that sounds)\b/i;
const STEP = /\b(?:by (?:monday|tuesday|wednesday|thursday|friday|tomorrow|end of (?:day|week))|tomorrow|this week|next step|let'?s agree)\b/i;
const BYE = /\b(?:bye|thanks for your time|that'?s all|we can stop here|let'?s wrap up)\b/i;
const HARSH = /\b(?:idiot|stupid|useless|pathetic|shut up|incompetent|worthless|your fault)\b/i;

const pick = <T,>(list: T[], n: number) => list[n % list.length];

/** The persona stand in: short, plain replies that follow mood, trust and what was said. */
export const personaNpc: NpcModel = {
  reply(ctx) {
    const { speaker: sp, said, format } = ctx;
    if (said === null) {
      if (ctx.replyTo) return { text: ctx.replyTo };
      if (format === 'sponsor') return { text: `Thanks for making time. Give me your update: where are we against target, and what is your plan?` };
      if (format === 'interview') return { text: `Hello, thank you for having me. I am ${sp.name}, and I am interested in the ${sp.persona?.title ?? 'role'} role.` };
      if (format === 'meeting') return { text: `Morning, everyone is here. So, what did you want to go through?` };
      const byMood: Record<Mood, string[]> = {
        frustrated: ['You wanted to see me? Honestly, it has been a rough week.', 'Okay. I did not expect this meeting. What is it about?'],
        concerned: ['Sure. I have a few things on my mind, to be honest.', 'Hi. Is everything alright? You wanted to talk.'],
        thinking: ['Hi. I was hoping we would get a chance to talk.', 'Good timing. I had something I wanted to raise.'],
        neutral: ['Hi. What did you want to talk about?', 'Sure, I have a few minutes. What is up?'],
        happy: ['Hi! Good to see you. What did you want to talk about?', 'Hey, sure. Things are going well this week.']
      };
      return { text: pick(byMood[sp.mood], sp.name.length) };
    }
    if (HARSH.test(said)) return { text: 'That is not okay. I would rather stop here.', signsOff: true };
    if (BYE.test(said) || ctx.turnsLeft <= 0) {
      return { text: format === 'sponsor' ? 'Good. Keep me posted, and come back to me if you need support.' : format === 'interview' ? 'Thank you for your time. I look forward to hearing from you.' : `Okay. Thanks, I will get back to it.`, signsOff: true };
    }
    if (format === 'sponsor') {
      const probes = ['What is the biggest risk to the target, in your view?', 'And what do you need from me to get there?', 'Who on the team are you most worried about, and what are you doing about it?'];
      return { text: pick(probes, ctx.turnsSoFar) };
    }
    if (format === 'plan') {
      // The 2 minute check in on the plan (spec, Written plan).
      if (ctx.turnsSoFar <= 1) return { text: /\d/.test(said) ? 'Thanks for the plan. The numbers make it clear what good looks like, and I can commit to that.' : 'Thanks for the plan. Could we make the goals more specific? I am not sure how we will know it worked.' };
      return { text: 'Okay, that works for me. I will get started.', signsOff: true };
    }
    if (format === 'interview') {
      const p = sp.persona;
      if (/\b(?:experience|background|previous|before)\b/i.test(said)) return { text: p?.profile.remarks || `I have ${p?.profile.experience || 'some'} of experience in this area.` };
      if (/\b(?:skill|strength|good at)\b/i.test(said)) return { text: `My strengths are ${p?.profile.skills || 'working with clients'}.` };
      if (/\b(?:why|motivat|interest)\b/i.test(said)) return { text: 'I want a team where I can grow and where results are recognized.' };
      return { text: pick(['Good question. I would start by understanding the customer, then work out the next step with them.', 'I learned to keep promises small and keep them. That has worked for me.', 'I would ask the team first. They usually know where the problem is.'], ctx.turnsSoFar) };
    }
    const canOpenUp = sp.persona?.concernLine && !ctx.concernRevealed && (sp.trust >= 45 || ACK.test(said)) && (CONCERN_Q.test(said) || (OPEN_Q.test(said) && ctx.turnsSoFar >= 2));
    if (canOpenUp) return { text: sp.persona!.concernLine!, revealsConcern: true };
    if (STEP.test(said)) return { text: pick(['Okay. I can do that by then.', 'Fair. I will have it ready.', 'Alright, that is clear. I will make it happen.'], ctx.turnsSoFar) };
    if (ACK.test(said)) return { text: pick(['Thanks, I appreciate you saying that.', 'That helps, honestly.', 'Thanks. It means something that you noticed.'], ctx.turnsSoFar) };
    if (OPEN_Q.test(said)) {
      const byMood: Record<Mood, string> = {
        frustrated: 'Mostly that things change and nobody asks us first.',
        concerned: 'The pipeline is slow, and I am not sure what is expected of me anymore.',
        thinking: 'I have some ideas, but I am not sure they would be welcome.',
        neutral: 'Things are okay. The work is moving, slowly.',
        happy: 'Going well. I think we can push a bit harder this week.'
      };
      return { text: byMood[sp.mood] };
    }
    return { text: pick([`Okay${sp.trust < 40 ? ', if you say so' : ''}.`, 'Right. Anything else?', `I hear you${sp.mood === 'frustrated' ? ', but I am not sure that fixes it' : ''}.`], ctx.turnsSoFar) };
  }
};

/** Coaching tips per format, one per interaction (Configuration Spec, Hints: on request): `engine.hint` in the catalog. */
const HINT_FORMATS = new Set(['roleplay', 'chat', 'email', 'meeting', 'sponsor', 'interview', 'plan']);

export function speakerFor(sim: Sim, it: Interaction): string {
  if (it.format === 'sponsor') return 'sponsor';
  if (it.format === 'interview') return it.candidates?.[it.candidate ?? 0] ?? 'sponsor';
  if (it.format === 'meeting') return it.floor ?? attendees(sim)[0] ?? 'sponsor';
  return it.memberIds[0] ?? 'sponsor';
}

function speakerCtx(sim: Sim, id: string): NpcContext['speaker'] {
  if (id === 'sponsor') return { id, name: sim.config.sponsor.name, persona: null, mood: 'neutral', trust: 50 };
  const m = member(sim, id);
  const p = person(sim, id);
  return { id, name: p.name, persona: p, mood: m ? moodOf(m, sim) : 'neutral', trust: m?.trust ?? sim.config.trustRules.start };
}

const actionName = (sim: Sim, it: Interaction) => sim.config.actions.find(a => a.key === it.actionKey)?.name ?? (it.actionKey === 'sponsor' ? 'Sponsor briefing' : 'Reply');
export const turnLimit = (sim: Sim, it: Interaction) => (it.actionKey === PRACTICE ? sim.config.practice.turnLimit : sim.config.actions.find(a => a.key === it.actionKey)?.live.turnLimit ?? 12);
const yourTurns = (it: Interaction) => it.turns.filter(t => t.by === 'you').length;

async function npcSays(sim: Sim, npc: NpcModel, it: Interaction, said: string | null): Promise<Turn> {
  const by = speakerFor(sim, it);
  const msg = it.replyTo ? sim.inbox.find(x => x.id === it.replyTo) : undefined;
  const r = await npc.reply({
    format: it.format, speaker: speakerCtx(sim, by), said, turnsSoFar: yourTurns(it), turnsLeft: turnLimit(sim, it) - yourTurns(it),
    concernRevealed: it.concernRevealed, actionName: actionName(sim, it), replyTo: said === null ? msg?.body : undefined
  });
  if (r.revealsConcern) it.concernRevealed = true;
  if (r.signsOff) it.closed = true;
  const turn: Turn = { id: nextId(sim, 't'), by, text: r.text };
  it.turns.push(turn);
  return turn;
}

/** Who is in a team meeting: everyone available. */
export const attendees = (sim: Sim) => sim.members.filter(m => m.away === 0).map(m => m.id);

/**
 * Team meeting floor (design frame l5: active speaker, raised hands, call on by name). Calling someone
 * by first name gives them the floor; otherwise the first raised hand speaks up; otherwise whoever
 * spoke goes on.
 */
function passFloor(sim: Sim, it: Interaction, text: string) {
  const named = attendees(sim).find(id => new RegExp(`\\b${firstName(sim, id)}\\b`, 'i').test(text));
  const next = named ?? it.hands?.[0];
  if (!next) return;
  it.floor = next;
  it.hands = (it.hands ?? []).filter(id => id !== next);
}

/**
 * After someone speaks, up to two people who have not had the floor raise a hand: first anyone
 * carrying an unshared concern, then the lowest morale. Deterministic, so a replay matches.
 */
function raiseHands(sim: Sim, it: Interaction) {
  const spoke = new Set(it.turns.filter(t => t.by !== 'you').map(t => t.by));
  const want = attendees(sim).filter(id => !spoke.has(id) && id !== it.floor).map(id => member(sim, id)!).filter(Boolean)
    .sort((a, b) => Number(!!person(sim, b.id).hiddenConcern && !b.concernShared) - Number(!!person(sim, a.id).hiddenConcern && !a.concernShared) || a.morale - b.morale || a.id.localeCompare(b.id));
  it.hands = [...new Set([...(it.hands ?? []), ...want.map(m => m.id)])].slice(0, 2);
}

/** A fresh interaction record. */
export const blank = (base: Omit<Interaction, 'turns' | 'hint' | 'concernRevealed' | 'closed'>): Interaction => ({ ...base, turns: [], hint: null, concernRevealed: false, closed: false });

/** The NPC speaks first unless the author set otherwise (Configuration Spec, Opening). */
export async function opening(sim: Sim, npc: NpcModel, id: string) {
  const it = sim.interactions[id];
  if (!it || it.turns.length) return;
  const who = sim.config.actions.find(a => a.key === it.actionKey)?.live.opening ?? 'npc';
  if (!ONE_SHOT.has(it.format) && (who === 'npc' || it.replyTo)) await npcSays(sim, npc, it, null);
}

function get(sim: Sim, id: string): Interaction {
  const it = sim.interactions[id];
  if (!it) throw new IntentError('Unknown or finished interaction', 'unknownInteraction');
  return it;
}

/** The participant says something; the NPC answers. Returns the NPC's turn. */
export async function sendTurn(sim: Sim, npc: NpcModel, id: string, text: string, voice = false): Promise<Turn> {
  const it = get(sim, id);
  if (ONE_SHOT.has(it.format)) throw new IntentError('This format is submitted once', 'oneShot');
  if (it.closed) throw new IntentError('The conversation has ended', 'closed');
  if (yourTurns(it) >= turnLimit(sim, it)) throw new IntentError('No turns left', 'turnLimit');
  it.turns.push({ id: nextId(sim, 't'), by: 'you', text, voice });
  if (it.format === 'meeting') passFloor(sim, it, text);
  const turn = await npcSays(sim, npc, it, text);
  if (it.format === 'meeting') raiseHands(sim, it);
  return turn;
}

/** The participant spoke over the NPC: keep only what was shown (spec, Interrupt). */
export function interruptTurn(sim: Sim, id: string, turnId: string, shownChars: number) {
  const it = get(sim, id);
  const t = it.turns.find(x => x.id === turnId);
  if (!t || t.by === 'you') throw new IntentError('Unknown turn', 'unknownTurn');
  // Engine copy is worded on the client, so only a plain line can be cut where it stopped; a message is kept whole.
  if (typeof t.text !== 'string') t.interrupted = true;
  else if (shownChars < t.text.length) { t.text = t.text.slice(0, Math.max(0, shownChars)).trimEnd(); t.interrupted = true; }
}

/** One coaching tip per interaction, when the author allows hints. */
export function requestHint(sim: Sim, id: string): Copy {
  const it = get(sim, id);
  const mode = sim.config.actions.find(a => a.key === it.actionKey)?.live.hints ?? 'onRequest';
  if (mode === 'off') throw new IntentError('Hints are off for this interaction', 'noHints');
  it.hint ??= msg('engine.hint', { format: HINT_FORMATS.has(it.format) ? it.format : 'roleplay' });
  return it.hint;
}

/** Interview: move on to the next candidate, who opens. */
export async function nextCandidate(sim: Sim, npc: NpcModel, id: string) {
  const it = get(sim, id);
  if (it.format !== 'interview' || !it.candidates) throw new IntentError('Not an interview', 'notInterview');
  if ((it.candidate ?? 0) + 1 >= it.candidates.length) throw new IntentError('No more candidates', 'noCandidate');
  it.candidate = (it.candidate ?? 0) + 1;
  it.closed = false;
  await npcSays(sim, npc, it, null);
}

/** Everything the participant said or wrote, for the evaluator. */
export const participantText = (it: Interaction) => it.turns.filter(t => t.by === 'you').map(t => String(t.text)).join('\n');
/** The NPC's last words, for the outcome panel. */
export const lastNpcWords = (it: Interaction) => [...it.turns].reverse().find(t => t.by !== 'you')?.text ?? '';

// ---------------------------------------------------------------- the Week 0 practice (D16, D84)

/** The practice conversation's action key: not an action, never scored, never logged. */
export const PRACTICE = 'practice';
/** Who the participant practises with: the authored member, else the first member. */
export const practicePartner = (sim: Sim) => sim.config.practice.with && member(sim, sim.config.practice.with) ? sim.config.practice.with : sim.members[0]?.id ?? null;
/** Offered before week 1 begins: in style setting of the first period, before anything has happened. */
export const practiceAvailable = (sim: Sim) => sim.practice === 'offered' && sim.phase === 'style' && sim.period === 1 && sim.log.length === 0 && !!practicePartner(sim) && !Object.keys(sim.interactions).length;

/** Opens the practice: a short conversation in the live shell that changes nothing. */
export async function startPractice(sim: Sim, npc: NpcModel): Promise<string> {
  if (!practiceAvailable(sim)) throw new IntentError('The practice is not on offer', 'noPractice');
  const id = nextId(sim, 'i');
  sim.interactions[id] = blank({ actionKey: PRACTICE, optionKey: null, memberIds: [practicePartner(sim)!], format: sim.config.practice.format, startedAt: sim.absSub });
  await npcSays(sim, npc, sim.interactions[id], null);
  return id;
}

/** Skips the practice, or ends it: nothing is evaluated, recorded or scored. Ending gives one coaching tip. */
export function endPractice(sim: Sim, id: string | null): Copy | undefined {
  if (id === null) {
    if (sim.practice === 'offered') sim.practice = 'skipped';
    return undefined;
  }
  const it = get(sim, id);
  if (it.actionKey !== PRACTICE) throw new IntentError('Not the practice', 'notPractice');
  delete sim.interactions[id];
  sim.practice = 'done';
  return it.turns.some(t => t.by === 'you') ? msg('engine.hint', { format: it.format }) : undefined;
}
