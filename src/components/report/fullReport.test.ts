import { describe, expect, it } from 'vitest';
import { moneyFormatter } from '../../engine/money';
import { playToEnd } from '../../engine/mock';
import { parseReport } from '../../engine/reportContract';
import { createI18n } from '../../i18n';
import { buildReportModel, type SectionModel } from './engine';
import { sectionTitle, withEvidence } from './fullReport';
import './messages';

/** The full report's hiding rule (D235): what has nothing to say is left out, and named once at the end. */
const i18n = createI18n();
const level = { index: 1, name: 'Developing' };
const row = (key: string, rated: boolean) => ({ key, name: key.toUpperCase(), level: rated ? level : null, quote: null });

describe('leaving out what has nothing to say', () => {
  it('leaves out each skill without a level, and the skills section when none has one', () => {
    const some = withEvidence([{ key: 'skills', rows: [row('a', true), row('b', false), row('c', false)], levels: ['x', 'y'] }]);
    expect(some.sections).toHaveLength(1);
    expect(some.sections[0].key === 'skills' && some.sections[0].rows.map(r => r.key)).toEqual(['a']);
    expect(some.leftOut).toEqual([{ kind: 'skill', name: 'B' }, { kind: 'skill', name: 'C' }]);
    const none = withEvidence([{ key: 'skills', rows: [row('a', false)], levels: ['x'] }]);
    expect(none).toEqual({ sections: [], leftOut: [{ kind: 'section', key: 'skills' }] });
  });

  it('leaves out sections with no evidence in them, and keeps the order of the rest', () => {
    const empty: SectionModel[] = [
      { key: 'moments', moments: [] },
      { key: 'intent', cards: [{ key: 'k', did: 'd', said: null, verdict: 'v', tone: 'neutral' }] },
      { key: 'analytics', data: { conversations: 0, talkRatio: null, openQuestions: 0, recognition: 0, spoken: 0 } },
      { key: 'consistency', data: { actions: [], members: [], deviations: [{ key: 'neededUsed', value: null, narrative: null }] } },
      { key: 'actions', rows: [{ key: 'a', name: 'A', description: null, narrative: '', frequency: 0, impact: 'none' }] },
      { key: 'distribution', data: { actions: [], members: [], totals: [0, 0] } },
      { key: 'people', people: [] },
      { key: 'style', periods: [1], rows: [], summary: '', extras: {} as never }
    ];
    const kept: SectionModel[] = [
      { key: 'about', data: { lines: [], howToRead: [], confidentiality: '' } },
      { key: 'intent', cards: [{ key: 'k', did: 'd', said: null, verdict: 'v', tone: 'gain' }, { key: 'j', did: 'd', said: null, verdict: 'v', tone: 'neutral' }] },
      { key: 'analytics', data: { conversations: 3, talkRatio: null, openQuestions: 0, recognition: 0, spoken: 0 } }
    ];
    const r = withEvidence([kept[0], ...empty, kept[1], kept[2]]);
    expect(r.sections).toEqual(kept);
    expect(r.leftOut).toEqual(empty.map(s => ({ kind: 'section', key: s.key })));
  });

  it('names sections by their titles', () => {
    expect(sectionTitle(i18n.t, 'moments', { purpose: 'development', unit: 'week', periods: 8 })).toBe('Key moments');
    expect(sectionTitle(i18n.t, 'plan', { purpose: 'assessment', unit: 'week', periods: 8 })).toBe('Development needs');
    expect(sectionTitle(i18n.t, 'team', { purpose: 'development', unit: 'week', periods: 8 })).toBe('Your team over eight weeks');
  });
});

describe('the report model from a run', () => {
  const date = new Date(2026, 9, 5);
  const model = async (policy: 'good' | 'passive', seed: number) => {
    const view = await playToEnd({ policy, seed });
    const report = parseReport(view.report);
    return { report, m: buildReportModel(i18n, moneyFormatter(view.money), report, { participantName: 'Jordan Lee', date, subPeriodUnit: view.clock.subPeriodUnit }) };
  };

  it('a passive run leaves out its skills, moments without words and conversations, and names them', async () => {
    const { m } = await model('passive', 2);
    const keys = m.sections.map(s => s.key);
    for (const k of ['skills', 'analytics', 'intent'] as const) expect(keys).not.toContain(k);
    expect(m.leftOut).toEqual(expect.arrayContaining(['Your leadership skills', 'How you talked', 'Intent and action']));
    expect(i18n.t('report.leftOut', { list: 'A and B' })).toMatch(/^Not enough evidence yet for: A and B\./);
  });

  it('a good run keeps what it has evidence for and leaves out only its unrated skills', async () => {
    const { report, m } = await model('good', 3);
    const unrated = report.skills.filter(s => !s.level).map(s => s.name);
    expect(m.leftOut).toEqual(unrated);
    const skills = m.sections.find(s => s.key === 'skills');
    expect(skills?.key === 'skills' && skills.rows.every(r => r.level)).toBe(true);
  });

  it('carries the first page, with the replay worded and the quote alone for a report stored before it', async () => {
    const { report, m } = await model('good', 3);
    expect(m.brief?.findings).toHaveLength(3);
    expect(m.brief?.actions).toHaveLength(3);
    expect(m.brief?.moments).toHaveLength(2);
    expect(m.brief?.moments[0].replay[0]).toMatchObject({ you: true, who: 'You' });
    const money = moneyFormatter({ currency: 'USD', locale: 'en-US', display: 'symbol' } as never);
    const old = { ...report, moments: report.moments.map(x => ({ ...x, replay: [] })) };
    const stored = buildReportModel(i18n, money, old, { date, subPeriodUnit: 'day' });
    const quoted = stored.brief!.moments.find(x => x.quote);
    expect(quoted?.replay).toEqual([{ key: '0', you: true, who: 'You', text: quoted!.quote }]);
    expect(buildReportModel(i18n, money, { ...report, brief: null }, { date, subPeriodUnit: 'day' }).brief).toBeNull();
  });
});
