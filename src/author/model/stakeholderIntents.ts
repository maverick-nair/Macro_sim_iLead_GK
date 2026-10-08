import type { AuthorDraft, EventDraft, StakeholderDraft } from './draft';
import type { EditOp } from './patch';
import { freshKey } from './seed';
import { briefStakeholders, defaultRequest, newStakeholder, ROLES } from './stakeholders';
import { MAX_STAKEHOLDERS } from './draft';

/**
 * Ask Kora about stakeholders, without a model (D165): three intents read from plain instructions, each as
 * structured changes to the draft, never the instruction's words pasted in.
 *
 *   add          "add the CFO as a stakeholder", "add a client stakeholder", "create the stakeholders from the brief"
 *   demanding    "make Helen more demanding", "make the client harder to please"
 *   request      "add a stakeholder triggered event", "have Priya ask for a meeting", "add a request from the CFO"
 *
 * Returns null when the instruction is not about stakeholders, so Kora's other rules read it as before.
 */

export type StakeholderStep = { ops: EditOp[]; said: string } | { reply: string; options?: string[] };

const set = (path: string, value: unknown): EditOp => ({ op: 'set', path, value });
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const has = (text: string, phrase: string) => phrase.length >= 2 && ` ${norm(text)} `.includes(` ${norm(phrase)} `);

const RX = {
  word: /\bstakeholders?\b/i,
  add: /\b(add|create|bring in|include|introduce|set up)\b/i,
  role: /\b(cfo|coo|ceo|board( member)?|client|customer|union|partner|vendor|supplier|line manager|my manager|their manager|boss|peer|head of [a-z]+)\b/i,
  team: /\b(team member|member of the team|character|direct report|rep)\b/i,
  brief: /\b(from|in|of) the brief\b|\bbrief'?s stakeholders\b/i,
  demanding: /\b(more demanding|tougher|harder to please|stricter|more critical|less patient|more impatient|more difficult)\b/i,
  request: /\b(stakeholder[- ](triggered|initiated|led) events?|requests? from|asks? (to meet|for (a )?(meeting|call|update))|ask(ing)? to meet|events? from|messages? from|wants? a meeting)\b/i,
  event: /\b(event|request|meeting request)\b/i
};

/** The stakeholders an instruction names: by full name, first name, role, or the word for their kind. */
export function stakeholdersIn(d: AuthorDraft, text: string): StakeholderDraft[] {
  return d.stakeholders.filter(s => {
    const first = s.name.split(' ')[0] ?? '';
    if (has(text, s.name) || (first.length >= 3 && has(text, first))) return true;
    if (s.role.trim() && has(text, s.role)) return true;
    const role = ROLES.find(r => r.kind === s.kind && r.re.test(text) && r.re.test(`${s.role} ${s.kind}`));
    return !!role;
  });
}

/** A request from a stakeholder, mid run: they ask to meet (or write, when nothing live is on), by a deadline. */
function requestEvent(d: AuthorDraft, s: StakeholderDraft): EventDraft {
  const first = s.name.split(' ')[0] || s.name;
  const r = defaultRequest(s);
  const meeting = r.kind === 'meeting';
  const body: Record<StakeholderDraft['kind'], string> = {
    manager: `${first} wants an update on your team before the end of the week.`,
    peer: `${first}'s team is stretched. ${first} wants to agree priorities with you before anything else slips.`,
    customer: `${first} has concerns about what your team promised and wants to talk this week.`,
    executive: `${first} wants to hear your plan for the quarter, with the numbers, by Thursday.`,
    board: `${first} has questions about risk in your area before the next board meeting.`,
    union: `${first} has heard about the workload in your team and wants to meet.`,
    partner: `${first} says the partnership is not working as agreed and wants to talk.`,
    other: `${first} wants to talk to you this week.`
  };
  const week = clamp(Math.ceil(d.process.weeks / 2), 1, d.process.weeks);
  return {
    key: freshKey(`${s.key}_asks`, d.events.map(e => e.key)), title: meeting ? `${first} asks to meet` : `${first} asks for an answer`, kind: 'sponsor', week, day: 2, timing: 'fixed',
    who: 'team', arrives: 'email', body: body[s.kind], skill: 0, morale: 0, result: 0, leadFlow: 0, respondWith: [], within: r.within, onTime: [0, 2, 0],
    ifIgnored: { sponsor: s.kind === 'executive' || s.kind === 'board' || s.kind === 'manager', followUp: null }, stakeholder: s.key, request: r, origin: 'yours'
  };
}

function add(d: AuthorDraft, text: string): StakeholderStep {
  if (d.stakeholders.length >= MAX_STAKEHOLDERS) return { reply: `There are already ${MAX_STAKEHOLDERS} stakeholders, the most. Remove one in Team first.` };
  if (RX.brief.test(text)) {
    const listed = briefStakeholders(d);
    if (!listed.length) return { reply: 'The brief names no stakeholders I have not created yet. Tell me a role instead, for example: add the CFO as a stakeholder.' };
    const w = structuredClone(d);
    const ops: EditOp[] = [];
    // The brief's own words for each role are kept as written.
    for (const b of listed) { const s = { ...newStakeholder(w, b), ...(b.role ? { role: b.role } : null) }; w.stakeholders.push(s); ops.push({ op: 'addStakeholder', value: s }); }
    return { ops, said: `Adds ${listed.length} stakeholder${listed.length === 1 ? '' : 's'} from your brief: ${listed.map(b => `${b.name}${b.role ? `, ${b.role}` : ''}`).join('; ')}. Each starts steady, with ways to engage them that suit who they are.` };
  }
  const role = text.match(/\bstakeholders?\s*[:,]\s*(?:the\s+)?(.+?)\s*\.?$/i)?.[1] ?? text.match(RX.role)?.[0] ?? '';
  const s = newStakeholder(d, { role: role || undefined });
  const on = s.interactions.filter(i => i.enabled).map(i => i.type);
  return { ops: [{ op: 'addStakeholder', value: s }], said: `Adds ${s.name}, ${s.role}, as a stakeholder outside the team. Participants can ${on.join(' and ')} with them in play; open Team to shape who they are and what each conversation does.` };
}

function demanding(d: AuthorDraft, who: StakeholderDraft[]): StakeholderStep {
  const ops: EditOp[] = [];
  for (const s of who) {
    ops.push(set(`stakeholders.${s.key}.start.satisfaction`, clamp(s.start.satisfaction - 15, 5, 100)));
    ops.push(set(`stakeholders.${s.key}.start.trust`, clamp(s.start.trust - 10, 5, 100)));
    ops.push(set(`stakeholders.${s.key}.drift`, clamp(s.drift + 2, 0, 10)));
    ops.push(set(`stakeholders.${s.key}.voice.warmth`, clamp(s.voice.warmth - 20, 0, 100)));
    for (const x of s.interactions.filter(i => i.enabled)) ops.push(set(`stakeholders.${s.key}.interactions.${x.type}.bad.satisfaction`, clamp(x.bad.satisfaction - 3, -30, 30)));
  }
  const names = who.map(s => s.name.split(' ')[0]).join(' and ');
  return { ops, said: `${names} ${who.length === 1 ? 'is' : 'are'} more demanding: ${who.length === 1 ? 'starts' : 'start'} less satisfied and less trusting, lose${who.length === 1 ? 's' : ''} patience faster in a week you do not engage them, sound${who.length === 1 ? 's' : ''} cooler, and take${who.length === 1 ? 's' : ''} a conversation that goes badly harder.` };
}

/**
 * Reads an instruction about stakeholders: returns the operations and Kora's line, a question back, or null when the
 * instruction is about something else.
 */
export function stakeholderIntent(d: AuthorDraft, text: string): StakeholderStep | null {
  const named = stakeholdersIn(d, text);
  const about = RX.word.test(text) || named.length > 0;
  // A request from a stakeholder: an event they start, with a deadline.
  if ((RX.request.test(text) || (RX.add.test(text) && RX.event.test(text) && about)) && (about || RX.role.test(text))) {
    const who = named.length ? named : d.stakeholders.length === 1 ? d.stakeholders : [];
    if (!d.stakeholders.length) return { reply: 'There are no stakeholders yet. Add one first, for example: add the CFO as a stakeholder.' };
    if (!who.length) return { reply: `Which stakeholder should it come from? ${d.stakeholders.map(s => s.name).join(', ')}.`, options: d.stakeholders.slice(0, 4).map(s => `Add a request from ${s.name}`) };
    const w = structuredClone(d);
    const ops: EditOp[] = [];
    for (const s of who) { const e = requestEvent(w, s); w.events.push(e); ops.push({ op: 'addEvent', value: e }); }
    return { ops, said: `${who.map(s => s.name.split(' ')[0]).join(' and ')} now ${who.length === 1 ? 'asks' : 'ask'} for a meeting in week ${Math.ceil(d.process.weeks / 2)}, by a deadline. Answered in time, the relationship grows; ignored, it suffers${who.some(s => ['executive', 'board', 'manager'].includes(s.kind)) ? ' and the sponsor hears of it' : ''}. Open Events to change when and what they ask.` };
  }
  if (RX.demanding.test(text) && about) {
    const who = named.length ? named : d.stakeholders.length === 1 ? d.stakeholders : [];
    if (!who.length) return d.stakeholders.length ? { reply: `Which stakeholder should be more demanding? ${d.stakeholders.map(s => s.name).join(', ')}.`, options: d.stakeholders.slice(0, 4).map(s => `Make ${s.name} more demanding`) } : { reply: 'There are no stakeholders yet. Add one first, for example: add a client as a stakeholder.' };
    return demanding(d, who);
  }
  if (RX.add.test(text) && (RX.word.test(text) || (RX.role.test(text) && !RX.team.test(text) && /\bas an? (outside|external)\b|\boutside the team\b/i.test(text)))) return add(d, text);
  return null;
}
