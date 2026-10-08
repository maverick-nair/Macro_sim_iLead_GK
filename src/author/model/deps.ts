import { draftContext } from '../storyline';
import type { AuthorDraft, Tab } from './draft';
import { briefFromDraft, redraft, regenerate } from './regenerate';

/**
 * What depends on what in a draft (D148). When the author renames a person, the company, the product or the
 * sponsor, changes the lens or confirms a framework, or changes the challenge, other content still says the old
 * thing: a name in an event's text or the welcome letter, an action scored on a skill the report no longer has,
 * sample calls made against the old skills, events drafted from the old challenge. `scanRefs` finds each place
 * (a pure function over the draft); `applyChange` updates them all, as one step the store can undo; and
 * `changeSummary` says in plain words what a change does to a draft ("company name in 4 places, 2 events").
 *
 * Removing a person or a stage, and changing the run's length, are handled where they happen (D128): the Team
 * and Work process tabs ask where things go, and `fitRun` moves events. This file does not repeat them.
 */

export type Change =
  | { kind: 'person'; id: string; from: { first: string; last: string }; to: { first: string; last: string } }
  | { kind: 'company' | 'product' | 'sponsor'; from: string; to: string }
  | { kind: 'skills'; why: 'lens' | 'framework' }
  | { kind: 'challenge'; from: string; to: string };

/** One place that still refers to the old value. */
export interface Ref { path: string; where: string; tab: Tab }

interface TextField { path: string; where: string; tab: Tab; get(): string; set(v: string): void }

const fullName = (n: { first: string; last: string }) => [n.first.trim(), n.last.trim()].filter(Boolean).join(' ');

/** Every author facing text the participant or Kora reads, with where it is in plain words. */
export function textFields(d: AuthorDraft): TextField[] {
  const out: TextField[] = [];
  const f = (path: string, where: string, tab: Tab, obj: Record<string, unknown>, key: string) => {
    if (typeof obj[key] === 'string') out.push({ path, where, tab, get: () => obj[key] as string, set: v => { obj[key] = v; } });
  };
  f('title', 'The simulation title', 'overview', d as unknown as Record<string, unknown>, 'title');
  f('story.company.about', 'What the company does', 'story', d.story.company, 'about');
  f('story.company.team', 'Your team, in Story and world', 'story', d.story.company, 'team');
  f('story.product.oneLine', 'The product in one line', 'story', d.story.product, 'oneLine');
  d.story.product.points.forEach((_, i) => f(`story.product.points.${i}`, `Selling point ${i + 1}`, 'story', d.story.product.points as unknown as Record<string, unknown>, String(i)));
  f('story.market.customers', 'Customers', 'story', d.story.market, 'customers');
  d.story.market.rivals.forEach((r, i) => f(`story.market.rivals.${i}.angle`, `How ${r.name || 'a rival'} competes`, 'story', r, 'angle'));
  f('story.sponsor.voice', 'The sponsor\'s voice', 'story', d.story.sponsor, 'voice');
  for (const s of d.story.screens) { f(`story.screens.${s.key}.title`, `${s.title}, title`, 'story', s, 'title'); f(`story.screens.${s.key}.body`, s.title, 'story', s, 'body'); }
  for (const c of d.team) {
    const who = fullName(c) || c.id;
    f(`team.${c.id}.title`, `${who}, job title`, 'team', c, 'title');
    for (const [k, label] of [['persona', 'persona'], ['hiddenConcern', 'hidden concern'], ['concernLine', 'what they say about it'], ['motivatedBy', 'motivation'], ['careerGoal', 'career goal'], ['noTopics', 'topics they avoid']] as const) f(`team.${c.id}.${k}`, `${who}, ${label}`, 'team', c, k);
    for (const k of Object.keys(c.reactions)) f(`team.${c.id}.reactions.${k}`, `${who}, reaction to a style`, 'team', c.reactions, k);
    c.custom.forEach((x, i) => f(`team.${c.id}.custom.${i}`, `${who}, ${x.label || 'a custom field'}`, 'team', x, 'value'));
  }
  for (const a of d.actions) {
    for (const [k, label] of [['description', 'description'], ['goal', 'goal'], ['decides', 'how it is decided']] as const) f(`actions.${a.key}.${k}`, `${a.name}, ${label}`, 'actions', a, k);
    a.options.forEach((o, i) => f(`actions.${a.key}.options.${i}`, `${a.name}, option ${i + 1}`, 'actions', o, 'label'));
  }
  for (const e of d.events) { f(`events.${e.key}.title`, `Event "${e.title || e.key}", title`, 'events', e, 'title'); f(`events.${e.key}.body`, `Event "${e.title || e.key}"`, 'events', e, 'body'); }
  d.scoring.samples.forEach((s, i) => f(`scoring.samples.${s.id}.answer`, `Sample answer ${i + 1}`, 'scoring', s, 'answer'));
  for (const s of d.suggestions) if (!s.done) f(`suggestions.${s.id}`, 'One of Kora\'s suggestions', s.tab, s, 'text');
  return out;
}

/* ------------------------------------------------------------------------------------------------
 * Names in text: whole words, case-insensitive; a first name that is also a common word ("Will",
 * "Grace") only when written with a capital inside a sentence, as Ask Kora reads names (D125).
 * ---------------------------------------------------------------------------------------------- */

const COMMON = new Set(['will', 'mark', 'grace', 'hope', 'faith', 'joy', 'rose', 'may', 'june', 'april', 'august', 'art', 'bill', 'pat', 'sue', 'jack', 'frank', 'rich', 'chase', 'drew', 'gene', 'max', 'sky', 'summer', 'dawn', 'eve', 'iris', 'ray', 'rob', 'sandy', 'hunter', 'page', 'reed', 'wade', 'cliff', 'dale', 'glen', 'guy', 'lane', 'miles', 'norm', 'penny', 'ruby', 'sunny', 'amber', 'ivy', 'jade', 'lily', 'holly', 'river', 'rock', 'stone', 'brook', 'young', 'black', 'white', 'green', 'brown', 'king', 'long', 'bell', 'lead', 'team', 'new', 'best', 'case', 'deal', 'close', 'hall', 'price', 'cash', 'sharp', 'early', 'love', 'happy', 'major', 'small', 'west', 'north', 'south', 'day', 'week']);
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const wordRe = (s: string, flags: string) => new RegExp(`(?<![\\p{L}\\p{N}_])${escape(s)}(?![\\p{L}\\p{N}_])`, flags);

/** Replaces a name where it appears as a name; returns the text and how many times it was found. */
export function replaceName(text: string, from: string, to: string): { text: string; n: number } {
  const w = from.trim();
  if (w.length < 2 || w === to) return { text, n: 0 };
  let n = 0;
  if (!COMMON.has(w.toLowerCase()) || /\s/.test(w)) {
    const out = text.replace(wordRe(w, 'giu'), () => { n++; return to; });
    return { text: out, n };
  }
  const cap = w.charAt(0).toUpperCase() + w.slice(1);
  const out = text.replace(wordRe(cap, 'gu'), (m, at: number) => {
    const before = text.slice(0, at).trimEnd();
    if (!before || /[.!?:;]$/.test(before)) return m;
    n++;
    return to;
  });
  return { text: out, n };
}

/** The names a change replaces, longest first: a full name before a first name alone. */
function renames(c: Change): Array<[string, string]> {
  if (c.kind === 'person') {
    const pairs: Array<[string, string]> = [[fullName(c.from), fullName(c.to)]];
    if (c.from.first.trim() && c.from.first.trim() !== c.to.first.trim()) pairs.push([c.from.first.trim(), c.to.first.trim() || fullName(c.to)]);
    return pairs.filter(([a, b]) => a && a !== b);
  }
  if (c.kind === 'company' || c.kind === 'product') return c.from.trim() && c.from.trim() !== c.to.trim() ? [[c.from.trim(), c.to.trim()]] : [];
  if (c.kind === 'sponsor') {
    const [ff, ...fr] = c.from.trim().split(/\s+/), [tf] = c.to.trim().split(/\s+/);
    const pairs: Array<[string, string]> = [[c.from.trim(), c.to.trim()]];
    if (fr.length && ff && tf && ff !== tf) pairs.push([ff, tf]);
    return pairs.filter(([a, b]) => a && b && a !== b);
  }
  return [];
}

const skillNames = (d: AuthorDraft) => new Set(d.scoring.skills.map(s => s.name));

/** The challenge's redraft on a copy: what would change, by label. */
function challengeChanges(d: AuthorDraft): string[] {
  const copy = structuredClone(d);
  const fresh = redraft(copy);
  return [...regenerate(copy, { tab: 'events' }, fresh).changed, ...regenerate(copy, { section: 'sponsor' }, fresh).changed];
}

/** Every place that still refers to the old value. Pure: the draft is not changed. */
export function scanRefs(d: AuthorDraft, c: Change): Ref[] {
  const out: Ref[] = [];
  if (c.kind === 'skills') {
    const names = skillNames(d);
    for (const a of d.actions) if (a.scoredOn.some(n => !names.has(n))) out.push({ path: `actions.${a.key}.scoredOn`, where: `${a.name}, scored on`, tab: 'actions' });
    for (const s of d.scoring.samples) if (s.call !== null) out.push({ path: `scoring.samples.${s.id}`, where: 'Your call on a sample answer', tab: 'scoring' });
    return out;
  }
  if (c.kind === 'challenge') return challengeChanges(d).map(label => ({ path: label, where: label, tab: 'events' }));
  const pairs = renames(c);
  if (!pairs.length) return out;
  for (const f of textFields(d)) {
    let text = f.get(), hit = 0;
    for (const [from, to] of pairs) { const r = replaceName(text, from, to); text = r.text; hit += r.n; }
    if (hit) out.push({ path: f.path, where: f.where, tab: f.tab });
  }
  if (c.kind === 'person') for (const s of d.scoring.samples) if (s.with.trim() && s.with.trim() === c.from.first.trim() && c.from.first.trim() !== c.to.first.trim()) out.push({ path: `scoring.samples.${s.id}.with`, where: 'Who a sample answer is said to', tab: 'scoring' });
  if (c.kind === 'company') {
    if (d.brand.name.trim() === c.from.trim()) out.push({ path: 'brand.name', where: 'The brand name', tab: 'brand' });
    if (d.story.company.logo && d.story.company.logo === initials(c.from)) out.push({ path: 'story.company.logo', where: 'The logo initials', tab: 'story' });
  }
  return out;
}

const initials = (s: string) => s.split(/\s+/).filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase();

/** Updates every place `scanRefs` finds, in place. Returns how many places changed. */
export function applyChange(d: AuthorDraft, c: Change): number {
  if (c.kind === 'skills') {
    const names = d.scoring.skills.filter(s => !s.reportOnly).map(s => s.name);
    const all = skillNames(d);
    let n = 0;
    d.actions.forEach((a, i) => {
      if (!a.scoredOn.some(x => !all.has(x)) || !names.length) return;
      // Keep the skills that still exist; fill to two from the new skills, in turn, so every skill is observed (D128).
      const kept = a.scoredOn.filter(x => all.has(x));
      for (let k = 0; kept.length < Math.min(2, names.length) && k < names.length; k++) { const s = names[(i + k) % names.length]; if (!kept.includes(s)) kept.push(s); }
      a.scoredOn = kept;
      n++;
    });
    for (const s of d.scoring.samples) if (s.call !== null) { s.call = null; n++; }
    return n;
  }
  if (c.kind === 'challenge') {
    const fresh = redraft(d);
    return regenerate(d, { tab: 'events' }, fresh).changed.length + regenerate(d, { section: 'sponsor' }, fresh).changed.length;
  }
  const pairs = renames(c);
  let n = 0;
  for (const f of textFields(d)) {
    let text = f.get(), hit = 0;
    for (const [from, to] of pairs) { const r = replaceName(text, from, to); text = r.text; hit += r.n; }
    if (hit) { f.set(text); n++; }
  }
  if (c.kind === 'person') for (const s of d.scoring.samples) if (s.with.trim() && s.with.trim() === c.from.first.trim() && c.from.first.trim() !== c.to.first.trim()) { s.with = c.to.first.trim(); n++; }
  if (c.kind === 'company') {
    if (d.brand.name.trim() === c.from.trim()) { d.brand.name = c.to.trim(); n++; }
    if (d.story.company.logo && d.story.company.logo === initials(c.from)) { d.story.company.logo = initials(c.to); n++; }
  }
  return n;
}

/** What the prompt says the change was. */
export function changeTitle(c: Change): string {
  switch (c.kind) {
    case 'person': return `You renamed ${fullName(c.from)} to ${fullName(c.to)}`;
    case 'company': return `You renamed the company to ${c.to.trim()}`;
    case 'product': return `You renamed the product to ${c.to.trim()}`;
    case 'sponsor': return `You renamed the sponsor to ${c.to.trim()}`;
    case 'skills': return c.why === 'lens' ? 'You changed the lens, so the skills scored changed' : 'You confirmed your framework, so the skills scored changed';
    case 'challenge': return 'You changed the challenge';
  }
}

/** What the update does, as a button and as an undo step. */
export function changeAction(c: Change, n: number): { button: string; label: string } {
  const places = `${n} place${n === 1 ? '' : 's'}`;
  switch (c.kind) {
    case 'person': return { button: `Update ${places}`, label: `Rename ${fullName(c.from)} to ${fullName(c.to)} in ${places}` };
    case 'company': case 'product': case 'sponsor': return { button: `Update ${places}`, label: `Rename the ${c.kind} to ${c.to.trim()} in ${places}` };
    case 'skills': return { button: `Update ${places}`, label: `Score on the new skills: update ${places}` };
    case 'challenge': return { button: `Update ${places}`, label: `Redraft from the new challenge: ${places}` };
  }
}

/* ------------------------------------------------------------------------------------------------
 * A brief answer changed later (D146): what it changes in the draft, and the change itself.
 * ---------------------------------------------------------------------------------------------- */

export type BriefField = 'participants' | 'industry' | 'client' | 'challenge';

/** The company name the draft would use with no client: the fictional one Kora drafts. */
export function fictionalCompany(d: AuthorDraft): string {
  return draftContext({ ...briefFromDraft(d), client: null }).company;
}

/**
 * Carries a changed brief answer into the draft, in place. The brief field itself is already set. The client renames
 * the company everywhere (a fictional one when it is cleared); the industry drafts the story and the events again; the
 * challenge drafts the events and the welcome screens again. Only Kora's fields are drafted again (D126).
 */
export function propagateBrief(d: AuthorDraft, field: BriefField): void {
  if (field === 'participants') return;
  if (field === 'client') {
    const to = d.brief.client.trim() || fictionalCompany(d);
    const from = d.story.company.name;
    applyChange(d, { kind: 'company', from, to });
    d.story.company.name = to;
    d.marks['story.company.name'] = d.brief.client.trim() ? 'you' : 'ai';
    return;
  }
  const fresh = redraft(d);
  if (field === 'industry') { regenerate(d, { tab: 'story' }, fresh); regenerate(d, { tab: 'events' }, fresh); return; }
  regenerate(d, { tab: 'events' }, fresh);
  regenerate(d, { section: 'sponsor' }, fresh);
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** What turned `before` into `after`, in plain words, most visible first: "company name in 4 places", "2 events". */
export function changeSummary(before: AuthorDraft, after: AuthorDraft): string[] {
  const out: string[] = [];
  if (before.story.company.name !== after.story.company.name) {
    const n = 1 + scanRefs(before, { kind: 'company', from: before.story.company.name, to: after.story.company.name }).length;
    out.push(`company name in ${plural(n, 'place')}`);
  }
  if (before.brief.industry !== after.brief.industry) out.push('the industry of the story');
  if (before.story.product.name !== after.story.product.name) out.push('the product');
  if (!same(before.story.sponsor, after.story.sponsor)) out.push('the sponsor');
  if (before.story.company.about !== after.story.company.about || !same(before.story.market, after.story.market)) out.push('the company and its market');
  const screens = after.story.screens.filter(s => before.story.screens.find(b => b.key === s.key)?.body !== s.body).length;
  if (screens) out.push(screens === 1 ? 'the welcome screen' : `${screens} welcome screens`);
  if (!same(before.process.stages.map(s => s.name), after.process.stages.map(s => s.name))) out.push('the work process');
  const events = after.events.filter(e => { const b = before.events.find(x => x.key === e.key); return !b || b.title !== e.title || b.body !== e.body; }).length + before.events.filter(e => !after.events.some(x => x.key === e.key)).length;
  if (events) out.push(plural(events, 'event'));
  const people = after.team.filter(c => { const b = before.team.find(x => x.id === c.id); return !b || !same(b, c); }).length + Math.max(0, before.team.length - after.team.length);
  if (people) out.push(plural(people, 'person', 'people'));
  if (before.lens.id !== after.lens.id) out.push('the leadership lens');
  const scored = after.actions.filter(a => !same(before.actions.find(x => x.key === a.key)?.scoredOn, a.scoredOn)).length;
  if (scored) out.push(`the skills ${plural(scored, 'action')} ${scored === 1 ? 'is' : 'are'} scored on`);
  const calls = after.scoring.samples.filter(s => s.call === null && before.scoring.samples.find(b => b.id === s.id)?.call != null).length;
  if (calls) out.push(plural(calls, 'sample call'));
  return out;
}

/** What changing a brief answer would do, without doing it: the draft after, and the summary. */
export function previewBrief(d: AuthorDraft, field: BriefField): { after: AuthorDraft; summary: string[] } {
  const after = structuredClone(d);
  propagateBrief(after, field);
  return { after, summary: changeSummary(d, after) };
}
