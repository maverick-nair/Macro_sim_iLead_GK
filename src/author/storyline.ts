import type { AuthorDraftResponse, Brief, FrameworkDimension, LeadershipLensModule } from '../api/author';
import { DEFAULT_SECTIONS, REPORT_SECTIONS, type StorylineInput } from '../engine/config';
import { bestStyle, NEEDS, type Lens, type LensStyle, type NeedKey } from '../engine/lens';
import { DEFAULT_LINKAGE, DEFAULT_METHODOLOGY, DEFAULT_NARRATIVES, DEFAULT_RECOGNITION, DEFAULT_SCALE } from '../engine/report/defaults';
import salesElevator from '../engine/storylines/sales-elevator.json';
import { sanitizeCopy } from '../i18n/copy';
import { challengeKind, DEFAULT_PROCESS, DURATION_MODES, industryOf, REGIONS, type Industry } from './context';
import { SKIP } from './copyGuard';
import { fitTable, LENS_BY_ID, type Dimension, type LibraryLens, type LibraryStyle, type Tone } from './lenses';
import { selectionOf } from './module';

/**
 * The mock drafter's storyline (D70, D73): no model, only templates. Sales Elevator supplies the
 * calibrated mechanics (actions, triggers, stats, money per deal); the brief and the locked lens module
 * supply everything a participant reads: company and product, the sponsor and their lines, the welcome
 * letter, the team, the lens's styles renamed for the context, the scoring dimensions and the events.
 * The output parses with the engine's StorylineConfig (src/author/storyline.test.ts, all 8 lenses).
 */

type Person = Pick<(typeof salesElevator.members)[number], 'homeStage' | 'byStage' | 'start'>;
type Event = NonNullable<StorylineInput['events']>[number];

const SE_STAGES = salesElevator.stages.map(s => s.key);
const SE_TITLES: Record<string, string> = Object.fromEntries(salesElevator.members.map(m => [m.homeStage, m.title]));

const NAMES = {
  he: ['Arjun Mehta', 'Daniel Okafor', 'Marcus Lee', 'Tomas Silva', 'Ravi Kumar', 'Owen Clarke', 'Samuel Tan', 'Hiro Sato', 'Leon Fischer', 'Kwame Mensah', 'Ethan Brooks', 'Omar Haddad', 'Victor Hale', 'Felix Moreau', 'Adrian Cole', 'Nikhil Rao'],
  she: ['Priya Nair', 'Sofia Martins', 'Grace Chen', 'Amara Obi', 'Hannah Wright', 'Leila Rahman', 'Mei Lin', 'Nadia Petrova', 'Clara Jensen', 'Ana Ruiz', 'Zoe Adams', 'Isha Kapoor']
} as const;
const SPONSORS = ['Elena Ward', 'Catherine Bose', 'Julia Brandt', 'Maya Fernandes'];
const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];

/** A small stable hash, so the same brief always drafts the same storyline. */
function hash(s: string): number {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}

const slug = (s: string, prefix = 's') => {
  const k = s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 30);
  return /^[a-z]/.test(k) ? k : `${prefix}_${k || 'x'}`;
};
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const lower = (s: string) => (/^[A-Z][a-z]/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s);
const sentence = (s: string) => { const t = s.trim().replace(/[.!?]+$/, ''); return t ? `${t}.` : ''; };

/** Fills `{work}`, `{company}` and friends. */
function fill(template: string, v: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in v ? v[k] : m));
}

/** Applies the copy rules to every copy field of the draft (the engine does the same on the way in). */
function sanitizeDeep<T>(value: T, key = ''): T {
  if (typeof value === 'string') return (SKIP.has(key) ? value : sanitizeCopy(value)) as T;
  if (Array.isArray(value)) return value.map(v => sanitizeDeep(v, key)) as T;
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, SKIP.has(k) ? v : sanitizeDeep(v, k)])) as T;
  return value;
}

export interface DraftContext {
  company: string;
  rival: string;
  product: string;
  industry: Industry;
  tone: Tone;
  stages: Array<{ key: string; name: string }>;
  teamSize: number;
  weeks: number;
}

export function draftContext(brief: Brief): DraftContext {
  const industry = industryOf(brief.industry);
  const seed = hash(`${brief.client ?? ''}|${brief.industry ?? ''}|${brief.challenge ?? ''}`);
  const fictional = industry.companies[seed % industry.companies.length];
  const company = brief.client?.trim() || fictional;
  const rival = industry.companies.find(c => c !== company && c !== fictional) ?? 'a rival firm';
  const names = brief.process ?? DEFAULT_PROCESS.stages;
  const keys = new Set<string>();
  const stages = names.map(n => { let k = slug(n); while (keys.has(k)) k += '_2'; keys.add(k); return { key: k, name: n }; });
  return { company, rival, product: industry.product, industry, tone: brief.tone ?? 'professional', stages, teamSize: brief.teamSize ?? 10, weeks: DURATION_MODES[brief.duration ?? 'full'].weeks };
}

/** The lens's styles renamed for the tone and the team's work (D70). The Client Leadership Model plays on the readiness styles. */
export function fitStyles(lib: LibraryLens, ctx: DraftContext): Array<LensStyle & { home: NeedKey }> {
  const source: LibraryStyle[] = lib.styles ?? LENS_BY_ID.readiness_based.styles!;
  const v = { work: ctx.industry.work, company: ctx.company, product: ctx.product };
  return source.map(s => ({ key: s.key, letter: s.letter, name: s.names[ctx.tone], short: fill(s.short, v), description: fill(s.description, v), home: s.home }));
}

export function draftLens(module: LeadershipLensModule, ctx: DraftContext): Lens {
  const lib = LENS_BY_ID[module.primary.id];
  const styles = fitStyles(lib, ctx);
  return {
    id: lib.id, title: lib.title, description: lib.description, basedOn: lib.basedOn,
    styles: styles.map(({ home: _home, ...s }) => s),
    needs: structuredClone(lib.needs),
    fit: fitTable(lib.styles ? lib : { fit: undefined }, styles),
    ...(module.secondary ? { secondary: { id: module.secondary.id, title: module.secondary.title } } : null)
  };
}

const ANCHORS = ['Little evidence of {focus}.', 'Some evidence of {focus}, mostly when prompted.', 'Clear evidence of {focus} in most conversations.', 'Consistent evidence of {focus}, even under pressure.', 'Strong evidence of {focus} in every conversation, and others follow the example.'];

/** Scoring dimensions as skills: the library's, or the confirmed client framework's. */
export function dimensionsOf(id: LeadershipLensModule['primary']['id'], client: FrameworkDimension[]): Dimension[] {
  if (id !== 'client_model') return LENS_BY_ID[id].dimensions;
  return client.map(d => {
    const example = d.behaviours[0] ? lower(d.behaviours[0].replace(/[.!?]+$/, '')) : lower(d.name);
    return { key: slug(d.name, 'd'), name: d.name, focus: `${lower(d.name)} (for example, ${example})`, practice: `Pick one ${d.name} behaviour and plan where you will use it this week.`, onTheJob: `Ask a colleague to watch for one ${d.name} behaviour and tell you what they saw.` };
  });
}

function draftReport(module: LeadershipLensModule, lens: Lens) {
  const sel = selectionOf(module);
  const primary = dimensionsOf(sel.primary, sel.clientDimensions);
  const used = new Set(primary.map(d => d.key));
  const secondary = sel.secondary ? dimensionsOf(sel.secondary, sel.clientDimensions).map(d => ({ ...d, key: used.has(d.key) ? `${d.key}_2` : d.key })) : [];
  const skill = (d: Dimension, reportOnly: boolean) => ({ key: d.key, name: d.name, reportOnly, anchors: ANCHORS.map(a => fill(a, { focus: d.focus })) });
  // Every conversation rates two primary dimensions; conversations also rate one report only dimension.
  const linkage: Record<string, string[]> = {};
  const conversations = new Set(['f2f', 'coach', 'feedback', 'meet', 'goals', 'email', 'sponsor', 'reply']);
  Object.keys(DEFAULT_LINKAGE).forEach((k, i) => {
    const list = [primary[i % primary.length].key, primary[(i + 1) % primary.length].key];
    if (secondary.length && conversations.has(k)) list.push(secondary[i % secondary.length].key);
    linkage[k] = [...new Set(list)];
  });
  const names = lens.styles.map(s => s.name);
  const or = names.length > 1 ? `${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}` : names[0];
  return {
    skills: [...primary.map(d => skill(d, false)), ...secondary.map(d => skill(d, true))],
    linkage,
    scale: DEFAULT_SCALE,
    narratives: {
      overall: DEFAULT_NARRATIVES.overall,
      capability: {
        low: `Most of your style choices did not match what people needed. Start each week by asking what each person needs most: ${or}.`,
        mid: DEFAULT_NARRATIVES.capability.mid,
        high: DEFAULT_NARRATIVES.capability.high
      },
      dominant: Object.fromEntries(lens.styles.map(s => {
        const need = NEEDS.find(n => lens.fit[n][s.key] === 0);
        const who = need ? lower(lens.needs[need].label) : 'ready for it';
        return [s.key, `You lean on ${s.name}. It helps people who are ${who}, and holds back people who need something else.`];
      }))
    },
    development: Object.fromEntries([...primary, ...secondary].map(d => [d.key, { practice: d.practice, onTheJob: d.onTheJob }])),
    recognitionPhrases: DEFAULT_RECOGNITION,
    methodology: DEFAULT_METHODOLOGY,
    reflection: [`What did you learn about leading through the ${lens.title} lens?`, 'What will you do differently with your real team next week?']
  };
}

const PERSONA: Record<string, string> = {
  six_styles: '{Pron} reacts strongly to how {pron} is led, and remembers it.',
  inspire_deliver: '{Pron} cares about {pos} numbers and about feeling recognised.',
  servant: '{Pron} brings blockers to you rather than working around them.',
  five_practices: '{Pron} watches whether you do what you say.',
  adaptive: '{Pron} finds the changes at {company} unsettling.',
  team_amplifier: '{Pron} has more ideas than {pron} shares.'
};
const REMARKS: Record<NeedKey, string> = {
  lowSkill_lowMorale: '{First} is still learning how {company} handles each {work} and tends to wait to be told what to do.',
  lowSkill_highMorale: '{First} is keen and asks lots of questions, but has not yet handled a difficult {work} alone.',
  highSkill_lowMorale: '{First} knows the work well but has gone quiet in meetings lately.',
  highSkill_highMorale: '{First} is one of the strongest on the team and likes to run {pos} own {work}s.'
};
const CONCERNS: Record<NeedKey, [string, string]> = {
  lowSkill_lowMorale: ['{Pron} feels the role is not what {pron} was promised when {pron} joined.', 'Honestly? This role is not what I was promised. I expected a lot more support when I joined.'],
  lowSkill_highMorale: ['{Pron} wants to move to another stage and worries nobody will ask.', 'I really want a shot at another part of the process. I just did not know who to ask.'],
  highSkill_lowMorale: ['{Pron} feels {pos} expertise goes unnoticed.', 'I know this work better than most, and it feels like nobody notices.'],
  highSkill_highMorale: ['{Pron} is wondering whether {pron} can grow any further here.', 'I love the work, but I am not sure where I go next at {company}.']
};

function pronouns(p: 'he' | 'she' | 'they') {
  return p === 'he' ? { pron: 'he', Pron: 'He', pos: 'his', obj: 'him' } : p === 'she' ? { pron: 'she', Pron: 'She', pos: 'her', obj: 'her' } : { pron: 'they', Pron: 'They', pos: 'their', obj: 'them' };
}

function needOfStats(s: { skill: number; morale: number }): NeedKey {
  return s.skill >= 70 ? (s.morale >= 70 ? 'highSkill_highMorale' : 'highSkill_lowMorale') : s.morale >= 70 ? 'lowSkill_highMorale' : 'lowSkill_lowMorale';
}

/** Maps Sales Elevator's per stage values onto the drafted stages, by position. */
function remapStages(p: Person, ctx: DraftContext, homeKey: string) {
  const n = ctx.stages.length;
  const byStage: Record<string, { skill: number; morale: number; result: number }> = {};
  ctx.stages.forEach((s, k) => { byStage[s.key] = { ...(p.byStage as Record<string, { skill: number; morale: number; result: number }>)[SE_STAGES[n === 1 ? 0 : Math.round((k * 4) / (n - 1))]] }; });
  byStage[homeKey] = { skill: p.start.skill, morale: p.start.morale, result: p.start.result };
  return byStage;
}

function homeIndex(p: Person, ctx: DraftContext) {
  const h = SE_STAGES.indexOf(p.homeStage);
  return Math.min(ctx.stages.length - 1, Math.floor((h * ctx.stages.length) / SE_STAGES.length));
}

function titleFor(stage: { key: string; name: string }, ctx: DraftContext) {
  const se = ctx.stages.length === SE_STAGES.length && ctx.stages.every((s, i) => s.name === DEFAULT_PROCESS.stages[i]);
  return se ? SE_TITLES[SE_STAGES[ctx.stages.indexOf(stage)]] : `${stage.name} Specialist`;
}

function draftPeople(ctx: DraftContext, lib: LibraryLens, seed: number) {
  const used = { he: 0, she: 0 };
  const offset = { he: seed % NAMES.he.length, she: seed % NAMES.she.length };
  const nameFor = (p: 'he' | 'she') => NAMES[p][(offset[p] + used[p]++) % NAMES[p].length];
  const v = { company: ctx.company, work: ctx.industry.work };
  const members = Array.from({ length: ctx.teamSize }, (_, i) => {
    const src = salesElevator.members[i % salesElevator.members.length];
    const lift = i >= salesElevator.members.length ? 8 : 0;
    const stage = ctx.stages[homeIndex(src, ctx)];
    const pronoun = src.pronoun as 'he' | 'she';
    const name = nameFor(pronoun);
    const first = name.split(' ')[0];
    const pr = pronouns(pronoun);
    const start = { skill: Math.min(100, src.start.skill + lift), morale: Math.min(100, src.start.morale + lift), result: src.start.result };
    const need = needOfStats(start);
    const words = { ...v, ...pr, First: first };
    const persona = PERSONA[lib.id] && i % 2 === 0 ? ` ${fill(PERSONA[lib.id], words)}` : '';
    const concern = need !== 'highSkill_highMorale' || i % 3 === 0;
    const id = slug(first, 'm') + (i >= salesElevator.members.length ? `_${i}` : '');
    return {
      id, name, title: titleFor(stage, ctx), pronoun, homeStage: stage.key,
      start, byStage: { ...remapStages(src, ctx, stage.key), [stage.key]: start },
      profile: { previous: '', tenure: src.profile.tenure, experience: src.profile.experience, skills: ctx.stages.slice(homeIndex(src, ctx), homeIndex(src, ctx) + 2).map(s => s.name).join(', '), remarks: fill(REMARKS[need], words) + persona, relations: '' },
      ...(concern ? { hiddenConcern: fill(CONCERNS[need][0], words), concernLine: fill(CONCERNS[need][1], words) } : null),
      portrait: src.portrait
    };
  });
  const candidates = salesElevator.candidates.map((c, i) => {
    const pronoun = c.pronoun as 'he' | 'she';
    const stage = ctx.stages[homeIndex(c, ctx)];
    const name = nameFor(pronoun);
    return {
      id: `cand_${slug(name.split(' ')[0], 'c')}_${i}`, name, title: titleFor(stage, ctx), pronoun, homeStage: stage.key,
      start: { ...c.start }, byStage: remapStages(c, ctx, stage.key),
      profile: { previous: '', tenure: 'New joiner', experience: /^\d/.test(c.profile.experience) ? c.profile.experience : '3 years', skills: stage.name, remarks: `${name.split(' ')[0]} has worked on ${ctx.industry.work}s like these at ${ctx.rival}.`, relations: '' }
    };
  });
  return { members, candidates };
}

function draftEvents(brief: Brief, ctx: DraftContext, lib: LibraryLens, members: Array<{ id: string; start: { morale: number } }>, sponsor: string): Event[] {
  const v = { company: ctx.company, product: ctx.product, work: ctx.industry.work, customers: ctx.industry.customers, customer: ctx.industry.customers.replace(/s$/, '') };
  const body = (s: string) => { const t = fill(s, { ...v, Customers: cap(v.customers) }); return { he: t, she: t }; };
  const kind = challengeKind(brief.challenge);
  const kickoff: Record<string, [string, string]> = {
    delivery_morale: ['A tougher target', '{company} raises the target for {product} this quarter. The team is already stretched.'],
    change: ['A new way of working', '{company} announces a change to how each {work} is handled. Some of the team are worried about what it means for them.'],
    agile: ['A new delivery rhythm', '{company} moves the team to shorter delivery cycles. Dependencies on other teams start to pile up.'],
    one_style: ['Pressure from the top', '{company} wants faster results on {product}. It is tempting to tell everyone exactly what to do.'],
    other: ['The challenge ahead', `Your sponsor sets out the quarter: ${sentence(lower(brief.challenge ?? 'grow the business and keep the team strong'))}`]
  };
  const middle = ctx.stages[Math.floor(ctx.stages.length / 2)].key;
  const quietest = [...members].sort((a, b) => a.start.morale - b.start.morale)[0].id;
  const [lensA, lensB] = lib.events.length ? lib.events : LENS_BY_ID.readiness_based.events;
  const sponsorFirst = sponsor.split(' ')[0];
  const events: Event[] = [
    { key: 'challenge_kickoff', title: kickoff[kind][0], body: body(kickoff[kind][1]), card: 'impact', period: 1, subPeriod: 1, impact: [-1, -4, -5], target: 'team' },
    { key: 'competitor_moves', title: 'A competitor moves', body: body(`${ctx.rival} launches a cheaper alternative to {product}. {Customers} start asking harder questions.`), card: 'impact', period: 2, subPeriod: 1, impact: [0, -4, -4], target: 'team', delivery: 'bulletin', impactText: 'Later stages get harder unless the team sells value.' },
    { key: 'lens_moment', title: fill(lensB.title, v), body: body(lensB.body), card: lensB.card, ...(lensB.label ? { label: lensB.label } : null), period: 2, subPeriod: 3, impact: [0, -6, -10], target: 'member', response: { actions: ['f2f', 'coach', 'feedback'], within: 2, onTime: [0, 3, 2] }, escalation: { sponsor: true } },
    { key: 'pulse_survey', title: 'Pulse survey results', body: body('A pulse survey shows the team is tired and wants clearer priorities.'), card: 'signal', period: 3, subPeriod: 1, impact: [0, -4, 0], target: 'team', delivery: 'bulletin', impactText: 'Team morale dips. A team activity this week would land well.' },
    { key: 'budget_cut', title: 'A hard message to share', body: body('Budgets are cut across {company}, and you must explain to your team what it means for them.'), card: 'crisis', period: 3, subPeriod: 3, impact: [0, -5, -5], target: 'team', delivery: 'sponsorCall', response: { actions: ['meet'], within: 2, onTime: [0, 2, 0] }, escalation: { sponsor: true } },
    { key: 'role_email', title: 'About my role', body: body('I have been thinking about my role here and would like to talk about where it is going. Could we find some time this week?'), card: 'signal', period: 4, subPeriod: 2, impact: [0, -3, 0], target: quietest, delivery: 'email', response: { actions: ['reply', 'f2f'], within: 2, onTime: [0, 3, 0] }, escalation: { sponsor: false } },
    { key: 'offer_elsewhere', title: 'An offer elsewhere', body: body(`{name} has an offer from ${ctx.rival} and is tempted to take it.`), card: 'capacity', period: 5, subPeriod: 1, impact: [0, -5, -5], target: 'member', delivery: 'chat', response: { actions: ['f2f', 'reward', 'coach'], within: 2, onTime: [0, 4, 0] }, escalation: { sponsor: false } },
    { key: 'lens_challenge', title: fill(lensA.title, v), body: body(lensA.body.replace('{name}', 'One of your team')), card: lensA.card, ...(lensA.label ? { label: lensA.label } : null), period: 5, subPeriod: 3, impact: lensA.card === 'opportunity' ? [0, 3, 4] : [0, -4, -3], target: lensA.card === 'opportunity' ? `stage:${middle}` : 'team' },
    { key: 'public_complaint', title: '{product} under scrutiny', body: body('A public complaint about {product} spreads online. {Customers} want reassurance before they commit.'), card: 'impact', period: 6, subPeriod: 1, impact: [0, -8, -7], target: 'team' },
    { key: 'more_approvals', title: 'More approvals', body: body('{company} adds new approval steps before any {work} can close. The team feels slowed down.'), card: 'impact', period: 7, subPeriod: 1, impact: [0, -9, -10], target: 'team', delivery: 'bulletin', impactText: 'More approvals slow every stage. Morale and result fall unless you help the team adjust.' },
    { key: 'big_referral', title: 'A big referral', body: body('A happy {customer} refers a large new {work} to the team.'), card: 'opportunity', window: { from: 3, to: 6, probability: 60 }, impact: [0, 3, 4], target: `stage:${middle}` },
    { key: 'morale_alarm', title: `${sponsorFirst} has heard the team is struggling`, body: body(`${sponsorFirst} calls. Word has reached her that your team is worn out, and she wants to know what you are doing about it.`), card: 'crisis', when: { condition: 'teamMoraleBelow', value: 40, periods: 2 }, impact: [0, 0, 0], target: 'sponsor', delivery: 'sponsorCall', response: { actions: ['reply'], within: 2, onTime: [0, 0, 0] }, escalation: { sponsor: true } }
  ];
  const named = events.map(e => ({ ...e, title: fill(e.title, v) }));
  if (ctx.weeks >= 8) return named;
  // Lite: the same deck, compressed into four weeks.
  return named.map(e => (e.period !== undefined ? { ...e, period: Math.ceil(e.period / 2) } : e.window ? { ...e, window: { ...e.window, from: 2, to: 3 } } : e));
}

const WELCOME: Record<Tone, string> = {
  professional: 'Welcome to {company}. I am glad you are here.',
  warm: 'Welcome to {company}. We are so glad to have you with us.',
  direct: 'Welcome to {company}. Let us get straight to it.'
};
const CLOSE: Record<Tone, string> = {
  professional: 'Your time is limited each week. Spend it where it matters most.',
  warm: 'You will not do this alone. Lean on your team, and on me.',
  direct: 'Your time is short each week. Spend it well.'
};

function money(brief: Brief, weeks: number) {
  const region = REGIONS.find(r => r.id === (brief.region ?? 'global'))!;
  const round = (n: number) => { const p = 10 ** (Math.floor(Math.log10(n)) - 1); return Math.round(n / p) * p; };
  const scale = weeks / 8;
  return { currency: region.currency, locale: region.locale, display: 'symbol' as const, target: round(salesElevator.money.target * region.rate * scale), valuePerConversion: round(salesElevator.money.valuePerConversion * region.rate), inputPerSubPeriod: [...salesElevator.money.inputPerSubPeriod] };
}

/** The drafted storyline. Throws nothing; the caller checks it with the engine's schema. */
export function draftStoryline(brief: Brief, module: LeadershipLensModule): StorylineInput {
  const ctx = draftContext(brief);
  const lib = LENS_BY_ID[module.primary.id];
  const seed = hash(`${ctx.company}|${ctx.industry.id}`);
  const lens = draftLens(module, ctx);
  const sponsorName = SPONSORS[seed % SPONSORS.length];
  const { members, candidates } = draftPeople(ctx, lib, seed);
  const perStage = new Map<string, number>();
  for (const m of members) perStage.set(m.homeStage, (perStage.get(m.homeStage) ?? 0) + 1);
  const mode = DURATION_MODES[brief.duration ?? 'full'];
  const m = money(brief, mode.weeks);
  const fmt = new Intl.NumberFormat(m.locale, { style: 'currency', currency: m.currency, maximumFractionDigits: 0 });
  const v = { company: ctx.company, product: ctx.product, work: ctx.industry.work };
  // Option tags follow the lens: each Readiness Based tag becomes the lens style that fits the same need.
  const tag: Record<string, string> = { D: bestStyle(lens, 'lowSkill_lowMorale'), G: bestStyle(lens, 'lowSkill_highMorale'), P: bestStyle(lens, 'highSkill_lowMorale'), E: bestStyle(lens, 'highSkill_highMorale') };
  const swapNames = (s: string) => s.replace(/Innov8(?: Inc\.)?/g, ctx.company).replace(/Beta Elevators/g, ctx.rival);
  const se = JSON.parse(swapNames(JSON.stringify({ actions: salesElevator.actions, triggers: salesElevator.triggers }))) as Pick<StorylineInput, 'actions' | 'triggers'>;
  const stageList = ctx.stages.map(s => s.name);
  const stagesText = stageList.length > 1 ? `${stageList.slice(0, -1).join(', ')} and ${stageList[stageList.length - 1]}` : stageList[0];
  const challenge = brief.challenge ? `This quarter our challenge is ${sentence(lower(brief.challenge))}` : 'This quarter I need the number, and a team that is stronger when you leave than when you arrived.';
  const storyline: StorylineInput = {
    id: `draft_${slug(ctx.company, 'c')}`,
    name: `${ctx.product}, ${ctx.company}`,
    organisation: ctx.company,
    lens,
    money: m,
    time: { period: { unit: 'week', count: mode.weeks }, liveCap: mode.liveCap },
    stages: ctx.stages.map((s, k) => {
      const src = salesElevator.stages[ctx.stages.length === 1 ? 0 : Math.round((k * 4) / (ctx.stages.length - 1))];
      return { key: s.key, name: s.name, conversionRatio: src.conversionRatio, ideal: Math.max(1, Math.round(ctx.teamSize / ctx.stages.length)) };
    }),
    sponsor: { name: sponsorName, title: ctx.industry.sponsorTitle, styleLine: fill(lib.styleLine, v) },
    intro: {
      welcome: [fill(WELCOME[ctx.tone], v), `You are taking over a team of ${WORDS[ctx.teamSize]} who handle every ${ctx.industry.work} from ${stageList[0]} to ${stageList[stageList.length - 1]}. Some are thriving, some are new, and one or two are struggling.`, challenge],
      product: [`We offer ${ctx.product}, ${ctx.industry.productLine}. Every ${ctx.industry.work} moves through ${WORDS[stageList.length]} stages: ${stagesText}.`, 'Each stage hands its work to the next, so one weak stage slows everything after it.'],
      targets: [`Reach ${fmt.format(m.target)} in revenue over ${WORDS[mode.weeks]} weeks.`, 'Keep Team Morale and Trust healthy. A burned out team will not hold the number next quarter.', CLOSE[ctx.tone]]
    },
    members,
    candidates,
    actions: se.actions.map(a => ({ ...a, options: a.options.map(o => (o.style ? { ...o, style: tag[o.style] ?? o.style } : o)) })),
    weeklyStyle: salesElevator.weeklyStyle as StorylineInput['weeklyStyle'],
    events: draftEvents(brief, ctx, lib, members, sponsorName),
    triggers: se.triggers,
    report: draftReport(module, lens),
    maxPerStage: Math.max(2, ...perStage.values()),
    performanceThreshold: salesElevator.performanceThreshold,
    calibrated: false
  };
  return sanitizeDeep(storyline);
}

const SECTION_NAMES: Record<(typeof REPORT_SECTIONS)[number], string> = {
  about: 'About the simulation', summary: 'Summary', skills: 'Skills', objectives: 'Objectives', adaptability: 'Leadership adaptability',
  styles: 'Leadership styles summary', style: 'Leadership style', consistency: 'Consistency in styles', intent: 'Intent and action',
  actions: 'Summary of actions', distribution: 'Actions across the team', moments: 'Key moments', people: 'People',
  business: 'Business results', analytics: 'Conversation analytics', thought: 'Food for thought', takeaways: 'Key takeaways',
  plan: 'Development plan', progress: 'Progress over time', methodology: 'Methodology'
};

/** The build preview (module step 6), from a drafted storyline. */
export function previewOf(storyline: StorylineInput): AuthorDraftResponse['preview'] {
  const first = storyline.events?.[0];
  const purpose = storyline.purpose ?? (storyline.use === 'selection' ? 'assessment' : 'development');
  const sections = (storyline.report?.sections ?? DEFAULT_SECTIONS[purpose]) as Array<(typeof REPORT_SECTIONS)[number]>;
  return {
    teamSize: storyline.members.length,
    sampleEvent: { title: first?.title ?? '', body: first?.body.he.replace('{name}', storyline.members[0].name.split(' ')[0]) ?? '' },
    styles: (storyline.lens?.styles ?? []).map(s => ({ name: s.name, short: s.short })),
    dimensions: (storyline.report?.skills ?? []).map(s => ({ name: s.name, reportOnly: !!s.reportOnly })),
    reportSections: sections.map(s => SECTION_NAMES[s])
  };
}
