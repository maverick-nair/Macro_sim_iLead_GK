import type { Purpose } from '../config';
import { msg, type Copy } from '../copy';
import type { DriverItem } from './narrative';

/**
 * The report's first page (D235): what a manager reads in five minutes. Three findings, three things to do
 * on Monday (assessment: the development needs, for the assessor) and the two moments that mattered most.
 * Chosen from what the report already computes; nothing here judges the run again.
 */

export type FindingTone = 'positive' | 'negative' | 'neutral';
export interface Finding { key: string; tone: FindingTone; text: Copy }
export interface BriefAction { key: string; text: Copy; skill: string | null }

export interface FindingInput {
  purpose: Purpose;
  /** What held the overall level or the verdict under what the words reached (D168, D169), or null. */
  held: Copy | null;
  /** "What drove your results" (D145), largest first. */
  drivers: DriverItem[];
  /** The primary lens's rated skills, best first. */
  rated: Array<{ name: string; level: string }>;
  /** The business outcome line, and the share of target reached in percent. */
  business: { text: Copy; share: number };
}

/** The strongest and the weakest rated skill in one line, or null without a rated skill. */
function skillsFinding(x: FindingInput): Finding | null {
  const best = x.rated[0], low = x.rated.length > 1 ? x.rated[x.rated.length - 1] : null;
  if (!best) return null;
  return { key: 'skills', tone: 'neutral', text: msg('engine.report.brief.skills', { purpose: x.purpose, both: low ? 'yes' : 'no', best: best.name, bestLevel: best.level, low: low?.name ?? '', lowLevel: low?.level ?? '' }) };
}

/**
 * Three findings: what decided the level (what held it down, else the business outcome), the driver that
 * moved the most, then the strongest and weakest skill. Without a rated skill, the largest driver of the
 * other tone, so the page is not one sided. Short of three, the rest fill in that order.
 */
export function pickFindings(x: FindingInput): Finding[] {
  const out: Finding[] = [];
  const add = (f: Finding | null | undefined) => { if (f && out.length < 3 && !out.some(o => o.key === f.key)) out.push(f); };
  const business: Finding = { key: 'business', tone: x.business.share >= 100 ? 'positive' : x.business.share < 60 ? 'negative' : 'neutral', text: x.business.text };
  const drivers: Finding[] = x.drivers.map(d => ({ key: `driver:${d.key}`, tone: d.tone, text: d.text }));
  const skills = skillsFinding(x);
  add(x.held ? { key: 'held', tone: 'negative', text: x.held } : business);
  add(drivers[0]);
  add(skills ?? drivers.find(d => d.tone !== drivers[0].tone));
  for (const f of [business, skills, ...drivers]) add(f);
  return out;
}

export interface ActionInput {
  purpose: Purpose;
  /** The run's own takeaway about one person (who to start with, or what to repeat), or null. */
  person: Copy | null;
  /** The plan's skills, lowest rated first, with what to do on the job. */
  plan: Array<{ skill: string; name: string; onTheJob: Copy }>;
  /** Practical takeaways, to fill when the plan is short. */
  fallback: Copy[];
  /** Assessment: the development needs, lowest level first. */
  needs: Array<{ key: string; name: string; level: string | null; bar: string }>;
}

/**
 * Three things to do on Monday: the takeaway about a person in this run, then the plan's on the job actions,
 * then the practical takeaways. An assessment report gives no next step to the participant (D75): it lists
 * up to three development needs against the bar, for the assessor, and none when nothing is below it.
 */
export function pickActions(x: ActionInput): BriefAction[] {
  if (x.purpose === 'assessment') {
    return x.needs.slice(0, 3).map(n => ({ key: `need:${n.key}`, skill: n.name, text: msg('engine.report.brief.need', { rated: n.level ? 'yes' : 'no', level: n.level ?? '', bar: n.bar }) }));
  }
  const out: BriefAction[] = [];
  const add = (a: BriefAction) => { if (a.text !== '' && !out.some(o => o.key === a.key || (typeof a.text === 'string' && o.text === a.text))) out.push(a); };
  if (x.person) add({ key: 'person', text: x.person, skill: null });
  for (const p of x.plan) add({ key: `plan:${p.skill}`, text: p.onTheJob, skill: p.name });
  x.fallback.forEach((text, i) => add({ key: `takeaway:${i}`, text, skill: null }));
  return out.slice(0, 3);
}

export interface MomentCandidate { kind: 'best' | 'revisit'; weight: number; said: boolean }

/**
 * The two moments that mattered most, as indices in the report's order: the weightiest moment with words to
 * replay (one without words only when no moment has any), then the weightiest of the other kind with words
 * as well, so one worth repeating sits beside one worth another look; else the next weightiest.
 */
export function pickMoments(moments: MomentCandidate[]): number[] {
  const ranked = moments.map((_, i) => i).sort((a, b) => Number(moments[b].said) - Number(moments[a].said) || moments[b].weight - moments[a].weight || a - b);
  const first = ranked[0];
  if (first === undefined) return [];
  const m = moments[first];
  const second = ranked.find(i => i !== first && moments[i].kind !== m.kind && moments[i].said === m.said) ?? ranked.find(i => i !== first);
  return (second === undefined ? [first] : [first, second]).sort((a, b) => a - b);
}
