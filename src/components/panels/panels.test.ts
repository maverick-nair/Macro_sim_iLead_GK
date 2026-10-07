import { describe, expect, it } from 'vitest';
import { EngineView, type EngineView as View } from '../../engine/contract';
import { createEngine } from '../../engine/sim/engine';
import { neededStyles } from '../../engine/sim/policies';
import { defaultStoryline } from '../../engine/mock';
import { loadEngineCopy } from '../../i18n/locales';
import { entryWhat, historyOptions, historyWeeks } from './history';
import { averageRow, resultColumns, resultRows, share, stageWeeks, teamMetrics } from './overview';

/** A run two periods in: styles, a training, an email, the period end, and the second period's styles. */
async function twoWeeks(): Promise<View> {
  await loadEngineCopy();
  const e = createEngine(defaultStoryline(), { seed: 2 });
  await e.dispatch({ type: 'confirmStyles', styles: await neededStyles(e) });
  await e.dispatch({ type: 'planAction', action: 'training', option: 'three_day', memberIds: ['kent'] });
  await e.dispatch({ type: 'endPeriod' });
  if (e.view().pendingReward) await e.dispatch({ type: 'chooseReward', reward: e.view().pendingReward![0] });
  await e.dispatch({ type: 'startNextPeriod' });
  await e.dispatch({ type: 'confirmStyles', styles: await neededStyles(e) });
  return EngineView.parse(e.view());
}

describe('History (D95)', () => {
  it('groups the log by week, newest first, with each person\'s changes and reasons', async () => {
    const v = await twoWeeks();
    const names = (id: string) => v.members.find(m => m.id === id)?.name ?? null;
    const weeks = historyWeeks(v, { person: null, what: null }, names);
    expect(weeks.map(w => w.period)).toEqual([2, 1]);
    const styles = weeks[1].entries.find(e => e.kind === 'style')!;
    expect(styles.people.length).toBe(v.members.length);
    const kent = styles.people.find(p => p.id === 'kent')!;
    expect(kent.name).toBe('Kent Goldberg');
    expect(kent.reasons.length).toBeGreaterThan(0);
    expect(kent.changes.every(c => c.delta !== 0)).toBe(true);
    // Within a week, newest first.
    const ids = weeks[1].entries.map(e => Number(e.id.slice(1)));
    expect([...ids].sort((a, b) => b - a)).toEqual(ids);
  });

  it('filters by person and by action, and offers only what is in the log', async () => {
    const v = await twoWeeks();
    const names = (id: string) => v.members.find(m => m.id === id)?.name ?? null;
    const training = historyWeeks(v, { person: null, what: 'training' }, names);
    expect(training.flatMap(w => w.entries).every(e => e.title.includes('training'))).toBe(true);
    expect(training.flatMap(w => w.entries)).toHaveLength(1);
    const beth = historyWeeks(v, { person: 'beth', what: null }, names).flatMap(w => w.entries);
    expect(beth.length).toBeGreaterThan(0);
    expect(beth.every(e => e.people.every(p => p.id === 'beth'))).toBe(true);
    expect(beth.some(e => e.title.includes('training'))).toBe(false);
    const opts = historyOptions(v, names);
    expect(opts.people[0]).toEqual({ id: v.members[0].id, name: v.members[0].name });
    expect(opts.what).toContain('styles');
    expect(opts.what).toContain('training');
    expect(opts.what).not.toContain('f2f');
    expect(entryWhat({ ...v.history[0], kind: 'trigger' })).toBe('events');
  });
});

describe('Result and stage overviews (D96)', () => {
  it('lays out the result table by period, with averages over the people whose profile is open', async () => {
    const v = await twoWeeks();
    const cols = resultColumns(v.clock, v.phase);
    expect(cols).toEqual([{ kind: 'start' }, { kind: 'end', period: 1 }, { kind: 'now' }]);
    const rows = resultRows(v, cols.length);
    expect(rows.every(r => r.values?.length === 3)).toBe(true);
    const kent = rows.find(r => r.id === 'kent')!;
    expect(kent.values![2]).toBe(v.members.find(m => m.id === 'kent')!.result);
    const avg = averageRow(rows, cols.length);
    const mean = Math.round(rows.reduce((s, r) => s + r.values![2]!, 0) / rows.length);
    expect(avg[2]).toBe(mean);
    expect(averageRow([{ id: 'a', name: 'A', values: null }], 2)).toEqual([null, null]);
    expect(resultColumns({ period: 3 }, 'periodEnd').at(-1)).toEqual({ kind: 'end', period: 3 });
  });

  it('gives team metrics against the run start, and the funnel week by week with the run so far', async () => {
    const v = await twoWeeks();
    const m = teamMetrics(v);
    expect(m.map(x => x.metric)).toEqual(['skill', 'morale', 'result', 'trust']);
    expect(m[0].runStart).toBe(v.periods[0].kpis.skill.start);
    const s = stageWeeks(v);
    expect(s.weeks.map(w => [w.period, w.current])).toEqual([[1, false], [2, true]]);
    expect(s.weeks[0].cells).toHaveLength(v.funnel.length);
    // The current week counts its output so far, but its ideal only once it ends.
    expect(s.total[0].ideal).toBeCloseTo(s.weeks[0].cells[0].ideal, 1);
    expect(share(5, 10)).toBe(0.5);
    expect(share(3, 0)).toBe(1);
    expect(share(12, 10)).toBe(1);
  });
});
