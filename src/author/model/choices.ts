import type { AuthorDraft, ChoiceOptionDraft, EventDraft } from './draft';

/**
 * Choice events in the draft (D137, D138): the skills their leadership reads name, the flags they set, and which
 * conditions read them. Pure helpers shared by the Events tab, the validator, Kora and the skill changes.
 */

/** The skill names the draft scores on: a confirmed framework's, else the lens's (not report only). */
export function skillNames(d: AuthorDraft): string[] {
  return d.scoring.framework?.confirmed
    ? d.scoring.framework.rows.filter(r => r.include && r.behaviors.trim()).map(r => r.skill)
    : d.scoring.skills.filter(s => !s.reportOnly).map(s => s.name);
}

/**
 * After the skills change (a new lens, a framework confirmed, the lens skills kept), every leadership read that names a
 * skill no longer there takes one of the new skills in turn, as Scored on does. Reads already on a skill stay.
 */
export function remapReads(d: AuthorDraft) {
  const names = skillNames(d);
  if (!names.length) return;
  const known = new Set(names.map(n => n.trim().toLowerCase()));
  let i = 0;
  for (const e of d.events) for (const o of e.choice?.options ?? []) {
    o.read = o.read.map(r => (known.has(r.skill.trim().toLowerCase()) ? r : { ...r, skill: names[i++ % names.length] }));
    o.read = o.read.filter((r, k, arr) => arr.findIndex(x => x.skill === r.skill) === k);
  }
  // Stakeholder interactions (D163): what a conversation is scored on, and a decision's reads, follow the same way.
  for (const s of d.stakeholders ?? []) for (const x of s.interactions) {
    x.scoredOn = [...new Set(x.scoredOn.map(n => (known.has(n.trim().toLowerCase()) ? n : names[i++ % names.length])))];
    for (const o of x.options) {
      o.read = o.read.map(r => (known.has(r.skill.trim().toLowerCase()) ? r : { ...r, skill: names[i++ % names.length] }));
      o.read = o.read.filter((r, k, arr) => arr.findIndex(y => y.skill === r.skill) === k);
    }
  }
}

/** Every flag some choice option sets. */
export const flagsSet = (d: Pick<AuthorDraft, 'events'>) => new Set(d.events.flatMap(e => (e.choice?.options ?? []).flatMap(o => o.set)));

/** An option's consequences, as one comparable value: two options with the same are the same choice twice. */
export const consequenceKey = (o: ChoiceOptionDraft) => JSON.stringify([o.who, o.skill, o.morale, o.result, o.trust, o.revenue, o.sponsor,
  Object.entries(o.variables).filter(([, v]) => v).sort(), [...o.set].sort(), [...o.clear].sort(), o.followUp ? [o.followUp.event, o.followUp.days, o.followUp.weeks] : null]);

/** The events whose conditions test this flag. */
export const testsFlag = (d: Pick<AuthorDraft, 'events'>, flag: string): EventDraft[] => d.events.filter(e => (e.conditions ?? []).some(c => c.kind === 'flag' && c.flag === flag));
