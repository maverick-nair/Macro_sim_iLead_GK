import { describe, expect, it } from 'vitest';
import { Brief } from '../../api/author';
import { configHash } from '../calibrate/logic/hash';
import type { AuthorDraft } from './draft';
import { toStoryline } from './export';
import { effectText, emptyChat, seedDraft } from './seed';
import { MIN_ACTIONS, readiness, recordCalibration, syntheticGate, validateDraft, validationOf } from './validate';

const chat = (): AuthorDraft['chat'] => ({
  ...emptyChat(),
  brief: Brief.parse({ roleLevel: 'First time sales managers', industry: 'Manufacturing', challenge: 'Deals stall at negotiation and new reps burn out.', client: 'Ascent Lifts', teamSize: 10, duration: 'standard' }),
  asked: ['role_level', 'industry', 'challenge', 'client'], answers: { role_level: 'First time sales managers', industry: 'Manufacturing', challenge: 'x', client: 'Ascent Lifts' }, primary: 'readiness_based'
});

/** A draft with nothing left to do but the synthetic test, which passed on this version. */
function ready(): AuthorDraft {
  const d = seedDraft(chat(), 'workspace');
  d.story.product.dealValue = 42000;
  for (const s of d.scoring.samples) s.call = s.scored;
  d.publish.played = true;
  d.calibration = recordCalibration(null, { status: 'passed', summary: 'All good.', full: true }, configHash(toStoryline(d).storyline));
  return d;
}
const ids = (d: AuthorDraft) => validateDraft(d).blocking.map(i => i.id);
const blockedBy = (d: AuthorDraft, pattern: RegExp) => validateDraft(d).blocking.filter(i => pattern.test(i.id));

describe('the publish gate (D131)', () => {
  it('passes a finished draft, and the header says Ready to publish', () => {
    const d = ready();
    expect(validateDraft(d).blocking).toEqual([]);
    expect(readiness(d)).toEqual({ kind: 'ready', text: 'Ready to publish', count: 0 });
    expect(validationOf(d)).toBe(validationOf(d));
  });

  it('blocks on every field labelled Required: participants, industry, product name and the rest', () => {
    const d = ready();
    d.brief.participants = ' ';
    d.brief.industry = '';
    d.story.product.name = '';
    d.brief.language = '';
    const b = validateDraft(d).blocking;
    expect(b.map(i => i.id)).toEqual(expect.arrayContaining(['required.brief.participants', 'required.brief.industry', 'required.story.product.name', 'required.brief.language']));
    expect(b.find(i => i.id === 'required.brief.participants')).toMatchObject({ title: 'Participants is empty', tab: 'brief', target: 'brief.participants' });
    expect(b.find(i => i.id === 'required.story.product.name')).toMatchObject({ tab: 'story' });
    expect(readiness(d).kind).toBe('need');
  });

  it('blocks with too few actions in use, and when a core action is gone', () => {
    const d = ready();
    for (const a of d.actions) if (!a.core) a.enabled = false;
    expect(ids(d)).not.toContain('mechanics.actions');
    d.actions = d.actions.filter(a => a.template !== 'coach' && a.template !== 'feedback');
    expect(ids(d)).toEqual(expect.arrayContaining(['mechanics.actions', 'mechanics.core.coach', 'mechanics.core.feedback']));
    expect(blockedBy(d, /^mechanics\.actions$/)[0].title).toBe(`Only 3 actions are in use`);
    expect(blockedBy(d, /core\.coach/)[0]).toMatchObject({ title: 'The core action "Coach member" is not in use', tab: 'actions' });
    expect(MIN_ACTIONS).toBe(4);
  });

  it('blocks when no conversation tells styles apart, and when every conversation has the same table', () => {
    const d = ready();
    const same = { fit: effectText([1, 2, 3]), close: effectText([1, 2, 3]), wrong: effectText([1, 2, 3]) };
    for (const a of d.actions) for (const k of Object.keys(a.impact)) a.impact[k] = { ...same };
    expect(ids(d)).toContain('mechanics.impact.flat');
    const e = ready();
    const table = e.actions.find(a => a.key === 'coach')!.impact;
    for (const a of e.actions) if (a.canPlay.length > 1) a.impact = structuredClone(table);
    expect(ids(e)).toContain('mechanics.impact.same');
    const f = ready();
    for (const k of Object.keys(f.actions.find(a => a.key === 'coach')!.impact)) f.actions.find(a => a.key === 'coach')!.impact[k] = { ...same };
    f.publish.skipTest = true;
    const v = validateDraft(f);
    expect(v.blocking).toEqual([]);
    expect(v.advisories.map(i => i.id)).toContain('mechanics.impact.coach');
  });

  it('blocks a static decision with no option or only one', () => {
    const d = ready();
    const coach = d.actions.find(a => a.key === 'coach')!;
    coach.plays = 'static';
    coach.options = coach.options.slice(0, 1);
    expect(blockedBy(d, /options\.coach/)[0].title).toBe('"Coach member" is a decision with only one option');
    coach.options = [];
    expect(blockedBy(d, /options\.coach/)[0].title).toBe('"Coach member" is a decision with no options');
    const energize = d.actions.find(a => a.key === 'energize')!;
    energize.options = energize.options.slice(0, 1);
    expect(ids(d)).toContain('mechanics.options.energize');
    // An action whose rule is not a choice plays with one option.
    expect(ids(d)).not.toContain('mechanics.options.assess');
  });

  it('blocks a fit table where every style fits everyone, or one style fits every need', () => {
    const d = ready();
    for (const n of Object.keys(d.lens.fit) as Array<keyof typeof d.lens.fit>) for (const k of Object.keys(d.lens.fit[n])) d.lens.fit[n][k] = 0;
    expect(ids(d)).toContain('mechanics.fit.flat');
    const e = ready();
    for (const n of Object.keys(e.lens.fit) as Array<keyof typeof e.lens.fit>) e.lens.fit[n].D = 0;
    expect(blockedBy(e, /fit\.D/)[0].title).toBe('"Directing" fits every need');
    // A scrambled table that still plays is advice: the descriptions no longer match.
    const f = ready();
    const rows = Object.keys(f.lens.fit) as Array<keyof typeof f.lens.fit>;
    const copy = structuredClone(f.lens.fit);
    rows.forEach((n, i) => { f.lens.fit[n] = copy[rows[(i + 1) % rows.length]]; });
    expect(validateDraft(f).advisories.map(i => i.id)).toContain('mechanics.fit.moved');
  });

  it('blocks duplicate character names, style names and tags, and skills', () => {
    const d = ready();
    d.team[1].first = d.team[0].first;
    d.team[1].last = ` ${d.team[0].last.toUpperCase()} `;
    d.lens.styles[1].name = d.lens.styles[0].name;
    d.lens.styles[2].letter = d.lens.styles[3].letter;
    d.scoring.framework = { file: 'f.md', pages: 1, step: 3, confirmed: true, rows: [
      { skill: 'Coaching', behaviors: 'Asks questions', levels: null, page: 1, include: true },
      { skill: 'Coaching', behaviors: 'Gives time', levels: null, page: 1, include: true },
      { skill: 'Feedback!', behaviors: 'Names the work', levels: null, page: 1, include: true },
      { skill: 'Feedback', behaviors: 'Says it soon', levels: null, page: 1, include: true }
    ] };
    const b = validateDraft(d).blocking;
    expect(b.map(i => i.title)).toEqual(expect.arrayContaining([
      `Two characters are called "${d.team[0].first} ${d.team[0].last}"`,
      `Two styles are called "${d.lens.styles[0].name}"`,
      `Two styles share the tag "${d.lens.styles[3].letter}"`,
      'Two skills are called "Coaching"',
      'Two skills would be scored as one'
    ]));
    expect(b.filter(i => i.area === 'names').every(i => i.tab)).toBe(true);
  });

  it('blocks events, stages and relationships that point at people or stages that are gone', () => {
    const d = ready();
    const gone = d.team.pop()!;
    d.events[0].who = gone.id;
    d.events[1].who = 'stage:closing';
    d.team[0].relationships = [{ with: gone.id, kind: 'Works closely with' }];
    d.team[1].stage = 'nowhere';
    const b = validateDraft(d).blocking.filter(i => i.area === 'links');
    expect(b.map(i => i.title)).toEqual(expect.arrayContaining([
      `The event "${d.events[0].title}" is for someone no longer in the team`,
      `The event "${d.events[1].title}" is for a stage that no longer exists`,
      expect.stringMatching(/has a relationship with someone no longer in the team$/),
      expect.stringMatching(/works in a stage that no longer exists$/)
    ]));
    expect(b.every(i => i.tab === 'events' || i.tab === 'team')).toBe(true);
  });

  it('never passes scoring on no samples, unanswered samples or low agreement', () => {
    const d = ready();
    d.scoring.samples = [];
    expect(blockedBy(d, /^scoring/)[0].title).toBe('There are no scoring samples to check');
    const e = ready();
    e.scoring.samples[0].call = null;
    expect(blockedBy(e, /^scoring/)[0].title).toBe('1 of 6 scoring samples still need your call');
    const f = ready();
    f.scoring.samples[0].call = f.scoring.samples[0].scored === 'strong' ? 'weak' : 'strong';
    expect(blockedBy(f, /^scoring/)[0].title).toBe('You agree with only 5 of 6 scoring samples');
  });

  it('blocks on every issue the export or the engine reports, whatever its shape', () => {
    const d = ready();
    const out = toStoryline(d);
    const v = validateDraft(d, { ...out, issues: ['members.0: bad', { message: 'Two actions share the key coach' }] as unknown as string[] });
    expect(v.blocking.filter(i => i.area === 'engine').map(i => i.detail)).toEqual(['members.0: bad', 'Two actions share the key coach']);
  });

  it('the header badge counts blocking issues once nothing needs the author', () => {
    const d = ready();
    d.calibration = null;
    expect(readiness(d)).toEqual({ kind: 'fix', text: '1 to fix', count: 1 });
    // Drafts are never changed in place in the app; the cache is per draft object.
    const e = structuredClone(d);
    e.publish.skipTest = true;
    expect(readiness(e).kind).toBe('ready');
  });
});

describe('the synthetic players gate (D132)', () => {
  const pass = { status: 'passed' as const, summary: 'Passed.', full: true };
  const fail = { status: 'failed' as const, summary: 'Experts miss Gold.', full: true };
  const partial = { status: 'advisory' as const, summary: 'Two levels only.', full: false };

  it('not run, out of date and partial block, unless the author ticks Publish without testing', () => {
    expect(syntheticGate(null, 'h', false)).toMatchObject({ state: 'notRun', acknowledgeable: true, issue: { blocking: true } });
    expect(syntheticGate(null, 'h', true)).toMatchObject({ state: 'notRun', issue: { blocking: false } });
    const ran = recordCalibration(null, pass, 'a');
    expect(syntheticGate(ran, 'a', false)).toEqual({ state: 'passed', acknowledgeable: false, issue: null });
    expect(syntheticGate(ran, 'b', false)).toMatchObject({ state: 'outOfDate', issue: { blocking: true } });
    expect(syntheticGate(ran, 'b', true)).toMatchObject({ state: 'outOfDate', issue: { blocking: false } });
    const part = recordCalibration(null, partial, 'a');
    expect(part.status).toBe('partial');
    expect(syntheticGate(part, 'a', false)).toMatchObject({ state: 'partial', issue: { blocking: true, title: 'The last synthetic test was not a full test' } });
    expect(syntheticGate(recordCalibration(null, { ...pass, status: 'advisory' }, 'a'), 'a', false)).toMatchObject({ state: 'advisory', issue: { blocking: false } });
  });

  it('a failure stays blocking after an edit, a partial run and the checkbox, until a full run passes', () => {
    const failed = recordCalibration(null, fail, 'a');
    expect(syntheticGate(failed, 'a', false)).toMatchObject({ state: 'failed', acknowledgeable: false, issue: { blocking: true } });
    // An edit since: still blocking, and Publish without testing does not cover it.
    expect(syntheticGate(failed, 'b', true)).toMatchObject({ state: 'failedEarlier', issue: { blocking: true } });
    // A partial run on the new version does not clear it.
    const afterPartial = recordCalibration(failed, partial, 'b');
    expect(afterPartial.failed).toEqual({ summary: 'Experts miss Gold.', configHash: 'a' });
    expect(syntheticGate(afterPartial, 'b', true)).toMatchObject({ state: 'failedEarlier', issue: { blocking: true } });
    // A full run that passes does.
    const fixed = recordCalibration(afterPartial, pass, 'c');
    expect(fixed.failed).toBeNull();
    expect(syntheticGate(fixed, 'c', false).issue).toBeNull();
  });

  it('reads a run recorded before D132 by its passed and advisory flags', () => {
    expect(syntheticGate({ ranAt: 1, passed: false, summary: 'x', configHash: 'a' }, 'a', false)).toMatchObject({ state: 'failed', issue: { blocking: true } });
    expect(syntheticGate({ ranAt: 1, passed: true, advisory: true, summary: 'x', configHash: 'a' }, 'a', false)).toMatchObject({ state: 'advisory' });
  });
});
