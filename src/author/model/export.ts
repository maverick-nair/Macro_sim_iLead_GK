import { Brief } from '../../api/author';
import { parseStoryline, type StorylineInput } from '../../engine/config';
import { NEEDS } from '../../engine/lens';
import { guardDraft, type CopyIssue } from '../copyGuard';
import { buildModule } from '../module';
import { capabilityLow, draftStoryline } from '../storyline';
import type { AuthorDraft, EventDraft } from './draft';
import { parseEffect } from './seed';

/**
 * The draft as the engine plays it (D105). The mechanics are drafted again from the brief and the lens
 * (the mock drafter's calibrated Sales Elevator rules, deterministic), then every author facing field of
 * the draft is laid over them: names, words, styles, fit, team, stats, actions, events, money and time.
 * Nothing the author wrote is lost, and the result is always checked with the engine's own schema.
 */

type SL = StorylineInput;
type Action = SL['actions'][number];
type GeneralEvent = NonNullable<SL['events']>[number];

const paragraphs = (s: string, max = 4) => s.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean).slice(0, max);
const pronounOf = (g: AuthorDraft['team'][number]['gender'], pronouns: string): 'he' | 'she' | 'they' =>
  /^\s*he\b/i.test(pronouns) ? 'he' : /^\s*she\b/i.test(pronouns) ? 'she' : /^\s*they\b/i.test(pronouns) ? 'they' : g === 'man' ? 'he' : g === 'woman' ? 'she' : 'they';

/** The brief the mechanics are drafted from: the chat's, with the workspace's answers over it. */
function briefOf(d: AuthorDraft): Brief {
  return Brief.parse({
    ...d.chat.brief,
    roleLevel: d.brief.participants || d.chat.brief.roleLevel,
    industry: d.brief.industry || d.chat.brief.industry,
    challenge: d.brief.challenge || d.chat.brief.challenge,
    client: d.story.company.name || null,
    teamSize: Math.min(12, Math.max(6, d.team.length)),
    process: d.process.stages.map(s => s.name || s.key),
    duration: d.brief.run
  });
}

function overlayAction(base: Action, a: AuthorDraft['actions'][number], styleKeys: Set<string>): Action {
  const live = a.plays !== 'static';
  const format = live ? (base.format ?? (a.plays === 'hybrid' ? 'roleplay' : 'roleplay')) : undefined;
  const options = a.options.length
    ? a.options.map((o, i) => {
      const src = base.options[i] ?? base.options[base.options.length - 1];
      const style = o.style && styleKeys.has(o.style) ? o.style : src.style && styleKeys.has(src.style) ? src.style : undefined;
      const imp = style ? a.impact[style] : undefined;
      const fit = parseEffect(imp?.fit ?? o.fits), close = parseEffect(imp?.close ?? ''), wrong = parseEffect(imp?.wrong ?? o.misses);
      return {
        ...src, key: i < base.options.length ? src.key : `${src.key}_${i + 1}`, label: o.label || src.label, ...(style ? { style } : { style: undefined }), away: o.away,
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

function overlayEvent(base: GeneralEvent | undefined, e: EventDraft, weeks: number, memberIds: Set<string>, stageKeys: Set<string>, actionKeys: Set<string>): GeneralEvent {
  const who = e.who === 'team' || e.who === 'member' || e.who === 'sponsor' || (e.who.startsWith('stage:') && stageKeys.has(e.who.slice(6))) || memberIds.has(e.who) ? e.who : 'team';
  const arrives = (e.arrives === 'chat' || e.arrives === 'email') && (who === 'team' || who.startsWith('stage:')) ? 'modal' : e.arrives;
  const timing = e.timing === 'fixed' || !base
    ? { period: Math.min(weeks, e.week ?? 1), subPeriod: Math.min(5, e.day), window: undefined, when: undefined }
    : { period: undefined, subPeriod: e.day, window: base.window ? { ...base.window, to: Math.min(base.window.to, weeks), from: Math.min(base.window.from, weeks) } : undefined, when: base.when };
  const response = base?.response ? { ...base.response, actions: base.response.actions.filter(k => k === 'reply' || actionKeys.has(k)), within: e.within } : undefined;
  return {
    ...(base ?? {}), key: e.key, title: e.title || base?.title || 'Event', body: { he: e.body, she: e.body }, card: CARD[e.kind] ?? base?.card ?? 'impact',
    ...timing, impact: [e.skill, e.morale, e.result], target: who, delivery: arrives,
    ...(response && response.actions.length ? { response } : { response: undefined }),
    ...(e.kind === 'sponsor' && !base ? { delivery: 'sponsorCall', target: 'sponsor' } : null)
  } as GeneralEvent;
}

export interface Exported { storyline: SL; issues: string[]; copy: CopyIssue[] }

/** The draft as a StorylineConfig, with the schema's issues and the copy guard's. */
export function toStoryline(d: AuthorDraft): Exported {
  const brief = briefOf(d);
  const module = buildModule(brief, { primary: d.lens.id, secondary: d.lens.secondary, clientDimensions: d.chat.clientDimensions }, true);
  const base = draftStoryline(brief, module);
  const stageKey = new Map(d.process.stages.map((s, i) => [s.key, base.stages[i]?.key ?? s.key]));
  const stageKeys = new Set(base.stages.map(s => s.key));
  const styleKeys = new Set(d.lens.styles.map(s => s.key));

  // Lens: the author's styles (renamed, a fifth added) and fit; the report names follow them.
  const lens = { ...base.lens!, styles: d.lens.styles.map(s => ({ ...s, letter: s.letter || s.name.charAt(0).toUpperCase() })), fit: structuredClone(d.lens.fit), needs: structuredClone(d.lens.needs) };
  for (const n of NEEDS) for (const k of styleKeys) lens.fit[n][k] ??= 1;

  // Team: by position over the drafted members, so each keeps calibrated per stage values.
  const members = d.team.map((c, i) => {
    const src = base.members[i % base.members.length];
    const home = stageKey.get(c.stage) ?? base.stages[0].key;
    const byStage = Object.fromEntries(base.stages.map(s => [s.key, { ...(src.byStage[s.key] ?? src.start) }]));
    byStage[home] = { skill: c.stats.skill, morale: c.stats.morale, result: c.stats.result };
    const name = [c.first, c.last].filter(Boolean).join(' ') || src.name;
    return {
      ...src, id: c.id, name, title: c.title || src.title, pronoun: pronounOf(c.gender, c.pronouns), homeStage: home,
      start: { ...c.stats }, byStage,
      profile: {
        ...src.profile, previous: c.shown.previousCompany ? c.previousCompany : '', tenure: c.shown.tenure ? c.tenure : '', experience: c.shown.experience ? c.experience : '',
        remarks: c.persona || src.profile.remarks,
        relations: c.relationships.map(r => `${r.kind} ${d.team.find(o => o.id === r.with)?.first ?? r.with}`.trim()).join('; '),
        ...(c.commStyles.length ? { attitude: c.commStyles.join(', ') } : null)
      },
      ...(c.hiddenConcern ? { hiddenConcern: c.hiddenConcern, concernLine: c.concernLine || src.concernLine || c.hiddenConcern } : { hiddenConcern: undefined, concernLine: undefined }),
      ...(c.shown.careerGoal && c.careerGoal ? { careerGoal: c.careerGoal } : null),
      portrait: c.photo.startsWith('/') ? c.photo : src.portrait,
      voice: c.voice.id
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

  const baseEvents = new Map((base.events ?? []).map(e => [e.key, e]));
  const events = d.events.map(e => overlayEvent(baseEvents.get(e.key), e, d.process.weeks, memberIds, stageKeys, actionKeys));
  const eventKeys = new Set(events.map(e => e.key));
  for (const e of events) if (e.escalation?.event && !eventKeys.has(e.escalation.event)) e.escalation = { ...e.escalation, event: undefined };

  const screen = (key: string) => d.story.screens.find(s => s.key === key)?.body ?? '';
  const intro = {
    welcome: paragraphs(screen('welcome')).length ? paragraphs(screen('welcome')) : base.intro!.welcome,
    product: paragraphs(screen('product')).length ? paragraphs(screen('product')) : base.intro!.product,
    targets: paragraphs(screen('targets')).length ? paragraphs(screen('targets')) : base.intro!.targets
  };

  const skills = d.scoring.framework?.confirmed
    ? d.scoring.framework.rows.filter(r => r.include && r.behaviors.trim()).map(r => ({ key: r.skill.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'skill', name: r.skill, reportOnly: false, anchors: ['Little evidence of it.', 'Some evidence, mostly when prompted.', 'Clear evidence in most conversations.', 'Consistent evidence, even under pressure.', `Strong evidence in every conversation: ${r.behaviors.split(';')[0].trim().toLowerCase()}.`] }))
    : null;
  const report = { ...base.report! };
  report.narratives = { ...report.narratives!, capability: { ...report.narratives!.capability, low: capabilityLow(lens.styles.map(s => s.name)) } };
  if (skills && skills.length >= 2) {
    const keys = skills.map(s => s.key);
    report.skills = skills;
    report.linkage = Object.fromEntries(Object.keys(report.linkage ?? {}).map((k, i) => [k, [keys[i % keys.length], keys[(i + 1) % keys.length]]]));
    report.development = Object.fromEntries(skills.map(s => [s.key, { practice: `Pick one ${s.name} behavior and plan where you will use it this week.`, onTheJob: `Ask a colleague to watch for one ${s.name} behavior and tell you what they saw.` }]));
  }

  const hasStatic = actions.some(a => a.kind === 'static' && a.scope === 'member');
  const storyline: SL = {
    ...base,
    name: d.title || base.name,
    organisation: d.story.company.name || base.organisation,
    lens,
    money: { ...base.money, valuePerConversion: d.story.product.dealValue ?? base.money.valuePerConversion, target: d.process.revenue ?? base.money.target },
    time: { ...base.time, period: { unit: 'week', count: d.process.weeks } },
    stages: base.stages.map((s, i) => ({ ...s, name: d.process.stages[i]?.name || s.name, conversionRatio: Math.min(1, Math.max(0.05, (d.process.stages[i]?.passesOn ?? s.conversionRatio * 100) / 100)), ideal: d.process.stages[i]?.people ?? s.ideal })),
    sponsor: { ...base.sponsor, name: d.story.sponsor.name || base.sponsor.name, title: d.story.sponsor.title || base.sponsor.title },
    intro,
    members,
    actions,
    events,
    report,
    purpose: d.brief.purpose,
    maxPerStage: Math.max(2, ...perStage.values()),
    ...(hasStatic ? null : { demo: { enabled: false } }),
    calibrated: false
  };
  const parsed = parseStoryline(storyline);
  return { storyline, issues: parsed.ok ? [] : parsed.issues, copy: guardDraft(storyline) };
}
