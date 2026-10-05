import { describe, expect, it } from 'vitest';
import { copyViolations } from '../../i18n/copy';
import { EngineView } from '../contract';
import { parseStoryline, type StorylineConfig } from '../config';
import salesElevator from '../storylines/sales-elevator.json';
import { heuristicEvaluator } from '../sim/evaluator';
import { play } from '../sim/policies';
import { createSim } from '../sim/sim';
import type { Band, LiveRecord, Sim } from '../sim/types';
import { buildReport } from './build';

/** Report 2.0 rules (docs/genie/scoring-and-report.md 5, 7 and 9). */
const parsed = parseStoryline(salesElevator);
if (!parsed.ok) throw new Error(parsed.issues.join('\n'));
const config: StorylineConfig = parsed.config;

let n = 0;
const rec = (sim: Sim, skills: Array<[string, Band, string?]>, extra: Partial<LiveRecord> = {}): LiveRecord => {
  const quotes = skills.map(([, , q]) => q).filter((q): q is string => !!q);
  const r: LiveRecord = { id: `r${++n}`, period: 1, sub: 1, actionKey: 'f2f', format: 'roleplay', band: 'adequate', memberIds: ['kent'], title: 'Meet face to face',
    skills: skills.map(([key, band, q]) => ({ key, band, evidence: q ? [q] : [] })), quotes, ...extra };
  sim.liveRecords.push(r);
  return r;
};
const skill = (sim: Sim, key: string) => buildReport(sim).skills.find(s => s.key === key)!;

describe('skill ratings', () => {
  it('needs 2 observations from 2 different conversations, else "Not enough evidence"', () => {
    const sim = createSim(config, 1);
    rec(sim, [['coaching_for_growth', 'strong']]);
    expect(skill(sim, 'coaching_for_growth')).toMatchObject({ observations: 1, level: null, score: null });
    rec(sim, [['coaching_for_growth', 'adequate']]);
    expect(skill(sim, 'coaching_for_growth')).toMatchObject({ observations: 2, score: 85, level: { name: 'Advanced' } });
  });

  it('scores the mean of band scores and reads the scale at every boundary', () => {
    const sim = createSim(config, 1);
    const levels = config.report.scale;
    const at = (score: number) => levels.reduce((lv, l) => (score >= l.min ? l.name : lv), levels[0].name);
    expect([39, 40, 59, 60, 74, 75, 89, 90].map(at)).toEqual(['Novice', 'Developing', 'Developing', 'Proficient', 'Proficient', 'Advanced', 'Advanced', 'Role Model']);
    // The doc's worked examples: all Adequate 70, Strong and Adequate 85, three Strong and one Adequate 92.5, Adequate and Weak 52.5.
    rec(sim, [['giving_feedback', 'strong']]); rec(sim, [['giving_feedback', 'strong']]); rec(sim, [['giving_feedback', 'strong']]); rec(sim, [['giving_feedback', 'adequate']]);
    expect(skill(sim, 'giving_feedback')).toMatchObject({ score: 93, level: { name: 'Role Model' } });
    rec(sim, [['goal_setting', 'adequate']]); rec(sim, [['goal_setting', 'weak']]);
    expect(skill(sim, 'goal_setting')).toMatchObject({ score: 53, level: { name: 'Developing' } });
  });

  it('caps a skill with any Harmful observation at Developing', () => {
    const sim = createSim(config, 1);
    for (let i = 0; i < 5; i++) rec(sim, [['results_ownership', 'strong']]);
    rec(sim, [['results_ownership', 'harmful']]);
    expect(skill(sim, 'results_ownership')).toMatchObject({ capped: true, level: { name: 'Developing' } });
  });

  it('shows an overall level only when at least half the skills are rated', () => {
    const sim = createSim(config, 1);
    const keys = config.report.skills.map(s => s.key);
    for (const k of keys.slice(0, 3)) { rec(sim, [[k, 'adequate']]); rec(sim, [[k, 'adequate']]); }
    expect(buildReport(sim).summary.level).toBeNull();
    rec(sim, [[keys[3], 'adequate']]); rec(sim, [[keys[3], 'adequate']]);
    expect(buildReport(sim).summary.level).toEqual({ index: 2, name: 'Proficient' });
    expect(buildReport(sim).summary.narrative).toBe(config.report.narratives.overall[2]);
  });

  it('quotes only verbatim words from the participant, best band first, up to 2', () => {
    const sim = createSim(config, 1);
    rec(sim, [['coaching_for_growth', 'adequate', 'Let us practise the call.']]);
    rec(sim, [['coaching_for_growth', 'strong', 'What would help you most?']]);
    rec(sim, [['coaching_for_growth', 'weak', 'Not in the transcript']], { quotes: ['Something else entirely.'] });
    const q = skill(sim, 'coaching_for_growth').quotes.map(x => x.text);
    expect(q).toEqual(['What would help you most?', 'Let us practise the call.']);
  });

  it('lists 3 strengths and 3 different priorities', () => {
    const sim = createSim(config, 1);
    const bands: Band[] = ['strong', 'strong', 'adequate', 'adequate', 'weak', 'weak', 'harmful', 'adequate'];
    config.report.skills.forEach((s, i) => { rec(sim, [[s.key, bands[i]]]); rec(sim, [[s.key, bands[i]]]); });
    const { strengths, priorities } = buildReport(sim).summary;
    expect(strengths).toHaveLength(3);
    expect(priorities).toHaveLength(3);
    expect(strengths.some(k => priorities.includes(k))).toBe(false);
    expect(priorities[0]).toBe(config.report.skills[6].key);
  });
});

describe('the evaluator rates the linked skills', () => {
  it('returns one observation per linked skill, and a red flag makes them Harmful', async () => {
    const skills = config.report.linkage.f2f;
    const ok = await heuristicEvaluator.evaluate({ format: 'roleplay', text: 'I hear you. What would help you most? Let us practise the next call together by Friday.', skills });
    expect(ok.skills!.map(s => s.key)).toEqual(skills);
    const bad = await heuristicEvaluator.evaluate({ format: 'roleplay', text: 'This is your fault, you are useless.', skills });
    expect(bad.skills!.every(s => s.band === 'harmful')).toBe(true);
  });
});

describe('the whole report from a run', () => {
  it('builds every section, passes the contract, and keeps to the copy rules', async () => {
    const r = await play(config, 'random', 5);
    expect(EngineView.safeParse(r.view).success).toBe(true);
    const rep = r.view.report!;
    expect(rep.available).toBe(true);
    expect(rep.sections).toHaveLength(10);
    expect(rep.moments.length).toBeGreaterThanOrEqual(5);
    expect(rep.moments.length).toBeLessThanOrEqual(7);
    expect(new Set(rep.moments.map(m => m.title)).size).toBe(rep.moments.length);
    expect(rep.plan).toHaveLength(3);
    expect(rep.style.grid.flat().reduce((a, b) => a + b, 0)).toBe(rep.style.total);
    expect(rep.people.every(p => p.series.length > 0)).toBe(true);
    expect(rep.analytics.conversations).toBeGreaterThan(0);
    // Every sentence the engine wrote keeps to the copy rules (participant quotes are their own words).
    const engineText = [rep.summary.business, rep.summary.narrative ?? '', ...rep.style.narrative, ...rep.moments.flatMap(m => [m.title, m.situation, m.behaviour, m.impact]), rep.business.bottleneck?.why ?? '', ...rep.plan.flatMap(p => [p.practice, p.onTheJob]), ...rep.methodology.lines, ...rep.skills.map(s => s.anchor ?? '')];
    expect(engineText.flatMap(t => copyViolations(t).map(v => `${v}: ${t}`))).toEqual([]);
  });

  it('is only sent once the run has ended', async () => {
    const sim = createSim(config, 1);
    expect(sim.phase).not.toBe('ended');
    const r = await play(config, 'passive', 2);
    expect(r.view.report).not.toBeNull();
  });
});
