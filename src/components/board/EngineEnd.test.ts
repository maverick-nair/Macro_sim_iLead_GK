import { parseReport } from '../../engine/reportContract';
import { describe, expect, it } from 'vitest';
import { parseStoryline } from '../../engine/config';
import { EngineView } from '../../engine/contract';
import { play } from '../../engine/sim/policies';
import salesElevator from '../../engine/storylines/sales-elevator.json';
import { createI18n } from '../../i18n';
import { copyViolations } from '../../i18n/copy';
import { endScreenProps } from './EngineEnd';

const parsed = parseStoryline(salesElevator);
if (!parsed.ok) throw new Error(parsed.issues.join('\n'));
const i18n = createI18n();

async function endedRun(policy: 'good' | 'passive') {
  if (!parsed.ok) throw new Error();
  const r = await play(parsed.config, policy, 3);
  return EngineView.parse(r.view);
}

describe('the end screen on the engine', () => {
  it('shows the report as the engine sent it', async () => {
    const view = await endedRun('good');
    expect(view.phase).toBe('ended');
    const report = parseReport(view.report);
    const p = endScreenProps(i18n, view, report);
    // Tier and score: the engine's tier, its tiers lowest first, the total rounded for display.
    expect(p.tier).toBe(report.score.tier.key);
    expect(p.tiers.map(x => x.key)).toEqual([...report.gamificationTiers].sort((a, b) => a.min - b.min).map(x => x.key));
    expect(p.score).toBe(Math.round(report.score.total));
    expect(p.scoreMax).toBe(1000);
    // The eyebrow's numbers: the run's periods and everyone who was on the team.
    expect(p.periods).toBe(view.clock.periods);
    expect(p.people).toBe(report.people.length);
    // Results: money, conversions and the four team metrics, as sent.
    expect(p.results).toMatchObject({ revenue: report.results.revenue, target: report.results.target, share: report.results.share, conversions: report.results.conversions });
    expect(p.results.kpis.map(k => k.metric)).toEqual(['skill', 'morale', 'result', 'trust']);
    expect(copyViolations(p.results.conversionsNote)).toEqual([]);
    // Up to four moments, each with a portrait and its SBI text.
    expect(p.moments.length).toBe(Math.min(4, report.moments.length));
    for (const m of p.moments) {
      expect(report.moments.some(x => x.id === m.id && x.title === m.title && x.situation === m.situation)).toBe(true);
      expect(m.img).toMatch(/^\/assets\/npc\//);
    }
    // Every badge, earned first, each with its icon.
    expect(p.badges.length).toBe(view.badges.length);
    const earned = p.badges.filter(b => b.status === 'earned').length;
    expect(earned).toBe(view.badges.filter(b => b.earned).length);
    expect(p.badges.slice(0, earned).every(b => b.status === 'earned')).toBe(true);
    expect(p.badges.every(b => b.icon)).toBe(true);
  });

  it('says how conversions compare with the ideal pace', async () => {
    const view = await endedRun('passive');
    const report = parseReport(view.report);
    const p = endScreenProps(i18n, view, report);
    const ideal = Math.round(report.business.funnel.at(-1)!.cumulativeIdeal);
    const diff = report.results.conversions - ideal;
    expect(p.results.conversionsTone).toBe(diff > 0 ? 'gain' : diff < 0 ? 'decline' : 'neutral');
    expect(p.results.conversionsNote).toBe(diff === 0 ? 'On ideal pace' : `${i18n.delta(diff)} on ideal pace`);
  });
});
