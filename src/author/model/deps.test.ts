import { describe, expect, it } from 'vitest';
import { Brief } from '../../api/author';
import { changeLens } from '../ui/workspace/tabs/Lens';
import { applyChange, changeAction, changeSummary, previewBrief, propagateBrief, replaceName, scanRefs } from './deps';
import { emptyChat, seedDraft } from './seed';
import { createAuthorStore } from './store';

const draft = () => seedDraft({
  ...emptyChat(),
  brief: Brief.parse({ roleLevel: 'First time managers', industry: 'Healthcare', challenge: 'Keep the team going through a hard quarter.', client: 'Riverbend Clinics', teamSize: 10, duration: 'standard' }),
  asked: ['role_level', 'industry', 'challenge', 'client'], answers: {}, primary: 'readiness_based'
}, 'workspace');

describe('the dependency scanner (D148)', () => {
  it('finds every place a renamed person is still named, and the update is one undoable step', () => {
    const store = createAuthorStore(draft(), null);
    const d0 = store.getState().draft;
    const p = d0.team[1];
    const old = { first: p.first, last: p.last };
    // The audit: a name in an event's body and in the welcome letter.
    store.getState().edit(d => {
      d.events[0].body = `${old.first} ${old.last} asks for a word before the review.`;
      d.story.screens.find(s => s.key === 'welcome')!.body += `\n\nSay hello to ${old.first} first.`;
      d.team[2].persona = `Works closely with ${old.first}.`;
    }, { label: 'Setup' });
    store.getState().edit(d => { const c = d.team.find(x => x.id === p.id)!; c.first = 'Zara'; c.last = 'Quinn'; }, { label: 'Rename' });
    const change = { kind: 'person' as const, id: p.id, from: old, to: { first: 'Zara', last: 'Quinn' } };
    const refs = scanRefs(store.getState().draft, change);
    const paths = refs.map(r => r.path);
    expect(paths).toEqual(expect.arrayContaining([`events.${d0.events[0].key}.body`, 'story.screens.welcome.body', `team.${d0.team[2].id}.persona`]));
    // Pure: scanning changes nothing.
    expect(store.getState().draft.events[0].body).toContain(old.first);

    const before = store.getState().draft;
    const { label } = changeAction(change, refs.length);
    let n = 0;
    store.getState().edit(d => { n = applyChange(d, change); }, { label, restorePoint: true });
    const after = store.getState().draft;
    expect(n).toBe(refs.length);
    expect(after.events[0].body).toBe('Zara Quinn asks for a word before the review.');
    expect(after.story.screens.find(s => s.key === 'welcome')!.body).toContain('Say hello to Zara first.');
    expect(after.team[2].persona).toBe('Works closely with Zara.');
    expect(scanRefs(after, change)).toEqual([]);
    expect(store.getState().past.at(-1)?.label).toBe(label);
    expect(store.getState().versions.at(-1)?.label).toBe(`Before: ${label}`);
    store.getState().undo();
    expect(store.getState().draft).toBe(before);
  });

  it('reads a common word as a name only when it is written as one', () => {
    expect(replaceName('I will call Will tomorrow. Will said yes.', 'Will', 'Sam')).toEqual({ text: 'I will call Sam tomorrow. Will said yes.', n: 1 });
    expect(replaceName('Ana (lead) and Anaya', 'Ana', 'Mia')).toEqual({ text: 'Mia (lead) and Anaya', n: 1 });
  });

  it('a renamed company is updated in the story, the events, the brand and the logo', () => {
    const d = draft();
    expect(d.story.company.name).toBe('Riverbend Clinics');
    const change = { kind: 'company' as const, from: 'Riverbend Clinics', to: 'Northstar Health Partners' };
    const refs = scanRefs(d, change);
    expect(refs.length).toBeGreaterThan(3);
    expect(refs.map(r => r.tab)).toEqual(expect.arrayContaining(['story', 'brand']));
    applyChange(d, change);
    d.story.company.name = 'Northstar Health Partners';
    // Only the brief (the author's own notes) still says the old name.
    const { story, events, team, actions, brand, scoring } = d;
    expect(JSON.stringify({ story, events, team, actions, brand, scoring })).not.toContain('Riverbend Clinics');
    expect(d.brand.name).toBe('Northstar Health Partners');
    expect(d.story.company.logo).toBe('NH');
  });

  it('a lens change: the old sample calls and actions scored on skills the report no longer has', () => {
    const d = draft();
    for (const s of d.scoring.samples) s.call = s.scored;
    changeLens(d, 'servant');
    // changeLens rescored the actions; a custom skill still points at the old lens.
    d.actions[0].scoredOn = ['Diagnosing readiness'];
    const refs = scanRefs(d, { kind: 'skills', why: 'lens' });
    expect(refs.filter(r => r.tab === 'scoring')).toHaveLength(6);
    expect(refs.filter(r => r.tab === 'actions').map(r => r.path)).toEqual([`actions.${d.actions[0].key}.scoredOn`]);
    applyChange(d, { kind: 'skills', why: 'lens' });
    // "6 of 6 agreed" no longer stays after the lens changed.
    expect(d.scoring.samples.every(s => s.call === null)).toBe(true);
    const names = new Set(d.scoring.skills.map(s => s.name));
    expect(d.actions.every(a => a.scoredOn.every(n => names.has(n)))).toBe(true);
    expect(scanRefs(d, { kind: 'skills', why: 'lens' })).toEqual([]);
  });

  it('a changed challenge: events still Kora\'s are drafted again, and what the author wrote stays', () => {
    const d = draft();
    d.brief.challenge = 'Hitting targets without burning out the team';
    const own = d.events[1];
    own.body = 'The author wrote this.';
    d.marks[`events.${own.key}`] = 'you';
    const refs = scanRefs(d, { kind: 'challenge', from: 'Keep the team going through a hard quarter.', to: d.brief.challenge });
    expect(refs.length).toBeGreaterThan(0);
    const n = applyChange(d, { kind: 'challenge', from: '', to: d.brief.challenge });
    expect(n).toBe(refs.length);
    expect(d.events[1].body).toBe('The author wrote this.');
  });
});

describe('a brief answer changed later (D146)', () => {
  it('previews what the client changes, and Apply renames the company everywhere', () => {
    const d = draft();
    d.brief.client = 'Northstar Health Partners';
    const p = previewBrief(d, 'client');
    expect(p.summary[0]).toMatch(/^company name in \d+ places$/);
    expect(d.story.company.name).toBe('Riverbend Clinics');
    propagateBrief(d, 'client');
    expect(d.story.company.name).toBe('Northstar Health Partners');
    expect(d.marks['story.company.name']).toBe('you');
    // Cleared, it is fictional again, and the draft says so (DraftReady).
    d.brief.client = '';
    propagateBrief(d, 'client');
    expect(d.story.company.name).not.toBe('Northstar Health Partners');
    expect(d.marks['story.company.name']).toBe('ai');
  });

  it('the industry: the story and the events, in plain words', () => {
    const d = draft();
    d.brief.industry = 'Banking';
    const { summary, after } = previewBrief(d, 'industry');
    expect(summary).toEqual(expect.arrayContaining(['the company and its market']));
    expect(summary.some(s => /^\d+ events?$/.test(s))).toBe(true);
    expect(after.story.company.about).toMatch(/banking/);
    // Participants: nothing else in the draft depends on it.
    d.brief.participants = 'Store managers';
    expect(previewBrief(d, 'participants').summary).toEqual([]);
    expect(changeSummary(d, d)).toEqual([]);
  });
});
