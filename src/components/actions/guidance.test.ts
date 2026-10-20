import { describe, expect, it } from 'vitest';
import { createI18n } from '../../i18n';
import type { EngineView } from '../../engine/contract';
import { byIntent, fitsNow, fitText, intentOf, type GuidanceView } from './guidance';

type ActionV = EngineView['actions'][number];
type MemberV = EngineView['members'][number];

// The Sales Elevator's actions, as the view sends them: what the hint reads is the rule, kind, scope and format.
const SPECS: Array<[string, ActionV['rule'], ActionV['scope'], ActionV['kind'], string | null]> = [
  ['meet', 'styleOption', 'team', 'live', 'meeting'], ['energize', 'weeklyStyle', 'team', 'static', null],
  ['email', 'trend', 'member', 'live', 'email'], ['training', 'training', 'member', 'static', null],
  ['swap', 'swap', 'member', 'hybrid', 'roleplay'], ['hire', 'hire', 'team', 'live', 'interview'],
  ['fire', 'fire', 'member', 'hybrid', 'roleplay'], ['f2f', 'styleOption', 'member', 'live', 'roleplay'],
  ['assess', 'assess', 'member', 'static', null], ['reward', 'reward', 'member', 'hybrid', 'roleplay'],
  ['goals', 'styleOption', 'member', 'live', 'plan'], ['coach', 'styleOption', 'member', 'live', 'roleplay'],
  ['feedback', 'styleOption', 'member', 'live', 'chat']
];
const action = ([key, rule, scope, kind, format]: (typeof SPECS)[number]): ActionV => ({
  key, rule, name: key, description: '', scope, kind, format, cost: 1, perk: null, targets: [1, 1], prerequisite: null, options: [],
  cooldown: 0, unlockPeriod: 1, blocked: null, blockedFor: scope === 'member' ? { kent: null } : {}
});
const kent = (over: Partial<MemberV> = {}): MemberV => ({
  id: 'kent', name: 'Kent Ross', title: 'Rep', pronoun: 'he', stage: 'pitch', skill: 60, morale: 60, result: 60, trust: 60,
  style: null, lastStyle: null, lastReaction: null, mood: 'neutral', img: null, away: 0, awayReason: null, statsRevealed: true,
  shared: null, careerGoal: null, assessedStages: ['pitch'], assessments: {}, unread: false, promise: null,
  profile: { previous: '', tenure: '', experience: '', skills: '', remarks: '', relations: '' }, ...over
});
function view(over: Partial<MemberV> = {}, rest: Partial<GuidanceView> = {}): GuidanceView {
  return { phase: 'board', purpose: 'development', actions: SPECS.map(action), members: [kent(over)], promises: [], ...rest };
}
const block = (v: GuidanceView, key: string) => {
  const a = v.actions.find(x => x.key === key)!;
  a.blockedFor = { kent: { reason: 'cooldown', in: 2 } };
  return v;
};
const on = { guide: true };
const keys = (v: GuidanceView) => fitsNow(v, 'kent', on).map(h => h.key);

describe('grouping by intent (D234)', () => {
  it('maps every rule, and any whole team action to Team', () => {
    const groups = Object.fromEntries(SPECS.map(s => [s[0], intentOf(action(s))]));
    expect(groups).toEqual({
      meet: 'team', energize: 'team', hire: 'team',
      email: 'talk', f2f: 'talk', goals: 'talk', coach: 'talk', feedback: 'talk',
      training: 'develop', assess: 'develop', reward: 'develop',
      swap: 'decide', fire: 'decide'
    });
  });
  it('orders Talk, Develop, Decide, Team and keeps the authored order inside each', () => {
    expect(byIntent(SPECS.map(action), intentOf).map(a => a.key)).toEqual(['email', 'f2f', 'goals', 'coach', 'feedback', 'training', 'assess', 'reward', 'swap', 'fire', 'meet', 'energize', 'hire']);
  });
});

describe('fits now (D234)', () => {
  it('gives no hint to someone doing fine', () => {
    expect(keys(view())).toEqual([]);
  });

  it('low morale: a face to face conversation, with the number when it is revealed', () => {
    const [h] = fitsNow(view({ morale: 24 }), 'kent', on);
    expect(h).toEqual({ key: 'f2f', reason: { code: 'morale', morale: 24 } });
  });

  it('a hidden morale reads the mood instead', () => {
    const v = view({ morale: null, skill: null, result: null, trust: null, statsRevealed: false, mood: 'frustrated' });
    expect(fitsNow(v, 'kent', on)[0]).toEqual({ key: 'f2f', reason: { code: 'mood', mood: 'frustrated' } });
  });

  it('a promise due soon: an action that keeps it, a conversation first', () => {
    const v = view({}, { promises: [{ id: 'p1', memberId: 'kent', text: 'I will call the client', state: 'open', dueInSubPeriods: 1, keptBy: ['reward', 'coach'] }] });
    expect(fitsNow(v, 'kent', on)).toEqual([{ key: 'coach', reason: { code: 'promise' } }]);
    // Not yet due: no hint for it.
    v.promises[0].dueInSubPeriods = 4;
    expect(keys(v)).toEqual([]);
  });

  it('neglect: time alone with them', () => {
    expect(fitsNow(view({ neglected: true, unattended: 4 }), 'kent', on)).toEqual([{ key: 'f2f', reason: { code: 'neglect', periods: 4 } }]);
  });

  it('a style that did not land: talk it through', () => {
    expect(fitsNow(view({ lastReaction: 'neg' }), 'kent', on)).toEqual([{ key: 'f2f', reason: { code: 'missed' } }]);
  });

  it('not assessed yet: assess', () => {
    expect(fitsNow(view({ assessedStages: [] }), 'kent', on)).toEqual([{ key: 'assess', reason: { code: 'assess' } }]);
  });

  it('low skill with morale that holds: training; low skill with low morale: a conversation first', () => {
    expect(fitsNow(view({ skill: 30 }), 'kent', on)).toEqual([{ key: 'training', reason: { code: 'skill', skill: 30 } }]);
    expect(keys(view({ skill: 30, morale: 30 }))).toEqual(['f2f']);
  });

  it('a strong result: reward', () => {
    expect(fitsNow(view({ result: 82 }), 'kent', on)).toEqual([{ key: 'reward', reason: { code: 'result', result: 82 } }]);
  });

  it('at most two, never two conversations, best first', () => {
    const v = view({ morale: 24, neglected: true, unattended: 5, lastReaction: 'neg', assessedStages: [], result: 90 });
    expect(fitsNow(v, 'kent', on)).toEqual([{ key: 'f2f', reason: { code: 'morale', morale: 24 } }, { key: 'assess', reason: { code: 'assess' } }]);
  });

  it('never a blocked action: the next conversation, or nothing', () => {
    expect(keys(block(view({ morale: 24 }), 'f2f'))).toEqual(['coach']);
    expect(keys(block(view({ assessedStages: [] }), 'assess'))).toEqual([]);
    expect(keys(block(view({ skill: 30 }), 'training'))).toEqual([]);
    // Every conversation blocked (out of time, or away): no conversation is hinted.
    const v = view({ morale: 24 });
    for (const k of ['f2f', 'coach', 'goals', 'feedback']) block(v, k);
    expect(keys(v)).toEqual([]);
    // Blocked for everyone: a missing entry is not taken as open.
    const gone = view({ assessedStages: [] });
    gone.actions.find(a => a.key === 'assess')!.blockedFor = {};
    expect(keys(gone)).toEqual([]);
  });

  it('skips a repeat that would land at under half its effect', () => {
    const v = view({ morale: 24 });
    v.actions.find(a => a.key === 'f2f')!.repeatFor = { kent: { share: 0.3, uses: 2, ago: 1, window: 10 } };
    expect(keys(v)).toEqual(['coach']);
  });

  it('shows none with the guide off, in an assessment run, or off the plain board', () => {
    const busy = { morale: 24, assessedStages: [] };
    expect(keys(view(busy))).toHaveLength(2);
    expect(fitsNow(view(busy), 'kent', { guide: false })).toEqual([]);
    expect(keys(view(busy, { purpose: 'assessment' }))).toEqual([]);
    expect(keys(view(busy, { phase: 'style' }))).toEqual([]);
    expect(keys(view(busy, { phase: 'ended' }))).toEqual([]);
    expect(fitsNow(view(busy), 'nobody', on)).toEqual([]);
  });

  it('words each reason plainly', () => {
    const { t } = createI18n();
    const who = { name: 'Kent Ross', periodUnit: 'week' as const };
    expect([
      fitText(t, { code: 'promise' }, who),
      fitText(t, { code: 'morale', morale: 24 }, who),
      fitText(t, { code: 'mood', mood: 'concerned' }, who),
      fitText(t, { code: 'neglect', periods: 1 }, who),
      fitText(t, { code: 'neglect', periods: 2 }, { ...who, periodUnit: 'month' }),
      fitText(t, { code: 'missed' }, who),
      fitText(t, { code: 'assess' }, who),
      fitText(t, { code: 'skill', skill: 30 }, who),
      fitText(t, { code: 'result', result: 82 }, who)
    ]).toEqual([
      'You owe Kent a follow up: this keeps your promise',
      'Morale is 24: a conversation helps more than training',
      'Looks concerned: a conversation helps more than training',
      'No time alone with you for 1 week: meet before Kent loses heart',
      'No time alone with you for 2 months: meet before Kent loses heart',
      'Your last approach did not land: talk it through',
      'Not assessed yet: assess before you coach or move Kent',
      'Skill is 30 and morale holds: training pays off now',
      'Result is 82: recognize it while it is fresh'
    ]);
  });
});
