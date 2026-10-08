import { describe, expect, it } from 'vitest';
import { Brief } from '../../api/author';
import { AuthorDraft, type Tab } from './draft';
import { charactersIn, eventsIn, understand, type KoraAnswer } from './intents';
import { applyOps, checkOps, checkViewOps, editView } from './patch';
import { emptyChat, seedDraft } from './seed';

const draft = () => seedDraft({
  ...emptyChat(),
  brief: Brief.parse({ roleLevel: 'First time managers', industry: 'Healthcare', challenge: 'Keep the team going through a hard quarter.', teamSize: 10, duration: 'standard' }),
  asked: ['role_level', 'industry', 'challenge'], answers: { role_level: 'First time managers', industry: 'Healthcare', challenge: 'x' }, primary: 'six_styles'
}, 'workspace');

/** Every string value anywhere in the draft. */
function strings(v: unknown, out: string[] = []): string[] {
  if (typeof v === 'string') out.push(v);
  else if (Array.isArray(v)) for (const x of v) strings(x, out);
  else if (v && typeof v === 'object') for (const x of Object.values(v)) strings(x, out);
  return out;
}

function ask(d: AuthorDraft, text: string, tab: Tab = 'overview'): KoraAnswer {
  return understand(d, tab, text);
}
function change(d: AuthorDraft, text: string, tab: Tab = 'overview') {
  const a = ask(d, text, tab);
  if (a.kind !== 'change') throw new Error(`expected a change for "${text}", got: ${a.reply}`);
  return a;
}
/** Applies a proposal to a copy and checks nothing of the instruction was pasted into the content. */
function applied(d: AuthorDraft, text: string, tab: Tab = 'overview') {
  const a = change(d, text, tab);
  const next = structuredClone(d);
  applyOps(next, a.ops);
  expect(AuthorDraft.safeParse(next).success).toBe(true);
  const before = new Set(strings(d));
  const added = strings(next).filter(s => !before.has(s));
  const instruction = text.toLowerCase().replace(/[.!?]$/, '');
  for (const s of added) expect(s.toLowerCase(), `"${text}" pasted into ${s}`).not.toContain(instruction);
  for (const c of a.changes) {
    expect(c.after.toLowerCase()).not.toContain(instruction);
    expect(c.field.length).toBeGreaterThan(0);
  }
  return { a, next };
}

describe('Ask Kora offline: every instruction becomes structured changes (D125)', () => {
  it('"make it harder" raises the target and pacing, shortens windows and deepens setbacks', () => {
    const d = draft();
    const { a, next } = applied(d, 'Make it harder');
    expect(next.process.revenue!).toBeGreaterThan(d.process.revenue!);
    expect(next.process.pacing).toBe('demanding');
    const e = d.events.find(x => x.key === 'budget_cut')!;
    expect(next.events.find(x => x.key === 'budget_cut')!.within).toBe(e.within - 1);
    expect(next.events.find(x => x.key === 'budget_cut')!.morale).toBeLessThan(e.morale);
    expect(a.changes.find(c => c.path === 'process.revenue')).toMatchObject({ field: 'Revenue target', before: '240,000', after: '280,000' });
    expect(a.reply).toMatch(/^Harder:/);
    // Nothing appended to the company or the first event, the audit's failure.
    expect(next.story.company.about).toBe(d.story.company.about);
    expect(next.events[0].body).toBe(d.events[0].body);
  });

  it('"make it easier" goes the other way', () => {
    const d = draft();
    const { next } = applied(d, 'Make it a bit easier');
    expect(next.process.revenue!).toBeLessThan(d.process.revenue!);
    expect(next.process.pacing).toBe('forgiving');
  });

  it('"make decisions less obvious" narrows the style gap and gives the best option a cost', () => {
    const d = draft();
    const { a, next } = applied(d, 'Make decisions less obvious', 'actions');
    const f2f = (x: AuthorDraft) => x.actions.find(y => y.key === 'f2f')!.impact.coach;
    expect(f2f(d)).toEqual({ fit: 'Skill +1, morale +6, result +9', close: 'Skill −1, morale −4, result −5', wrong: 'Skill −1, morale −6, result −8' });
    expect(f2f(next)).toEqual({ fit: 'Skill +1, morale +4, result +6', close: 'Skill −1, morale −2, result −2', wrong: 'Skill −1, morale −6, result −8' });
    const energize = next.actions.find(y => y.key === 'energize')!;
    expect(energize.options.find(o => o.key === 'team_building')!.fits).toBe('Skill −3, morale +6, result +9');
    expect(a.changes.find(c => c.path === 'actions.f2f.impact.coach.fit')!.field).toMatch(/ · Coach when it fits$/);
    expect(a.reply).toMatch(/^Less obvious decisions/);
  });

  it('"introduce stronger trade-offs" gives options and opportunities opposing effects', () => {
    const d = draft();
    const { next } = applied(d, 'Introduce stronger trade-offs');
    const opts = next.actions.find(y => y.key === 'energize')!.options;
    expect(opts.map(o => o.fits)).toEqual(['Morale −2, result +4', 'Skill +1, morale +6, result −2']);
    expect(next.events.find(e => e.key === 'big_referral')).toMatchObject({ morale: -2, result: 4 });
  });

  it('"make consequences carry forward" sets what happens when an event is ignored', () => {
    const d = draft();
    const { next } = applied(d, 'Make consequences carry forward');
    expect(next.events.find(e => e.key === 'budget_cut')!.ignored).toBe('Comes back in week 4 and costs a further 3 morale; the sponsor asks what happened');
    expect(next.events.find(e => e.key === 'pulse_survey')!.ignored).toBe('');
  });

  it('combines compatible intents in one instruction', () => {
    const d = draft();
    const { next } = applied(d, 'Make it harder and make consequences carry forward');
    expect(next.process.pacing).toBe('demanding');
    expect(next.events.find(e => e.key === 'budget_cut')!.ignored).toMatch(/^Comes back/);
  });

  it('regenerates one named event and nothing else; an ambiguous week asks which', () => {
    const d = draft();
    const amb = ask(d, 'Regenerate only the week 3 event');
    expect(amb).toMatchObject({ kind: 'reply', options: ['Regenerate the event "Pulse survey results"', 'Regenerate the event "A hard message to share"'] });
    const { a } = applied(d, (amb as { options: string[] }).options[0]);
    expect(a.ops.every(o => o.op === 'set' && o.path.startsWith('events.pulse_survey.'))).toBe(true);
    expect(a.regenerate).toBe(true);
  });

  it('makes a named event more tense; "this event" without a name asks which', () => {
    const d = draft();
    const { next } = applied(d, 'Make the budget cut event more tense');
    expect(next.events.find(e => e.key === 'budget_cut')).toMatchObject({ morale: -7, result: -7, within: 1 });
    expect(next.events.filter(e => e.key !== 'budget_cut')).toEqual(d.events.filter(e => e.key !== 'budget_cut'));
    expect(ask(d, 'Improve this event and make it more tense', 'events')).toMatchObject({ kind: 'reply', reply: expect.stringMatching(/^Which event\?/) });
  });

  it('shortens and lengthens the run', () => {
    const d = draft();
    const { next } = applied(d, 'Shorten it to a 30 minute Lite run');
    expect(next.brief.run).toBe('lite');
    expect(next.process.weeks).toBe(4);
    expect(Math.max(...next.events.map(e => e.week ?? 0))).toBeLessThanOrEqual(4);
    expect(ask(next, 'Shorten it')).toMatchObject({ kind: 'reply', reply: expect.stringMatching(/already 4 weeks/) });
    expect(applied(next, 'Make it longer').next.process.weeks).toBe(8);
    expect(applied(d, 'Make the run 6 weeks').next.process.weeks).toBe(6);
  });

  it('adds a character within the limit and says so honestly when the team is full', () => {
    const d = draft();
    const { next } = applied(d, 'Add a remote team member');
    expect(next.team).toHaveLength(11);
    expect(next.team.at(-1)!.persona).toMatch(/video/);
    while (next.team.length < 12) applyOps(next, (change(next, 'Add a team member').ops));
    expect(ask(next, 'Add a team member')).toEqual({ kind: 'reply', reply: expect.stringMatching(/^Nothing to change\. The team is full/), source: 'rules' });
  });

  it('removes and renames a character, the company and a style', () => {
    const d = draft();
    const c = d.team[2];
    const removed = applied(d, `Remove ${c.first} from the team`).next;
    expect(removed.team.some(x => x.id === c.id)).toBe(false);
    const renamed = applied(d, `Rename ${c.first} ${c.last} to Ana Lopez`).next.team[2];
    expect([renamed.first, renamed.last]).toEqual(['Ana', 'Lopez']);
    expect(applied(d, 'Rename the company to Harbour Clinics').next.story.company.name).toBe('Harbour Clinics');
    expect(applied(d, 'Rename Coach to Mentor', 'lens').next.lens.styles.find(s => s.key === 'coach')!.name).toBe('Mentor');
  });

  it('changes the tone and the sponsor by replacing lines, never by appending the instruction', () => {
    const d = draft();
    const warm = applied(d, 'Make the tone warmer').next;
    expect(warm.brief.tones).toEqual(['Warm and encouraging']);
    expect(warm.story.screens.find(s => s.key === 'welcome')!.body.split('\n\n')[0]).toBe(`Welcome to ${d.story.company.name}. We are so glad to have you with us.`);
    expect(warm.story.screens.find(s => s.key === 'welcome')!.body.split('\n\n').slice(1)).toEqual(d.story.screens.find(s => s.key === 'welcome')!.body.split('\n\n').slice(1));
    const strict = applied(d, 'Make the sponsor more demanding').next;
    expect(strict.story.sponsor.voice).toBe('Brisk, direct');
    expect(strict.story.screens.find(s => s.key === 'welcome')!.body.split('\n\n')).toHaveLength(d.story.screens.find(s => s.key === 'welcome')!.body.split('\n\n').length);
  });

  it('makes a character more defensive: persona and stats, by whole name', () => {
    const d = draft();
    const c = d.team[0];
    const { next } = applied(d, `Make ${c.first} more defensive in the first meeting`, 'team');
    const n = next.team[0];
    expect(n.persona).toMatch(/gets defensive when questioned/);
    expect(n.stats.trust).toBe(c.stats.trust - 12);
    expect(next.team.slice(1)).toEqual(d.team.slice(1));
  });

  it('says honestly what it cannot do, and asks when two instructions conflict', () => {
    const d = draft();
    expect(ask(d, 'Make the story more about pricing pressure')).toMatchObject({ kind: 'reply', reply: expect.stringMatching(/^I can't do that yet\./) });
    expect(ask(d, 'Make it harder but also easier')).toMatchObject({ kind: 'reply', reply: expect.stringMatching(/^Those two conflict/), options: ['Make it harder', 'Make it easier'] });
    expect(ask(d, 'Shorten the run and make it longer')).toMatchObject({ kind: 'reply', options: ['Shorten the run', 'Lengthen the run'] });
    expect(ask(d, 'Make the sponsor more demanding and more supportive')).toMatchObject({ kind: 'reply', reply: expect.stringMatching(/conflict/) });
    expect(ask(d, '   ')).toMatchObject({ kind: 'reply' });
  });
});

describe('names in instructions', () => {
  it('escapes names, ignores empty ones and matches common words only as names', () => {
    const d = draft();
    d.team[0].first = 'Ana (Lead)';
    d.team[1].first = '';
    d.team[1].last = '';
    d.team[2].first = 'Will';
    expect(() => understand(d, 'team', 'Make it harder')).not.toThrow();
    expect(charactersIn(d, 'Make Ana (Lead) more confident').map(c => c.id)).toEqual([d.team[0].id]);
    expect(charactersIn(d, 'I will make it harder')).toEqual([]);
    expect(charactersIn(d, 'Will you make it harder?')).toEqual([]);
    expect(charactersIn(d, 'Make Will more confident').map(c => c.id)).toEqual([d.team[2].id]);
    expect(charactersIn(d, 'make it harder')).toEqual([]);
    // "Make it harder" no longer rewrites a character because of an empty name.
    expect(change(d, 'Make it harder').ops.some(o => o.op === 'set' && o.path.startsWith('team.'))).toBe(false);
    expect(eventsIn(d, 'make the week 2 events tougher').map(e => e.key)).toEqual(['competitor_moves', 'lens_moment']);
  });
});

describe('Kora\'s edits as data (the whitelist)', () => {
  it('refuses paths off the whitelist, values the schema refuses and fields the model was not shown', () => {
    const d = draft();
    expect(checkOps(d, [{ op: 'set', path: 'marks.title', value: 'you' }])).toMatchObject({ ok: false });
    expect(checkOps(d, [{ op: 'set', path: 'process.weeks', value: 40 }])).toMatchObject({ ok: false });
    expect(checkOps(d, [{ op: 'set', path: 'actions.f2f.impact.coach.fit', value: 'much better' }])).toMatchObject({ ok: false });
    expect(checkOps(d, [{ op: 'set', path: 'events.nope.body', value: 'x' }])).toMatchObject({ ok: false });
    expect(checkOps(d, [{ op: 'set', path: 'process.weeks', value: 6 }], new Set(['title']))).toMatchObject({ ok: false });
    const ok = checkOps(d, [{ op: 'set', path: 'process.weeks', value: 6 }, { op: 'set', path: 'title', value: d.title }]);
    expect(ok).toMatchObject({ ok: true, ops: [{ op: 'set', path: 'process.weeks', value: 6 }], marks: ['process.weeks'] });
    const view = editView(d, 'process');
    expect(Object.keys(view.fields)).toContain('process.revenue');
    expect(Object.keys(view.fields).some(k => k.startsWith('events.'))).toBe(false);
    expect(checkViewOps(view, [{ path: 'process.revenue', value: 300000 }])).toEqual([]);
    expect(checkViewOps(view, [{ path: 'events.budget_cut.body', value: 'x' }])).toHaveLength(1);
    expect(checkViewOps(view, [{ path: 'process.pacing', value: 'brutal' }])).toHaveLength(1);
  });
});
