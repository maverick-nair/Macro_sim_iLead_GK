import { describe, expect, it } from 'vitest';
import { wordAll as en } from '../../i18n/engineCopy';
import { EngineView } from '../contract';
import { parseStoryline, type StorylineInput } from '../config';
import { withSixStyles } from '../storylines/sixStyles';
import salesElevator from '../storylines/sales-elevator.json';
import { createEngine } from './engine';
import { neededStyles, play } from './policies';

/**
 * What the original flow gaps added to the view (D91 to D97): stage info, the actions list's cooldowns
 * and unlocks, worked examples, result trends, milestones, the History's action labels and the guide's
 * settings. None of it changes a rule, a draw or a score.
 */
const config = (extra: Partial<StorylineInput> = {}, base: StorylineInput = salesElevator as unknown as StorylineInput) => {
  const r = parseStoryline({ ...base, ...extra });
  if (!r.ok) throw new Error(r.issues.join('\n'));
  return r.config;
};

describe('the view for the in play panels', () => {
  it('sends stage info, cooldowns and unlocks, and the guide settings', () => {
    const v = EngineView.parse(createEngine(config(), { seed: 1 }).view());
    expect(v.funnel[0]).toMatchObject({ key: 'leads', about: expect.stringMatching(/prospects/), suits: expect.stringMatching(/Prospecting/) });
    const hire = v.actions.find(a => a.rule === 'hire')!;
    expect(hire.unlockPeriod).toBe(3);
    expect(v.actions.find(a => a.key === 'energize')!.options.map(o => o.cooldown)).toContain(10);
    expect(v.guide.tour).toEqual({ enabled: true, steps: {} });
    expect(v.guide.demo.enabled).toBe(true);
    expect(v.guide.demo.with).toBe(v.members[0].id);
    const demoAction = v.actions.find(a => a.key === v.guide.demo.action)!;
    expect(demoAction).toMatchObject({ kind: 'static', scope: 'member' });
  });

  it('turns the demo off when the storyline does, or has no instant action for one person', () => {
    expect(EngineView.parse(createEngine(config({ demo: { enabled: false } }), { seed: 1 }).view()).guide.demo.enabled).toBe(false);
    const raw = salesElevator as unknown as StorylineInput;
    const noStatic = config({ actions: raw.actions.filter(a => !(a.kind === 'static' && a.scope === 'member')).map(a => ({ ...a, prerequisite: undefined })) });
    expect(EngineView.parse(createEngine(noStatic, { seed: 1 }).view()).guide.demo.enabled).toBe(false);
    expect(parseStoryline({ ...raw, demo: { action: 'meet' } }).ok).toBe(false);
  });

  it('sends the worked examples: authored for Readiness Based, worded from the fit for another lens', () => {
    const v = EngineView.parse(createEngine(config(), { seed: 1 }).view());
    expect(v.lens.examples.map(x => [x.need, x.style])).toEqual([['lowSkill_lowMorale', 'D'], ['lowSkill_highMorale', 'G'], ['highSkill_lowMorale', 'P'], ['highSkill_highMorale', 'E']]);
    const six = EngineView.parse(createEngine(config({}, withSixStyles(salesElevator as unknown as StorylineInput)), { seed: 1 }).view());
    expect(six.lens.examples).toHaveLength(2);
    expect(six.lens.examples[0].why).toMatch(/fits best here/);
    expect(six.lens.examples.every(x => six.lens.styles.some(s => s.key === x.style))).toBe(true);
  });

  it('sends result trends only for people whose profile is open, one point per period start and one for now', async () => {
    const e = createEngine(config(), { seed: 1 });
    expect(e.view().trends).toEqual({});
    await e.dispatch({ type: 'confirmStyles', styles: await neededStyles(e) });
    await e.dispatch({ type: 'endPeriod' });
    if (e.view().pendingReward) await e.dispatch({ type: 'chooseReward', reward: e.view().pendingReward![0] });
    await e.dispatch({ type: 'startNextPeriod' });
    const v = e.view();
    const id = v.members[0].id;
    expect(v.trends[id]).toHaveLength(3);
    expect(v.trends[id][2]).toBe(v.members[0].result);
  });

  it('labels log entries with their action, and records milestones in order as revenue and stages grow', async () => {
    const { view } = await play(config(), 'good', 1);
    const v = en(view);
    const actions = new Set(v.actions.map(a => a.key));
    const labelled = v.history.filter(h => h.kind === 'action' || h.kind === 'interaction');
    expect(labelled.length).toBeGreaterThan(0);
    expect(labelled.every(h => !!h.action)).toBe(true);
    expect(labelled.some(h => actions.has(h.action!))).toBe(true);
    const keys = v.milestones.map(m => m.key);
    expect(keys).toContain('target:25');
    expect(keys.indexOf('target:25')).toBeLessThan(keys.indexOf('target:50'));
    expect(new Set(keys).size).toBe(keys.length);
    expect(v.milestones.every(m => m.period >= 1 && m.period <= 8)).toBe(true);
    expect(v.milestones.filter(m => m.kind === 'stage').every(m => v.funnel.some(f => f.key === m.stage))).toBe(true);
  });

  it('honours authored milestones', async () => {
    const { view } = await play(config({ milestones: { target: [10], stages: [] } }), 'good', 1);
    expect(view.milestones.map(m => m.key)).toEqual(['target:10']);
  });
});
