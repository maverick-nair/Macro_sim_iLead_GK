import { Brief, TONE_IDS } from '../../api/author';
import { needOf, type NeedKey } from '../../engine/lens';
import { industryOf, regionOf, TONE_LABELS } from '../context';
import type { AuthorDraft, Character, EventDraft, Mark, Tab } from './draft';
import { hash, seedDraft } from './seed';

/**
 * Regenerate (D126): Kora drafts again from the draft as it is now (the current brief, industry,
 * company, role, challenge, team, run and lens), never from the chat's first answers, and replaces only
 * what is still Kora's. A field the author typed (You) or edited (Edited) is never overwritten; the
 * result says what changed and what was kept, counting only fields whose value is different.
 */

export type RegenScope =
  | { tab: Tab }
  | { section: 'company' | 'market' | 'sponsor' }
  | { event: string }
  | { character: string };

export interface RegenResult {
  /** Labels of the fields whose value changed. */
  changed: string[];
  /** Labels of the fields in scope the author owns, left as they are. */
  kept: string[];
}

const toneOf = (label: string | undefined) => TONE_IDS.find(t => TONE_LABELS[t].toLowerCase() === (label ?? '').toLowerCase());
const clampTeam = (n: number) => Math.min(12, Math.max(6, n));

/** The author's own: typed or edited. Anything else (Kora's, or unmarked) may be drafted again. */
export const owned = (m: Mark | undefined) => m === 'you' || m === 'edited';

/** The brief Kora drafts from: the workspace's fields as they are now, the chat's only for what the workspace has no field for. */
export function briefFromDraft(d: AuthorDraft): Brief {
  const chat = d.chat.brief;
  const company = d.story.company.name.trim();
  const client = owned(d.marks['story.company.name']) && company ? company : d.brief.client.trim() || null;
  const stages = d.process.stages.map(s => s.name.trim() || s.key);
  return Brief.parse({
    ...chat,
    roleLevel: d.brief.participants.trim() || chat.roleLevel,
    industry: d.brief.industry.trim() || chat.industry,
    challenge: d.brief.challenge.trim() || chat.challenge,
    client,
    teamSize: clampTeam(d.team.length),
    process: new Set(stages.map(s => s.toLowerCase())).size === stages.length ? stages : chat.process,
    duration: d.brief.run,
    region: chat.region ?? regionOf(d.brief.language)?.id,
    language: d.brief.language || chat.language,
    tone: toneOf(d.brief.tones[0]) ?? chat.tone
  });
}

/** Kora's whole draft again, from the draft as it is now. */
export function redraft(d: AuthorDraft): AuthorDraft {
  const chat = { ...d.chat, brief: briefFromDraft(d), primary: d.lens.id, secondary: d.lens.secondary };
  return seedDraft(chat, 'workspace');
}

interface Ctx { d: AuthorDraft; fresh: AuthorDraft; out: RegenResult; ids: Map<string, string>; stages: Map<string, string> }

/** Replaces one field when it is still Kora's; records it as changed only when the value differs. */
function take(x: Ctx, mark: string, label: string, get: () => unknown, set: () => void) {
  if (owned(x.d.marks[mark])) { x.out.kept.push(label); return; }
  const before = JSON.stringify(get());
  set();
  if (JSON.stringify(get()) !== before) x.out.changed.push(label);
}

function company(x: Ctx) {
  const c = x.d.story.company, f = x.fresh.story.company;
  const L = { name: 'Company name', hq: 'Headquarters', about: 'What the company does', team: 'Your team', office: 'Office image' } as const;
  for (const k of ['name', 'hq', 'about', 'team', 'office'] as const) take(x, `story.company.${k}`, L[k], () => c[k], () => { c[k] = f[k]; });
  const p = x.d.story.product, fp = x.fresh.story.product;
  take(x, 'story.product.name', 'Product name', () => p.name, () => { p.name = fp.name; });
  take(x, 'story.product.oneLine', 'Product in one line', () => p.oneLine, () => { p.oneLine = fp.oneLine; });
  take(x, 'story.product.points', 'Selling points', () => p.points, () => { p.points = [...fp.points]; });
}
function market(x: Ctx) {
  const m = x.d.story.market, f = x.fresh.story.market;
  take(x, 'story.market.rivals', 'Customers and rivals', () => [m.customers, m.rivals], () => { m.customers = f.customers; m.rivals = structuredClone(f.rivals); });
}
function sponsor(x: Ctx) {
  const s = x.d.story.sponsor, f = x.fresh.story.sponsor;
  const L = { name: 'Sponsor name', title: 'Sponsor title', voice: 'Sponsor voice' } as const;
  for (const k of ['name', 'title', 'voice'] as const) take(x, `story.sponsor.${k}`, L[k], () => s[k], () => { s[k] = f[k]; });
  for (const sc of x.d.story.screens) {
    const fs = x.fresh.story.screens.find(y => y.key === sc.key);
    if (fs) take(x, `story.screens.${sc.key}`, sc.title, () => sc.body, () => { sc.body = fs.body; });
  }
}

/** Kora's fresh character for the author's one, by position, with ids and stages mapped to the draft's. */
function characterFrom(x: Ctx, c: Character, f: Character) {
  const who = () => [c.first, c.last].filter(Boolean).join(' ') || c.id;
  const name = who();
  const group = (g: string, label: string, keys: Array<keyof Character>) =>
    take(x, `team.${c.id}.${g}`, `${name} · ${label}`, () => keys.map(k => c[k]), () => {
      for (const k of keys) {
        let v = structuredClone(f[k]);
        if (k === 'stage') v = x.stages.get(f.stage) ?? c.stage;
        if (k === 'relationships') v = f.relationships.map(r => ({ ...r, with: x.ids.get(r.with) ?? '' })).filter(r => r.with && r.with !== c.id);
        if (k === 'bestStage') v = f.bestStage ? x.stages.get(f.bestStage) ?? '' : '';
        (c as Record<string, unknown>)[k] = v;
      }
    });
  group('identity', 'Identity', ['first', 'last', 'gender', 'pronouns', 'ageRange', 'title', 'stage', 'photo']);
  group('voice', 'Voice', ['voice']);
  group('persona', 'Persona', ['persona']);
  group('hiddenConcern', 'Hidden concern', ['hiddenConcern', 'concernLine']);
  group('personality', 'Personality', ['commStyles', 'motivatedBy', 'reactions', 'relationships', 'noTopics']);
  group('stats', 'Starting stats', ['stats', 'bestStage', 'experience', 'tenure', 'previousCompany', 'careerGoal', 'shown', 'custom']);
}

function eventFrom(x: Ctx, e: EventDraft) {
  const f = x.fresh.events.find(y => y.key === e.key);
  if (!f) return;
  const who = x.ids.get(f.who) ?? (f.who.startsWith('stage:') ? `stage:${x.stages.get(f.who.slice(6)) ?? f.who.slice(6)}` : f.who);
  take(x, `events.${e.key}`, e.title || e.key, () => x.d.events.find(y => y.key === e.key), () => {
    const i = x.d.events.indexOf(e);
    x.d.events[i] = { ...structuredClone(f), who, origin: e.origin };
  });
}

function context(d: AuthorDraft, fresh: AuthorDraft): Ctx {
  // Kora's people and stages line up with the draft's by position; their ids are kept.
  const ids = new Map(fresh.team.map((c, i) => [c.id, d.team[i]?.id ?? c.id]));
  const stages = new Map(fresh.process.stages.map((s, i) => [s.key, d.process.stages[i]?.key ?? s.key]));
  return { d, fresh, out: { changed: [], kept: [] }, ids, stages };
}

/** Drafts the scope again in place. Only fields still Kora's change; nothing outside the scope is touched. */
export function regenerate(d: AuthorDraft, scope: RegenScope, fresh: AuthorDraft = redraft(d)): RegenResult {
  const x = context(d, fresh);
  if ('section' in scope) {
    ({ company, market, sponsor })[scope.section](x);
  } else if ('event' in scope) {
    const e = d.events.find(y => y.key === scope.event);
    if (e) eventFrom(x, e);
  } else if ('character' in scope) {
    const i = d.team.findIndex(c => c.id === scope.character);
    if (i >= 0 && fresh.team[i]) characterFrom(x, d.team[i], fresh.team[i]);
  } else {
    const tab = scope.tab;
    if (tab === 'brief') {
      const L = { participants: 'Participants', industry: 'Industry', challenge: 'Business challenge', run: 'Run length', language: 'Language', conversationBy: 'Conversations by', tones: 'Tone' } as const;
      for (const k of ['participants', 'industry', 'challenge', 'run', 'language', 'conversationBy', 'tones'] as const)
        take(x, `brief.${k}`, L[k], () => d.brief[k], () => { (d.brief as Record<string, unknown>)[k] = structuredClone(fresh.brief[k]); });
    }
    if (tab === 'story') { company(x); market(x); sponsor(x); }
    if (tab === 'process') {
      if (fresh.process.stages.length === d.process.stages.length) take(x, 'process.stages', 'Stages', () => d.process.stages, () => { d.process.stages = fresh.process.stages.map((s, i) => ({ ...s, key: d.process.stages[i].key, name: d.process.stages[i].name })); });
      take(x, 'process.revenue', 'Revenue target', () => d.process.revenue, () => { d.process.revenue = fresh.process.revenue; });
    }
    if (tab === 'team') d.team.forEach((c, i) => { if (fresh.team[i]) characterFrom(x, c, fresh.team[i]); });
    if (tab === 'events') for (const e of [...d.events]) eventFrom(x, e);
  }
  return x.out;
}

/* ------------------------------------------------------------------------------------------------
 * One event or one person, again (D126). Kora's draft from the current brief first; when that is what
 * is already there, an alternative from small tables, so the button always does what it says.
 * ---------------------------------------------------------------------------------------------- */

const ALT_EVENTS: Record<EventDraft['kind'], Array<[string, string]>> = {
  impact: [
    ['A system goes down', '{Company}\'s main system is down for two days. Every {work} in progress is stuck, and {customers} are calling.'],
    ['A new rule from head office', 'Head office changes how each {work} is approved. Nobody on the team was asked, and the first approvals are slow.'],
    ['A rival wins a big client', '{Rival} wins one of your biggest {customers} with a lower price. The team wonders what they did wrong.']
  ],
  opportunity: [
    ['A large new opening', 'A large new {customer} asks {company} for a proposal on {product}. It could make the quarter, if the team is ready.'],
    ['A chance to pilot', '{Company} asks your team to pilot a faster way to handle each {work}. It is a chance to shine, and extra work.']
  ],
  people: [
    ['Friction in the team', 'Two of your team disagree about who owns a {work}, and the argument is spilling into team meetings.'],
    ['Running on empty', 'One of your team has worked late every night this week and is starting to make mistakes.'],
    ['Asking for more', 'One of your team asks for a bigger role and wants an answer soon.']
  ],
  sponsor: [
    ['The sponsor wants an update', 'Your sponsor asks for a short update on the numbers and on how the team is holding up.'],
    ['Questions from the top', 'Your sponsor has heard {customers} are unhappy and wants your plan by the end of the week.']
  ]
};

const ALT_PERSONA: Record<NeedKey, string[]> = {
  lowSkill_lowMorale: ['{First} joined recently and is not yet sure what good looks like at {company}. {Pron} keeps quiet when unsure.', '{First} is finding each {work} harder than expected and has started to doubt the move.'],
  lowSkill_highMorale: ['{First} is eager to learn and volunteers for everything, sometimes before {pron} is ready.', '{First} brings energy to the team and wants to handle a big {work} alone soon.'],
  highSkill_lowMorale: ['{First} has done this work for years and feels {pos} advice is no longer asked for.', '{First} is one of the most capable on the team, but has stopped speaking up in meetings.'],
  highSkill_highMorale: ['{First} is confident and quick, and likes to run {pos} own work with little oversight.', '{First} sets the pace for the team, and others go to {obj} for help.']
};
const ALT_CONCERN: Record<NeedKey, Array<[string, string]>> = {
  lowSkill_lowMorale: [['{Pron} worries {pron} will be the first to go if the numbers slip.', 'If the numbers slip, I think I will be the first one out.']],
  lowSkill_highMorale: [['{Pron} wants more training and is afraid to ask in case it looks like weakness.', 'I would love more training. I just did not want to look like I cannot cope.']],
  highSkill_lowMorale: [['{Pron} has been approached by {rival} and is quietly thinking about it.', 'To be honest, {rival} has been in touch. I have not said no yet.']],
  highSkill_highMorale: [['{Pron} wants to lead a team one day and wonders if anyone has noticed.', 'One day I would like to lead a team. I am not sure anyone here sees that.']]
};

function words(d: AuthorDraft, c?: Character): Record<string, string> {
  const ind = industryOf(d.brief.industry);
  const p = c?.gender === 'man' ? ['he', 'He', 'his', 'him'] : c?.gender === 'woman' ? ['she', 'She', 'her', 'her'] : ['they', 'They', 'their', 'them'];
  const rival = d.story.market.rivals[0]?.name || 'a rival';
  return {
    company: d.story.company.name, Company: d.story.company.name, product: d.story.product.name || ind.product, work: ind.work, customers: d.story.market.customers || ind.customers,
    customer: (d.story.market.customers || ind.customers).replace(/s$/, ''), rival, Rival: rival.charAt(0).toUpperCase() + rival.slice(1),
    First: c?.first ?? '', pron: p[0], Pron: p[1], pos: p[2], obj: p[3]
  };
}
const fill = (t: string, v: Record<string, string>) => t.replace(/\{(\w+)\}/g, (m, k: string) => v[k] ?? m);

function pick<T>(list: T[], seed: string, variant: number, isCurrent: (t: T) => boolean): T | null {
  for (let i = 0; i < list.length; i++) {
    const t = list[(hash(seed) + variant + i) % list.length];
    if (!isCurrent(t)) return t;
  }
  return null;
}

/**
 * Drafts one event or one person again, changing nothing else. `variant` moves to the next alternative
 * when Kora's draft is what is already there (each press of Regenerate gives another).
 */
export function regenerateItem(d: AuthorDraft, scope: { event: string } | { character: string }, variant = 0, fresh: AuthorDraft = redraft(d)): RegenResult {
  const out = regenerate(d, scope, fresh);
  if (out.changed.length) return out;
  if ('event' in scope) {
    const e = d.events.find(y => y.key === scope.event);
    if (!e || owned(d.marks[`events.${e.key}`])) return out;
    const v = words(d);
    const alt = pick(ALT_EVENTS[e.kind], e.key, variant, ([t, b]) => fill(t, v) === e.title && fill(b, v) === e.body);
    if (alt) { e.title = fill(alt[0], v); e.body = fill(alt[1], v); out.changed.push(e.title); }
    return out;
  }
  const c = d.team.find(y => y.id === scope.character);
  if (!c) return out;
  const v = words(d, c);
  const need = needOf(c.stats);
  const name = [c.first, c.last].filter(Boolean).join(' ') || c.id;
  if (!owned(d.marks[`team.${c.id}.persona`])) {
    const alt = pick(ALT_PERSONA[need], `${c.id}.persona`, variant, t => fill(t, v) === c.persona);
    if (alt) { c.persona = fill(alt, v); out.changed.push(`${name} · Persona`); }
  }
  if (!owned(d.marks[`team.${c.id}.hiddenConcern`]) && c.hiddenConcern) {
    const alt = pick(ALT_CONCERN[need], `${c.id}.concern`, variant, ([t]) => fill(t, v) === c.hiddenConcern);
    if (alt) { c.hiddenConcern = fill(alt[0], v); c.concernLine = fill(alt[1], v); out.changed.push(`${name} · Hidden concern`); }
  }
  return out;
}

/** The plain summary after a regenerate: what changed, and what of the author's was kept. */
export function regenSummary(r: RegenResult): string {
  const n = r.changed.length, k = r.kept.length;
  const changed = n ? `Kora drafted it again from your current brief: ${n} field${n === 1 ? '' : 's'} changed.` : 'Nothing changed: Kora\'s draft already matches your current brief.';
  const kept = k ? ` Kept ${k} field${k === 1 ? '' : 's'} you wrote: ${r.kept.slice(0, 4).join(', ')}${k > 4 ? ', and more' : ''}.` : '';
  return changed + kept;
}
