import { describe, expect, it } from 'vitest';
import { Brief } from '../../api/author';
import { configHash } from '../calibrate/logic/hash';
import type { AuthorDraft } from './draft';
import { toStoryline } from './export';
import { emptyChat, seedDraft } from './seed';
import { recordCalibration, validateDraft } from './validate';
import { explainIssue, nextPage, pageHash, proposeFix, WALK_PAGES, walkOf } from './walkthrough';

const chat = (): AuthorDraft['chat'] => ({
  ...emptyChat(),
  brief: Brief.parse({ roleLevel: 'First time sales managers', industry: 'Manufacturing', challenge: 'Deals stall at negotiation and new reps burn out.', client: 'Ascent Lifts', teamSize: 10, duration: 'standard' }),
  asked: ['role_level', 'industry', 'challenge', 'client'], answers: { role_level: 'First time sales managers', industry: 'Manufacturing', challenge: 'x', client: 'Ascent Lifts' }, primary: 'readiness_based'
});

/** A draft with nothing left to fix, the synthetic test passed on this version. */
function ready(): AuthorDraft {
  const d = seedDraft(chat(), 'workspace');
  d.story.product.dealValue = 42000;
  for (const s of d.scoring.samples) s.call = s.scored;
  d.publish.played = true;
  d.calibration = recordCalibration(null, { status: 'passed', summary: 'All good.', full: true }, configHash(toStoryline(d).storyline));
  return d;
}
const confirmAll = (d: AuthorDraft) => { for (const p of WALK_PAGES) d.publish.reviewed[p] = pageHash(d, p); };
const fixed = (d: AuthorDraft, id: string) => {
  const i = validateDraft(d).blocking.find(x => x.id === id);
  if (!i) throw new Error(`no issue ${id}`);
  const p = proposeFix(i, d);
  if (!p) throw new Error(`no proposal for ${id}`);
  p.apply(d);
  return p;
};

describe('the publishing walkthrough (D244)', () => {
  it('asks for every page in order, and is ready only once each is confirmed', () => {
    const d = ready();
    const w = walkOf(d);
    expect(w.pages.map(p => p.page)).toEqual([...WALK_PAGES]);
    expect(w.pages.every(p => p.state === 'open')).toBe(true);
    expect(w.next).toBe('brief');
    expect(w.ready).toBe(false);
    d.publish.reviewed.brief = pageHash(d, 'brief');
    expect(walkOf(d).next).toBe('story');
    expect(walkOf(d).confirmed).toBe(1);
    confirmAll(d);
    expect(walkOf(d)).toMatchObject({ confirmed: WALK_PAGES.length, next: null, ready: true });
  });

  it('asks again for a page changed since it was confirmed, and only that page', () => {
    const d = ready();
    confirmAll(d);
    d.story.company.name = 'Northwind Lifts';
    const w = walkOf(d);
    expect(w.pages.find(p => p.page === 'story')!.state).toBe('changed');
    // The synthetic test ran on the draft before the change, so it asks to be run again as well.
    expect(w.pages.filter(p => p.state !== 'confirmed').map(p => p.page)).toEqual(['story', 'calibrate']);
    expect(w.ready).toBe(false);
  });

  it('keeps a page with something that stops publishing from being confirmed, and never ready', () => {
    const d = ready();
    confirmAll(d);
    d.brief.industry = '';
    const brief = walkOf(d).pages.find(p => p.page === 'brief')!;
    expect(brief.state).toBe('blocked');
    expect(brief.blocking).toBeGreaterThan(0);
    expect(walkOf(d).ready).toBe(false);
  });

  it('goes page to page, then to Review and publish', () => {
    expect(nextPage('brief')).toBe('story');
    expect(nextPage('calibrate')).toBeNull();
  });
});

describe('Kora explains every issue (D244)', () => {
  it('says what is wrong, why it matters and the steps to fix it, for each blocking issue', () => {
    const d = ready();
    d.brief.industry = '';
    d.actions.filter(a => !a.core).forEach(a => { a.enabled = false; });
    for (const i of validateDraft(d).blocking) {
      const x = explainIssue(i, 'A page');
      expect(x.what.length).toBeGreaterThan(5);
      expect(x.why.length).toBeGreaterThan(40);
      expect(x.steps.length).toBeGreaterThan(1);
      expect(x.steps[0]).toMatch(/^(Open A page|Choose Play)/);
      expect(explainIssue(i, 'A page', true).steps[0]).not.toMatch(/^Open A page/);
      expect(x.steps.join(' ')).not.toMatch(/—/);
    }
  });
});

describe('Kora proposes the fixes it can make safely (D244)', () => {
  it('switches on enough actions when too few are in use, and the issue goes', () => {
    const d = ready();
    d.actions.forEach((a, k) => { a.core = false; a.enabled = k < 2; });
    const p = fixed(d, 'mechanics.actions');
    expect(p.changes.length).toBeGreaterThan(0);
    expect(validateDraft(d).blocking.map(i => i.id)).not.toContain('mechanics.actions');
  });

  it('sends an event for someone who left to the whole team', () => {
    const d = ready();
    const e = d.events[0];
    e.who = 'nobody_here';
    fixed(d, `links.event.${e.key}`);
    expect(e.who).toBe('team');
    expect(validateDraft(d).blocking.some(i => i.id === `links.event.${e.key}`)).toBe(false);
  });

  it('moves a member out of a stage that no longer exists', () => {
    const d = ready();
    const c = d.team[0];
    c.stage = 'gone';
    fixed(d, `links.stage.${c.id}`);
    expect(c.stage).toBe(d.process.stages[0].key);
  });

  it('removes a relationship with someone who left', () => {
    const d = ready();
    const c = d.team[0];
    c.relationships.push({ with: 'left_long_ago', kind: 'friend' });
    fixed(d, `links.relation.${c.id}.left_long_ago`);
    expect(c.relationships.some(r => r.with === 'left_long_ago')).toBe(false);
  });

  it('proposes nothing where only the author can decide: a name, a field to fill in', () => {
    const d = ready();
    d.brief.industry = '';
    d.team[1].first = d.team[0].first;
    d.team[1].last = d.team[0].last;
    for (const i of validateDraft(d).blocking.filter(x => x.area === 'required' || x.area === 'names')) expect(proposeFix(i, d)).toBeNull();
  });
});
