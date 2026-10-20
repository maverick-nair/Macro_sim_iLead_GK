import { describe, expect, it } from 'vitest';
import { wordAll as en } from '../../i18n/engineCopy';
import { parseStoryline, type StorylineConfig } from '../config';
import salesElevator from '../storylines/sales-elevator.json';
import { createSim, exchangeOf } from '../sim/sim';
import { play } from '../sim/policies';
import type { LiveRecord, Sim } from '../sim/types';
import { pickActions, pickFindings, pickMoments, type FindingInput } from './brief';
import { buildReport } from './build';
import type { DriverItem } from './narrative';

/** The first page's selection (D235): three findings, three things to do on Monday, the two moments that mattered most. */
const parsed = parseStoryline(salesElevator);
if (!parsed.ok) throw new Error(parsed.issues.join('\n'));
const config: StorylineConfig = parsed.config;

const driver = (key: string, tone: DriverItem['tone']): DriverItem => ({ key, tone, text: `${key} text` });
const base: FindingInput = {
  purpose: 'development', held: null, drivers: [],
  rated: [{ name: 'Coaching', level: 'Advanced' }, { name: 'Feedback', level: 'Proficient' }, { name: 'Goals', level: 'Developing' }],
  business: { text: 'business line', share: 80 }
};

describe('three findings', () => {
  it('open with what held the level down, then the largest driver, then the strongest and weakest skill', () => {
    const f = pickFindings({ ...base, held: 'held line', drivers: [driver('drift', 'negative'), driver('fit', 'positive')] });
    expect(f.map(x => x.key)).toEqual(['held', 'driver:drift', 'skills']);
    expect(f[0].tone).toBe('negative');
    expect(en(f[2].text)).toBe('Your strongest skill was Coaching (Advanced); the one to grow next is Goals (Developing).');
  });

  it('open with the business outcome when nothing held the level down, toned by the share of target', () => {
    expect(pickFindings({ ...base, drivers: [driver('fit', 'positive')] }).map(x => [x.key, x.tone])).toEqual([['business', 'neutral'], ['driver:fit', 'positive'], ['skills', 'neutral']]);
    expect(pickFindings({ ...base, business: { text: 'b', share: 112 } })[0].tone).toBe('positive');
    expect(pickFindings({ ...base, business: { text: 'b', share: 40 } })[0].tone).toBe('negative');
  });

  it('without a rated skill, balance the largest driver with the largest of the other tone', () => {
    const f = pickFindings({ ...base, rated: [], drivers: [driver('neglect', 'negative'), driver('drift', 'negative'), driver('coach', 'positive')] });
    expect(f.map(x => x.key)).toEqual(['business', 'driver:neglect', 'driver:coach']);
  });

  it('fill up to three from what is left, and never repeat one', () => {
    expect(pickFindings({ ...base, rated: [], drivers: [driver('a', 'negative'), driver('b', 'negative')] }).map(x => x.key)).toEqual(['business', 'driver:a', 'driver:b']);
    expect(pickFindings({ ...base, rated: [], drivers: [] }).map(x => x.key)).toEqual(['business']);
    expect(pickFindings({ ...base, held: 'h', drivers: [] }).map(x => x.key)).toEqual(['held', 'skills', 'business']);
  });

  it('word one rated skill alone, and assessment neutrally', () => {
    expect(en(pickFindings({ ...base, rated: [base.rated[0]] })[1].text)).toBe('Your one rated skill was Coaching (Advanced).');
    expect(en(pickFindings({ ...base, purpose: 'assessment' })[1].text)).toBe('Highest rated skill: Coaching (Advanced). Lowest rated: Goals (Developing).');
  });
});

describe('three things to do on Monday', () => {
  const plan = [
    { skill: 'coaching', name: 'Coaching', onTheJob: 'Ask one open question in every 1:1.' },
    { skill: 'goals', name: 'Goals', onTheJob: 'Agree one measurable goal with each person.' },
    { skill: 'feedback', name: 'Feedback', onTheJob: 'Give one piece of specific feedback.' }
  ];

  it('start with the person the run names, then the plan, lowest rated skill first', () => {
    const a = pickActions({ purpose: 'development', person: 'Start with Derick.', plan, fallback: ['Check morale weekly.'], needs: [] });
    expect(a.map(x => x.key)).toEqual(['person', 'plan:coaching', 'plan:goals']);
    expect(a[1]).toEqual({ key: 'plan:coaching', text: plan[0].onTheJob, skill: 'Coaching' });
  });

  it('fill from the practical takeaway when the plan is short, and skip empty or repeated actions', () => {
    const a = pickActions({ purpose: 'development', person: null, plan: [plan[0], { ...plan[1], onTheJob: '' }, { ...plan[2], onTheJob: plan[0].onTheJob }], fallback: ['Check morale weekly.'], needs: [] });
    expect(a.map(x => x.key)).toEqual(['plan:coaching', 'takeaway:0']);
  });

  it('give an assessment no next step: up to three needs against the bar, for the assessor', () => {
    const needs = ['a', 'b', 'c', 'd'].map(k => ({ key: k, name: k.toUpperCase(), level: 'Developing', bar: 'Proficient' }));
    const a = pickActions({ purpose: 'assessment', person: 'Start with Derick.', plan, fallback: ['x'], needs });
    expect(a.map(x => x.key)).toEqual(['need:a', 'need:b', 'need:c']);
    expect(a[0].skill).toBe('A');
    expect(en(a[0].text)).toBe('Rated Developing; the bar for the role is Proficient.');
    expect(pickActions({ purpose: 'assessment', person: null, plan, fallback: [], needs: [] })).toEqual([]);
  });
});

describe('the two moments that mattered most', () => {
  const m = (kind: 'best' | 'revisit', weight: number, said = true) => ({ kind, weight, said });

  it('take the weightiest, then the weightiest of the other kind, in the run\'s order', () => {
    expect(pickMoments([m('revisit', 5), m('best', 3), m('revisit', 9), m('best', 4)])).toEqual([2, 3]);
  });

  it('prefer moments with words to replay, and keep to one kind when the other has none', () => {
    expect(pickMoments([m('revisit', 30, false), m('best', 6), m('best', 8)])).toEqual([1, 2]);
    expect(pickMoments([m('revisit', 30, false), m('revisit', 20, false)])).toEqual([0, 1]);
  });

  it('show what there is: one moment, or none', () => {
    expect(pickMoments([m('best', 1)])).toEqual([0]);
    expect(pickMoments([])).toEqual([]);
  });
});

describe('the replay a moment carries', () => {
  it('keeps the participant\'s first turn and the reply to it, or that turn alone', () => {
    expect(exchangeOf([{ id: 't1', by: 'kent', text: 'Hi.' }, { id: 't2', by: 'you', text: 'How are you?' }, { id: 't3', by: 'kent', text: 'Tired.' }, { id: 't4', by: 'you', text: 'Why?' }]))
      .toEqual([{ by: 'you', text: 'How are you?' }, { by: 'kent', text: 'Tired.' }]);
    expect(exchangeOf([{ id: 't1', by: 'you', text: 'Thanks.' }])).toEqual([{ by: 'you', text: 'Thanks.' }]);
    expect(exchangeOf([{ id: 't1', by: 'kent', text: 'Hi.' }])).toEqual([]);
  });

  it('reaches the report with who replied, and the first page points at the moments that mattered', () => {
    const sim: Sim = createSim(config, 1);
    const rec = (id: string, band: LiveRecord['band'], impact: number, extra: Partial<LiveRecord> = {}): LiveRecord => ({
      id, period: 1, sub: 1, actionKey: 'f2f', format: 'roleplay', band, memberIds: ['kent'], title: `Talk ${id}`, quotes: ['How are you?'], impact, skills: [], ...extra
    });
    sim.liveRecords.push(
      rec('r1', 'weak', 9, { exchange: [{ by: 'you', text: 'How are you?' }, { by: 'kent', text: 'Tired, to be honest.' }] }),
      rec('r2', 'strong', 4, { exchange: [{ by: 'you', text: 'Well done.' }] }),
      rec('r3', 'weak', 2)
    );
    const report = en(buildReport(sim));
    const picked = report.brief.moments.map(i => report.moments[i]);
    expect(picked.map(x => x.id)).toEqual(['r1', 'r2']);
    expect(picked[0].replay).toEqual([{ you: true, name: null, text: 'How are you?' }, { you: false, name: 'Kent', text: 'Tired, to be honest.' }]);
    expect(picked[1].replay).toEqual([{ you: true, name: null, text: 'Well done.' }]);
  });
});

describe('the first page from a whole run', () => {
  it('holds three findings, three things to do and two moments, all from the report', async () => {
    const r = await play(config, 'random', 5);
    const rep = en(r.view.report!);
    expect(rep.brief.findings).toHaveLength(3);
    expect(rep.brief.actions).toHaveLength(3);
    expect(rep.brief.moments).toHaveLength(2);
    expect(rep.brief.moments.every(i => rep.moments[i])).toBe(true);
    const drivers = rep.summary.drivers.map(d => d.text);
    expect(rep.brief.findings.some(f => drivers.includes(f.text))).toBe(true);
    expect(rep.brief.actions.some(a => rep.plan.some(p => p.onTheJob === a.text))).toBe(true);
  });
});
