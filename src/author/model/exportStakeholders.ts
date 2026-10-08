import type { StorylineInput } from '../../engine/config';
import type { AuthorDraft, ClauseDraft, EventDraft, StakeholderDraft, StakeholderEffectDraft } from './draft';
import { KIND_LABEL, TYPE_LABEL } from './stakeholders';

/**
 * Stakeholders as the engine plays them (D163), for `toStoryline`: each stakeholder with their persona, starting
 * relationship and drift, and the interactions switched on, with their consequences; what events and decisions say
 * about stakeholders. Every reference that names a stakeholder, stage, person, variable or skill that is not there is
 * an issue naming it (D128), never dropped silently. Kept apart from export.ts so the rest of the export reads as before.
 */

type SL = StorylineInput;
type ShOut = NonNullable<SL['stakeholders']>[number];
type EffectOut = NonNullable<NonNullable<ShOut['interactions']>[number]['consequences']>['strong'];

export interface StakeholderCtx {
  stakeholders: AuthorDraft['stakeholders'];
  stageKey: Map<string, string>;
  memberIds: Set<string>;
  variables: Map<string, string>;
  weeks: number;
  issues: string[];
}

const clamp30 = (n: number) => Math.max(-30, Math.min(30, Math.round(n)));
const pronounOf = (s: StakeholderDraft): 'he' | 'she' | 'they' =>
  /^\s*he\b/i.test(s.pronouns) ? 'he' : /^\s*she\b/i.test(s.pronouns) ? 'she' : /^\s*they\b/i.test(s.pronouns) ? 'they' : s.gender === 'man' ? 'he' : s.gender === 'woman' ? 'she' : 'they';

/** A draft effect as the engine's, at `k` times its numbers (Adequate is half of good, Harmful half as much again as bad). */
function effectOf(x: StakeholderEffectDraft, k: number, c: StakeholderCtx, say: (s: string) => void, flags = true): EffectOut {
  let who = x.who || 'team';
  if (who.startsWith('stage:')) {
    const st = c.stageKey.get(who.slice(6));
    if (st) who = `stage:${st}`; else { say('lands on a stage that is no longer in the work process. Pick who it lands on.'); who = 'team'; }
  } else if (who !== 'team' && !c.memberIds.has(who)) { say('lands on someone who is no longer on the team. Pick who it lands on.'); who = 'team'; }
  for (const v of Object.keys(x.variables)) if (!c.variables.has(v)) say(`changes ${v}, which is not one of the business variables. Add it in Work process, or pick another.`);
  const variables = Object.fromEntries(Object.entries(x.variables).filter(([v, n]) => c.variables.has(v) && n).map(([v, n]) => [v, Math.round(n * k)]));
  return {
    trust: clamp30(x.trust * k), satisfaction: clamp30(x.satisfaction * k),
    business: { variables, revenue: Math.round(x.revenue * k), sponsor: clamp30(x.sponsor * k), set: flags ? [...x.set] : [] },
    people: x.people.map(v => clamp30(v * k)) as [number, number, number], who,
    ...(x.outcome.trim() ? { outcome: x.outcome.trim() } : null)
  };
}

/** The stakeholders the draft has, as the engine's (D160 to D163). `skillKey` maps a skill's name to its key. */
export function exportStakeholders(d: AuthorDraft, c: StakeholderCtx, skillKey: Map<string, string>): ShOut[] {
  return d.stakeholders.map(s => {
    const name = s.name.trim() || s.key;
    const say = (what: string) => c.issues.push(`Stakeholder "${name}": ${what}`);
    const t = (v: string) => v.trim() || undefined;
    const skills = (names: string[], where: string) => names.flatMap(n => {
      const k = skillKey.get(n.trim().toLowerCase());
      if (!k) { say(`${where} is scored on ${n}, which is not one of the skills in Scoring and report. Pick its skills again.`); return []; }
      return [k];
    });
    const interactions = s.interactions.filter(x => x.enabled).map(x => {
      const label = x.label.trim() || TYPE_LABEL[x.type];
      const at = (w: string) => say(`"${label}" ${w}`);
      if (x.from > c.weeks) at(`opens in week ${x.from}, after the last week (${c.weeks}).`);
      const base = { key: x.type, type: x.type, label, ...(t(x.goal) ? { goal: x.goal.trim() } : null), kind: x.plays, cost: x.cost, from: Math.min(x.from, c.weeks) };
      if (x.plays === 'static') {
        if (x.options.length < 2) at('is a decision with fewer than two options. Add options, or let it play as a conversation.');
        return { ...base, options: x.options.map(o => ({
          key: o.key, label: o.label || o.key, ...(o.detail.trim() ? { detail: o.detail.trim() } : null),
          effect: { ...effectOf(o.effect, 1, c, w => at(`option "${o.label || o.key}" ${w}`)), ...(o.needsTrust ? { needs: { trust: o.needsTrust }, otherwise: { satisfaction: -3, outcome: o.refusal.trim() || `${name.split(' ')[0]} says no: not now.` } } : null) },
          read: o.read.flatMap(r => { const k = skillKey.get(r.skill.trim().toLowerCase()); if (!k) { at(`option "${o.label || o.key}" shows ${r.skill}, which is not one of the skills in Scoring and report. Pick its skills again.`); return []; } return [{ skill: k, band: r.band }]; })
        })) };
      }
      const keys = [...new Set(skills(x.scoredOn, `"${label}"`))];
      return { ...base, ...(keys.length ? { skills: keys.slice(0, 4) } : null), consequences: {
        strong: effectOf(x.good, 1, c, w => at(`when it goes well, ${w}`)), adequate: effectOf(x.good, 0.5, c, () => undefined, false),
        weak: effectOf(x.bad, 1, c, w => at(`when it goes badly, ${w}`)), harmful: effectOf(x.bad, 1.5, c, () => undefined)
      } };
    });
    const notes = [...(t(s.persona) ? [{ label: 'Persona', value: s.persona.trim() }] : [])];
    return {
      key: s.key, name, role: s.role.trim() || KIND_LABEL[s.kind], kind: s.kind, pronoun: pronounOf(s),
      ...(s.photo.startsWith('/') ? { portrait: s.photo } : null),
      ...(t(s.about) ? { about: s.about.trim() } : null),
      ...(t(s.hiddenConcern) ? { hiddenConcern: s.hiddenConcern.trim(), concernLine: s.concernLine.trim() || s.hiddenConcern.trim() } : null),
      npc: {
        ...(t(s.motivatedBy) ? { motivatedBy: s.motivatedBy.trim() } : null), ...(t(s.noTopics) ? { avoid: s.noTopics.trim() } : null),
        speech: { pace: s.voice.pace, warmth: s.voice.warmth, formality: s.voice.formality, replyLength: s.voice.replyLength }, ...(notes.length ? { notes } : null)
      },
      start: { ...s.start }, drift: { trust: 0, satisfaction: -s.drift },
      interactions
    } as ShOut;
  });
}

type EventOut = NonNullable<SL['events']>[number];

/**
 * An event's stakeholder parts (D162, D163): who it comes from, what they ask for by when, and what it does to
 * stakeholders when it plays. `say` adds an issue on the event.
 */
export function eventStakeholder(e: EventDraft, c: StakeholderCtx, say: (s: string) => void): Pick<EventOut, 'stakeholder' | 'request'> & { moves?: Record<string, { trust: number; satisfaction: number }> } {
  const shs = new Map(c.stakeholders.map(s => [s.key, s]));
  const sh = e.stakeholder ? shs.get(e.stakeholder) : undefined;
  if (e.stakeholder && !sh) say('it comes from a stakeholder who is no longer in the simulation. Pick who it comes from, or none.');
  let request: EventOut['request'];
  if (e.request) {
    if (!e.stakeholder) say('it asks for something, but it does not come from a stakeholder. Pick who it comes from.');
    if (e.choice) say('it is a decision and a stakeholder\'s request at once. Make it one or the other.');
    if (e.respondWith.length) say('it is a stakeholder\'s request, answered by answering them: clear "What counts as a response".');
    const r = e.request;
    if (sh && r.kind === 'meeting') {
      const x = sh.interactions.find(i => i.type === r.interaction && i.enabled);
      if (!x) say(`it asks to ${r.interaction ? TYPE_LABEL[r.interaction].toLowerCase() : 'meet'} with ${sh.name || sh.key}, but that way of engaging them is switched off. Switch it on in Team, or pick another.`);
    }
    if (sh) request = { kind: r.kind, ...(r.kind === 'meeting' && r.interaction ? { interaction: r.interaction } : null), within: r.within, onTime: { trust: r.onTime.trust, satisfaction: r.onTime.satisfaction }, ifIgnored: { trust: r.ifIgnored.trust, satisfaction: r.ifIgnored.satisfaction } };
  }
  const moves: Record<string, { trust: number; satisfaction: number }> = {};
  for (const [k, m] of Object.entries(e.moves ?? {})) {
    if (!shs.has(k)) { say(`it moves ${k}, who is no longer a stakeholder. Remove that, or add them back.`); continue; }
    if (m.trust || m.satisfaction) moves[k] = { trust: m.trust, satisfaction: m.satisfaction };
  }
  return { ...(sh ? { stakeholder: sh.key } : null), ...(request ? { request } : null), ...(Object.keys(moves).length ? { moves } : null) };
}

/** A choice option's moves on stakeholders (D163), the ones that still exist; the others are issues. */
export function optionStakeholders(o: { label: string; key: string; stakeholders?: Record<string, { trust: number; satisfaction: number }> }, c: StakeholderCtx, say: (s: string) => void) {
  const out: Record<string, { trust: number; satisfaction: number }> = {};
  for (const [k, m] of Object.entries(o.stakeholders ?? {})) {
    if (!c.stakeholders.some(s => s.key === k)) { say(`its option "${o.label || o.key}" moves ${k}, who is no longer a stakeholder. Remove that, or add them back.`); continue; }
    if (m.trust || m.satisfaction) out[k] = { trust: m.trust, satisfaction: m.satisfaction };
  }
  return Object.keys(out).length ? out : undefined;
}

/** A condition on a stakeholder that no longer exists is an issue, and left out. */
export function clauseHolds(cl: ClauseDraft, c: StakeholderCtx, say: (s: string) => void): boolean {
  if (cl.kind !== 'stakeholder') return true;
  if (c.stakeholders.some(s => s.key === cl.stakeholder)) return true;
  say(`it plays only if ${cl.stakeholder}'s ${cl.measure} is ${cl.op === 'below' ? 'below' : 'at least'} ${cl.value}, but there is no such stakeholder. Pick another, or remove the condition.`);
  return false;
}
