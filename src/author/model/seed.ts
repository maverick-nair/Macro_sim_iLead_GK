import { Brief, type QuestionId } from '../../api/author';
import type { StorylineInput } from '../../engine/config';
import { needOf, NEEDS, type NeedKey } from '../../engine/lens';
import { DEFAULT_SCALE } from '../../engine/report/defaults';
import { DURATION_MODES, industryOf, REGIONS, TONE_LABELS } from '../context';
import { LENS_BY_ID } from '../lenses';
import { buildModule } from '../module';
import { draftContext, draftStoryline } from '../storyline';
import { AuthorDraft, type ActionDraft, type Chat, type Character, type DraftStyle, type EventDraft, type Mark } from './draft';
import { ACTION_TEMPLATES, canPlay, ENGINE_TEMPLATES } from './library';

/**
 * The offline drafter for the workspace (D105): the chat's brief and lens become a full draft with no
 * model. The storyline comes from the existing mock drafter (`draftStoryline`, calibrated Sales Elevator
 * mechanics with the brief's words); the extra author facing detail (headquarters, selling points,
 * voices, sample answers) comes from small deterministic tables, so the same answers always give the
 * same draft. Fields from the author's answers are marked `you`, everything else `ai`.
 */

type SL = StorylineInput;
type Member = SL['members'][number];

export function hash(s: string): number {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}

export const slugKey = (s: string, prefix = 'k') => {
  const k = s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 30);
  return /^[a-z]/.test(k) ? k : `${prefix}_${k || 'x'}`;
};

/** A key not yet in `taken`. */
export function freshKey(base: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  let k = slugKey(base), i = 2;
  while (used.has(k)) k = `${slugKey(base)}_${i++}`;
  return k;
}

const sign = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0');
/** "Skill +1, morale +6, result +9" from an effect triple; "No change" when all are zero. */
export function effectText([skill, morale, result]: readonly number[]): string {
  const parts = [['Skill', skill], ['morale', morale], ['result', result]].filter(([, v]) => v !== 0).map(([k, v], i) => `${i === 0 ? String(k).charAt(0).toUpperCase() + String(k).slice(1) : String(k).toLowerCase()} ${sign(v as number)}`);
  return parts.length ? parts.join(', ') : 'No change';
}

/** Reads "Skill +4, result −2" back to [skill, morale, result]; null when it names none of them. */
export function parseEffect(text: string): [number, number, number] | null {
  const out: [number, number, number] = [0, 0, 0];
  let found = false;
  for (const m of text.matchAll(/(skill|morale|result)\s*([+−-]?)\s*(\d+)/gi)) {
    const i = ['skill', 'morale', 'result'].indexOf(m[1].toLowerCase());
    out[i] = (m[2] === '−' || m[2] === '-' ? -1 : 1) * Number(m[3]);
    found = true;
  }
  if (!found && /no change/i.test(text)) return out;
  return found ? out : null;
}

const HQ: Record<string, string> = { global: 'London, United Kingdom', us: 'Chicago, United States', uk: 'Manchester, United Kingdom', india: 'Pune, India', singapore: 'Singapore', uae: 'Dubai, United Arab Emirates', australia: 'Melbourne, Australia' };
/** The portrait library: Sales Elevator's faces, each with its moods. */
export const PORTRAITS = ['kent', 'beth', 'justin', 'ruth', 'derick', 'mandy', 'peter', 'lowe', 'green', 'jack'].map(n => `/assets/npc/${n}.webp`);
const AGES = ['25 to 34', '35 to 44', '45 to 54', '25 to 34'];
const COMM = ['Direct', 'Guarded at first', 'Detailed', 'Warm', 'Data driven', 'Competitive', 'Quiet', 'Talkative'];
const VOICES = {
  man: [{ id: 'warm_measured_m', name: 'Warm, measured', accent: 'US English', pace: 50, warmth: 70, formality: 55 }, { id: 'brisk_direct_m', name: 'Brisk, direct', accent: 'UK English', pace: 75, warmth: 40, formality: 60 }, { id: 'calm_low_m', name: 'Calm, low', accent: 'Indian English', pace: 35, warmth: 60, formality: 50 }, { id: 'upbeat_quick_m', name: 'Upbeat, quick', accent: 'Australian English', pace: 80, warmth: 75, formality: 35 }],
  woman: [{ id: 'warm_measured_w', name: 'Warm, measured', accent: 'US English', pace: 50, warmth: 75, formality: 55 }, { id: 'crisp_clear_w', name: 'Crisp, clear', accent: 'UK English', pace: 65, warmth: 50, formality: 70 }, { id: 'calm_steady_w', name: 'Calm, steady', accent: 'Indian English', pace: 40, warmth: 65, formality: 50 }, { id: 'bright_quick_w', name: 'Bright, quick', accent: 'Australian English', pace: 80, warmth: 80, formality: 30 }]
};
export const VOICE_LIBRARY = [...VOICES.man.map(v => ({ ...v, gender: 'man' as const })), ...VOICES.woman.map(v => ({ ...v, gender: 'woman' as const }))];

const MOTIVES: Record<NeedKey, string> = {
  lowSkill_lowMorale: 'Clear steps, a manager who checks in, and early wins to build on.',
  lowSkill_highMorale: 'Learning fast, and a chance to try bigger work.',
  highSkill_lowMorale: 'Recognition for what they know, and a say in how the work is done.',
  highSkill_highMorale: 'Room to run their own work, and a clear path to a senior role.'
};
const GOALS: Record<NeedKey, string> = {
  lowSkill_lowMorale: 'To feel confident in the role within six months.',
  lowSkill_highMorale: 'To move to a more senior stage of the process.',
  highSkill_lowMorale: 'To be trusted with the hardest accounts again.',
  highSkill_highMorale: 'To lead a team of their own.'
};
const REACT = ['Opens up and gets to work.', 'Goes along with it, without much energy.', 'Pushes back, or goes quiet.'];

const SAMPLES: Array<{ answer: string; scored: 'strong' | 'adequate' | 'weak' | 'harmful' }> = [
  { answer: 'Talk me through what the new discount policy means for your deals.', scored: 'strong' },
  { answer: 'The policy is final, so let\'s focus on what we can control.', scored: 'adequate' },
  { answer: 'Your numbers are slipping. I need you to close two deals this week.', scored: 'weak' },
  { answer: 'What would help you most this week? I can take the pricing call with you.', scored: 'strong' },
  { answer: 'Just follow the process and stop complaining about it.', scored: 'harmful' },
  { answer: 'I hear you. Let us look at the two biggest deals together on Thursday.', scored: 'adequate' }
];

/** The answers that came from the author, as brief field names. */
const FROM_ANSWER: Partial<Record<QuestionId, string[]>> = {
  role_level: ['brief.participants'], industry: ['brief.industry'], challenge: ['brief.challenge'], client: ['brief.client', 'story.company.name'],
  team_size: [], process: ['process.stages'], duration: ['brief.run'], language: ['brief.language'], tone: ['brief.tones']
};

/** The stage the challenge names, else the one before the last: the pressure point events lean on. */
export function pressureOf(challenge: string | undefined, stages: Array<{ key: string; name: string }>): string {
  const named = challenge ? stages.find(s => new RegExp(`\\b${s.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i').test(challenge)) : undefined;
  return (named ?? stages[Math.max(0, stages.length - 2)]).key;
}

function genderOf(p: Member['pronoun']): Character['gender'] {
  return p === 'he' ? 'man' : p === 'she' ? 'woman' : 'nonbinary';
}
export const pronounsOf = (g: Character['gender']) => (g === 'man' ? 'he, him' : g === 'woman' ? 'she, her' : 'they, them');

function character(m: Member, i: number, sl: SL, seed: number): Character {
  const [first, ...rest] = m.name.split(' ');
  const gender = genderOf(m.pronoun);
  const voices = gender === 'woman' ? VOICES.woman : VOICES.man;
  const v = voices[(seed + i) % voices.length];
  const need = needOf(m.start);
  const reactions = Object.fromEntries(sl.lens!.styles.map(s => [s.key, REACT[sl.lens!.fit[need][s.key] ?? 2]]));
  const others = sl.members.filter(o => o.id !== m.id);
  return {
    id: m.id, first, last: rest.join(' '), gender, pronouns: pronounsOf(gender), ageRange: AGES[(seed + i) % AGES.length], title: m.title, stage: m.homeStage, photo: m.portrait ?? PORTRAITS[i % PORTRAITS.length],
    voice: { id: v.id, language: 'English', accent: v.accent, pace: v.pace, warmth: v.warmth, formality: v.formality, replyLength: i % 3 === 0 ? 'short' : 'medium' },
    persona: m.profile.remarks, hiddenConcern: m.hiddenConcern ?? '', concernLine: m.concernLine ?? '',
    commStyles: [COMM[(seed + i) % COMM.length], COMM[(seed + i + 3) % COMM.length]], motivatedBy: MOTIVES[need], reactions,
    relationships: i % 3 === 0 && others.length ? [{ with: others[(i + 1) % others.length].id, kind: 'Works closely with' }] : [],
    noTopics: '', stats: { skill: m.start.skill, morale: m.start.morale, result: m.start.result, trust: m.start.trust ?? 50 },
    bestStage: '', experience: m.profile.experience, tenure: m.profile.tenure, previousCompany: m.profile.previous, careerGoal: GOALS[need],
    shown: { experience: true, tenure: true, previousCompany: false, careerGoal: true }, custom: []
  };
}

/** Impact by style for a conversation: from the engine options' fit, one step off and wrong effects. */
function impactOf(action: SL['actions'][number], styles: DraftStyle[]) {
  const byStyle = new Map(action.options.filter(o => o.style).map(o => [o.style!, o.effects]));
  const fallback = action.options[0].effects;
  return Object.fromEntries(styles.map(s => {
    const e = byStyle.get(s.key) ?? fallback;
    return [s.key, { fit: effectText(e.m0), close: effectText(e.m1), wrong: effectText(e.m2 ?? e.m1) }];
  }));
}

const FORMATS: Record<string, string> = { meeting: 'Team meeting by voice or text', roleplay: '1:1 by voice or text', chat: 'Chat', email: 'Written message', plan: 'Written plan', interview: 'Interview', sponsor: 'Sponsor briefing' };

export function actionFrom(a: SL['actions'][number], t: { key: string; name: string; description: string; group: 'team' | 'person'; core: boolean; enabled: boolean; template: string; origin: 'library' | 'yours' }, styles: DraftStyle[], skills: string[]): ActionDraft {
  const plays = a.kind as ActionDraft['plays'];
  return {
    key: t.key, template: t.template, name: t.name, description: t.description, group: t.origin === 'yours' ? 'story' : t.group, core: t.core, enabled: t.enabled, plays,
    canPlay: canPlay(a.rule, plays), forWhom: a.scope === 'team' ? 'The whole team' : a.targets && a.targets[1] > 1 ? `Up to ${a.targets[1]} people` : 'One person',
    cost: a.cost, againAfter: a.cooldownDays ?? 0, availableFrom: a.unlockPeriod ?? 1,
    format: `${FORMATS[a.format ?? ''] ?? 'Decision'}${a.live?.minutes ? ` · ${a.live.minutes} minutes` : ''}${a.live?.turnLimit ? ` · up to ${a.live.turnLimit} turns` : ''}`,
    starts: a.live?.opening === 'participant' ? 'participant' : 'npc',
    goal: a.live?.goal ?? (a.scope === 'team' ? 'Set out the goals for the weeks ahead and hear what the team thinks.' : 'Understand what is behind this person\'s results this week, and agree one next step together.'),
    impact: impactOf(a, styles),
    options: a.options.map(o => ({ key: o.key, label: o.label, style: o.style ?? null, away: o.away ?? 0, fits: effectText(o.effects.m0), misses: effectText(o.effects.m2 ?? o.effects.m1) })),
    decides: a.rule === 'styleOption' ? 'Each option carries one of your lens styles; it is compared with what this person needs this week.' : a.rule === 'training' ? 'Each course carries a style; it is compared with what this person needs this week.' : 'The engine\'s tested rule for this action.',
    scoredOn: skills.slice(0, 4), origin: t.origin
  };
}

/** The author's kind for an engine event: what its card, delivery and target read as. */
export function kindOf(e: Pick<NonNullable<SL['events']>[number], 'card' | 'delivery' | 'target'>): EventDraft['kind'] {
  if (e.delivery === 'sponsorCall' || e.target === 'sponsor') return 'sponsor';
  if (e.card === 'opportunity') return 'opportunity';
  if (e.target === 'team' || e.target?.startsWith('stage:')) return 'impact';
  return 'people';
}

export function eventFrom(e: NonNullable<SL['events']>[number], followUps: ReadonlySet<string> = new Set()): EventDraft {
  const timing: EventDraft['timing'] = e.period !== undefined ? 'fixed' : e.when ? 'condition' : e.window ? 'random' : followUps.has(e.key) ? 'followup' : 'random';
  return {
    key: e.key, title: e.title, kind: kindOf(e), week: e.period ?? null, day: e.subPeriod ?? 1, timing,
    ...(e.window ? { window: { from: e.window.from, to: e.window.to, chance: e.window.probability ?? 100 } } : null),
    ...(e.when ? { condition: { kind: e.when.condition, value: e.when.value ?? 30, weeks: e.when.periods ?? 1 } } : null),
    who: e.target ?? 'team', arrives: e.delivery ?? 'modal', body: e.body.he,
    skill: e.impact[0], morale: e.impact[1], result: e.impact[2], leadFlow: 0,
    respondWith: e.response?.actions ?? [], within: e.response?.within ?? 2, onTime: e.response?.onTime ?? [0, 2, 0],
    ifIgnored: { sponsor: e.response ? (e.escalation?.sponsor ?? false) : false, followUp: e.escalation?.event ?? null }, origin: 'library'
  };
}

/** A blank chat, before the first question. */
export function emptyChat(): Chat {
  return { brief: Brief.parse({}), asked: [], answers: {}, log: [], current: null, recommendation: null, primary: null, secondary: null, clientDimensions: [] };
}

/** The draft from the chat: everything the workspace shows, filled in. */
export function seedDraft(chat: Chat, stage: AuthorDraft['stage'] = 'ready'): AuthorDraft {
  const brief = chat.brief;
  const primary = chat.primary ?? chat.recommendation?.id ?? 'readiness_based';
  const module = buildModule(brief, { primary, secondary: chat.secondary, clientDimensions: chat.clientDimensions }, true);
  const sl = draftStoryline(brief, module);
  const ctx = draftContext(brief);
  const ind = industryOf(brief.industry);
  const seed = hash(`${ctx.company}|${ind.id}`);
  const lens = sl.lens!;
  const styles: DraftStyle[] = lens.styles.map(s => ({ key: s.key, letter: s.letter, name: s.name, short: s.short, description: s.description }));
  const pressure = pressureOf(brief.challenge, sl.stages);
  const pressureName = sl.stages.find(s => s.key === pressure)!.name;
  const input = sl.money.inputPerSubPeriod[0] * 5;
  let flow = input;
  const stages = sl.stages.map(s => {
    const perWeek = Math.round(flow * 10) / 10;
    flow *= s.conversionRatio;
    return { key: s.key, name: s.name, people: sl.members.filter(m => m.homeStage === s.key).length, perWeek, passesOn: Math.round(s.conversionRatio * 100) };
  });
  const skills = (sl.report?.skills ?? []).map(s => ({ key: s.key, name: s.name, reportOnly: !!s.reportOnly }));
  const used = new Set(sl.actions.map(a => a.key));
  const actions = sl.actions.map(a => {
    const t = ENGINE_TEMPLATES.find(x => x.key === a.key) ?? ACTION_TEMPLATES[0];
    // Scored on: the skills the drafted report's linkage rates in this action (D128), else the first two.
    const linked = (sl.report?.linkage?.[a.key] ?? []).map(k => skills.find(s => s.key === k)?.name).filter((n): n is string => !!n);
    return actionFrom(a, { key: a.key, name: t.name, description: t.description, group: t.group, core: t.inNew === 'core', enabled: t.inNew !== 'off', template: a.key, origin: 'library' }, styles, linked.length ? linked : skills.filter(s => !s.reportOnly).map(s => s.name).slice(0, 2));
  });
  const team = sl.members.map((m, i) => character(m, i, sl, seed));
  const intro = sl.intro!;
  const words = { company: ctx.company, product: ctx.product, work: ind.work, customers: ind.customers };
  const draft: AuthorDraft = {
    v: 1, stage, title: `Leading the ${pressureName} Team`, savedAt: null,
    chat,
    brief: {
      participants: brief.roleLevel ?? 'First time managers', industry: brief.industry ?? ind.label, client: brief.client ?? '', challenge: brief.challenge ?? '',
      purpose: 'development', run: brief.duration ?? 'standard', language: brief.language ?? REGIONS.find(r => r.id === (brief.region ?? 'global'))!.label,
      conversationBy: 'both', tones: [TONE_LABELS[brief.tone ?? 'professional']], documents: brief.documents.map(d => ({ name: d.name, use: d.text ? 'Read for the brief' : 'Kept for the server to read' })),
      minutesPerWeek: DURATION_MODES[brief.duration ?? 'standard'].weeks === 4 ? 8 : 9, targetSkills: '', saveAndResume: true,
      stakeholders: structuredClone(brief.stakeholders ?? []), objectives: [...(brief.objectives ?? [])], dilemmas: structuredClone(brief.dilemmas ?? [])
    },
    story: {
      company: { name: ctx.company, hq: HQ[brief.region ?? 'global'], about: `${ctx.company} offers ${ctx.product}, ${ind.productLine}, to ${ind.customers} across the region.`, team: `${pressureName} and the stages around it`, office: 'Glass office, city view', logo: ctx.company.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase() },
      product: { name: ctx.product, dealValue: null, oneLine: `${ctx.product}: ${ind.productLine}.`, points: [`Built for ${words.customers} who need it to work first time`, 'Support that answers within four hours', `Pricing that scales with each ${words.work}`], view: 'none' },
      market: { customers: ind.customers, rivals: [{ name: ctx.rival, angle: 'Competes on service and reach' }] },
      sponsor: { name: sl.sponsor.name, title: sl.sponsor.title, voice: 'Warm, measured' },
      screens: [
        { key: 'welcome', title: 'Welcome letter', body: intro.welcome.join('\n\n') },
        { key: 'product', title: 'About the product', body: intro.product.join('\n\n') },
        { key: 'targets', title: 'Your targets', body: intro.targets.join('\n\n') },
        { key: 'team', title: 'Meet your team', body: `You lead ${team.length} people across ${stages.length} stages. Open each profile to see what they need from you.` }
      ]
    },
    process: { stages, pressure, revenue: sl.money.target, weeks: sl.time.period.count, daysPerWeek: 5, pacing: 'balanced' },
    team,
    lens: { id: lens.id, title: lens.title, secondary: lens.secondary?.id ?? null, styles, library: structuredClone(styles), needs: structuredClone(lens.needs), fit: structuredClone(lens.fit) as AuthorDraft['lens']['fit'] },
    actions: actions.filter(a => used.has(a.key)),
    events: (sl.events ?? []).map(e => eventFrom(e, new Set((sl.events ?? []).flatMap(x => (x.escalation?.event ? [x.escalation.event] : []))))),
    scoring: {
      skills,
      samples: SAMPLES.map((s, i) => ({ id: `s${i + 1}`, with: team.find(m => m.stage === pressure)?.first ?? team[0].first, answer: s.answer, scored: s.scored, call: null })),
      framework: null, levels: (sl.report?.scale ?? DEFAULT_SCALE).map(l => l.name), reportSections: null
    },
    brand: { from: 'knolskape', name: ctx.company, logo: '', main: '#249DFF', second: '#43D6E8', font: 'Manrope', look: 'dark', preview: 'board' },
    publish: { cohort: '', notes: '', version: 0, played: false, skipTest: false },
    marks: {},
    suggestions: [],
    calibration: null
  };
  draft.marks = initialMarks(draft, chat);
  draft.suggestions = initialSuggestions(draft);
  return AuthorDraft.parse(draft);
}

/** Every field Kora filled is `ai`; what came from the author's answers is `you`. */
function initialMarks(d: AuthorDraft, chat: Chat): Record<string, Mark> {
  const m: Record<string, Mark> = {};
  for (const p of fieldPaths(d)) m[p] = 'ai';
  for (const id of chat.asked) for (const p of FROM_ANSWER[id] ?? []) if (chat.answers[id] && !(id === 'client' && !chat.brief.client)) m[p] = 'you';
  m['brief.purpose'] = 'you';
  m['lens.id'] = 'you';
  return m;
}

/** The author facing field paths of a draft, for marks and counts. */
export function fieldPaths(d: AuthorDraft): string[] {
  const out = ['brief.participants', 'brief.industry', 'brief.client', 'brief.challenge', 'brief.purpose', 'brief.run', 'brief.language', 'brief.conversationBy', 'brief.tones',
    'story.company.name', 'story.company.hq', 'story.company.about', 'story.company.team', 'story.company.office', 'story.product.name', 'story.product.oneLine', 'story.product.points',
    'story.market.rivals', 'story.sponsor.name', 'story.sponsor.title', 'story.sponsor.voice', 'process.stages', 'process.revenue', 'process.weeks', 'process.pacing', 'lens.id'];
  for (const s of d.story.screens) out.push(`story.screens.${s.key}`);
  for (const c of d.team) for (const f of ['identity', 'voice', 'persona', 'hiddenConcern', 'personality', 'stats']) out.push(`team.${c.id}.${f}`);
  for (const s of d.lens.styles) out.push(`lens.styles.${s.key}`);
  for (const a of d.actions) out.push(`actions.${a.key}`);
  for (const e of d.events) out.push(`events.${e.key}`);
  return out;
}

function initialSuggestions(d: AuthorDraft): AuthorDraft['suggestions'] {
  const out: AuthorDraft['suggestions'] = [];
  const lib = LENS_BY_ID[d.lens.id];
  if (d.story.market.rivals.length < 2) out.push({ id: 'story.rival', tab: 'story', text: 'Add a rival that competes on price? It gives a pricing event a face.', action: 'Add a rival', done: false });
  const letter = d.story.screens.find(s => s.key === 'welcome');
  if (letter && letter.body.split(/\s+/).length > 60) out.push({ id: 'story.shorten', tab: 'story', text: 'Shorten the letter to under 60 words? Participants read it in about 20 seconds.', action: 'Shorten it', done: false });
  const concern = d.team.find(c => c.stage === d.process.pressure && c.hiddenConcern);
  if (concern) out.push({ id: `team.link.${concern.id}`, tab: 'team', text: `Link ${concern.first}'s concern to a pricing event, so a good conversation early pays off later.`, action: 'Use', done: false });
  const weeks = new Set(d.events.map(e => e.week));
  const empty = Array.from({ length: d.process.weeks }, (_, i) => i + 1).filter(w => !weeks.has(w)).pop();
  if (empty) out.push({ id: `events.fill.${empty}`, tab: 'events', text: `Week ${empty} has no event. Move one there for a stronger finish?`, action: 'Move it', done: false });
  if (!d.lens.secondary && lib.worksWith !== d.lens.id) out.push({ id: `scoring.secondary.${lib.worksWith}`, tab: 'scoring', text: `Add a secondary lens, ${LENS_BY_ID[lib.worksWith].title}, for a richer report? It adds report only skills.`, action: 'Add it', done: false });
  out.push({ id: 'brand.second', tab: 'brand', text: 'Use your second color for the report cover too?', action: 'Use it', done: false });
  out.push({ id: 'brief.purpose', tab: 'brief', text: 'Your participants are new in role. Keep the purpose as Development, so the report frames findings as next steps.', action: 'Keep it', done: false });
  return out;
}

/** Tells needs apart for reactions and samples (re-exported for the editor). */
export { NEEDS };
