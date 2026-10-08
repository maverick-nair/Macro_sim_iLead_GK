import { TONE_LABELS } from '../context';
import { LENS_BY_ID, type Tone } from '../lenses';
import { CLOSE, WELCOME } from '../storyline';
import { MAX_WEEKS, MIN_WEEKS, type ActionDraft, type AuthorDraft, type Character, type EventDraft, type Tab } from './draft';
import { PACING as PACE } from './export';
import { applyOps, checkOps, type Change, type EditOp } from './patch';
import { regenerateItem } from './regenerate';
import { fitRun, movedNote } from './run';
import { effectText, freshKey, parseEffect, PORTRAITS, pronounsOf } from './seed';
import { flagsSet } from './choices';

/**
 * Ask Kora without a model (D125): a small rule based reading of plain instructions. Each recognised
 * intent becomes real, structured changes to the draft (numbers, timings, effects, names, people),
 * never the instruction's words pasted into the content. Several compatible intents in one instruction
 * are combined; two that pull opposite ways get a question back; anything else gets an honest "I can't
 * do that yet". Nothing changes until the author applies the proposal.
 */

export type KoraAnswer =
  | { kind: 'change'; reply: string; ops: EditOp[]; changes: Change[]; marks: string[]; source: 'rules' | 'model'; regenerate?: boolean }
  | { kind: 'reply'; reply: string; options?: string[]; source: 'rules' | 'model' };

/** What the rules understand, for the panel's help line and the "can't do that yet" reply. */
export const CAN_DO = 'make it harder or easier, make decisions less obvious, add trade-offs, make consequences carry forward, make an event more tense, shorten or lengthen the run, add, remove or rename a character, rename the company, product or sponsor, regenerate one event or person, change the tone, or make the sponsor more demanding or supportive';

/* ------------------------------------------------------------------------------------------------
 * Names: whole names only, escaped, never empty, and first names that are also common words only
 * when written with a capital inside a sentence ("Will" the person, not "I will").
 * ---------------------------------------------------------------------------------------------- */

const COMMON = new Set(['will', 'mark', 'grace', 'hope', 'faith', 'joy', 'rose', 'may', 'june', 'april', 'august', 'art', 'bill', 'pat', 'sue', 'jack', 'frank', 'rich', 'chase', 'drew', 'gene', 'max', 'sky', 'summer', 'winter', 'autumn', 'dawn', 'eve', 'iris', 'ray', 'rob', 'sandy', 'hunter', 'page', 'reed', 'wade', 'cliff', 'dale', 'glen', 'guy', 'lane', 'miles', 'norm', 'penny', 'ruby', 'rusty', 'sunny', 'amber', 'crystal', 'honor', 'ivy', 'jade', 'lily', 'holly', 'heather', 'daisy', 'violet', 'river', 'rock', 'stone', 'brook', 'young', 'black', 'white', 'green', 'brown', 'king', 'long', 'bell', 'less', 'more', 'lead', 'team', 'new', 'best', 'case', 'deal', 'close', 'hall', 'price', 'cash', 'sharp', 'early', 'love', 'happy', 'major', 'prince', 'small', 'west', 'north', 'south', 'day', 'week']);
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const wordRe = (s: string, flags: string) => new RegExp(`(?<![\\p{L}\\p{N}_])${escape(s)}(?![\\p{L}\\p{N}_])`, flags);

/** True when the text names this word as a name: case-insensitive, or, for common words, capitalised mid sentence. */
function namesWord(text: string, word: string): boolean {
  const w = word.trim();
  if (w.length < 2) return false;
  if (!COMMON.has(w.toLowerCase())) return wordRe(w, 'iu').test(text);
  const cap = w.charAt(0).toUpperCase() + w.slice(1);
  for (const m of text.matchAll(wordRe(cap, 'gu'))) {
    const before = text.slice(0, m.index).trimEnd();
    if (before && !/[.!?:;]$/.test(before)) return true;
  }
  return false;
}

/** The characters an instruction names, by full name, first name or (when unique) last name. */
export function charactersIn(d: AuthorDraft, text: string): Character[] {
  return d.team.filter(c => {
    const first = c.first.trim(), last = c.last.trim();
    if (first.length >= 2 && last.length >= 2 && wordRe(`${first} ${last}`, 'iu').test(text)) return true;
    if (namesWord(text, first)) return true;
    return last.length >= 3 && d.team.filter(o => o.last.trim().toLowerCase() === last.toLowerCase()).length === 1 && namesWord(text, last);
  });
}

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

/** The events an instruction names: by week ("the week 3 event"), by title, or by key. */
export function eventsIn(d: AuthorDraft, text: string): EventDraft[] {
  const t = ` ${norm(text)} `;
  const byTitle = d.events.filter(e => { const n = norm(e.title); return n.length >= 4 && t.includes(` ${n} `); });
  if (byTitle.length) return byTitle;
  const byKey = d.events.filter(e => t.includes(` ${e.key.replace(/_/g, ' ')} `));
  if (byKey.length) return byKey;
  const week = text.match(/\bweek\s+(\d{1,2})\b/i);
  if (week && /\bevents?\b/i.test(text)) return d.events.filter(e => e.timing === 'fixed' && e.week === Number(week[1]));
  return [];
}

/** The actions an instruction names, by name or by the first word of the name ("coaching" for Coach member). */
function actionsIn(d: AuthorDraft, text: string): ActionDraft[] {
  const t = ` ${norm(text)} `;
  return d.actions.filter(a => {
    const n = norm(a.name);
    if (n && t.includes(` ${n} `)) return true;
    const first = n.split(' ')[0];
    return first.length >= 5 && first !== 'meet' && new RegExp(`\\s${escape(first)}\\w*\\s`).test(t);
  });
}

/* ------------------------------------------------------------------------------------------------
 * Intents: each reads the working draft and returns operations and a line for Kora's reply.
 * ---------------------------------------------------------------------------------------------- */

interface Step { ops: EditOp[]; said: string; none?: string; regenerate?: boolean }
/** What an intent works on: what the instruction names, else the whole draft; the tab narrows trade-offs to its own kind. */
interface Scope { events: EventDraft[]; characters: Character[]; actions: ActionDraft[]; text: string; variant: number; tab: Tab }

const set = (path: string, value: unknown): EditOp => ({ op: 'set', path, value });
const round2 = (n: number) => { const p = 10 ** Math.max(0, Math.floor(Math.log10(n)) - 1); return Math.round(n / p) * p; };
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const PACING = ['forgiving', 'balanced', 'demanding'] as const;
const IMPACTS = ['skill', 'morale', 'result'] as const;
/** An event that expects a response (D128): some action answers it, within its days. */
const needsAnswer = (e: EventDraft) => e.respondWith.length > 0;
const list = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

function tense(events: EventDraft[], factor: number): EditOp[] {
  const ops: EditOp[] = [];
  for (const e of events) {
    let any = false;
    for (const k of IMPACTS) {
      if (e[k] >= 0) continue;
      any = true;
      const v = clamp(Math.min(e[k] - 1, Math.round(e[k] * factor)), -30, -1);
      if (v !== e[k]) ops.push(set(`events.${e.key}.${k}`, v));
    }
    if (!any) ops.push(set(`events.${e.key}.morale`, clamp(e.morale - 3, -30, 30)));
    if (needsAnswer(e) && e.within > 1) ops.push(set(`events.${e.key}.within`, e.within - 1));
  }
  return ops;
}

/**
 * What a pacing does, in words, from the export's own levers (D129): pacing is the one place the run's
 * leads, how hard setbacks land, morale drift and the sponsor's reaction to an ignored event are set.
 */
function pacingWords(p: (typeof PACING)[number]): string {
  if (p === 'balanced') return 'the calibrated pace';
  const x = PACE[p], b = PACE.balanced;
  const leads = Math.round(Math.abs(x.leads - 1) * 100);
  return `${leads}% ${x.leads < 1 ? 'fewer' : 'more'} new leads, setbacks land ${Math.round(Math.abs(x.harm - 1) * 100)}% ${x.harm > 1 ? 'harder' : 'softer'}, morale drifts ${x.drift > b.drift ? 'faster' : 'slower'} when nobody acts, and an ignored event costs the sponsor's confidence ${-x.escalation} instead of ${-b.escalation}`;
}

/**
 * Harder (D125): the target up about 15%, pacing one step up, and a day less to answer events that need an
 * answer. Pacing carries the rest through the export (fewer leads, setbacks deeper, faster drift, a harsher
 * sponsor), so the events' own effects are deepened only when pacing is already demanding.
 */
function harder(d: AuthorDraft): Step {
  const ops: EditOp[] = [];
  const said: string[] = [];
  if (d.process.revenue) { ops.push(set('process.revenue', round2(d.process.revenue * 1.15))); said.push('the revenue target goes up about 15%'); }
  const p = PACING.indexOf(d.process.pacing);
  if (p < 2) { ops.push(set('process.pacing', PACING[p + 1])); said.push(`pacing becomes ${PACING[p + 1]} (${pacingWords(PACING[p + 1])})`); }
  const windows = d.events.filter(e => needsAnswer(e) && e.within > 1);
  for (const e of windows) ops.push(set(`events.${e.key}.within`, e.within - 1));
  if (windows.length) said.push('every event that needs an answer gives a day less to respond');
  if (p === 2) {
    const before = ops.length;
    for (const e of d.events) for (const k of IMPACTS) if (e[k] < 0) { const v = clamp(Math.min(e[k] - 1, Math.round(e[k] * 1.25)), -30, -1); if (v !== e[k]) ops.push(set(`events.${e.key}.${k}`, v)); }
    if (ops.length > before) said.push('setbacks hit about a quarter harder');
  }
  return { ops, said: said.length ? `Harder: ${list(said)}.` : '', none: 'It is already as hard as I can make it by rule.' };
}

/** Easier: the reverse, through the same pacing levers; the events' own effects soften only when pacing is already forgiving. */
function easier(d: AuthorDraft): Step {
  const ops: EditOp[] = [];
  const said: string[] = [];
  if (d.process.revenue) { ops.push(set('process.revenue', round2(d.process.revenue * 0.87))); said.push('the revenue target goes down about 13%'); }
  const p = PACING.indexOf(d.process.pacing);
  if (p > 0) { ops.push(set('process.pacing', PACING[p - 1])); said.push(`pacing becomes ${PACING[p - 1]} (${pacingWords(PACING[p - 1])})`); }
  const windows = d.events.filter(e => needsAnswer(e) && e.within < 5);
  for (const e of windows) ops.push(set(`events.${e.key}.within`, e.within + 1));
  if (windows.length) said.push('every event that needs an answer gives a day more to respond');
  if (p === 0) {
    const before = ops.length;
    for (const e of d.events) for (const k of IMPACTS) if (e[k] < -1) { const v = Math.min(-1, Math.round(e[k] * 0.75)); if (v !== e[k]) ops.push(set(`events.${e.key}.${k}`, v)); }
    if (ops.length > before) said.push('setbacks hit about a quarter softer');
  }
  return { ops, said: said.length ? `Easier: ${list(said)}.` : '', none: 'It is already as gentle as I can make it by rule.' };
}

/** Conversations whose style impact table can be tuned, and decisions with options of their own. */
const inPlay = (d: AuthorDraft, s: Scope) => (s.actions.length ? s.actions : d.actions.filter(a => a.core || a.enabled));
const sum = (e: number[]) => e.reduce((a, b) => a + b, 0);

function lessObvious(d: AuthorDraft, s: Scope): Step {
  const ops: EditOp[] = [];
  let tables = 0, costs = 0;
  for (const a of inPlay(d, s)) {
    let touched = false;
    for (const [style, row] of Object.entries(a.impact)) {
      const fit = parseEffect(row.fit), close = parseEffect(row.close);
      if (!fit || !close || sum(fit) <= sum(close)) continue;
      const nf = [...fit] as number[], nc = [...close] as number[];
      for (let i = 0; i < 3; i++) { const g = Math.floor((fit[i] - close[i]) / 4); if (g > 0) { nf[i] -= g; nc[i] += g; } }
      if (effectText(nf) !== row.fit) ops.push(set(`actions.${a.key}.impact.${style}.fit`, effectText(nf)));
      if (effectText(nc) !== row.close) ops.push(set(`actions.${a.key}.impact.${style}.close`, effectText(nc)));
      touched = true;
    }
    if (touched) tables++;
    const own = a.options.map(o => ({ o, fx: parseEffect(o.fits) })).filter(x => !x.o.style && x.fx && sum(x.fx) > 0);
    if (own.length >= 2) {
      const best = own.reduce((b, x) => (sum(x.fx!) > sum(b.fx!) ? x : b));
      const fx = [...best.fx!];
      const i = fx.indexOf(Math.min(...fx));
      fx[i] -= 4;
      ops.push(set(`actions.${a.key}.options.${best.o.key}.fits`, effectText(fx)));
      costs++;
    }
  }
  const said = [tables ? `the gap between the best style and the next one is smaller in ${tables} action${tables === 1 ? '' : 's'}` : '', costs ? `the best option in ${costs} decision${costs === 1 ? '' : 's'} now has a cost` : ''].filter(Boolean);
  return { ops, said: said.length ? `Less obvious decisions: ${list(said)}.` : '', none: 'I found no style table or decision whose best choice I could make less obvious.' };
}

function tradeOffs(d: AuthorDraft, s: Scope): Step {
  const ops: EditOp[] = [];
  let decisions = 0, events = 0;
  if (!s.events.length && s.tab !== 'events') for (const a of inPlay(d, s)) {
    const own = a.options.filter(o => !o.style);
    let touched = false;
    own.forEach((o, i) => {
      const fx = parseEffect(o.fits);
      if (!fx || fx.some(v => v < 0) || sum(fx) === 0) return;
      const [skill, morale, result] = fx;
      const next = i % 2 === 0 ? [skill, -Math.max(2, Math.round(result / 3)), result] : [skill, morale, -Math.max(2, Math.round(morale / 3))];
      ops.push(set(`actions.${a.key}.options.${o.key}.fits`, effectText(next)));
      touched = true;
    });
    if (touched) decisions++;
  }
  let choices = 0;
  if (!s.actions.length && s.tab !== 'actions') for (const e of s.events.length ? s.events : d.events) {
    if (e.choice) { const n = choiceTradeOffs(d, e, ops); if (n) choices++; continue; }
    if (e.result > 0 && e.morale >= 0) { ops.push(set(`events.${e.key}.morale`, -Math.max(2, Math.round(e.result / 2)))); events++; }
    else if (e.morale > 0 && e.result >= 0) { ops.push(set(`events.${e.key}.result`, -Math.max(2, Math.round(e.morale / 2)))); events++; }
  }
  const said = [decisions ? `in ${decisions} decision${decisions === 1 ? '' : 's'} each option now helps one of morale or result and costs the other` : '', events ? `${events} opportunit${events === 1 ? 'y' : 'ies'} now cost${events === 1 ? 's' : ''} something too` : '',
    choices ? `in ${choices} choice event${choices === 1 ? '' : 's'} the option that helps the business now costs people, and the one that helps people costs the business` : ''].filter(Boolean);
  return { ops, said: said.length ? `Stronger trade-offs: ${list(said)}.` : '', none: 'I found no options or opportunities that only help, so there is no trade-off to add.' };
}

/**
 * Opposing effects for a choice event's options (D137): an option that helps the business (revenue, or a variable up)
 * without costing people now costs them morale; one that helps people (morale, trust or skill) without costing the
 * business now costs a business variable (or revenue, with none). Each option ends with a gain and a cost.
 */
function choiceTradeOffs(d: AuthorDraft, e: EventDraft, ops: EditOp[]): number {
  let n = 0;
  const v = d.variables.find(x => x.shown) ?? d.variables[0];
  const step = v ? Math.max(1, Math.round((v.max - v.min) / 20)) * (v.higherIsBetter ? 1 : -1) : 0;
  for (const o of e.choice!.options) {
    const vars = Object.entries(o.variables).map(([k, x]) => { const def = d.variables.find(y => y.key === k); return def ? x * (def.higherIsBetter ? 1 : -1) : 0; });
    const business = o.revenue > 0 || vars.some(x => x > 0) || o.sponsor > 0;
    const businessCost = o.revenue < 0 || vars.some(x => x < 0) || o.sponsor < 0;
    const people = o.skill + o.morale + o.trust > 0;
    const peopleCost = o.morale < 0 || o.trust < 0 || o.skill < 0;
    const at = `events.${e.key}.choice.options.${o.key}`;
    if (business && !peopleCost) { ops.push(set(`${at}.morale`, -Math.max(2, Math.abs(o.morale) || 3))); n++; }
    else if (people && !businessCost) {
      if (v) ops.push(set(`${at}.variables.${v.key}`, (o.variables[v.key] ?? 0) - step));
      else ops.push(set(`${at}.revenue`, o.revenue - Math.round(d.process.revenue ? d.process.revenue / 40 : 1000)));
      n++;
    } else if (!business && !people) {
      // Neither: it helps people a little and costs the business a little, so it is a real option.
      ops.push(set(`${at}.morale`, 2));
      if (v) ops.push(set(`${at}.variables.${v.key}`, (o.variables[v.key] ?? 0) - step));
      n++;
    }
  }
  return n;
}

/**
 * Carrying a choice forward (D138): an option with no flag sets one, and a later event plays only if it is set, two weeks
 * on (a decision without a fixed week waits on the flag alone). The default option is the one carried: what happens
 * when nobody decides comes back too.
 */
function choiceCarry(d: AuthorDraft, e: EventDraft, keys: Set<string>, ops: EditOp[]): boolean {
  const ch = e.choice!;
  if (ch.options.some(o => o.set.length && d.events.some(x => (x.conditions ?? []).some(c => c.kind === 'flag' && o.set.includes(c.flag))))) return false;
  const o = ch.options.find(x => x.key === ch.default) ?? ch.options[0];
  const flag = o.set[0] ?? freshKey(`${e.key}_${o.key}`, [...flagsSet(d)]);
  if (!o.set.includes(flag)) ops.push(set(`events.${e.key}.choice.options.${o.key}.set`, [...o.set, flag]));
  const key = freshKey(`${e.key}_comes_back`, [...keys]);
  keys.add(key);
  const week = e.timing === 'fixed' && e.week ? Math.min(d.process.weeks, e.week + 2) : null;
  ops.push({ op: 'addEvent', value: {
    key, title: `${e.title || 'A decision'}: it comes back`, kind: e.kind === 'opportunity' ? 'impact' : e.kind, week, day: 1, timing: week ? 'fixed' : 'condition', who: e.who === 'sponsor' ? 'team' : e.who, arrives: 'modal',
    body: `"${o.label}" in "${e.title || 'the decision'}" has consequences now.`, skill: 0, morale: -3, result: -2, leadFlow: 0, respondWith: [], within: 2, onTime: [0, 2, 0],
    ifIgnored: { sponsor: false, followUp: null }, conditions: [{ kind: 'flag', flag, is: true }], origin: 'yours'
  } });
  return true;
}

/** The follow up Kora writes for an event nobody answered: it plays only then, and costs the person more. */
function followUpOf(e: EventDraft, key: string): EventDraft {
  const morale = -Math.max(2, Math.round(Math.abs(e.morale) / 2));
  const result = e.result < 0 ? -Math.max(1, Math.round(-e.result / 2)) : 0;
  return {
    key, title: `${e.title || 'An event'}: still not answered`, kind: e.kind === 'opportunity' ? 'impact' : e.kind, week: null, day: 1, timing: 'followup',
    who: e.who, arrives: 'modal', body: `Nobody answered "${e.title || 'it'}" in time. It has come back, and it costs more now.`,
    skill: 0, morale, result, leadFlow: 0, respondWith: [], within: e.within, onTime: [0, 2, 0], ifIgnored: { sponsor: false, followUp: null }, origin: 'yours'
  };
}

/**
 * Consequences carry forward (D125, structured by D128): every event that needs an answer gets an "If ignored"
 * follow up the engine plays when the days to respond run out, and the sponsor hears of it. An event that
 * already has a follow up keeps it; a follow up event nothing leads to yet is used first; otherwise Kora adds
 * one. The export turns it into the engine's escalation (`escalation.event`, `escalation.sponsor`).
 */
function carryForward(d: AuthorDraft, s: Scope): Step {
  const ops: EditOp[] = [];
  const keys = new Set(d.events.map(e => e.key));
  const led = new Set(d.events.flatMap(e => (e.ifIgnored.followUp ? [e.ifIgnored.followUp] : [])));
  const spare = d.events.filter(e => e.timing === 'followup' && !led.has(e.key));
  let added = 0, linked = 0, carried = 0;
  for (const e of (s.events.length ? s.events : d.events).filter(x => x.choice)) if (choiceCarry(d, e, keys, ops)) carried++;
  for (const e of (s.events.length ? s.events : d.events).filter(needsAnswer)) {
    let follow = e.ifIgnored.followUp && keys.has(e.ifIgnored.followUp) && e.ifIgnored.followUp !== e.key ? e.ifIgnored.followUp : null;
    if (!follow) {
      const i = spare.findIndex(x => x.key !== e.key);
      if (i >= 0) { follow = spare[i].key; spare.splice(i, 1); }
      else {
        follow = freshKey(`${e.key}_returns`, [...keys]);
        keys.add(follow);
        ops.push({ op: 'addEvent', value: followUpOf(e, follow) });
        added++;
      }
      ops.push(set(`events.${e.key}.ifIgnored.followUp`, follow));
      linked++;
    }
    if (!e.ifIgnored.sponsor) { ops.push(set(`events.${e.key}.ifIgnored.sponsor`, true)); if (e.ifIgnored.followUp === follow) linked++; }
  }
  const said = [linked ? `Consequences carry forward: ${linked} event${linked === 1 ? '' : 's'} that need an answer now come back when ignored, after the days to respond run out, and the sponsor hears of it${added ? `; ${added} new follow up event${added === 1 ? '' : 's'} play only then` : ''}.` : '',
    carried ? `${carried} decision${carried === 1 ? '' : 's'} now set${carried === 1 ? 's' : ''} a flag, and a new event plays later only if that choice was made.` : ''].filter(Boolean).join(' ');
  return { ops, said, none: s.events.length ? (s.events.some(needsAnswer) || s.events.some(x => x.choice) ? 'That event already comes back.' : 'That event does not ask for an answer, so ignoring it has no follow up to set.') : 'No event asks for an answer, so there is no follow up to set.' };
}

function eventTension(s: Scope): Step {
  const ops = tense(s.events, 1.4);
  return { ops, said: ops.length ? `More tense: ${list(s.events.map(e => e.title))} ${s.events.length === 1 ? 'hits' : 'hit'} harder${s.events.some(e => needsAnswer(e) && e.within > 1) ? ' and leave less time to respond' : ''}.` : '', none: 'That event is already as tense as I can make it.' };
}

/**
 * Shorten, lengthen or set the run (D128): the same `fitRun` the Brief and Work process tabs use moves every
 * fixed event, random window and action unlock with it (applyOps runs it for `process.weeks`), and Kora says
 * what moved.
 */
function runLength(d: AuthorDraft, to: 'short' | 'long' | number): Step {
  const weeks = to === 'short' ? 4 : to === 'long' ? 8 : clamp(to, MIN_WEEKS, MAX_WEEKS);
  const run = weeks <= 4 ? 'lite' : d.brief.run === 'lite' ? 'standard' : d.brief.run;
  if (weeks === d.process.weeks && run === d.brief.run) return { ops: [], said: '', none: `The run is already ${weeks} weeks.` };
  const ops: EditOp[] = [];
  if (run !== d.brief.run) ops.push(set('brief.run', run));
  if (weeks !== d.process.weeks) ops.push(set('process.weeks', weeks));
  const note = movedNote(fitRun(structuredClone(d), weeks));
  const capped = typeof to === 'number' && to > MAX_WEEKS ? ` (${MAX_WEEKS} is the most the simulation plays)` : '';
  return { ops, said: `The run becomes ${weeks} weeks${capped}${run === 'lite' ? ', the Lite run of about 30 minutes' : ''}.${note ? ` ${note}` : ''}` };
}

const NEW_NAMES: Array<[string, string, Character['gender']]> = [['Sam', 'Okoro', 'nonbinary'], ['Alex', 'Moreno', 'nonbinary'], ['Jordan', 'Reyes', 'nonbinary'], ['Robin', 'Das', 'nonbinary'], ['Casey', 'Morgan', 'nonbinary'], ['Noor', 'Haddad', 'woman']];

function addCharacter(d: AuthorDraft, s: Scope): Step {
  if (d.team.length >= 12) return { ops: [], said: '', none: 'The team is full: 12 people is the most. Remove someone first, then ask again.' };
  const remote = /\bremote\b/i.test(s.text);
  const [first, last, gender] = NEW_NAMES.find(([f]) => !d.team.some(c => c.first.toLowerCase() === f.toLowerCase())) ?? NEW_NAMES[0];
  const id = freshKey(remote ? 'remote_member' : 'new_member', d.team.map(c => c.id));
  const counts = new Map(d.process.stages.map(st => [st.key, d.team.filter(c => c.stage === st.key).length]));
  const stage = [...counts.entries()].sort((a, b) => a[1] - b[1])[0][0];
  const base = d.team[0];
  const c: Character = {
    ...structuredClone(base), id, first, last, gender, pronouns: pronounsOf(gender), stage, photo: PORTRAITS[d.team.length % PORTRAITS.length],
    title: `${d.process.stages.find(st => st.key === stage)!.name} Specialist`,
    persona: remote ? `Works from another city and joins every meeting by video. Easy to forget, quick to feel left out.` : `New to the team and keen to prove themselves.`,
    hiddenConcern: remote ? 'They think decisions are made in the office before they hear about them.' : 'They are not sure the role is what they were told it would be.',
    concernLine: remote ? 'Honestly, I usually hear about decisions after everyone in the office already knows.' : 'I am still not sure this role is what I was told it would be.',
    stats: { skill: 45, morale: 60, result: 40, trust: 50 }, relationships: [], custom: [], noTopics: '', bestStage: '', careerGoal: 'To feel part of the team and grow in the role.'
  };
  return { ops: [{ op: 'addCharacter', value: c }], said: `Adds ${first} ${last}${remote ? ', who works remotely,' : ''} to ${d.process.stages.find(st => st.key === stage)!.name}.` };
}

function removeCharacters(d: AuthorDraft, s: Scope): Step {
  if (!s.characters.length) return { ops: [], said: '', none: 'Who should leave the team? Name them and ask again.' };
  if (d.team.length - s.characters.length < 6) return { ops: [], said: '', none: 'A team needs at least 6 people, so I cannot remove anyone else.' };
  const theirs = d.events.filter(e => s.characters.some(c => c.id === e.who)).length;
  return { ops: s.characters.map(c => ({ op: 'removeCharacter' as const, id: c.id })), said: `Removes ${list(s.characters.map(c => `${c.first} ${c.last}`.trim()))} from the team${theirs ? `; ${theirs} event${theirs === 1 ? '' : 's'} about them then hit${theirs === 1 ? 's' : ''} one person the engine picks, as listed. To send them elsewhere, remove the person in the Team tab instead` : ''}.` };
}

const clean = (s: string) => s.trim().replace(/^["'“‘]+|["'”’.!]+$/g, '').trim().slice(0, 60);

function rename(d: AuthorDraft, target: string, to: string): Step {
  const name = clean(to);
  if (!name) return { ops: [], said: '', none: 'What should the new name be?' };
  const who = charactersIn(d, target);
  if (who.length === 1) {
    const c = who[0];
    const [first, ...rest] = name.split(/\s+/);
    const ops: EditOp[] = [set(`team.${c.id}.first`, first)];
    if (rest.length) ops.push(set(`team.${c.id}.last`, rest.join(' ')));
    if (c.first.trim().length >= 2) for (const f of ['persona', 'hiddenConcern', 'concernLine'] as const) {
      const re = wordRe(c.first.trim(), 'gu');
      if (re.test(c[f])) ops.push(set(`team.${c.id}.${f}`, c[f].replace(wordRe(c.first.trim(), 'gu'), first)));
    }
    return { ops, said: `${c.first} ${c.last} becomes ${name}.` };
  }
  const t = norm(target);
  const path = /\b(company|organi[sz]ation|firm)\b/.test(t) || t === norm(d.story.company.name) ? 'story.company.name'
    : /\bproduct\b/.test(t) || t === norm(d.story.product.name) ? 'story.product.name'
      : /\bsponsor\b/.test(t) || t === norm(d.story.sponsor.name) ? 'story.sponsor.name'
        : /\b(simulation|title|sim)\b/.test(t) ? 'title' : null;
  if (path) return { ops: [set(path, name)], said: `Renamed to ${name}.` };
  const style = d.lens.styles.find(st => norm(st.name) === t || t.includes(norm(st.name)));
  if (style) return { ops: [set(`lens.styles.${style.key}.name`, name)], said: `The ${style.name} style becomes ${name}.` };
  const ev = eventsIn(d, target);
  if (ev.length === 1) return { ops: [set(`events.${ev[0].key}.title`, name)], said: `The event becomes ${name}.` };
  return { ops: [], said: '', none: `I could not tell what to rename. Name a character, the company, the product, the sponsor, a style or an event.` };
}

const TONE_WORDS: Array<[Tone, RegExp]> = [
  ['warm', /\b(warmer|warm|friendlier|friendly|encouraging|kinder)\b/],
  ['direct', /\b(more direct|direct|brisk|blunter|blunt|punchier)\b/],
  ['professional', /\b(more professional|professional|formal|more formal)\b/]
];

function tone(d: AuthorDraft, to: Tone): Step {
  const label = TONE_LABELS[to];
  const ops: EditOp[] = [];
  if (d.brief.tones[0] !== label) ops.push(set('brief.tones', [label]));
  const v = { company: d.story.company.name };
  const fill = (t: string) => t.replace('{company}', v.company);
  const swap = (key: string, table: Record<Tone, string>, at: 'first' | 'last') => {
    const s = d.story.screens.find(x => x.key === key);
    if (!s) return;
    const paras = s.body.split(/\n\s*\n/);
    const i = at === 'first' ? 0 : paras.length - 1;
    if (Object.values(table).some(t => fill(t) === paras[i].trim()) && paras[i].trim() !== fill(table[to])) {
      paras[i] = fill(table[to]);
      ops.push(set(`story.screens.${key}.body`, paras.join('\n\n')));
    }
  };
  swap('welcome', WELCOME, 'first');
  swap('targets', CLOSE, 'last');
  const lib = LENS_BY_ID[d.lens.id].styles;
  for (const st of d.lens.styles) {
    const l = lib?.find(x => x.key === st.key);
    if (l && Object.values(l.names).includes(st.name) && st.name !== l.names[to]) ops.push(set(`lens.styles.${st.key}.name`, l.names[to]));
  }
  return { ops, said: `The tone becomes ${label.toLowerCase()}: the welcome letter's opening, the closing line and the style names follow it.`, none: `The tone is already ${label.toLowerCase()}.` };
}

function sponsor(d: AuthorDraft, demanding: boolean): Step {
  const ops: EditOp[] = [];
  const voice = demanding ? 'Brisk, direct' : 'Warm, encouraging';
  if (d.story.sponsor.voice !== voice) ops.push(set('story.sponsor.voice', voice));
  const w = d.story.screens.find(x => x.key === 'welcome');
  if (w) {
    const paras = w.body.split(/\n\s*\n/);
    paras[0] = demanding ? `Welcome to ${d.story.company.name}. I will be direct: I expect a plan from you by the end of week one, and results soon after.` : `Welcome to ${d.story.company.name}. I am here to help you succeed, so bring me problems early and we will solve them together.`;
    const body = paras.join('\n\n');
    if (body !== w.body) ops.push(set('story.screens.welcome.body', body));
  }
  return { ops, said: `The sponsor is more ${demanding ? 'demanding' : 'supportive'}: a ${demanding ? 'brisk' : 'warm'} voice and a new opening to the welcome letter.`, none: `The sponsor is already ${demanding ? 'demanding' : 'supportive'}.` };
}

interface Trait { word: string; re: RegExp; more: string; less: string; stats: Partial<Record<'skill' | 'morale' | 'result' | 'trust', number>> }
const TRAITS: Trait[] = [
  { word: 'defensive', re: /defensive/, stats: { trust: -12, morale: -5 }, more: '{Pron} gets defensive when questioned and tests a new manager before opening up.', less: '{Pron} takes questions well and is open with a new manager from the start.' },
  { word: 'confident', re: /confident|assertive/, stats: { skill: 8, morale: 5 }, more: '{Pron} is confident, speaks up early and backs {pos} own judgment.', less: '{Pron} doubts {pos} own judgment and waits to be told what to do.' },
  { word: 'motivated', re: /motivated|engaged|keen|enthusiastic|energetic/, stats: { morale: 12 }, more: '{Pron} is keen and brings energy to every meeting.', less: '{Pron} has lost some of {pos} energy and does the minimum.' },
  { word: 'tired', re: /tired|burn(ed|t)? out|stressed|frustrated|demotivated|disengaged/, stats: { morale: -12 }, more: '{Pron} is worn out and it shows in {pos} work.', less: '{Pron} has more energy than {pron} had a month ago.' },
  { word: 'skilled', re: /skilled|experienced|capable|competent|senior/, stats: { skill: 12 }, more: '{Pron} has handled work like this for years and knows the shortcuts.', less: '{Pron} is still learning the basics of the role.' },
  { word: 'skeptical', re: /skeptical|sceptical|cynical|guarded|resistant/, stats: { trust: -10 }, more: '{Pron} is skeptical of new managers and new plans until {pron} sees results.', less: '{Pron} gives a new manager the benefit of the doubt.' },
  { word: 'open', re: /open|trusting|cooperative|collaborative/, stats: { trust: 10 }, more: '{Pron} is open and works well with anyone who asks.', less: '{Pron} keeps to {pos} own work and shares little.' },
  { word: 'difficult', re: /difficult|challenging|prickly/, stats: { trust: -8, morale: -6 }, more: '{Pron} pushes back on most requests and can be hard to manage.', less: '{Pron} is easy to work with and rarely pushes back.' },
  { word: 'quiet', re: /quiet|reserved|shy/, stats: {}, more: '{Pron} rarely speaks up in meetings and keeps concerns to {pos}self.', less: '{Pron} speaks up in meetings and says what {pron} thinks.' }
];

function traitLine(c: Character, t: Trait, more: boolean): string {
  const p = c.gender === 'man' ? ['he', 'He', 'his', 'himself'] : c.gender === 'woman' ? ['she', 'She', 'her', 'herself'] : ['they', 'They', 'their', 'themselves'];
  return (more ? t.more : t.less).replace(/\{Pron\}/g, p[1]).replace(/\{pron\}/g, p[0]).replace(/\{pos\}self/g, p[3]).replace(/\{pos\}/g, p[2]);
}

/** A trait asked for: the persona keeps its first sentence (who they are) and gets the trait's line, and the stats follow. */
function trait(c: Character, t: Trait, more: boolean): Step {
  const line = traitLine(c, t, more);
  const ours = new Set(TRAITS.flatMap(x => [traitLine(c, x, true), traitLine(c, x, false)]));
  const first = c.persona.match(/^[^.!?]*[.!?]/)?.[0].trim() ?? '';
  const persona = first && !ours.has(first) ? `${first} ${line}` : line;
  const ops: EditOp[] = [];
  if (persona !== c.persona) ops.push(set(`team.${c.id}.persona`, persona));
  for (const [k, v] of Object.entries(t.stats) as Array<[keyof Character['stats'], number]>) {
    const next = clamp(c.stats[k] + (more ? v : -v), 0, 100);
    if (next !== c.stats[k]) ops.push(set(`team.${c.id}.stats.${k}`, next));
  }
  return { ops, said: `${c.first} becomes ${more ? 'more' : 'less'} ${t.word}: a new line in the persona${Object.keys(t.stats).length ? ' and starting stats to match' : ''}.`, none: `${c.first} is already as ${t.word} as I can make them.` };
}

function regenerateOne(d: AuthorDraft, s: Scope): Step {
  const ops: EditOp[] = [];
  const done: string[] = [];
  for (const e of s.events) {
    const w = structuredClone(d);
    regenerateItem(w, { event: e.key }, s.variant);
    const after = w.events.find(x => x.key === e.key)!;
    const answerable = after.respondWith.every(k => k === 'reply' || d.actions.some(a => a.key === k));
    for (const k of ['title', 'body', 'skill', 'morale', 'result', 'respondWith', 'within', 'week', 'day'] as const) {
      if (k === 'respondWith' && !answerable) continue;
      if (JSON.stringify(after[k]) !== JSON.stringify(e[k]) && after[k] !== null) ops.push(set(`events.${e.key}.${k}`, after[k]));
    }
    if (after.ifIgnored.sponsor !== e.ifIgnored.sponsor) ops.push(set(`events.${e.key}.ifIgnored.sponsor`, after.ifIgnored.sponsor));
    const follow = after.ifIgnored.followUp;
    if (follow !== e.ifIgnored.followUp && (follow === null || (follow !== e.key && d.events.some(x => x.key === follow)))) ops.push(set(`events.${e.key}.ifIgnored.followUp`, follow));
    if (ops.length) done.push(e.title);
  }
  for (const c of s.characters) {
    const w = structuredClone(d);
    regenerateItem(w, { character: c.id }, s.variant);
    const after = w.team.find(x => x.id === c.id)!;
    for (const k of ['persona', 'hiddenConcern', 'concernLine', 'motivatedBy', 'careerGoal'] as const) if (after[k] !== c[k]) ops.push(set(`team.${c.id}.${k}`, after[k]));
    done.push(c.first);
  }
  return { ops, said: `A new draft of ${list(done)}. Nothing else changes.`, none: 'What you wrote there stays yours, so there is nothing of Kora\'s to draft again.', regenerate: true };
}

/* ------------------------------------------------------------------------------------------------
 * Reading the instruction.
 * ---------------------------------------------------------------------------------------------- */

type Intent =
  | { id: 'harder' | 'easier' | 'lessObvious' | 'tradeOffs' | 'carry' | 'tense' | 'add' | 'remove' | 'regenerate' }
  | { id: 'run'; to: 'short' | 'long' | number }
  | { id: 'rename'; target: string; to: string }
  | { id: 'tone'; to: Tone }
  | { id: 'sponsor'; demanding: boolean }
  | { id: 'trait'; trait: Trait; more: boolean };

const RX = {
  rename: /\b(?:rename|re-name)\s+(.+?)\s+(?:to|as)\s+(.+)$|\bchange\s+(?:the\s+)?name\s+of\s+(.+?)\s+to\s+(.+)$|\b(.+?)['’]s\s+name\s+to\s+(.+)$/i,
  lessObvious: /\b(less obvious|not (so )?obvious|subtler|more subtle|subtle|ambiguous|no (obvious|clear) (right|best)|harder to (choose|pick|decide|tell)|closer (options|choices|calls)|grey areas?|gray areas?)\b/i,
  tradeOffs: /\b(trade[ -]?offs?|opposing effects?|dilemmas?|tough choices|something to give up)\b/i,
  carry: /\b(carry (forward|over|on)|carries (forward|over)|knock[ -]on|consequences?\b.{0,30}\b(carry|last|follow|stick|come back|later|forward)|lasting consequences|come back to bite|follow[ -]ups? if ignored|if ignored)\b/i,
  tense: /\b(more tense|tenser|tension|tense|more urgent|urgency|urgent|more dramatic|dramatic|higher stakes)\b/i,
  easier: /\b(easier|gentler|more forgiving|less (difficult|demanding|challenging|pressure|hard|tough|harsh)|lower the bar|reduce (the )?(difficulty|pressure)|softer)\b/i,
  harder: /\b(harder|tougher|more (difficult|demanding|challenging|pressure|stretching)|increase (the )?(difficulty|pressure|challenge)|raise the (bar|stakes)|less forgiving|stretch(ier)?|more of a challenge)\b/i,
  shorten: /\b(shorten|shorter|lite\b|30 minutes?|thirty minutes?|fewer weeks|cut (it|the run) down)\b/i,
  lengthen: /\b(lengthen|longer|more weeks|full run|extend)\b/i,
  weeks: /\b(\d{1,2})[ -]weeks?\b/i,
  add: /\b(add|hire|bring in|another|one more|extra)\b.{0,40}\b(team member|member|character|person|colleague|rep|report|hire)\b/i,
  remove: /\b(remove|delete|drop|take out|get rid of|let go of)\b/i,
  regenerate: /\b(regenerate|redo|re-?draft|rewrite|re-?write|new version of|draft again|try another)\b/i,
  sponsorWord: /\bsponsor\b/i,
  demanding: /\b(demanding|strict|tough|tougher|harder|harsh|pushy|impatient|stern)\b/i,
  supportive: /\b(supportive|kind|kinder|warmer|warm|gentler|softer|encouraging|patient|friendlier)\b/i,
  trait: /\b(more|less)\s+([a-z]+(?:\s+out)?)\b/gi,
  vague: /\b(improve|better|fix|polish|tweak|refine)\b/i
};

const CONFLICTS: Array<[string, string, string, string]> = [
  ['harder', 'easier', 'Make it harder', 'Make it easier'],
  ['shorten', 'lengthen', 'Shorten the run', 'Lengthen the run'],
  ['add', 'remove', 'Add a team member', 'Remove a team member']
];

/**
 * Reads an instruction and answers with a proposal (structured changes, not yet applied) or a reply
 * (a question, or an honest "I can't do that yet"). `variant` asks for another draft of a regenerated
 * event or person.
 */
export function understand(d: AuthorDraft, tab: Tab, instruction: string, variant = 0): KoraAnswer {
  const text = instruction.trim().replace(/\s+/g, ' ');
  const reply = (r: string, options?: string[]): KoraAnswer => ({ kind: 'reply', reply: r, ...(options ? { options } : null), source: 'rules' });
  if (!text) return reply('Tell me what to change in plain words.');

  const intents: Intent[] = [];
  let rest = text;
  const take = (re: RegExp) => { const m = rest.match(re); if (m) rest = rest.replace(re, ' '); return m; };

  const rn = text.match(RX.rename);
  if (rn) {
    const [target, to] = rn[1] ? [rn[1], rn[2]] : rn[3] ? [rn[3], rn[4]] : [rn[5], rn[6]];
    return finish(d, [{ id: 'rename', target: target.replace(/^(?:please\s+)?(?:change\s+)?/i, ''), to }], text, variant, reply, undefined, tab);
  }

  const characters = charactersIn(d, text);
  // Names are taken out before reading the rest, so a name never reads as an instruction word.
  for (const c of characters) for (const w of [`${c.first} ${c.last}`, c.first, c.last]) if (w.trim().length >= 2) rest = rest.replace(wordRe(w.trim(), 'giu'), ' ');
  const sponsorNamed = RX.sponsorWord.test(text);
  const named = { characters, events: eventsIn(d, text), actions: actionsIn(d, text) };
  const thisEvent = /\b(this|that|the)\s+event\b/i.test(text) && !named.events.length;
  const weekGiven = text.match(/\bweek\s+(\d{1,2})\b/i);

  if (RX.regenerate.test(text)) {
    rest = rest.replace(RX.regenerate, ' ');
    intents.push({ id: 'regenerate' });
  }
  if (sponsorNamed && !characters.length) {
    const dem = RX.demanding.test(text), sup = RX.supportive.test(text);
    if (dem && sup) return reply('Those two conflict: should the sponsor be more demanding, or more supportive? Which do you want?', ['Make the sponsor more demanding', 'Make the sponsor more supportive']);
    if (dem || sup) { intents.push({ id: 'sponsor', demanding: dem }); rest = rest.replace(dem ? RX.demanding : RX.supportive, ' '); }
  }
  if (take(RX.lessObvious)) intents.push({ id: 'lessObvious' });
  if (take(RX.tradeOffs)) intents.push({ id: 'tradeOffs' });
  if (take(RX.carry)) intents.push({ id: 'carry' });
  if (take(RX.tense)) intents.push({ id: 'tense' });
  const easy = take(RX.easier), hard = take(RX.harder);
  if (easy) intents.push({ id: 'easier' });
  if (hard) intents.push(named.events.length || thisEvent ? { id: 'tense' } : { id: 'harder' });
  const wk = text.match(RX.weeks);
  if (wk && !named.events.length) intents.push({ id: 'run', to: Number(wk[1]) });
  if (take(RX.shorten)) intents.push({ id: 'run', to: 'short' });
  if (take(RX.lengthen)) intents.push({ id: 'run', to: 'long' });
  if (RX.add.test(text) && !characters.length) intents.push({ id: 'add' });
  if (RX.remove.test(text) && (characters.length || /\b(member|character|person|someone)\b/i.test(text))) intents.push({ id: 'remove' });

  if (characters.length && !intents.some(i => i.id === 'remove' || i.id === 'regenerate')) {
    const found = [...rest.matchAll(RX.trait)].map(m => ({ more: m[1].toLowerCase() === 'more', word: m[2].toLowerCase() }));
    const plain = TRAITS.find(t => t.re.test(rest.toLowerCase()));
    if (found.length) {
      for (const f of found) {
        const t = TRAITS.find(x => x.re.test(f.word));
        if (t) intents.push({ id: 'trait', trait: t, more: f.more });
      }
    } else if (plain && /\b(make|be|is|seem|act)\b/i.test(rest)) intents.push({ id: 'trait', trait: plain, more: true });
    if (!intents.some(i => i.id === 'trait')) {
      const who = characters.map(c => c.first).join(' and ');
      return reply(`I can't do that for ${who} yet. I can make them more or less defensive, confident, motivated, tired, skilled, skeptical, open, difficult or quiet; rename them; regenerate them; or remove them.`);
    }
  }

  if (!sponsorNamed && !characters.length) for (const [t, re] of TONE_WORDS) {
    if (re.test(text) && (/\btone\b/i.test(text) || /\b(warmer|friendlier|more direct|more formal|more professional|blunter|punchier)\b/i.test(text))) intents.push({ id: 'tone', to: t });
  }

  // Opposites asked together get a question, never a silent pick.
  const ids: string[] = intents.map(i => (i.id === 'run' ? (i.to === 'short' || (typeof i.to === 'number' && i.to < d.process.weeks) ? 'shorten' : 'lengthen') : i.id));
  for (const [a, b, qa, qb] of CONFLICTS) if (ids.includes(a) && ids.includes(b)) return reply(`Those two conflict: ${qa.toLowerCase()}, or ${qb.toLowerCase()}? Which do you want?`, [qa, qb]);
  const tones = [...new Set(intents.filter(i => i.id === 'tone').map(i => (i as { to: Tone }).to))];
  if (tones.length > 1) return reply(`Those conflict: which tone do you want, ${list(tones.map(t => TONE_LABELS[t].toLowerCase()))}?`, tones.map(t => `Make the tone ${TONE_LABELS[t].toLowerCase()}`));
  const traits = intents.filter(i => i.id === 'trait') as Array<{ trait: Trait; more: boolean }>;
  if (traits.some(a => traits.some(b => a.trait === b.trait && a.more !== b.more))) return reply('Those two conflict: more, or less? Which do you want?');
  const runs = intents.filter(i => i.id === 'run');
  if (runs.length > 1) intents.splice(intents.indexOf(runs[0]), 1);

  if ((intents.some(i => i.id === 'tense') || intents.some(i => i.id === 'regenerate')) && !named.events.length && !named.characters.length) {
    if (intents.some(i => i.id === 'regenerate') && !intents.some(i => i.id === 'tense')) return reply('Which event or person should I draft again? Name one, for example: regenerate the competitor event, or regenerate ' + (d.team[0]?.first || 'a character') + '. Regenerate this tab, at the top of the tab, drafts the whole tab.');
    if (thisEvent || weekGiven) return reply('Which event? Name it, or say its week, for example: make the week 3 event more tense.');
    intents.splice(intents.findIndex(i => i.id === 'tense'), 1, { id: 'harder' });
  }
  if ((intents.some(i => i.id === 'regenerate' || i.id === 'tense')) && named.events.length > 1 && weekGiven && !named.events.some(e => norm(text).includes(norm(e.title)))) {
    const verb = intents.some(i => i.id === 'regenerate') ? 'Regenerate' : 'Make more tense:';
    return reply(`Week ${weekGiven[1]} has ${named.events.length} events: ${list(named.events.map(e => e.title))}. Which one?`, named.events.map(e => `${verb} the event "${e.title}"`));
  }

  if (!intents.length) {
    if (RX.vague.test(text)) return reply(`Tell me how: for example, make it more tense, make decisions less obvious, or add trade-offs. I can ${CAN_DO}.`);
    return reply(`I can't do that yet. I can ${CAN_DO}.`);
  }
  return finish(d, intents, text, variant, reply, named, tab);
}

function finish(d: AuthorDraft, intents: Intent[], text: string, variant: number, reply: (r: string, o?: string[]) => KoraAnswer, named: { characters: Character[]; events: EventDraft[]; actions: ActionDraft[] } | undefined, tab: Tab): KoraAnswer {
  const w = structuredClone(d);
  const ops: EditOp[] = [];
  const said: string[] = [];
  const none: string[] = [];
  let regen = false;
  for (const i of intents) {
    const s: Scope = { events: named?.events ?? [], characters: named?.characters ?? [], actions: named?.actions ?? [], text, variant, tab };
    // Each intent reads the draft as the ones before it left it.
    s.events = s.events.map(e => w.events.find(x => x.key === e.key)!).filter(Boolean);
    s.characters = s.characters.map(c => w.team.find(x => x.id === c.id)!).filter(Boolean);
    const step = i.id === 'harder' ? harder(w) : i.id === 'easier' ? easier(w) : i.id === 'lessObvious' ? lessObvious(w, s) : i.id === 'tradeOffs' ? tradeOffs(w, s)
      : i.id === 'carry' ? carryForward(w, s) : i.id === 'tense' ? eventTension(s) : i.id === 'run' ? runLength(w, i.to) : i.id === 'add' ? addCharacter(w, s)
        : i.id === 'remove' ? removeCharacters(w, s) : i.id === 'rename' ? rename(w, i.target, i.to) : i.id === 'tone' ? tone(w, i.to) : i.id === 'sponsor' ? sponsor(w, i.demanding)
          : i.id === 'trait' ? (s.characters.length ? s.characters.map(c => trait(c, i.trait, i.more)).reduce((a, b) => ({ ops: [...a.ops, ...b.ops], said: `${a.said} ${b.said}`.trim(), none: b.none })) : { ops: [], said: '' })
            : regenerateOne(w, s);
    if (step.ops.length) { applyOps(w, step.ops); ops.push(...step.ops); said.push(step.said); } else if (step.none) none.push(step.none);
    regen ||= !!step.regenerate;
  }
  if (!ops.length) return reply(none.length ? `Nothing to change. ${none.join(' ')}` : `I can't do that yet. I can ${CAN_DO}.`);
  // One operation per field, the last one's value, read against the draft as it was.
  const last = new Map<string, EditOp>();
  const structural: EditOp[] = [];
  for (const o of ops) { if (o.op === 'set') { last.delete(o.path); last.set(o.path, o); } else structural.push(o); }
  const checked = checkOps(d, [...structural, ...last.values()]);
  if (!checked.ok) return reply('I worked out a change but it did not pass the draft\'s checks, so I left everything as it is.');
  if (!checked.ops.length) return reply(`Nothing to change. ${none.join(' ')}`.trim());
  return { kind: 'change', reply: [...said, ...none].join(' '), ops: checked.ops, changes: checked.changes, marks: checked.marks, source: 'rules', ...(regen ? { regenerate: true } : null) };
}
