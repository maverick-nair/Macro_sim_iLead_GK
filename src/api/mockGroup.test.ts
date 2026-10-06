import { describe, expect, it } from 'vitest';
import { GroupReport } from '../engine/groupContract';
import { RunSummary } from '../engine/reportContract';
import { play } from '../engine/sim/policies';
import { cohortPlayer, mockGroupReport, mockStoryline } from './mockGroup';
import { createMockApi } from './mock';

/** The mock cohort (D77): the AI players, unfinished runs, and the group report the mock API serves. */

describe('cohort players', () => {
  const config = mockStoryline(null, 'development');

  it('the one style player leads everyone in one style, all run', async () => {
    const { engine } = await play(config, 'oneStyle', 6);
    const s = engine.summary();
    expect(s.completion).toBe(100);
    expect(s.styles.perStyle.filter(p => p.count > 0).map(p => p.key)).toEqual([config.lens.styles[6 % 4].key]);
  });

  it('stopAfter leaves the run unfinished, and its summary still reads', async () => {
    const { engine, view } = await play(config, 'careless', 4, { stopAfter: 3 });
    expect(view.phase).not.toBe('ended');
    const s = RunSummary.parse(engine.summary());
    expect(s.completion).toBe(37);
    expect(s.periods.completed).toBe(3);
  });

  it('an ended run summarizes as its report does', async () => {
    const { engine } = await play(config, 'good', 3);
    expect(engine.summary()).toEqual((engine.view().report as { run: unknown }).run);
  });

  it('mixes strong, one style, careless, random and passive players, every ninth stopping part way', () => {
    const players = Array.from({ length: 18 }, (_, i) => cohortPlayer(i, 8));
    expect(new Set(players.map(p => p.policy))).toEqual(new Set(['good', 'random', 'oneStyle', 'careless', 'passive']));
    expect(players.filter(p => p.stopAfter !== undefined)).toHaveLength(2);
  });
});

describe('mock group report', () => {
  it('development: 37 participants, the benchmark, every section, no names', async () => {
    const g = GroupReport.parse(await mockGroupReport('3'));
    expect(g.participants).toBe(37);
    expect(g.completed).toBeLessThan(37);
    expect(g.benchmark).toEqual({ participants: 300 });
    expect(g.sections).toHaveLength(12);
    expect(JSON.stringify(g)).not.toContain('Aisha Rahman');
  });

  it('assessment: the participant table by name, through the mock API', async () => {
    const raw = await createMockApi({ latencyMs: 0, group: { purpose: 'assessment' } }).getGroupReport('7');
    const g = GroupReport.parse(raw);
    expect(g.assessment!.participants).toHaveLength(18);
    expect(g.assessment!.participants[0].name).toBe('Aisha Rahman');
    expect(g.sections[1]).toBe('verdicts');
  });

  it('three participants: withheld', async () => {
    const g = await mockGroupReport('3', { size: 3 });
    expect(g.withheld?.minimum).toBe(5);
    expect(g.sections).toEqual(['about']);
  });
});
