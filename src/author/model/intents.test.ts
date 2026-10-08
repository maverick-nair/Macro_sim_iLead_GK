import { describe, expect, it } from 'vitest';
import { Brief } from '../../api/author';
import { AuthorDraft, type Tab } from './draft';
import { toStoryline } from './export';
import { charactersIn, eventsIn, understand, type KoraAnswer } from './intents';
import { applyOps, checkOps, checkViewOps, editView } from './patch';
import { fitRun } from './run';
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
  it('"make it harder" raises the target and pacing, and shortens the structured response windows', () => {
    const d = draft();
    const { a, next } = applied(d, 'Make it harder');
    expect(next.process.revenue!).toBeGreaterThan(d.process.revenue!);
    expect(next.process.pacing).toBe('demanding');
    const e = d.events.find(x => x.key === 'budget_cut')!;
    expect(e.respondWith.length).toBeGreaterThan(0);
    expect(next.events.find(x => x.key === 'budget_cut')!.within).toBe(e.within - 1);
    // Setbacks deepen through pacing in the export (D129), not twice in the draft.
    expect(next.events.find(x => x.key === 'budget_cut')!.morale).toBe(e.morale);
    expect(a.changes.find(c => c.path === 'process.revenue')).toMatchObject({ field: 'Revenue target', before: '240,000', after: '280,000' });
    expect(a.reply).toMatch(/^Harder:.*pacing becomes demanding \(10% fewer new leads, setbacks land 25% harder/);
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

  it('"make consequences carry forward" gives each event that needs an answer a real follow up the engine escalates to', () => {
    const d = draft();
    const { a, next } = applied(d, 'Make consequences carry forward');
    const cut = next.events.find(e => e.key === 'budget_cut')!;
    expect(cut.ifIgnored.sponsor).toBe(true);
    const follow = next.events.find(e => e.key === cut.ifIgnored.followUp)!;
    expect(follow).toMatchObject({ timing: 'followup', week: null, respondWith: [] });
    expect(follow.morale).toBeLessThan(0);
    // An event with no response expected gets no follow up.
    expect(next.events.find(e => e.key === 'pulse_survey')!.ifIgnored).toEqual(d.events.find(e => e.key === 'pulse_survey')!.ifIgnored);
    expect(a.changes.find(c => c.path === 'events.budget_cut.ifIgnored.followUp')!.after).toBe(follow.title);
    // The export plays it: the engine's escalation names the follow up, and nothing dangles.
    const out = toStoryline(next);
    expect(out.issues).toEqual([]);
    expect(out.storyline.events!.find(e => e.key === 'budget_cut')!.escalation).toEqual({ sponsor: true, event: follow.key });
    expect(out.storyline.events!.find(e => e.key === follow.key)).toMatchObject({ period: undefined, window: undefined, when: undefined });
    // Asked again, nothing changes.
    expect(ask(next, 'Make consequences carry forward')).toMatchObject({ kind: 'reply', reply: expect.stringMatching(/^Nothing to change/) });
  });

  it('a follow up event nothing leads to yet is used before a new one is made', () => {
    const d = draft();
    const spare = d.events.find(e => e.key !== 'budget_cut' && e.respondWith.length === 0)!;
    Object.assign(spare, { timing: 'followup', week: null });
    const cut = d.events.find(e => e.key === 'budget_cut')!;
    cut.ifIgnored = { sponsor: false, followUp: null };
    const { next } = applied(d, 'Make the budget cut event carry forward if ignored');
    expect(next.events.find(e => e.key === 'budget_cut')!.ifIgnored).toEqual({ sponsor: true, followUp: spare.key });
    expect(next.events).toHaveLength(d.events.length);
  });

  it('combines compatible intents in one instruction', () => {
    const d = draft();
    const { next } = applied(d, 'Make it harder and make consequences carry forward');
    expect(next.process.pacing).toBe('demanding');
    expect(next.events.find(e => e.key === 'budget_cut')!.ifIgnored.followUp).toBeTruthy();
  });

  it('"make it harder" changes the exported storyline: target, pacing levers, response windows and event impacts', () => {
    const d = draft();
    const { next } = applied(d, 'Make it harder');
    const before = toStoryline(d), after = toStoryline(next);
    expect(after.issues).toEqual([]);
    const a = before.storyline, b = after.storyline;
    expect(b.money.target).toBeGreaterThan(a.money.target);
    // Pacing (D129): fewer leads, faster drift, a harsher sponsor on an ignored event.
    expect(b.money.inputPerSubPeriod[0]).toBeLessThan(a.money.inputPerSubPeriod[0]);
    expect(b.drift?.morale ?? 3).toBeGreaterThan(a.drift?.morale ?? 3);
    expect(b.gamification?.sponsor?.escalation ?? -10).toBeLessThan(a.gamification?.sponsor?.escalation ?? -10);
    const ev = (s: typeof a, k: string) => s.events!.find(e => e.key === k)!;
    expect(ev(b, 'budget_cut').response!.within).toBe(ev(a, 'budget_cut').response!.within! - 1);
    // Setbacks land harder: every negative impact is at least as deep, and some deeper.
    const neg = (s: typeof a) => s.events!.flatMap(e => (e.impact ?? []).filter(v => v < 0));
    expect(neg(b).reduce((x, y) => x + y, 0)).toBeLessThan(neg(a).reduce((x, y) => x + y, 0));
    expect(ev(b, 'budget_cut').impact![1]).toBeLessThan(ev(a, 'budget_cut').impact![1]);
    // Easier goes back the other way in the export too.
    const eased = applied(next, 'Make it easier').next;
    expect(toStoryline(eased).storyline.money.inputPerSubPeriod[0]).toBeGreaterThan(b.money.inputPerSubPeriod[0]);
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

  it('shortens and lengthens the run with the same remapping as the Brief tab (fitRun)', () => {
    const d = draft();
    const { a, next } = applied(d, 'Shorten it to a 30 minute Lite run');
    expect(next.brief.run).toBe('lite');
    expect(next.process.weeks).toBe(4);
    expect(Math.max(...next.events.map(e => e.week ?? 0))).toBeLessThanOrEqual(4);
    const brief = structuredClone(d);
    brief.brief.run = 'lite';
    fitRun(brief, 4);
    expect(next.events).toEqual(brief.events);
    expect(next.actions.map(x => x.availableFrom)).toEqual(brief.actions.map(x => x.availableFrom));
    expect(a.reply).toMatch(/To fit the new length, \d+ items? moved/);
    expect(a.changes.some(c => c.field.endsWith('moves to fit the run'))).toBe(true);
    expect(toStoryline(next).issues).toEqual([]);
    expect(ask(next, 'Shorten it')).toMatchObject({ kind: 'reply', reply: expect.stringMatching(/already 4 weeks/) });
    expect(applied(next, 'Make it longer').next.process.weeks).toBe(8);
    expect(applied(d, 'Make the run 6 weeks').next.process.weeks).toBe(6);
    expect(change(d, 'Make the run 12 weeks').reply).toMatch(/becomes 10 weeks \(10 is the most/);
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
    const theirs = d.events.find(e => e.who !== c.id && /^[a-z]/.test(e.who) && !['team', 'member', 'sponsor'].includes(e.who) && !e.who.startsWith('stage:'));
    if (theirs) theirs.who = c.id;
    const { a: rm, next: removed } = applied(d, `Remove ${c.first} from the team`);
    expect(removed.team.some(x => x.id === c.id)).toBe(false);
    // Their events are said in the diff, never moved silently.
    if (theirs) expect(rm.changes.find(x => x.path === `events.${theirs.key}.who`)).toMatchObject({ after: 'One person, the engine picks' });
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
    expect(eventsIn(d, 'make the week 2 events tougher').map(e => e.key)).toEqual(['competitor_moves', 'lens_moment', 'discount_decision']);
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

  it('checks structured event references: a follow up must exist and not be itself, a response must be an action', () => {
    const d = draft();
    expect(checkOps(d, [{ op: 'set', path: 'events.budget_cut.ifIgnored.followUp', value: 'nope' }])).toMatchObject({ ok: false });
    expect(checkOps(d, [{ op: 'set', path: 'events.budget_cut.ifIgnored.followUp', value: 'budget_cut' }])).toMatchObject({ ok: false });
    expect(checkOps(d, [{ op: 'set', path: 'events.budget_cut.respondWith', value: ['nope'] }])).toMatchObject({ ok: false });
    expect(checkOps(d, [{ op: 'set', path: 'events.budget_cut.response', value: 'f2f' }])).toMatchObject({ ok: false });
    expect(checkOps(d, [{ op: 'set', path: 'events.budget_cut.ignored', value: 'x' }])).toMatchObject({ ok: false });
    const other = d.events.find(e => e.key !== 'budget_cut')!;
    expect(checkOps(d, [{ op: 'set', path: 'events.budget_cut.ifIgnored.followUp', value: other.key }])).toMatchObject({ ok: true, changes: [{ after: other.title }] });
    const view = editView(d, 'events');
    expect(view.fields['events.budget_cut.respondWith']).toEqual(d.events.find(e => e.key === 'budget_cut')!.respondWith);
    expect('events.budget_cut.ifIgnored.followUp' in view.fields).toBe(true);
    expect(checkViewOps(view, [{ path: 'events.budget_cut.within', value: 9 }])).toHaveLength(1);
  });

  it('a new number of weeks set by the model moves events the same way (fitRun)', () => {
    const d = draft();
    const c = checkOps(d, [{ op: 'set', path: 'process.weeks', value: 4 }]);
    expect(c.ok).toBe(true);
    const next = structuredClone(d);
    applyOps(next, (c as { ops: Parameters<typeof applyOps>[1] }).ops);
    const ref = structuredClone(d);
    fitRun(ref, 4);
    expect(next.events).toEqual(ref.events);
    expect(next.process.weeks).toBe(4);
  });
});
