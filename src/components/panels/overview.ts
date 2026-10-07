import type { EngineView, MetricKey } from '../../engine/contract';

/**
 * The result and stage overviews during play (D96), from the view only: each person's result at every
 * period start and now (the engine's `trends`), and the funnel by stage, week by week (the period
 * summaries) and this week so far. Pure, so it is unit tested; averages here are for display, the engine's
 * own numbers are never recomputed.
 */

/** A column of the result table: the start of the run, the end of each finished period, then now. */
export type ResultColumn = { kind: 'start' } | { kind: 'end'; period: number } | { kind: 'now' };

export interface ResultRow { id: string; name: string; values: Array<number | null> | null }

export function resultColumns(clock: Pick<EngineView['clock'], 'period'>, phase: EngineView['phase']): ResultColumn[] {
  // trends[id] = result at the start of periods 1..current, then now. The start of period n is the end of n − 1.
  const cols: ResultColumn[] = [{ kind: 'start' }];
  for (let p = 1; p < clock.period; p++) cols.push({ kind: 'end', period: p });
  // At a period end (or the end of the run) "now" is the end of the current period.
  cols.push(phase === 'periodEnd' || phase === 'ended' ? { kind: 'end', period: clock.period } : { kind: 'now' });
  return cols;
}

/** One row per person on the team; `values` is null while their profile is unopened (D39). */
export function resultRows(view: Pick<EngineView, 'members' | 'trends'>, columns: number): ResultRow[] {
  return view.members.map(m => {
    const t = view.trends[m.id];
    return { id: m.id, name: m.name, values: t ? Array.from({ length: columns }, (_, i) => t[i] ?? null) : null };
  });
}

/** The team average per column, over the people with a value there; null where nobody has one. */
export function averageRow(rows: ResultRow[], columns: number): Array<number | null> {
  return Array.from({ length: columns }, (_, i) => {
    const vals = rows.map(r => r.values?.[i]).filter((v): v is number => typeof v === 'number');
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
  });
}

/** The team metrics: now, at the start of this period, and at the start of the run (the first period summary's start). */
export function teamMetrics(view: Pick<EngineView, 'kpis' | 'periods'>): Array<{ metric: MetricKey; now: number; periodStart: number; runStart: number }> {
  const first = view.periods[0];
  return view.kpis.map(k => ({ metric: k.metric, now: k.value, periodStart: k.start, runStart: first ? first.kpis[k.metric].start : k.start }));
}

export interface StageWeek { period: number; current: boolean; cells: Array<{ output: number; ideal: number }> }

/**
 * The funnel by stage, week by week: each finished period's output and ideal per stage, then the current
 * period so far (while it is being played), and the run so far.
 */
export function stageWeeks(view: Pick<EngineView, 'funnel' | 'periods' | 'clock' | 'phase'>): { weeks: StageWeek[]; total: Array<{ output: number; ideal: number }> } {
  const keys = view.funnel.map(f => f.key);
  const weeks: StageWeek[] = view.periods.map(p => ({
    period: p.period, current: false,
    cells: keys.map(k => { const f = p.funnel.find(x => x.stage === k); return { output: f?.throughput ?? 0, ideal: f?.ideal ?? 0 }; })
  }));
  const done = new Set(view.periods.map(p => p.period));
  if (!done.has(view.clock.period) && view.phase !== 'ended') {
    weeks.push({ period: view.clock.period, current: true, cells: view.funnel.map(f => ({ output: f.throughput, ideal: f.idealThroughput })) });
  }
  const total = keys.map((_, i) => ({
    output: round1(weeks.reduce((s, w) => s + w.cells[i].output, 0)),
    // The current period's ideal counts in full only once it is over.
    ideal: round1(weeks.filter(w => !w.current).reduce((s, w) => s + w.cells[i].ideal, 0))
  }));
  return { weeks, total };
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Share of an ideal reached, 0 to 1 for a bar (an ideal of 0 reads as full when there was output). */
export function share(output: number, ideal: number): number {
  if (ideal <= 0) return output > 0 ? 1 : 0;
  return Math.max(0, Math.min(1, output / ideal));
}
