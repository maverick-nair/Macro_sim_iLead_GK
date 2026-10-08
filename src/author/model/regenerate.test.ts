import { describe, expect, it } from 'vitest';
import { Brief } from '../../api/author';
import type { AuthorDraft } from './draft';
import { understand } from './intents';
import { applyOps } from './patch';
import { briefFromDraft, regenerate, regenerateItem, regenSummary } from './regenerate';
import { emptyChat, seedDraft } from './seed';
import { createAuthorStore } from './store';

const draft = () => seedDraft({
  ...emptyChat(),
  brief: Brief.parse({ roleLevel: 'First time managers', industry: 'Healthcare', challenge: 'Keep the team going through a hard quarter.', teamSize: 10, duration: 'standard' }),
  asked: ['role_level', 'industry', 'challenge'], answers: { role_level: 'First time managers', industry: 'Healthcare', challenge: 'x' }, primary: 'six_styles'
}, 'workspace');

/** The draft without the parts a scope may change, to show nothing else moved. */
function without(d: AuthorDraft, drop: (x: AuthorDraft) => void) {
  const x = structuredClone(d);
  drop(x);
  return x;
}

describe('Regenerate drafts from the draft as it is now (D126)', () => {
  it('reads the current brief: an industry changed to Banking reaches Story', () => {
    const d = draft();
    expect(d.story.company.about).toMatch(/patients/);
    d.brief.industry = 'Banking';
    d.marks['brief.industry'] = 'you';
    expect(briefFromDraft(d).industry).toBe('Banking');
    const r = regenerate(d, { tab: 'story' });
    expect(d.story.company.about).toMatch(/business banking for small firms, to clients/);
    expect(d.story.company.about).not.toMatch(/patients|care/i);
    expect(['Harbour Bank', 'Meridian Finance', 'Crestway Bank']).toContain(d.story.company.name);
    expect(r.changed).toContain('What the company does');
    expect(regenSummary(r)).toMatch(new RegExp(`^Kora drafted it again from your current brief: ${r.changed.length} fields changed\\.`));
  });

  it('counts only fields that changed, and says so when nothing did', () => {
    const d = draft();
    const r = regenerate(d, { tab: 'story' });
    expect(r.changed).toEqual([]);
    expect(regenSummary(r)).toBe('Nothing changed: Kora\'s draft already matches your current brief.');
  });

  it('never overwrites what the author wrote or edited, and lists what it kept', () => {
    const d = draft();
    d.brief.industry = 'Banking';
    d.story.company.about = 'My own words about the company.';
    d.marks['story.company.about'] = 'you';
    d.story.company.hq = 'Leeds';
    d.marks['story.company.hq'] = 'edited';
    const r = regenerate(d, { tab: 'story' });
    expect(d.story.company.about).toBe('My own words about the company.');
    expect(d.story.company.hq).toBe('Leeds');
    expect(r.kept).toEqual(expect.arrayContaining(['What the company does', 'Headquarters']));
    expect(regenSummary(r)).toMatch(/Kept 2 fields you wrote: Headquarters, What the company does\.$/);
  });

  it('a Kora change applied to the author\'s text keeps it the author\'s, so Regenerate leaves it', () => {
    const d = draft();
    const c = d.team[0];
    d.team[0].persona = 'Written by the author. Quiet in meetings.';
    d.marks[`team.${c.id}.persona`] = 'you';
    const store = createAuthorStore(d, null);
    const a = understand(store.getState().draft, 'team', `Make ${c.first} more defensive`);
    if (a.kind !== 'change') throw new Error(a.reply);
    // The panel's Apply: the operations through the store, marked as Kora's.
    store.getState().edit(x => { applyOps(x, a.ops); }, a.marks, 'ai');
    const after = store.getState().draft;
    expect(after.team[0].persona).toMatch(/^Written by the author\. .*defensive/);
    expect(after.marks[`team.${c.id}.persona`]).toBe('edited');
    expect(after.marks[`team.${c.id}.stats`]).toBe('ai');
    const persona = after.team[0].persona;
    const next = structuredClone(after);
    next.brief.industry = 'Banking';
    regenerate(next, { tab: 'team' });
    expect(next.team[0].persona).toBe(persona);
  });

  it('regenerating one event changes that event and nothing else', () => {
    const d = draft();
    d.brief.industry = 'Banking';
    const before = structuredClone(d);
    const r = regenerateItem(d, { event: 'competitor_moves' });
    expect(r.changed).toHaveLength(1);
    expect(d.events.find(e => e.key === 'competitor_moves')!.body).not.toBe(before.events.find(e => e.key === 'competitor_moves')!.body);
    const drop = (x: AuthorDraft) => { x.events = x.events.filter(e => e.key !== 'competitor_moves'); };
    expect(without(d, drop)).toEqual(without(before, drop));
  });

  it('regenerating one event that already matches gives another version, still alone', () => {
    const d = draft();
    const before = structuredClone(d);
    const r = regenerateItem(d, { event: 'pulse_survey' });
    expect(r.changed).toHaveLength(1);
    const e = d.events.find(x => x.key === 'pulse_survey')!, b = before.events.find(x => x.key === 'pulse_survey')!;
    expect(e.title).not.toBe(b.title);
    expect([e.skill, e.morale, e.result, e.week]).toEqual([b.skill, b.morale, b.result, b.week]);
    const drop = (x: AuthorDraft) => { x.events = x.events.filter(y => y.key !== 'pulse_survey'); };
    expect(without(d, drop)).toEqual(without(before, drop));
    const again = regenerateItem(d, { event: 'pulse_survey' }, 1);
    expect(again.changed).toHaveLength(1);
  });

  it('regenerating one person changes that person and nothing else, and keeps what the author wrote', () => {
    const d = draft();
    const c = d.team[3];
    d.marks[`team.${c.id}.hiddenConcern`] = 'you';
    const before = structuredClone(d);
    const r = regenerateItem(d, { character: c.id });
    expect(r.changed).toEqual([`${c.first} ${c.last} · Persona`]);
    expect(r.kept).toContain(`${c.first} ${c.last} · Hidden concern`);
    expect(d.team[3].hiddenConcern).toBe(before.team[3].hiddenConcern);
    const drop = (x: AuthorDraft) => { x.team = x.team.filter(y => y.id !== c.id); };
    expect(without(d, drop)).toEqual(without(before, drop));
  });

  it('an event the author wrote is kept, even when asked for alone', () => {
    const d = draft();
    d.marks['events.budget_cut'] = 'edited';
    const before = structuredClone(d);
    const r = regenerateItem(d, { event: 'budget_cut' });
    expect(r).toEqual({ changed: [], kept: ['A hard message to share'] });
    expect(d).toEqual(before);
  });
});
