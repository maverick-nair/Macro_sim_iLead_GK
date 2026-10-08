import { Brief } from '../../api/author';
import { parseStoryline, type StorylineInput } from '../../engine/config';
import { NEEDS } from '../../engine/lens';
import { DEFAULT_SCALE } from '../../engine/report/defaults';
import { regionOf } from '../context';
import { guardDraft, type CopyIssue } from '../copyGuard';
import { buildModule } from '../module';
import { capabilityLow, draftStoryline } from '../storyline';
import type { AuthorDraft, EventDraft } from './draft';
import { mapWeek } from './run';
import { kindOf, parseEffect } from './seed';

/**
 * The draft as the engine plays it (D105, D128 to D130). The mechanics are drafted again from the brief and
 * the lens (the mock drafter's calibrated Sales Elevator rules, deterministic), then every author facing
 * field of the draft is laid over them. The principle (D128): every field the author sees reaches the
 * storyline, or is an author note documented as one (`AUTHOR_NOTES` in export.test.ts). Nothing is
 * retargeted or dropped silently: a reference to a person, stage, action or event that no longer exists
 * is an issue naming it, and the result is always checked with the engine's own schema.
 */

type SL = StorylineInput;
type Action = SL['actions'][number];
type GeneralEvent = NonNullable<SL['events']>[number];
type Member = SL['members'][number];

const paragraphs = (s: string, max = 4) => s.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean).slice(0, max);
const pronounOf = (g: AuthorDraft['team'][number]['gender'], pronouns: string): 'he' | 'she' | 'they' =>
  /^\s*he\b/i.test(pronouns) ? 'he' : /^\s*she\b/i.test(pronouns) ? 'she' : /^\s*they\b/i.test(pronouns) ? 'they' : g === 'man' ? 'he' : g === 'woman' ? 'she' : 'they';
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Pacing (D129). Balanced is the calibrated draft as it is. Forgiving and demanding move four levers the
 * engine already has: new leads each day (so the target is easier or harder to reach), how hard the
 * events' negative effects land, how much morale drifts in a week nobody acts with someone, and what the
 * sponsor's confidence loses when an expected response never comes.
 */
export const PACING = {
  forgiving: { leads: 1.1, harm: 0.75, drift: 2, escalation: -5 },
  balanced: { leads: 1, harm: 1, drift: 3, escalation: -10 },
  demanding: { leads: 0.9, harm: 1.25, drift: 4, escalation: -15 }
} as const;

/** The days a drafted week has (Sales Elevator's): leads per day scale so a week's leads stay the same (D129). */
const BASE_DAYS = 5;

/** The brief the mechanics are drafted from: the chat's, with the workspace's answers over it. */
function briefOf(d: AuthorDraft): Brief {
  return Brief.parse({
    ...d.chat.brief,
    roleLevel: d.brief.participants || d.chat.brief.roleLevel,
    industry: d.brief.industry || d.chat.brief.industry,
    challenge: d.brief.challenge || d.chat.brief.challenge,
    client: d.story.company.name || null,
    teamSize: clamp(d.team.length, 6, 12),
    process: d.process.stages.map(s => s.name || s.key),
    duration: d.brief.run
  });
}

function overlayAction(base: Action, a: AuthorDraft['actions'][number], styleKeys: Set<string>): Action {
  const live = a.plays !== 'static';
  const format = live ? (base.format ?? 'roleplay') : undefined;
  const options = a.options.length
    ? a.options.map((o, i) => {
      const src = base.options[i] ?? base.options[base.options.length - 1];
      const style = o.style && styleKeys.has(o.style) ? o.style : src.style && styleKeys.has(src.style) ? src.style : undefined;
      // A conversation's effects come from its impact by style; a static decision's from its options' own cells.
      const imp = live && style ? a.impact[style] : undefined;
      const fit = parseEffect(imp?.fit ?? o.fits), close = parseEffect(imp?.close ?? ''), wrong = parseEffect(imp?.wrong ?? o.misses);
      return {
        ...src, key: /^[a-z][a-z0-9_]*$/.test(o.key) ? o.key : `${src.key}_${i + 1}`, label: o.label || src.label, ...(style ? { style } : { style: undefined }), away: o.away,
        effects: { m0: fit ?? src.effects.m0, m1: close ?? src.effects.m1, ...(wrong ?? src.effects.m2 ? { m2: wrong ?? src.effects.m2 } : null) }
      };
    })
    : base.options;
  return {
    ...base, key: a.key, name: a.name || base.name, description: a.description || base.description,
    kind: a.plays, format, cost: a.cost, cooldownDays: a.againAfter, unlockPeriod: a.availableFrom,
    live: { ...(base.live ?? {}), goal: a.goal || base.live?.goal, opening: a.starts },
    options: options as Action['options']
  };
}

const CARD: Record<EventDraft['kind'], GeneralEvent['card']> = { impact: 'impact', opportunity: 'opportunity', people: 'signal', sponsor: 'crisis' };
const MESSAGES = new Set<EventDraft['arrives']>(['chat', 'email', 'sponsorCall']);

interface EventCtx {
  weeks: number;
  days: number;
  /** The weeks the drafted base events were placed on, for a random window from a draft saved before D128. */
  baseWeeks: number;
  harm: number;
  memberIds: Set<string>;
  stageKey: Map<string, string>;
  actionKeys: Set<string>;
  actionNames: Map<string, string>;
  eventKeys: Set<string>;
  followed: Set<string>;
  issues: string[];
}

/** One authored event as the engine's event. Every reference it cannot resolve is an issue naming it. */
function exportEvent(base: GeneralEvent | undefined, e: EventDraft, c: EventCtx): { event: GeneralEvent; dangling: boolean } {
  const say = (s: string) => c.issues.push(`Event "${e.title || e.key}": ${s}`);
  let dangling = false;
  let target = e.who;
  if (e.who.startsWith('stage:')) {
    const k = c.stageKey.get(e.who.slice(6));
    if (k) target = `stage:${k}`;
    else { say('it hits a stage that is no longer in the work process. Pick who it hits.'); dangling = true; }
  } else if (!['team', 'member', 'sponsor'].includes(e.who) && !c.memberIds.has(e.who)) {
    say('it is about a person who is no longer on the team. Pick who it hits, or remove the event.');
    dangling = true;
  }
  if ((e.arrives === 'chat' || e.arrives === 'email') && (e.who === 'team' || e.who.startsWith('stage:'))) {
    say(`it arrives as ${e.arrives === 'chat' ? 'a chat message' : 'an email'}, which comes from one person, but it hits ${e.who === 'team' ? 'the whole team' : 'a whole stage'}. Pick one person, or another way it arrives.`);
    dangling = true;
  }

  let timing: Pick<GeneralEvent, 'period' | 'subPeriod' | 'window' | 'when'>;
  if (e.timing === 'fixed') {
    if (e.week === null) say('it is on a fixed week but has none. Pick its week.');
    else if (e.week > c.weeks) say(`it is in week ${e.week}, after the last week (${c.weeks}).`);
    if (e.day > c.days) say(`it is on day ${e.day}, but a week has ${c.days} days.`);
    timing = { period: e.week ?? 1, subPeriod: e.day, window: undefined, when: undefined };
  } else if (e.timing === 'random') {
    const w = e.window
      ?? (base?.window ? { from: mapWeek(base.window.from, c.baseWeeks, c.weeks), to: mapWeek(base.window.to, c.baseWeeks, c.weeks), chance: base.window.probability ?? 100 } : { from: 1, to: c.weeks, chance: 100 });
    if (w.from > w.to) say(`its weeks run from ${w.from} to ${w.to}. The first week must come first.`);
    if (w.to > c.weeks) say(`its weeks run to week ${w.to}, after the last week (${c.weeks}).`);
    timing = { period: undefined, subPeriod: 1, window: { from: w.from, to: w.to, probability: w.chance }, when: undefined };
  } else if (e.timing === 'condition') {
    const when = e.condition ? { condition: e.condition.kind, value: e.condition.value, periods: e.condition.weeks } : base?.when;
    if (!when) say('it happens when something happens, but no condition is set. Pick one.');
    timing = { period: undefined, subPeriod: 1, window: undefined, when: when ?? { condition: 'teamMoraleBelow', value: 30, periods: 1 } };
  } else {
    if (!c.followed.has(e.key)) say('it only happens when another event is ignored, but no event leads to it. Pick it as a follow up in another event, or give it a week.');
    timing = { period: undefined, subPeriod: 1, window: undefined, when: undefined };
  }
  if (e.leadFlow !== 0 && e.timing !== 'fixed') say('it changes the lead flow, which needs a fixed week. Give it a week, or set lead flow to 0.');

  // Expected response and what happens if it is ignored (D128).
  const messages = MESSAGES.has(e.arrives);
  for (const k of e.respondWith) {
    if (k === 'reply') { if (!messages) say('it counts a reply as the response, but it arrives as a card, so there is nothing to reply to.'); }
    else if (!c.actionKeys.has(k)) say(`it counts ${c.actionNames.get(k) ?? k} as the response, but that action is not in this simulation. Switch it on, or pick another.`);
  }
  const response = e.respondWith.length ? { actions: e.respondWith, within: e.within, onTime: e.onTime } : undefined;
  const follow = e.ifIgnored.followUp;
  if ((e.ifIgnored.sponsor || follow) && !response) say('it says what happens if it is ignored, but no response is expected. Pick the actions that answer it.');
  if (follow && !c.eventKeys.has(follow)) say(`if ignored it leads to an event that no longer exists (${follow}). Pick another, or none.`);
  if (follow === e.key) say('if ignored it leads to itself. Pick another event.');
  const escalation = response && (e.ifIgnored.sponsor || follow) ? { sponsor: e.ifIgnored.sponsor, ...(follow ? { event: follow } : null) } : undefined;

  const harm = (v: number) => (v < 0 ? Math.round(v * c.harm) : v);
  const card = base && kindOf(base) === e.kind ? base.card : CARD[e.kind];
  const event = {
    ...(base ?? {}), key: e.key, title: e.title || base?.title || 'Event', body: { he: e.body, she: e.body }, card,
    ...timing, impact: [harm(e.skill), harm(e.morale), harm(e.result)], target, delivery: e.arrives,
    response, escalation
  } as GeneralEvent;
  return { event, dangling };
}

/** The author's persona details the AI character reads (D130), or undefined when there are none. */
function npcOf(c: AuthorDraft['team'][number], styleKeys: Set<string>): Member['npc'] {
  const t = (s: string) => s.trim() || undefined;
  const reactions = Object.fromEntries(Object.entries(c.reactions).filter(([k, v]) => styleKeys.has(k) && v.trim()).map(([k, v]) => [k, v.trim()]));
  // Facts the participant is not shown still shape how the person talks: the AI character knows them.
  const hidden = ([['experience', 'Experience', c.experience], ['tenure', 'Time on this team', c.tenure], ['previousCompany', 'Previous company', c.previousCompany], ['careerGoal', 'Career goal', c.careerGoal]] as const)
    .filter(([k, , v]) => !c.shown[k] && v.trim()).map(([, label, v]) => ({ label, value: v.trim() }));
  const notes = [...hidden, ...c.custom.filter(f => f.label.trim() && f.value.trim()).map(f => ({ label: f.label.trim(), value: f.value.trim() }))];
  return {
    ...(t(c.ageRange) ? { age: t(c.ageRange) } : null),
    ...(t(c.motivatedBy) ? { motivatedBy: t(c.motivatedBy) } : null),
    ...(t(c.noTopics) ? { avoid: t(c.noTopics) } : null),
    ...(Object.keys(reactions).length ? { reactions } : null),
    speech: { ...(t(c.voice.language) ? { language: t(c.voice.language) } : null), ...(t(c.voice.accent) ? { accent: t(c.voice.accent) } : null), pace: c.voice.pace, warmth: c.voice.warmth, formality: c.voice.formality, replyLength: c.voice.replyLength },
    ...(notes.length ? { notes } : null)
  };
}

/** The Story and world tab for the AI characters (D130): only what the author filled in. */
function worldOf(d: AuthorDraft): SL['world'] {
  const t = (s: string) => s.trim() || undefined;
  const st = d.story;
  const points = st.product.points.map(x => x.trim()).filter(Boolean);
  const rivals = st.market.rivals.filter(r => r.name.trim()).map(r => ({ name: r.name.trim(), ...(t(r.angle) ? { angle: t(r.angle) } : null) }));
  const product = { ...(t(st.product.name) ? { name: t(st.product.name) } : null), ...(t(st.product.oneLine) ? { line: t(st.product.oneLine) } : null), ...(points.length ? { points } : null) };
  return {
    ...(t(st.company.about) ? { about: t(st.company.about) } : null),
    ...(t(st.company.hq) ? { headquarters: t(st.company.hq) } : null),
    ...(t(st.company.team) ? { team: t(st.company.team) } : null),
    ...(Object.keys(product).length ? { product } : null),
    ...(t(st.market.customers) ? { customers: t(st.market.customers) } : null),
    ...(rivals.length ? { rivals } : null),
    ...(t(st.sponsor.voice) ? { sponsorVoice: t(st.sponsor.voice) } : null)
  };
}

/** Lower bounds for a rating scale of `n` levels: the default scale's for five, else even steps. */
function scaleMins(n: number): number[] {
  return n === DEFAULT_SCALE.length ? DEFAULT_SCALE.map(l => l.min) : Array.from({ length: n }, (_, i) => Math.round((i * 100) / n));
}
/** Anchors resampled to `n` levels, lowest and highest kept. */
const resample = <T,>(list: T[], n: number): T[] => Array.from({ length: n }, (_, i) => list[n === 1 ? 0 : Math.round((i * (list.length - 1)) / (n - 1))]);

export interface Exported { storyline: SL; issues: string[]; copy: CopyIssue[] }

/** The draft as a StorylineConfig, with the issues it has (the schema's and the references') and the copy guard's. */
export function toStoryline(d: AuthorDraft): Exported {
  const issues: string[] = [];
  const brief = briefOf(d);
  const module = buildModule(brief, { primary: d.lens.id, secondary: d.lens.secondary, clientDimensions: d.chat.clientDimensions }, true);
  const base = draftStoryline(brief, module);
  const stageKey = new Map(d.process.stages.map((s, i) => [s.key, base.stages[i]?.key ?? s.key]));
  const styleKeys = new Set(d.lens.styles.map(s => s.key));
  const weeks = d.process.weeks, days = d.process.daysPerWeek;
  const pace = PACING[d.process.pacing];

  // Lens: the author's styles (renamed, a fifth added) and fit; the report names follow them.
  const lens = { ...base.lens!, styles: d.lens.styles.map(s => ({ ...s, letter: s.letter || s.name.charAt(0).toUpperCase() })), fit: structuredClone(d.lens.fit), needs: structuredClone(d.lens.needs) };
  for (const n of NEEDS) for (const k of styleKeys) lens.fit[n][k] ??= 1;

  // Team: by position over the drafted members, so each keeps calibrated per stage values.
  const members = d.team.map((c, i) => {
    const src = base.members[i % base.members.length];
    const who = [c.first, c.last].filter(Boolean).join(' ') || c.id;
    const home = stageKey.get(c.stage);
    if (!home) issues.push(`${who} is in a stage that is no longer in the work process. Pick their stage in Team.`);
    const homeKey = home ?? base.stages[0].key;
    const byStage = Object.fromEntries(base.stages.map(s => [s.key, { ...(src.byStage[s.key] ?? src.start) }]));
    byStage[homeKey] = { skill: c.stats.skill, morale: c.stats.morale, result: c.stats.result };
    // Best stage (D128): the stage where swap and assess show this person at their strongest.
    if (c.bestStage) {
      const best = stageKey.get(c.bestStage);
      if (!best) issues.push(`${who}'s best stage is no longer in the work process. Pick another in Team, or none.`);
      else if (best !== homeKey) {
        const b = byStage[best];
        byStage[best] = { skill: clamp(Math.max(b.skill, c.stats.skill + 10), 0, 100), morale: c.stats.morale, result: clamp(Math.max(b.result, c.stats.result + 10), 0, 100) };
      }
    }
    return {
      ...src, id: c.id, name: [c.first, c.last].filter(Boolean).join(' ') || src.name, title: c.title || src.title, pronoun: pronounOf(c.gender, c.pronouns), homeStage: homeKey,
      start: { ...c.stats }, byStage,
      profile: {
        ...src.profile, previous: c.shown.previousCompany ? c.previousCompany : '', tenure: c.shown.tenure ? c.tenure : '', experience: c.shown.experience ? c.experience : '',
        remarks: c.persona || src.profile.remarks,
        relations: c.relationships.map(r => `${r.kind} ${d.team.find(o => o.id === r.with)?.first ?? r.with}`.trim()).join('; '),
        ...(c.commStyles.length ? { attitude: c.commStyles.join(', ') } : null)
      },
      ...(c.hiddenConcern ? { hiddenConcern: c.hiddenConcern, concernLine: c.concernLine || src.concernLine || c.hiddenConcern } : { hiddenConcern: undefined, concernLine: undefined }),
      ...(c.shown.careerGoal && c.careerGoal ? { careerGoal: c.careerGoal } : { careerGoal: undefined }),
      portrait: c.photo.startsWith('/') ? c.photo : src.portrait,
      voice: c.voice.id,
      npc: npcOf(c, styleKeys)
    };
  });
  const memberIds = new Set(members.map(m => m.id));
  const perStage = new Map<string, number>();
  for (const m of members) perStage.set(m.homeStage, (perStage.get(m.homeStage) ?? 0) + 1);

  // Actions: core and switched on ones, each over its engine template.
  const templates = new Map(base.actions.map(a => [a.key, a]));
  const actions = d.actions.filter(a => a.core || a.enabled).map(a => overlayAction(templates.get(a.template) ?? templates.get('f2f')!, a, styleKeys));
  const actionKeys = new Set(actions.map(a => a.key));
  for (const a of actions) if (a.prerequisite && !actionKeys.has(a.prerequisite)) delete a.prerequisite;

  // Events (D128): timing, response and escalation as authored; references checked, never retargeted.
  const baseEvents = new Map((base.events ?? []).map(e => [e.key, e]));
  const ctx: EventCtx = {
    weeks, days, baseWeeks: base.time.period.count, harm: pace.harm, memberIds, stageKey,
    actionKeys, actionNames: new Map(d.actions.map(a => [a.key, a.name])), eventKeys: new Set(d.events.map(e => e.key)),
    followed: new Set(d.events.flatMap(e => (e.ifIgnored.followUp ? [e.ifIgnored.followUp] : []))), issues
  };
  const exported = d.events.map(e => exportEvent(baseEvents.get(e.key), e, ctx));
  const events = exported.map(x => x.event);
  const suppressed = new Set(exported.flatMap((x, i) => (x.dangling ? [`events.${i}.target`, `events.${i}.delivery`] : [])));

  // Leads (D129): the drafted leads per day, scaled by pacing and the days in a week, and each week by
  // the lead flow of the fixed events in it.
  const flow = Array.from({ length: weeks }, () => 1);
  for (const e of d.events) if (e.timing === 'fixed' && e.week && e.week <= weeks && e.leadFlow) flow[e.week - 1] *= Math.max(0, 1 + e.leadFlow / 100);
  const inputs = base.money.inputPerSubPeriod;
  const scale = pace.leads * (BASE_DAYS / days);
  const inputPerSubPeriod = scale === 1 && flow.every(f => f === 1) ? inputs : flow.map((f, i) => round2(inputs[Math.min(i, inputs.length - 1)] * scale * f));

  const screen = (key: string) => d.story.screens.find(s => s.key === key)?.body ?? '';
  const intro = {
    welcome: paragraphs(screen('welcome')).length ? paragraphs(screen('welcome')) : base.intro!.welcome,
    product: paragraphs(screen('product')).length ? paragraphs(screen('product')) : base.intro!.product,
    targets: paragraphs(screen('targets')).length ? paragraphs(screen('targets')) : base.intro!.targets
  };

  // Report: skills, the rating scale, the sections and which skills each action rates (D128).
  const report = { ...base.report! };
  report.narratives = { ...report.narratives!, capability: { ...report.narratives!.capability, low: capabilityLow(lens.styles.map(s => s.name)) } };
  const framework = d.scoring.framework?.confirmed
    ? d.scoring.framework.rows.filter(r => r.include && r.behaviors.trim()).map(r => ({ key: r.skill.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'skill', name: r.skill, reportOnly: false, anchors: ['Little evidence of it.', 'Some evidence, mostly when prompted.', 'Clear evidence in most conversations.', 'Consistent evidence, even under pressure.', `Strong evidence in every conversation: ${r.behaviors.split(';')[0].trim().toLowerCase()}.`] }))
    : null;
  if (framework && framework.length >= 2) {
    const keys = framework.map(s => s.key);
    report.skills = framework;
    report.linkage = Object.fromEntries(Object.keys(report.linkage ?? {}).map((k, i) => [k, [keys[i % keys.length], keys[(i + 1) % keys.length]]]));
    report.development = Object.fromEntries(framework.map(s => [s.key, { practice: `Pick one ${s.name} behavior and plan where you will use it this week.`, onTheJob: `Ask a colleague to watch for one ${s.name} behavior and tell you what they saw.` }]));
  }
  const levels = d.scoring.levels.map(l => l.trim());
  if (levels.some(l => !l)) issues.push('Name every level of the rating scale in Scoring and report.');
  const mins = scaleMins(levels.length);
  report.scale = levels.map((name, i) => ({ name: name || `Level ${i + 1}`, min: mins[i] }));
  report.skills = (report.skills ?? []).map(s => ({ ...s, anchors: resample(s.anchors, levels.length) }));
  if (d.scoring.reportSections) report.sections = [...d.scoring.reportSections];
  const skillKey = new Map((report.skills ?? []).map(s => [s.name.trim().toLowerCase(), s.key]));
  const linkage = { ...(report.linkage ?? {}) };
  // A static decision has no conversation to rate, so only live and hybrid actions carry Scored on.
  for (const a of d.actions.filter(x => (x.core || x.enabled) && x.plays !== 'static')) {
    const keys = a.scoredOn.map(n => {
      const k = skillKey.get(n.trim().toLowerCase());
      if (!k) issues.push(`Action "${a.name}" is scored on ${n}, which is not one of the skills in Scoring and report. Pick its skills again.`);
      return k;
    }).filter((k): k is string => !!k);
    if (keys.length > 4) issues.push(`Action "${a.name}" is scored on ${keys.length} skills. Pick at most 4.`);
    if (keys.length) linkage[a.key] = [...new Set(keys)].slice(0, 4);
    else delete linkage[a.key];
  }
  report.linkage = linkage;

  const hasStatic = actions.some(a => a.kind === 'static' && a.scope === 'member');
  const region = regionOf(d.brief.language);
  const balanced = d.process.pacing === 'balanced';
  const storyline: SL = {
    ...base,
    name: d.title || base.name,
    organisation: d.story.company.name || base.organisation,
    world: worldOf(d),
    lens,
    // Language (D128): the participant's number formats and the AI characters' language and region.
    money: { ...base.money, locale: region?.locale ?? base.money.locale, valuePerConversion: d.story.product.dealValue ?? base.money.valuePerConversion, target: d.process.revenue ?? base.money.target, inputPerSubPeriod },
    time: { ...base.time, period: { unit: 'week', count: weeks }, subPeriod: { unit: 'day', perPeriod: days } },
    stages: base.stages.map((s, i) => ({ ...s, name: d.process.stages[i]?.name || s.name, conversionRatio: clamp((d.process.stages[i]?.passesOn ?? s.conversionRatio * 100) / 100, 0.05, 1), ideal: d.process.stages[i]?.people ?? s.ideal })),
    sponsor: { ...base.sponsor, name: d.story.sponsor.name || base.sponsor.name, title: d.story.sponsor.title || base.sponsor.title },
    intro,
    members,
    actions,
    events,
    report,
    purpose: d.brief.purpose,
    maxPerStage: Math.max(2, ...perStage.values()),
    ...(balanced ? null : { drift: { morale: pace.drift, result: 0 }, gamification: { ...(base.gamification ?? {}), sponsor: { ...(base.gamification?.sponsor ?? {}), escalation: pace.escalation } } }),
    ...(hasStatic ? null : { demo: { enabled: false } }),
    calibrated: false
  };
  const parsed = parseStoryline(storyline);
  const schema = parsed.ok ? [] : parsed.issues.filter(i => ![...suppressed].some(p => i.startsWith(`${p}:`)));
  return { storyline, issues: [...issues, ...schema], copy: guardDraft(storyline) };
}
