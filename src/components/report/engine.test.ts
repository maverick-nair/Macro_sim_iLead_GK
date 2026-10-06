import { describe, expect, it } from 'vitest';
import { moneyFormatter } from '../../engine/money';
import { playToEnd } from '../../engine/mock';
import { parseReport } from '../../engine/reportContract';
import { createI18n } from '../../i18n';
import { buildReportModel, listNames, type ReportView } from './engine';

const i18n = createI18n();
const date = new Date(2026, 9, 5);

async function run(policy: 'good' | 'random', reflection?: string[]) {
  const view = await playToEnd({ policy, seed: 3, reflection });
  const money = moneyFormatter(view.money);
  return { view, report: parseReport(view.report), model: (r: ReportView, name: string | null = 'Jordan Lee') => buildReportModel(i18n, money, r, { participantName: name, date, subPeriodUnit: view.clock.subPeriodUnit }) };
}

describe('the engine report, shaped for display', () => {
  it('keeps the author\'s section order and puts the team over the run after the summary', async () => {
    const { report, model } = await run('good');
    const m = model(report);
    // Progress shows only with earlier attempts.
    expect(m.sections.map(s => s.key)).toEqual(report.sections.filter(s => s !== 'progress'));
    const reordered = model({ ...report, sections: ['plan', 'skills'] });
    expect(reordered.sections.map(s => s.key)).toEqual(['plan', 'skills']);
    expect(m.team.map(s => s.key)).toEqual(['revenue', 'skill', 'morale', 'result', 'trust']);
    expect(m.team[0].target).toHaveLength(report.periods);
  });

  it('names the participant, the storyline and the month, and shows the engine tier and score', async () => {
    const { report, model } = await run('good');
    const m = model(report);
    expect(m.header).toMatchObject({ name: 'Jordan Lee', tier: report.score.tier.name, score: i18n.number(report.score.total) });
    expect(m.header.line).toBe(`${report.storyline.name} · October 2026`);
    expect(model({ ...report, storyline: { name: 'Sales Elevator', organisation: 'Innov8' } }).header.line).toBe('Sales Elevator · Innov8 · October 2026');
    expect(model(report, null).header.name).toBe('Your development report');
  });

  it('shows levels as the engine rated them, and "Not enough evidence" where it did not', async () => {
    const { report, model } = await run('random');
    const skills = model(report).sections.find(s => s.key === 'skills');
    if (skills?.key !== 'skills') throw new Error('no skills section');
    expect(skills.levels).toEqual(report.scale.map(s => s.name));
    report.skills.forEach((s, i) => {
      expect(skills.rows[i].level).toEqual(s.level);
      expect(skills.rows[i].quote).toEqual(s.quotes[0] ?? null);
    });
    const none = model({ ...report, summary: { ...report.summary, level: null, narrative: null } }).sections.find(s => s.key === 'summary');
    expect(none?.key === 'summary' && none.extras.level).toBeNull();
  });

  it('words intent from the styles the engine sends, with its status as the verdict', async () => {
    const { report, model } = await run('good');
    const intent = model(report).sections.find(s => s.key === 'intent');
    if (intent?.key !== 'intent') throw new Error('no intent section');
    const first = report.intent[0];
    expect(intent.cards[0].verdict).toBe(i18n.t('report.intent.verdict', { status: first.status }));
    expect(intent.cards[0].did).toContain(report.lens.styles.find(x => x.key === first.intent[0])!.name);
  });

  it('builds the plan from the engine plan, the first reflection answer and the check in date', async () => {
    const { report, model } = await run('good', ['', 'Listen first.']);
    const plan = model(report).sections.find(s => s.key === 'plan');
    if (plan?.key !== 'plan') throw new Error('no plan section');
    expect(plan.items.map(p => p.skill)).toEqual(report.plan.map(p => p.name));
    expect(plan.reflection).toBe('Listen first.');
    expect(plan.checkIn).toBe(`Check in on October ${5 + report.checkInDays}, 2026`);
  });

  it('marks the bottleneck stage and keeps style fit cells per period', async () => {
    const { report, model } = await run('random');
    const m = model(report);
    const business = m.sections.find(s => s.key === 'business');
    if (business?.key !== 'business') throw new Error('no business section');
    expect(business.data.funnel.filter(f => f.bottleneck).map(f => f.key)).toEqual(report.business.bottleneck ? [report.business.bottleneck.stage] : []);
    const style = m.sections.find(s => s.key === 'style');
    if (style?.key !== 'style') throw new Error('no style section');
    expect(style.rows.every(r => r.cells.length === report.periods)).toBe(true);
    expect(style.summary).toBe(`You matched ${report.style.matched} of ${report.style.weeklyTotal} choices.`);
  });

  it('lists names with commas and a final "and"', () => {
    expect(listNames(i18n, ['Directing'])).toBe('Directing');
    expect(listNames(i18n, ['Directing', 'Guiding', 'Partnering'])).toBe('Directing, Guiding and Partnering');
  });
});
