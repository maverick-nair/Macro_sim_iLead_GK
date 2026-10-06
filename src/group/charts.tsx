import { AxisBottom, AxisLeft } from '@visx/axis';
import { scaleBand, scaleLinear } from '@visx/scale';
import { LinePath } from '@visx/shape';
import { chartMax, round1 } from '../components/report/display';

/**
 * The group report's own charts (D77), in the report's chart language: visx in a fixed drawing space
 * that scales to the card, never colour alone (cells carry their numbers, lines differ by pattern), a
 * name for screen readers and a table beside each (ChartBlock).
 */

const SVG = 'block h-auto w-full max-w-(--il-report-chart-max) overflow-visible';
const LABEL = 'fill-fg-primary text-12';
const MUTED = 'fill-fg-secondary text-12';
const TICK = { className: 'fill-fg-secondary text-11', fontFamily: 'inherit', fontSize: undefined } as const;

/**
 * Shares in a grid: one row per skill, one column per level (and "No level"), each cell its share as a
 * number with a bar under it scaled to the largest cell (the 1.0 report's distribution page). An HTML
 * grid, so text keeps its size at any width; it is one image to assistive technology, its table the alternative.
 */
export function ShareGridChart({ rows, columns, label }: { rows: Array<{ key: string; label: string; cells: number[] }>; columns: string[]; label: string }) {
  const max = chartMax(rows.flatMap(r => r.cells));
  return (
    <div role="img" aria-label={label} className="grid gap-1 text-12" style={{ gridTemplateColumns: `minmax(var(--il-report-fit-name), 1.6fr) repeat(${columns.length}, minmax(0, 1fr))` }}>
      <span></span>
      {columns.map(c => <span key={c} className="self-end pb-1 text-center text-fg-secondary text-balance">{c}</span>)}
      {rows.map(r => (
        <div key={r.key} className="contents">
          <span className="self-center pr-2 text-13 text-pretty">{r.label}</span>
          {r.cells.map((v, i) => (
            <span key={columns[i]} className="flex min-h-9 flex-col items-center justify-center gap-1 rounded-6 bg-report-chart-cell px-1.5 py-1">
              <span className={v ? 'font-700' : 'text-fg-secondary'}>{`${Math.round(v)}%`}</span>
              <span className="h-1 w-full rounded-2"><span className="block h-full rounded-2 bg-report-chart-series" style={{ inlineSize: `${Math.min(100, (100 * v) / max)}%` }}></span></span>
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

export type TrendLook = 'solid' | 'dashed' | 'dotted';
const LOOKS: Record<TrendLook, { className: string; dash?: string; stroke: number }> = {
  solid: { className: 'stroke-report-chart-series', stroke: 3 },
  dashed: { className: 'stroke-report-chart-reference', dash: '6 4', stroke: 2 },
  dotted: { className: 'stroke-report-chart-third', dash: '1 4', stroke: 2.5 }
};

/** Lines over the periods: the group's actual (solid), the ideal (dashed), the benchmark (dotted), each named at its end. */
export function TrendChart({ periods, series, label, format }: {
  periods: string[];
  series: Array<{ key: string; label: string; look: TrendLook; values: number[] }>;
  label: string;
  format: (n: number) => string;
}) {
  const W = 560, H = 230, M = { t: 14, r: 96, b: 28, l: 40 };
  const x = scaleBand({ domain: periods, range: [M.l, W - M.r], padding: 0.2 });
  const y = scaleLinear({ domain: [0, chartMax(series.flatMap(s => s.values))], range: [H - M.b, M.t], nice: true });
  const cx = (i: number) => round1((x(periods[i]) ?? 0) + x.bandwidth() / 2);
  // End labels sit at their line's last value, nudged apart so they never overlap.
  const ends = series.map(s => ({ key: s.key, y: y(s.values.at(-1) ?? 0) })).sort((a, b) => a.y - b.y);
  for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 14) ends[i].y = ends[i - 1].y + 14;
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className={SVG} role="img" aria-label={label}>
      <AxisLeft scale={y} left={M.l} numTicks={4} hideAxisLine hideTicks tickFormat={v => format(Number(v))} tickLabelProps={{ ...TICK, textAnchor: 'end', dx: -4 }} />
      <AxisBottom scale={x} top={H - M.b} hideTicks axisLineClassName="stroke-report-chart-reference" tickLabelProps={{ ...TICK, textAnchor: 'middle' }} />
      {series.map(s => {
        const l = LOOKS[s.look];
        return (
          <LinePath key={s.key} data={s.values} x={(_, i) => cx(i)} y={v => round1(y(v))} fill="none" className={l.className}
            strokeWidth={l.stroke} strokeDasharray={l.dash} strokeLinecap="round" strokeLinejoin="round" />
        );
      })}
      {series.map(s => (
        <text key={s.key} x={cx(periods.length - 1) + 10} y={ends.find(e => e.key === s.key)!.y} dominantBaseline="central" className={s.look === 'solid' ? `${LABEL} font-700` : MUTED}>
          {`${s.label} ${format(s.values.at(-1) ?? 0)}`}
        </text>
      ))}
    </svg>
  );
}

/** A short sample of a trend line, for the legend. */
export function TrendSample({ look }: { look: TrendLook }) {
  const l = LOOKS[look];
  return (
    <svg viewBox="0 0 24 8" className="h-2 w-6" aria-hidden="true">
      <LinePath data={[1, 23]} x={v => v} y={() => 4} className={l.className} strokeWidth={l.stroke} strokeDasharray={l.dash} strokeLinecap="round" />
    </svg>
  );
}
