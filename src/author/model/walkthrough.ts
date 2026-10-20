import type { AuthorDraft, Tab } from './draft';
import { MIN_ACTIONS, validationOf, type Issue, type IssueArea, type Validation } from './validate';

/**
 * The publishing walkthrough (D244): before a version is published the author goes through every page in order,
 * reads what Kora found on it and confirms it. A confirmation holds for the page as it was: change the page and it
 * asks to be confirmed again. Kora explains every issue in plain words (what is wrong, why it stops or harms the
 * simulation, what to do) and, where a change is safe to make for the author, proposes it as one step of undo.
 * Pure: no React, no storage.
 */

/** The pages walked through, in the workspace's order (Overview has nothing of its own to confirm). */
export const WALK_PAGES = ['brief', 'story', 'process', 'team', 'lens', 'actions', 'events', 'scoring', 'brand', 'calibrate'] as const satisfies readonly Tab[];
export type WalkPage = (typeof WALK_PAGES)[number];
export const isWalkPage = (t: Tab): t is WalkPage => (WALK_PAGES as readonly Tab[]).includes(t);

/** What each page owns of the draft: a confirmation is for these parts as they were. */
function slice(d: AuthorDraft, page: WalkPage): unknown {
  switch (page) {
    case 'brief': return d.brief;
    case 'story': return d.story;
    case 'process': return [d.process, d.variables];
    case 'team': return [d.team, d.stakeholders, d.candidates ?? null];
    case 'lens': return d.lens;
    case 'actions': return d.actions;
    case 'events': return d.events;
    case 'scoring': return d.scoring;
    case 'brand': return d.brand;
    case 'calibrate': return d.calibration ?? null;
  }
}

/** FNV-1a over the page's parts: short, stable, and enough to tell "changed since you confirmed it". */
export function pageHash(d: AuthorDraft, page: WalkPage): string {
  const s = JSON.stringify(slice(d, page)) ?? '';
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(36);
}

export type PageState = 'confirmed' | 'changed' | 'blocked' | 'open';

export interface PageReview {
  page: WalkPage;
  /** The page's issues, blocking first. */
  issues: Issue[];
  blocking: number;
  /** confirmed: as the author confirmed it; changed: confirmed, then changed; blocked: something on it stops publishing; open: not confirmed yet. */
  state: PageState;
}

export function pageReview(d: AuthorDraft, page: WalkPage, v: Validation = validationOf(d)): PageReview {
  const issues = [...v.blocking, ...v.advisories].filter(i => i.tab === page);
  const blocking = issues.filter(i => i.blocking).length;
  const at = d.publish.reviewed[page];
  const state: PageState = blocking ? 'blocked' : at === undefined ? 'open' : at === pageHash(d, page) ? 'confirmed' : 'changed';
  return { page, issues, blocking, state };
}

export interface Walk {
  pages: PageReview[];
  /** Issues that belong to no page (the simulation as a whole), shown on Review and publish. */
  general: Issue[];
  confirmed: number;
  /** The first page still to confirm, in order; null when every page is confirmed. */
  next: WalkPage | null;
  /** Every page confirmed as it is now and nothing blocking: Publish may go ahead. */
  ready: boolean;
}

export function walkOf(d: AuthorDraft, v: Validation = validationOf(d)): Walk {
  const pages = WALK_PAGES.map(p => pageReview(d, p, v));
  const general = [...v.blocking, ...v.advisories].filter(i => !isWalkPage(i.tab));
  const confirmed = pages.filter(p => p.state === 'confirmed').length;
  const next = pages.find(p => p.state !== 'confirmed')?.page ?? null;
  return { pages, general, confirmed, next, ready: next === null && v.blocking.length === 0 };
}

/** The page after this one in the walk; null after the last. */
export const nextPage = (page: WalkPage): WalkPage | null => WALK_PAGES[WALK_PAGES.indexOf(page) + 1] ?? null;

// ---------------------------------------------------------------- Kora's explanations

export interface Explanation {
  /** What is wrong, in one sentence. */
  what: string;
  /** Why it matters: what would happen to the simulation or to participants if it were published as it is. */
  why: string;
  /** What to do, step by step. */
  steps: string[];
}

/** Why each kind of issue matters, said for the author, not the engine. */
const WHY: Record<IssueArea, string> = {
  required: 'The simulation reads this field to build what participants see. Left empty, that part of the run would be blank, or the run could not start at all.',
  engine: 'The engine checks every setting before a run starts. With this problem it refuses to load the simulation, so no participant could play it.',
  mechanics: 'The simulation would load, but participants\' choices would not change what happens. A run where every choice leads to the same place cannot tell good leadership from poor, and the report would score noise.',
  names: 'Participants, the board and the report tell people, styles and skills apart by name. Two with the same name would be mixed up in conversations, in the team view and in the scores.',
  links: 'Something here points at a person, a stage or a decision that is no longer in this draft. The engine cannot resolve it, so that part would never play, or would stop the run when it comes up.',
  scoring: 'The report scores participants against your rubric. Until the samples show the scoring matches your judgment, participants could get a report you would not stand behind.',
  copy: 'Participants read this text. It breaks one of KNOLSKAPE\'s copy rules, so it would read differently from the rest of the simulation.',
  trace: 'Participants read this text, but no field in GenieKreator owns it, so you cannot review or change it before it goes out. It does not stop publishing.',
  synthetic: 'Synthetic players play the simulation many times at four levels of leadership. Until a full test passes on this version, nobody has checked that good leadership scores higher than poor leadership, so the report could reward the wrong things.',
  play: 'Playing a week yourself is the quickest way to catch something that reads or plays oddly before participants do. It does not stop publishing.'
};

const sentences = (s: string) => s.split(/(?<=[.!?])\s+(?=[A-Z"(])/).map(x => x.trim()).filter(Boolean);

/** Why some issues matter, where the reason of their area does not fit them. */
const WHY_OF: Array<[RegExp, string]> = [
  [/^mechanics\.core\./, 'Core actions are what every iLead simulation is built on. Without this one participants lose a way to lead their people, and the report would score a skill they never had the chance to show.'],
  [/^mechanics\.stakeholder\./, 'Participants would read about this person and never be able to meet them, which reads like a broken promise in the story.']
];

/**
 * Kora's explanation of an issue: what, why and the steps to fix it. `here`: the author is on the issue's page,
 * so the steps start there rather than with opening it.
 */
export function explainIssue(i: Issue, pageLabel: string, here = false): Explanation {
  const steps: string[] = [];
  if (i.area === 'synthetic') steps.push(`${here ? 'On this page,' : `Open ${pageLabel} and`} run all four levels with the strategy probes on.`);
  else if (i.area === 'play') steps.push('Choose Play week 1 on Review and publish. It opens the draft as a participant sees it, in a test run that saves nothing.');
  else if (!here) steps.push(`Open ${pageLabel}.`);
  if (i.detail && i.area !== 'engine') steps.push(...sentences(i.detail));
  if (i.area === 'engine') steps.push(`The engine says: ${i.detail ?? i.title}`, 'Change the setting it names, or ask Kora on that page to change it for you.');
  if (i.blocking) steps.push('Kora checks the page again as soon as you change it; when the issue is gone, confirm the page.');
  return { what: i.title.replace(/\.?$/, '.'), why: WHY_OF.find(([re]) => re.test(i.id))?.[1] ?? WHY[i.area], steps };
}

// ---------------------------------------------------------------- Kora's proposed fixes

export interface Proposal {
  /** What Kora proposes, as a button's words ("Switch on 2 actions"). */
  label: string;
  /** Each change it makes, in plain words, shown before the author applies it. */
  changes: string[];
  /** Makes the change on a draft (inside the store's `edit`, so it is one step of undo). */
  apply(d: AuthorDraft): void;
}

const fullName = (c: AuthorDraft['team'][number]) => [c.first, c.last].filter(s => s.trim()).join(' ') || c.id;

/**
 * A change Kora can safely propose for an issue: one with a clear right answer that loses none of the author's
 * work. Issues that need the author's judgment (a name, a rubric, what a field should say) get none, and Kora's
 * explanation says what to do instead.
 */
export function proposeFix(i: Issue, d: AuthorDraft): Proposal | null {
  const parts = i.id.split('.');
  if (i.id === 'mechanics.actions') {
    const inUse = d.actions.filter(a => a.core || a.enabled).length;
    const off = d.actions.filter(a => !a.core && !a.enabled).slice(0, Math.max(0, MIN_ACTIONS - inUse));
    if (!off.length) return null;
    const keys = off.map(a => a.key);
    return {
      label: `Switch on ${off.length} ${off.length === 1 ? 'action' : 'actions'}`,
      changes: off.map(a => `Switch on "${a.name}" in Actions and conversations.`),
      apply: x => { for (const a of x.actions) if (keys.includes(a.key)) a.enabled = true; }
    };
  }
  if (parts[0] === 'mechanics' && parts[1] === 'core') {
    const template = parts.slice(2).join('.');
    const a = d.actions.find(x => x.key === template) ?? d.actions.find(x => x.template === template);
    if (!a) return null;
    return { label: `Switch "${a.name}" back on`, changes: [`Switch the core action "${a.name}" back on in Actions and conversations.`], apply: x => { const t = x.actions.find(y => y.key === a.key); if (t) t.enabled = true; } };
  }
  if (parts[0] === 'links' && parts[1] === 'event') {
    const key = parts.slice(2).join('.');
    const e = d.events.find(x => x.key === key);
    if (!e) return null;
    return { label: 'Send it to the whole team', changes: [`"${e.title || e.key}" goes to the whole team instead of someone who is no longer here. You can pick one person again in Events.`], apply: x => { const t = x.events.find(y => y.key === key); if (t) t.who = 'team'; } };
  }
  if (parts[0] === 'links' && parts[1] === 'stage') {
    const id = parts.slice(2).join('.');
    const c = d.team.find(x => x.id === id);
    const first = d.process.stages[0];
    if (!c || !first) return null;
    return { label: `Move them to ${first.name || first.key}`, changes: [`${fullName(c)} moves to the stage "${first.name || first.key}". You can pick another stage in Team.`], apply: x => { const t = x.team.find(y => y.id === id); if (t) t.stage = first.key; } };
  }
  if (parts[0] === 'links' && parts[1] === 'relation') {
    const id = parts[2], other = parts.slice(3).join('.');
    const c = d.team.find(x => x.id === id);
    if (!c) return null;
    return { label: 'Remove the relationship', changes: [`${fullName(c)}'s relationship with someone who has left the team is removed.`], apply: x => { const t = x.team.find(y => y.id === id); if (t) t.relationships = t.relationships.filter(r => r.with !== other); } };
  }
  if (parts[0] === 'links' && parts[1] === 'flag') {
    const key = parts[2], flag = parts.slice(3).join('.');
    const e = d.events.find(x => x.key === key);
    if (!e) return null;
    return { label: 'Remove the condition', changes: [`"${e.title || e.key}" no longer waits for "${flag.replace(/_/g, ' ')}", which no decision sets, so it plays on its timing.`], apply: x => { const t = x.events.find(y => y.key === key); if (t?.conditions) t.conditions = t.conditions.filter(c => !(c.kind === 'flag' && c.flag === flag)); } };
  }
  return null;
}
