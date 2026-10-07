import { describe, expect, it } from 'vitest';
import { parseStoryline, purposeOf, type StorylineConfig, type StorylineInput } from '../config';
import { createEngine } from '../sim/engine';
import { neededStyles, play } from '../sim/policies';
import { createSim } from '../sim/sim';
import type { ActionRecord, Decision, Sim } from '../sim/types';
import salesElevator from '../storylines/sales-elevator.json';
import { withSixStyles } from '../storylines/sixStyles';
import { ReportView, RunSummary } from '../reportContract';
import { impactBand, summarizeRun } from './summary';

/** Report 3.0 metrics (D75, D76), on small runs computed by hand. */
const parse = (input: unknown): StorylineConfig => {
  const r = parseStoryline(input);
  if (!r.ok) throw new Error(r.issues.join('\n'));
  return r.config;
};
const config = parse(salesElevator);

let n = 0;
const rec = (sim: Sim, r: Partial<ActionRecord> & Pick<ActionRecord, 'actionKey' | 'reached'>) => {
  sim.actionRecords.push({ id: `a${++n}`, period: 1, sub: 1, optionKey: null, scope: 'member', effects: {}, uses: [], ...r });
};
const choice = (sim: Sim, d: Decision) => sim.decisions.run.push(d);

/** A run built by hand: five actions, two weekly settings, two one to one conversations. */
function handRun() {
  const sim = createSim(config, 1);
  rec(sim, { actionKey: 'f2f', reached: ['kent'], effects: { kent: [1, 6, 9] }, uses: [{ memberId: 'kent', style: 'D', need: 'lowSkill_lowMorale' }] });
  rec(sim, { actionKey: 'f2f', reached: ['beth'], effects: { beth: [-1, -4, -5] }, uses: [{ memberId: 'beth', style: 'G', need: 'lowSkill_lowMorale' }] });
  rec(sim, { actionKey: 'meet', scope: 'team', reached: ['kent', 'beth', 'justin'], effects: { kent: [2, 8, 10], beth: [-1, -5, -6] },
    uses: [{ memberId: 'kent', style: 'P', need: 'lowSkill_lowMorale' }, { memberId: 'beth', style: 'P', need: 'lowSkill_lowMorale' }, { memberId: 'justin', style: 'P', need: 'highSkill_lowMorale' }] });
  // The reward also reached the top performer it passed over.
  rec(sim, { actionKey: 'reward', reached: ['kent'], effects: { kent: [0, 6, 9], peter: [0, -12, -18] } });
  rec(sim, { actionKey: 'assess', reached: ['mandy'] });
  choice(sim, { memberId: 'kent', chosen: 'D', need: 'lowSkill_lowMorale', mismatch: 0, source: 'weeklyStyle', period: 1 });
  choice(sim, { memberId: 'beth', chosen: 'E', need: 'lowSkill_lowMorale', mismatch: 2, source: 'weeklyStyle', period: 1 });
  choice(sim, { memberId: 'kent', chosen: 'D', need: 'lowSkill_lowMorale', mismatch: 0, source: 'f2f', period: 1 });
  choice(sim, { memberId: 'beth', chosen: 'G', need: 'lowSkill_lowMorale', mismatch: 1, source: 'f2f', period: 1 });
  const ids = config.members.map(m => m.id);
  sim.periodStartResults = [Object.fromEntries(ids.map((id, i) => [id, 90 - i * 9]))];
  return { sim, ids };
}

describe('impact bands (D76)', () => {
  it('reads the mean net change against the thresholds', () => {
    const t = config.report.impact;
    expect(t).toEqual({ low: -2, moderate: 3, high: 10 });
    expect([null, -2.01, -2, 2.99, 3, 9.99, 10].map(m => impactBand(m, t))).toEqual(['none', 'veryLow', 'low', 'low', 'moderate', 'moderate', 'high']);
  });
});

describe('the run summary, on a run computed by hand', () => {
  it('counts each action and bands its mean net change per person reached', () => {
    const s = summarizeRun(handRun().sim);
    const a = Object.fromEntries(s.actions.map(x => [x.key, x]));
    expect(a.f2f).toMatchObject({ frequency: 2, reached: 2, mean: 3, impact: 'moderate' }); // (16 − 10) / 2
    expect(a.meet).toMatchObject({ frequency: 1, reached: 3, mean: 2.67, impact: 'low' }); // (20 − 12 + 0) / 3
    expect(a.reward).toMatchObject({ frequency: 1, reached: 2, mean: -7.5, impact: 'veryLow' }); // (15 − 30) / 2
    expect(a.assess).toMatchObject({ frequency: 1, reached: 1, mean: 0, impact: 'none' });
    expect(a.email).toMatchObject({ frequency: 0, reached: 0, mean: null, impact: 'none' });
    expect(s.actions.map(x => x.key)).toEqual(config.actions.map(x => x.key));
  });

  it('builds the member by action matrix, ordered by total impact', () => {
    const { sim, ids } = handRun();
    const d = summarizeRun(sim).distribution;
    expect(d.actions).toEqual(config.actions.map(x => x.key));
    const col = (k: string) => d.actions.indexOf(k);
    const row = (id: string) => d.members.find(m => m.memberId === id)!;
    expect(row('kent')).toMatchObject({ total: 51, impact: 'high' });
    expect(row('kent').cells[col('f2f')]).toEqual({ count: 1, mean: 16, impact: 'high' });
    expect(row('beth')).toMatchObject({ total: -22, impact: 'veryLow' });
    expect(row('justin').cells[col('meet')]).toEqual({ count: 1, mean: 0, impact: 'none' });
    expect(row('peter').cells[col('reward')]).toEqual({ count: 1, mean: -30, impact: 'veryLow' });
    // Highest total first; ties keep the storyline's order.
    const zero = ids.filter(id => !['kent', 'beth', 'peter'].includes(id));
    expect(d.members.map(m => m.memberId)).toEqual(['kent', ...zero, 'beth', 'peter']);
    expect(d.totals[col('meet')]).toBe(3);
    expect(d.totals[col('f2f')]).toBe(2);
  });

  it('compares needed, intended and used, as deviations and per person', () => {
    const c = summarizeRun(handRun().sim).consistency;
    expect(c.actions).toEqual(['meet', 'f2f', 'goals', 'coach', 'feedback']);
    // 5 uses; beth G, kent P and beth P do not fit a low skill, low morale need.
    expect(c.deviations.neededUsed).toBe(60);
    // 4 uses with a style set that week; beth G against E, kent P against D, beth P against E.
    expect(c.deviations.intendedUsed).toBe(75);
    // 2 weekly settings; beth's E did not fit.
    expect(c.deviations.neededIntended).toBe(50);
    expect(c.counts).toEqual({ uses: 5, usesWithIntent: 4, settings: 2 });
    const m = Object.fromEntries(c.members.map(x => [x.memberId, x]));
    expect(m.kent).toEqual({ memberId: 'kent', needed: 'lowSkill_lowMorale', desired: 'D', intended: 'D', used: 'D' });
    expect(m.beth).toEqual({ memberId: 'beth', needed: 'lowSkill_lowMorale', desired: 'D', intended: 'E', used: 'G' });
    expect(m.justin).toEqual({ memberId: 'justin', needed: 'highSkill_lowMorale', desired: 'P', intended: null, used: 'P' });
  });

  it('gives each style its proportion, accuracy and how often people needed it, and the preferred style', () => {
    const st = summarizeRun(handRun().sim).styles;
    expect(st).toMatchObject({ total: 4, fitted: 2, adaptability: 50, preferred: ['D'] });
    const s = Object.fromEntries(st.perStyle.map(x => [x.key, x]));
    expect(s.D).toEqual({ key: 'D', count: 2, proportion: 50, fitted: 2, accuracy: 100, needed: 4, neededShare: 100 });
    expect(s.G).toEqual({ key: 'G', count: 1, proportion: 25, fitted: 0, accuracy: 0, needed: 0, neededShare: 0 });
    expect(s.P).toMatchObject({ count: 0, proportion: 0, accuracy: null });
    expect(st.grid[0]).toEqual([2, 1, 0, 1]);
  });

  it('splits one to one actions between the top three, the bottom three and the rest, by result at the period start', () => {
    const at = summarizeRun(handRun().sim).attention;
    // f2f kent, f2f beth, reward kent: top; assess mandy: bottom. The team meeting is not one to one.
    expect(at).toMatchObject({ top: 75, average: 0, bottom: 25 });
    expect(at.periods[0]).toEqual({ period: 1, actions: 4, top: 75, average: 0, bottom: 25 });
  });

  it('reports completion, objectives and the funnel of a whole run, and passes its schema', async () => {
    const { engine } = await play(config, 'good', 3);
    const r = engine.view().report!;
    const s = r.run;
    expect(RunSummary.safeParse(JSON.parse(JSON.stringify(s))).success).toBe(true);
    expect(s.completion).toBe(100);
    expect(s.periods).toEqual({ count: 8, completed: 8, unit: 'week' });
    expect(s.objectives.revenue).toBe(r.results.revenue);
    expect(s.objectives.share).toBeCloseTo((100 * r.results.revenue) / r.results.target, 0);
    expect(s.objectives.team.morale).toEqual({ start: r.results.kpis[1].start, end: r.results.kpis[1].end });
    expect(s.funnel).toHaveLength(8);
    expect(s.skills.find(k => k.score !== null)?.outOf10).toBe(s.skills.find(k => k.score !== null)!.score! / 10);
    // Frequencies add up to the actions the engine recorded, and the matrix counts every touch.
    expect(s.actions.reduce((a, x) => a + x.frequency, 0)).toBeGreaterThan(0);
    expect(s.distribution.totals.reduce((a, b) => a + b, 0)).toBe(s.actions.reduce((a, x) => a + x.reached, 0));
  });
});

describe('the engine records what each action did', () => {
  it('keeps a conversation\'s skill, morale and result changes on its action record, with the style shown', async () => {
    const e = createEngine(config, { seed: 4 });
    await e.dispatch({ type: 'confirmStyles', styles: await neededStyles(e) });
    const r = await e.dispatch({ type: 'planAction', action: 'f2f', memberIds: ['kent'] });
    const out = await e.dispatch({ type: 'submitInteraction', interactionId: r.interactionId!, text: 'I hear you. Here is the plan, step by step. What is getting in the way?' });
    const net = out.changes.filter(c => c.subject === 'kent' && ['skill', 'morale', 'result'].includes(c.metric)).reduce((a, c) => a + c.delta, 0);
    while (e.view().phase !== 'ended') {
      await e.dispatch({ type: 'endPeriod' });
      const v = e.view();
      if (v.pendingReward) await e.dispatch({ type: 'chooseReward', reward: v.pendingReward[0] });
      if (e.view().phase === 'periodEnd') { await e.dispatch({ type: 'startNextPeriod' }); await e.dispatch({ type: 'confirmStyles', styles: await neededStyles(e) }); }
    }
    const run = e.view().report!.run;
    expect(run.actions.find(a => a.key === 'f2f')).toMatchObject({ frequency: 1, reached: 1, mean: net });
    expect(run.consistency.counts.uses).toBe(1);
    expect(run.distribution.members.find(m => m.memberId === 'kent')!.total).toBe(net);
  });
});

describe('purpose (D75)', () => {
  const raw = salesElevator as unknown as StorylineInput;
  it('defaults to development; use selection reads as assessment; purpose wins', () => {
    expect(purposeOf(parse(raw))).toBe('development');
    expect(purposeOf(parse({ ...raw, use: 'selection' }))).toBe('assessment');
    expect(purposeOf(parse({ ...raw, use: 'selection', purpose: 'development' }))).toBe('development');
  });

  it('keeps the leaderboard rule: off for assessment, on for development, unless authored', async () => {
    const leaderboard = async (patch: object) => createEngine(parse({ ...raw, ...patch }), { seed: 1 }).view().gamification.leaderboard.enabled;
    expect(await leaderboard({})).toBe(true);
    expect(await leaderboard({ use: 'selection' })).toBe(false);
    expect(await leaderboard({ purpose: 'assessment' })).toBe(false);
    expect(await leaderboard({ purpose: 'assessment', gamification: { leaderboard: { enabled: true } } })).toBe(true);
  });

  it('a development report has no verdict and no verdict words; an assessment report has both, with evidence', async () => {
    const dev = (await play(parse(raw), 'random', 5)).view.report!;
    const asmt = (await play(parse({ ...raw, purpose: 'assessment' }), 'random', 5)).view.report!;
    expect(dev.verdict).toBeNull();
    expect(dev.run.verdict).toBeNull();
    const devText = JSON.stringify(ReportView.parse(dev));
    for (const w of ['the bar', 'Development need', 'Strength', 'Meets']) expect(devText).not.toContain(w);
    expect(asmt.verdict).not.toBeNull();
    expect(asmt.verdict!.overall.label).toMatch(/the bar$/);
    expect(asmt.verdict!.overall.recordIds.length).toBeGreaterThan(0);
    expect(asmt.verdict!.overall.review).toBe('ai');
    expect(asmt.sections).not.toContain('thought');
    expect(asmt.path).toBeNull();
    expect(dev.path).not.toBeNull();
    expect(dev.checkIns).toEqual([14, 30, 60, 90]);
    // Same run, same numbers: only the words and the verdicts change.
    expect({ ...asmt.run, purpose: 'development', verdict: null }).toEqual(dev.run);
  });

  it('marks a verdict reviewed once an assessor reviews every conversation behind it', async () => {
    const { engine } = await play(parse({ ...raw, purpose: 'assessment' }), 'good', 3);
    const ids = engine.view().report!.verdict!.overall.recordIds;
    for (const id of ids) engine.review({ recordId: id, band: 'strong' });
    const v = engine.view().report!.verdict!;
    expect(v.overall).toMatchObject({ review: 'assessor', reviewed: ids.length, total: ids.length });
  });
});

describe('a lens with five styles (Six Leadership Styles, D104)', () => {
  it('summarizes five styles over the four needs, and the report passes its schema', async () => {
    const six = parse(withSixStyles(salesElevator as unknown as StorylineInput));
    const r = (await play(six, 'good', 3)).view.report!;
    expect(r.run.lens.styles).toHaveLength(5);
    expect(r.run.styles.perStyle.map(s => s.key)).toEqual(six.lens.styles.map(s => s.key));
    expect(r.run.styles.grid.every(row => row.length === 5)).toBe(true);
    expect(r.styleSummary.perStyle).toHaveLength(5);
    // Report only skills keep their scores but get no verdict and stay out of the plan.
    expect(r.run.skills.filter(s => s.reportOnly)).toHaveLength(2);
    expect(ReportView.safeParse(r).success).toBe(true);
    const asmt = (await play(parse({ ...withSixStyles(salesElevator as unknown as StorylineInput), purpose: 'assessment' }), 'good', 3)).view.report!;
    expect(asmt.verdict!.skills.map(s => s.key)).not.toContain('team_engagement');
  });
});
