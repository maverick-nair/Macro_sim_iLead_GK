import { NEEDS } from '../../engine/lens';
import { configHash } from '../calibrate/logic/hash';
import type { CalibrationPublishCheck } from '../calibrate/logic/publish';
import { fitTable, LENS_BY_ID } from '../lenses';
import type { AuthorDraft, Tab } from './draft';
import { toStoryline, type Exported } from './export';
import { ENGINE_TEMPLATES } from './library';
import { needsOf } from './needs';
import { parseEffect } from './seed';

/**
 * The publish gate (D131): every reason a draft cannot be published yet, and the advice that does not block,
 * from the draft and its export. Pure: no React, no storage. The header badge, the nav, Review and publish and
 * the Publish button all read this one list, so they can never disagree.
 *
 * An issue has a plain title, the tab where it is fixed and, where there is one, the field to fix (`target`, a
 * draft path). Blocking issues stop Publish; advisories never do.
 */

export type IssueArea = 'required' | 'engine' | 'mechanics' | 'names' | 'links' | 'scoring' | 'copy' | 'synthetic' | 'play';

export interface Issue {
  id: string;
  area: IssueArea;
  title: string;
  detail?: string;
  /** The tab to open to fix it. */
  tab: Tab;
  /** The field or item to fix, as a draft path ("brief.participants", "actions.coach"). */
  target?: string;
  blocking: boolean;
}

export interface Validation {
  blocking: Issue[];
  advisories: Issue[];
  /** The draft as the engine plays it, so callers need not export it again. */
  exported: Exported;
  synthetic: SyntheticGate;
}

/** At least this many actions in use; fewer leaves the week with nothing to choose. */
export const MIN_ACTIONS = 4;
/** The scoring samples a draft must have, and the share the author must agree with (D110). */
export const MIN_SAMPLES = 6;
export const SCORING_AGREEMENT = 0.85;
/** The core actions (D108), by the engine template they play as: a draft without one of them is not iLead. */
export const CORE_TEMPLATES = ENGINE_TEMPLATES.filter(t => t.inNew === 'core').map(t => ({ key: t.template, name: t.name }));
/** Templates whose static form is a choice between options, beside every style based action. */
const CHOICE_TEMPLATES = new Set(['energize', 'training']);

const norm = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();
const quote = (s: string) => `"${s.trim()}"`;

/** Values that appear more than once (normalized), each with its first spelling. */
function duplicates(values: string[]): string[] {
  const seen = new Map<string, string>();
  const out = new Map<string, string>();
  for (const v of values) {
    const k = norm(v);
    if (!k) continue;
    if (seen.has(k)) out.set(k, seen.get(k)!);
    else seen.set(k, v.trim());
  }
  return [...out.values()];
}

/** An issue the exporter or the engine reported, as text, whatever shape the exporter uses for it. */
function issueText(i: unknown): string {
  if (typeof i === 'string') return i;
  if (i && typeof i === 'object') {
    const o = i as { message?: unknown; title?: unknown; text?: unknown };
    for (const v of [o.message, o.title, o.text]) if (typeof v === 'string') return v;
  }
  return String(i);
}

const effectKey = (text: string) => (parseEffect(text) ?? [0, 0, 0]).join(',');

/** A conversation whose impact is the same whether the style fits, is one step off or is wrong, for every style. */
function flatImpact(a: AuthorDraft['actions'][number], styles: string[]): boolean {
  return styles.every(k => {
    const row = a.impact[k];
    if (!row) return true;
    const fit = effectKey(row.fit);
    return fit === effectKey(row.close) && fit === effectKey(row.wrong);
  });
}

const impactKey = (a: AuthorDraft['actions'][number], styles: string[]) => styles.map(k => { const r = a.impact[k]; return r ? `${effectKey(r.fit)}|${effectKey(r.close)}|${effectKey(r.wrong)}` : '-'; }).join(';');

/** The styles that fit a need (difference 0). */
const fitting = (fit: AuthorDraft['lens']['fit'], need: (typeof NEEDS)[number], keys: string[]) => keys.filter(k => fit[need]?.[k] === 0);

// ---------------------------------------------------------------- the synthetic players gate (D132)

export type SyntheticState = 'passed' | 'advisory' | 'failed' | 'failedEarlier' | 'notRun' | 'outOfDate' | 'partial';

export interface SyntheticGate {
  state: SyntheticState;
  /** The issue it raises, blocking or advisory; null when the test passed on this version. */
  issue: Issue | null;
  /** True when "Publish without testing" can turn the issue into advice: never for a failure. */
  acknowledgeable: boolean;
}

const SYN = { id: 'synthetic', area: 'synthetic' as const, tab: 'calibrate' as const };

/**
 * Whether the synthetic players let this version publish (D132):
 *   passed         a full run on this version passed: nothing to say
 *   advisory       a full run on this version passed with warnings: advice
 *   failed         a run on this version failed: blocking
 *   failedEarlier  a run failed and no full run has passed since (edits, or a partial run, do not clear it): blocking
 *   notRun, outOfDate, partial   no full run on this version: blocking, unless the author ticked "Publish without testing"
 */
export function syntheticGate(c: AuthorDraft['calibration'], hash: string, skipTest: boolean): SyntheticGate {
  const current = !!c && c.configHash === hash;
  if (c?.failed) {
    const here = current && (c.status ?? (c.passed ? 'passed' : 'failed')) === 'failed';
    return {
      state: here ? 'failed' : 'failedEarlier', acknowledgeable: false,
      issue: here
        ? { ...SYN, blocking: true, title: 'Synthetic players found problems on this version', detail: `${c.failed.summary} Fix what the results show, then run the test again. It must pass before you publish.` }
        : { ...SYN, blocking: true, title: 'The last synthetic test failed, and no full test has passed since', detail: `${c.failed.summary} Your edits since then have not been tested. Run all four levels with the probes on; the test must pass before you publish.` }
    };
  }
  // A run recorded before D132 has no status: its `passed` and `advisory` say what it was.
  const status = c ? c.status ?? (!c.passed ? 'failed' : c.advisory ? 'advisory' : 'passed') : null;
  if (c && current && status === 'failed') return { state: 'failed', acknowledgeable: false, issue: { ...SYN, blocking: true, title: 'Synthetic players found problems on this version', detail: c.summary } };
  const untested = (state: SyntheticState, title: string, detail: string): SyntheticGate => ({
    state, acknowledgeable: true,
    issue: skipTest
      ? { ...SYN, blocking: false, title, detail: `${detail} You chose to publish without testing this version.` }
      : { ...SYN, blocking: true, title, detail: `${detail} Run the test, or tick Publish without testing.` }
  });
  if (!c || !status) return untested('notRun', 'Synthetic players have not tested this draft', 'Nobody has checked that good leadership scores higher than poor leadership in this simulation.');
  if (!current) return untested('outOfDate', 'The draft changed since the last synthetic test', `The last test ran on an earlier version: ${c.summary}`);
  if (status === 'partial') return untested('partial', 'The last synthetic test was not a full test', 'A test passes only with all four levels and the strategy probes on.');
  if (status === 'advisory') return { state: 'advisory', acknowledgeable: false, issue: { ...SYN, blocking: false, title: 'Synthetic players passed, with things to look at', detail: c.summary } };
  return { state: 'passed', acknowledgeable: false, issue: null };
}

/** The draft's calibration record after a new run (D132): the verdict, and a failure that stays until a full run passes. */
export function recordCalibration(prev: AuthorDraft['calibration'], check: Pick<CalibrationPublishCheck, 'status' | 'summary' | 'full'>, hash: string, now = Date.now()): NonNullable<AuthorDraft['calibration']> {
  const status = check.status === 'failed' ? 'failed' as const : !check.full || check.status === 'notRun' || check.status === 'outOfDate' ? 'partial' as const : check.status === 'advisory' ? 'advisory' as const : 'passed' as const;
  const failed = status === 'failed' ? { summary: check.summary, configHash: hash } : status === 'partial' ? prev?.failed ?? null : null;
  return { ranAt: now, passed: status === 'passed' || status === 'advisory', summary: check.summary, advisory: status === 'advisory', configHash: hash, status, failed };
}

// ---------------------------------------------------------------- the validator

export function validateDraft(d: AuthorDraft, exported: Exported = toStoryline(d)): Validation {
  const issues: Issue[] = [];
  const block = (i: Omit<Issue, 'blocking'>) => issues.push({ ...i, blocking: true });
  const advise = (i: Omit<Issue, 'blocking'>) => issues.push({ ...i, blocking: false });

  // Required: every field the workspace labels Required, and the needs Kora could not fill.
  for (const n of needsOf(d)) if (n.id !== 'scoring.samples') block({ id: `required.${n.id}`, area: 'required', title: `${n.label} is empty`, detail: `Fill it in on ${n.where}.`, tab: n.tab, target: n.path });

  // The engine plays it: every schema issue and every issue the export found.
  (exported.issues as readonly unknown[]).forEach((i, k) => block({ id: `engine.${k}`, area: 'engine', title: 'The simulation does not play yet', detail: issueText(i), tab: 'overview' }));
  exported.copy.forEach((c, k) => block({ id: `copy.${k}`, area: 'copy', title: `Copy rule: ${c.rule.replace(/_/g, ' ')}`, detail: `"${c.text.slice(0, 80)}"`, tab: 'story' }));

  // Mechanics: enough actions, the core ones, choices that differ, styles that matter.
  const inUse = d.actions.filter(a => a.core || a.enabled);
  const styleKeys = d.lens.styles.map(s => s.key);
  if (inUse.length < MIN_ACTIONS) block({ id: 'mechanics.actions', area: 'mechanics', title: `Only ${inUse.length} ${inUse.length === 1 ? 'action is' : 'actions are'} in use`, detail: `Participants need at least ${MIN_ACTIONS} actions to choose from each week, the core ones included. Switch more on.`, tab: 'actions' });
  for (const c of CORE_TEMPLATES) {
    if (!inUse.some(a => a.template === c.key)) block({ id: `mechanics.core.${c.key}`, area: 'mechanics', title: `The core action ${quote(c.name)} is not in use`, detail: 'Core actions are always included: every iLead simulation needs them. Reset the action library or add it back.', tab: 'actions', target: `actions.${c.key}` });
  }
  const talks = inUse.filter(a => a.canPlay.length > 1 && a.plays !== 'static');
  const flat = talks.filter(a => flatImpact(a, styleKeys));
  if (talks.length && flat.length === talks.length) {
    block({ id: 'mechanics.impact.flat', area: 'mechanics', title: 'Styles make no difference in any conversation', detail: 'Every impact table gives the same result whether the style fits the person, is one step off or is wrong. Make a style that fits do more than one that does not.', tab: 'actions', target: `actions.${talks[0].key}` });
  } else {
    for (const a of flat) advise({ id: `mechanics.impact.${a.key}`, area: 'mechanics', title: `In ${quote(a.name)} the style makes no difference`, detail: 'Its impact table is the same whether the style fits or not.', tab: 'actions', target: `actions.${a.key}` });
    if (talks.length >= 3 && new Set(talks.map(a => impactKey(a, styleKeys))).size === 1) block({ id: 'mechanics.impact.same', area: 'mechanics', title: 'Every conversation has the same impact table', detail: 'Coaching, feedback and a one to one all do exactly the same. Give each conversation its own effects, so choosing the right one matters.', tab: 'actions', target: `actions.${talks[0].key}` });
  }
  for (const a of inUse) {
    const choice = a.plays !== 'live' && (a.canPlay.length > 1 || CHOICE_TEMPLATES.has(a.template));
    if (choice && a.options.length < 2) block({ id: `mechanics.options.${a.key}`, area: 'mechanics', title: a.options.length ? `${quote(a.name)} is a decision with only one option` : `${quote(a.name)} is a decision with no options`, detail: 'A decision needs at least two options to choose between. Add an option, or let it play as a conversation.', tab: 'actions', target: `actions.${a.key}` });
  }
  // The lens's fit table: the style must matter, and no one style may fit everyone.
  const allFit = NEEDS.every(n => fitting(d.lens.fit, n, styleKeys).length === styleKeys.length);
  if (allFit) block({ id: 'mechanics.fit.flat', area: 'mechanics', title: 'Every style fits every need', detail: 'In the lens\'s fit table every style is the best fit for everyone, so the style a participant picks never matters. Mark which styles fit each need.', tab: 'lens' });
  else {
    const everywhere = d.lens.styles.filter(s => NEEDS.every(n => d.lens.fit[n]?.[s.key] === 0));
    for (const s of everywhere) block({ id: `mechanics.fit.${s.key}`, area: 'mechanics', title: `${quote(s.name || s.key)} fits every need`, detail: 'Leading everyone in that one style would always be right, so reading people would not matter. Mark the needs it does not fit.', tab: 'lens', target: `lens.styles.${s.key}` });
    const lib = LENS_BY_ID[d.lens.id];
    const libStyles = lib.styles ?? LENS_BY_ID.readiness_based.styles!;
    const ref = fitTable(lib.styles ? lib : LENS_BY_ID.readiness_based, libStyles);
    const shared = styleKeys.filter(k => libStyles.some(s => s.key === k));
    const moved = NEEDS.filter(n => fitting(ref, n, shared).join() !== fitting(d.lens.fit, n, shared).join());
    if (shared.length >= 3 && moved.length >= 2) advise({ id: 'mechanics.fit.moved', area: 'mechanics', title: `The fit table no longer follows ${lib.title}`, detail: `For ${moved.length} of ${NEEDS.length} needs the style that fits is not the one the lens describes. Check the styles' descriptions still match what fits.`, tab: 'lens' });
  }

  // Names and keys that must be unique.
  const fullNames = d.team.map(c => [c.first, c.last].filter(s => s.trim()).join(' '));
  for (const n of duplicates(fullNames)) block({ id: `names.character.${norm(n)}`, area: 'names', title: `Two characters are called ${quote(n)}`, detail: 'Participants tell people apart by name. Give each character their own.', tab: 'team' });
  for (const n of duplicates(d.lens.styles.map(s => s.name))) block({ id: `names.style.${norm(n)}`, area: 'names', title: `Two styles are called ${quote(n)}`, detail: 'Each style needs its own name.', tab: 'lens' });
  for (const n of duplicates(d.lens.styles.map(s => (s.letter || s.name.charAt(0)).toUpperCase()))) block({ id: `names.tag.${norm(n)}`, area: 'names', title: `Two styles share the tag ${quote(n)}`, detail: 'Tags label styles on the board and in actions. Give each style its own.', tab: 'lens' });
  const skillNames = d.scoring.framework?.confirmed ? d.scoring.framework.rows.filter(r => r.include && r.behaviors.trim()).map(r => r.skill) : d.scoring.skills.map(s => s.name);
  const skillKeys = d.scoring.framework?.confirmed ? skillNames.map(s => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')) : d.scoring.skills.map(s => s.key);
  const dupNames = duplicates(skillNames);
  for (const n of dupNames) block({ id: `names.skill.${norm(n)}`, area: 'names', title: `Two skills are called ${quote(n)}`, detail: 'The report scores each skill once. Merge them, or rename one.', tab: 'scoring' });
  const dupKeys = duplicates(skillKeys).filter(k => !dupNames.some(n => n.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') === k));
  for (const k of dupKeys) block({ id: `names.skillkey.${k}`, area: 'names', title: 'Two skills would be scored as one', detail: `Their names differ only in spelling or punctuation (${k.replace(/_/g, ' ')}). Rename one.`, tab: 'scoring' });
  const reportKeys = (exported.storyline.report?.skills ?? []).map(s => s.key);
  for (const k of duplicates(reportKeys)) if (!dupKeys.includes(k) && !dupNames.some(n => norm(n) === k.replace(/_/g, ' '))) block({ id: `names.reportkey.${k}`, area: 'names', title: 'The report would score one skill twice', detail: `Two skills export as ${quote(k)}. Rename one.`, tab: 'scoring' });

  // Links: events, stages and relationships that point at people or stages that are gone.
  const ids = new Set(d.team.map(c => c.id));
  const stages = new Set(d.process.stages.map(s => s.key));
  const nameOf = (id: string) => { const c = d.team.find(x => x.id === id); return c ? [c.first, c.last].filter(Boolean).join(' ') : id; };
  const actionKeys = new Set(inUse.map(a => a.key));
  for (const e of d.events) {
    const who = e.who;
    const ok = who === 'team' || who === 'member' || who === 'sponsor' || ids.has(who) || (who.startsWith('stage:') && stages.has(who.slice(6)));
    if (!ok) block({ id: `links.event.${e.key}`, area: 'links', title: who.startsWith('stage:') ? `The event ${quote(e.title || e.key)} is for a stage that no longer exists` : `The event ${quote(e.title || e.key)} is for someone no longer in the team`, detail: 'Pick who it is for again, or remove the event.', tab: 'events', target: `events.${e.key}` });
    const asks = e.response.split(/[,\s]+/).filter(Boolean);
    const known = asks.length > 0 && !asks.includes('reply') && asks.every(k => d.actions.some(a => a.key === k));
    if (known && !asks.some(k => actionKeys.has(k))) advise({ id: `links.response.${e.key}`, area: 'links', title: `The event ${quote(e.title || e.key)} asks for an action that is switched off`, detail: 'Participants cannot answer it as intended. Switch the action on, or change the response.', tab: 'events', target: `events.${e.key}` });
  }
  for (const c of d.team) {
    if (!stages.has(c.stage)) block({ id: `links.stage.${c.id}`, area: 'links', title: `${nameOf(c.id)} works in a stage that no longer exists`, detail: 'Move them to one of the work process stages.', tab: 'team', target: `team.${c.id}.identity` });
    for (const r of c.relationships) if (!ids.has(r.with)) block({ id: `links.relation.${c.id}.${r.with}`, area: 'links', title: `${nameOf(c.id)} has a relationship with someone no longer in the team`, detail: 'Remove the relationship, or pick another person.', tab: 'team', target: `team.${c.id}.personality` });
  }

  // Scoring matches the author's judgment, on all the samples: none is not a pass.
  const s = d.scoring.samples;
  const answered = s.filter(x => x.call !== null);
  const agreed = s.filter(x => x.call === x.scored).length;
  if (s.length < MIN_SAMPLES) block({ id: 'scoring.samples.missing', area: 'scoring', title: s.length ? `Only ${s.length} scoring ${s.length === 1 ? 'sample' : 'samples'} to check` : 'There are no scoring samples to check', detail: `Check ${MIN_SAMPLES} sample answers, so scoring is known to match your judgment. Regenerate the Scoring and report tab to get them back.`, tab: 'scoring', target: 'scoring.samples' });
  else if (answered.length < s.length) block({ id: 'scoring.samples', area: 'scoring', title: `${s.length - answered.length} of ${s.length} scoring samples still need your call`, detail: 'Agree or disagree with each sample\'s band.', tab: 'scoring', target: 'scoring.samples' });
  else if (agreed / s.length < SCORING_AGREEMENT) block({ id: 'scoring.agreement', area: 'scoring', title: `You agree with only ${agreed} of ${s.length} scoring samples`, detail: `Publishing needs ${Math.round(SCORING_AGREEMENT * 100)}% agreement. Look at the rubric for the samples you disagreed with.`, tab: 'scoring', target: 'scoring.samples' });

  // Synthetic players, and playing it yourself.
  const synthetic = syntheticGate(d.calibration, configHash(exported.storyline), d.publish.skipTest);
  if (synthetic.issue) issues.push(synthetic.issue);
  if (!d.publish.played) advise({ id: 'play', area: 'play', title: 'You have not played a week of this draft yet', detail: 'It takes about 8 minutes.', tab: 'publish' });

  return { blocking: issues.filter(i => i.blocking), advisories: issues.filter(i => !i.blocking), exported, synthetic };
}

const cache = new WeakMap<AuthorDraft, Validation>();
/** The validation of a draft, once per draft object (every edit makes a new one), for the header, the nav and the tab. */
export function validationOf(d: AuthorDraft): Validation {
  let v = cache.get(d);
  if (!v) { v = validateDraft(d); cache.set(d, v); }
  return v;
}

/** The header badge (D131): what still needs the author, what blocks publishing, or ready. */
export function readiness(d: AuthorDraft): { kind: 'need' | 'fix' | 'ready'; text: string; count: number } {
  const needs = needsOf(d).length;
  if (needs) return { kind: 'need', text: `${needs} need${needs === 1 ? 's' : ''} you`, count: needs };
  const n = validationOf(d).blocking.length;
  if (n) return { kind: 'fix', text: `${n} to fix`, count: n };
  return { kind: 'ready', text: 'Ready to publish', count: 0 };
}
