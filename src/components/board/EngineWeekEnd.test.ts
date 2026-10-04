import { describe, expect, it } from 'vitest';
import { parseStoryline } from '../../engine/config';
import { EngineView } from '../../engine/contract';
import { createEngine } from '../../engine/sim/engine';
import { neededStyles } from '../../engine/sim/policies';
import salesElevator from '../../engine/storylines/sales-elevator.json';
import { createI18n } from '../../i18n';
import { copyViolations } from '../../i18n/copy';
import { engineBadges, engineReport, engineRewards } from './EngineWeekEnd';

const parsed = parseStoryline(salesElevator);
if (!parsed.ok) throw new Error(parsed.issues.join('\n'));
const i18n = createI18n();

async function firstPeriodEnd() {
  if (!parsed.ok) throw new Error();
  const engine = createEngine(parsed.config, { seed: 1 });
  await engine.dispatch({ type: 'confirmStyles', styles: await neededStyles(engine) });
  await engine.dispatch({ type: 'endPeriod' });
  return EngineView.parse(engine.view());
}

describe('the week end on the engine', () => {
  it('builds the report from the period summary and the view rules', async () => {
    const view = await firstPeriodEnd();
    expect(view.phase).toBe('periodEnd');
    const s = view.periods[0];
    const r = engineReport(i18n, view, s);
    // Funnel: one row per stage, named from the view, with this period and the run so far.
    expect(r.funnel.stages.map(x => x.name)).toEqual(view.funnel.map(f => f.name));
    expect(r.funnel.stages[0].value).toBe(s.funnel[0].throughput);
    expect(r.funnel.stages[0].total).toEqual({ value: s.funnel[0].cumulative, ideal: s.funnel[0].cumulativeIdeal });
    expect(r.funnel.bottleneck).toBe(s.bottleneck);
    expect(r.funnel.scale).toBeGreaterThanOrEqual(Math.max(...s.funnel.flatMap(f => [f.throughput, f.ideal])));
    // KPIs in the design's order.
    expect(r.kpis.map(k => k.metric)).toEqual(['skill', 'morale', 'result', 'trust']);
    expect(r.kpis[1]).toEqual({ metric: 'morale', start: s.kpis.morale.start, end: s.kpis.morale.end });
    // One row per star threshold, earned as the engine counted.
    expect(r.stars.map(x => x.earned)).toEqual([0, 1, 2].map(i => i < s.week.stars));
    expect(r.stars[0].title).toMatch(/^First star at 50/);
    expect(r.scoreParts?.[0]).toBe(`Style fit: ${s.week.styleFit.correct} of ${s.week.styleFit.total} people got the style they needed.`);
    expect(r.scoreParts?.[1]).toContain('No live conversations this week');
    // Streak and sponsor in words, with the numbers.
    expect(r.streak).toMatchObject({ count: s.streak.count, unit: 'week' });
    expect(r.streak.note).toMatch(/^Weeks in a row at 2 stars or more\./);
    expect(r.sponsor.values).toEqual({ from: s.sponsor.from, to: s.sponsor.to });
    expect(r.pulse).toMatchObject({ upbeat: view.pulse.upbeat, value: { from: s.pulse.from, to: s.pulse.to } });
    const words = [...r.stars.flatMap(x => [x.title ?? '', x.detail]), ...(r.scoreParts ?? []), r.streak.note];
    expect(words.flatMap(copyViolations)).toEqual([]);
  });

  it('names new badges from the view and words the rewards for the next period', async () => {
    const view = await firstPeriodEnd();
    const s = view.periods[0];
    const badges = engineBadges(view, s);
    expect(badges.map(b => b.key)).toEqual(s.newBadges.map(b => b.key));
    for (const b of badges) expect(b.name).toBe(view.badges.find(x => x.key === b.key)?.name);
    const rewards = engineRewards(i18n, view, ['bonus_day', 'hire_budget', 'team_activity']);
    expect(rewards.map(r => r.name)).toEqual(['A bonus day', 'Extra hire budget', 'A team activity']);
    expect(rewards[0].description).toBe('One more day of your time in week 2.');
    expect(rewards.flatMap(r => [...copyViolations(r.name), ...copyViolations(r.description)])).toEqual([]);
  });
});
