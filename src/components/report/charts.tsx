import { useId } from 'react';
import { AxisBottom, AxisLeft } from '@visx/axis';
import { Group } from '@visx/group';
import { PatternLines } from '@visx/pattern';
import { scaleBand, scaleLinear } from '@visx/scale';
import { Bar, Line, LinePath } from '@visx/shape';
import { useI18n } from '../../i18n';
import { chartMax, gridCell, round1 } from './display';
import type { StyleExtras, StyleKey } from './types';
import './messages';

/**
 * The report's charts, drawn with visx in a fixed drawing space that scales to the card. None relies
 * on colour alone: lines differ by pattern, bars carry their numbers, the bottleneck is hatched, and
 * matched cells are outlined. Each has a name for screen readers and a table beside it (ChartBlock).
 */

const SVG = 'block h-auto w-full max-w-(--il-report-chart-max) overflow-visible';
const LABEL = 'fill-fg-primary text-12';
const MUTED = 'fill-fg-secondary text-12';
/** Band padding of bar rows and grid cells, as a share of the band. */
const ROW_GAP = 0.3, CELL_GAP = 0.08, TICK_GAP = 0.2;
const TICK = { className: 'fill-fg-secondary text-11', fontFamily: 'inherit', fontSize: undefined } as const;

/** Style shares: one bar per lens style, with the count and share at its end. The dominant style is bold. */
export function StyleSharesChart({ styles, shares, total, dominant, label }: { styles: StyleExtras['styles']; shares: Record<StyleKey, number>; total: number; dominant: StyleKey[]; label: string }) {
  const { t, number } = useI18n();
  const W = 520, ROW = 30, LEFT = 100, RIGHT = 96;
  const H = ROW * styles.length;
  const keys = styles.map(s => s.key);
  const count = (k: StyleKey) => shares[k] ?? 0;
  const x = scaleLinear({ domain: [0, chartMax(Object.values(shares))], range: [0, W - LEFT - RIGHT] });
  const y = scaleBand({ domain: keys, range: [0, H], padding: ROW_GAP });
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className={SVG} role="img" aria-label={label}>
      {styles.map(({ key: k, name }) => {
        const top = y(k) ?? 0, h = y.bandwidth(), w = x(count(k));
        const strong = dominant.includes(k);
        return (
          <Group key={k} top={top}>
            <text x={0} y={h / 2} dominantBaseline="central" className={`${LABEL} ${strong ? 'font-700' : ''}`}>{name}</text>
            <Bar x={LEFT} y={0} width={W - LEFT - RIGHT} height={h} rx={4} className="fill-report-chart-cell" />
            <Bar x={LEFT} y={0} width={w} height={h} rx={4} className="fill-report-chart-series" />
            <text x={LEFT + w + 8} y={h / 2} dominantBaseline="central" className={MUTED}>
              {t('report.style.shareValue', { count: number(count(k)), pct: total ? Math.round((count(k) / total) * 100) : 0 })}
            </text>
          </Group>
        );
      })}
    </svg>
  );
}

/**
 * The used vs needed grid: rows are the four needs (skill and morale), columns the lens's styles you
 * used. The cells where the style fits the need are outlined. More than four styles show their letters
 * above the columns; the table beside it names them in full.
 */
export function FitGridChart({ grid, fit, styles, needs, label }: { grid: number[][]; fit: number[][]; styles: StyleExtras['styles']; needs: StyleExtras['needs']; label: string }) {
  const { number } = useI18n();
  const W = 520, LEFT = 140, TOP = 26, CELL_H = 36;
  const H = TOP + CELL_H * needs.length;
  const x = scaleBand({ domain: styles.map(s => s.key), range: [LEFT, W], padding: CELL_GAP });
  const y = scaleBand({ domain: needs.map(n => n.key), range: [TOP, H], padding: CELL_GAP });
  const max = chartMax(grid.flat());
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className={SVG} role="img" aria-label={label}>
      {styles.map(s => (
        <text key={`c${s.key}`} x={(x(s.key) ?? 0) + x.bandwidth() / 2} y={TOP / 2} textAnchor="middle" dominantBaseline="central" className={MUTED}>{styles.length > 4 ? s.letter : s.name}</text>
      ))}
      {needs.map(({ key: need, label: needLabel }, r) => (
        <Group key={need}>
          <text x={0} y={(y(need) ?? 0) + y.bandwidth() / 2} dominantBaseline="central" className={MUTED}>{needLabel}</text>
          {styles.map(({ key: used }, c) => {
            const cell = gridCell(grid, r, c, max, fit);
            const cx = x(used) ?? 0, cy = y(need) ?? 0, w = x.bandwidth(), h = y.bandwidth();
            return (
              <Group key={used}>
                <Bar x={cx} y={cy} width={w} height={h} rx={6} className={`fill-report-chart-cell ${cell.matched ? 'stroke-report-chart-series' : ''}`} strokeWidth={cell.matched ? 2 : 0} />
                <Bar x={cx + 6} y={cy + h - 8} width={(w - 12) * cell.share} height={4} rx={2} className="fill-report-chart-series" />
                <text x={cx + w / 2} y={cy + h / 2 - 2} textAnchor="middle" dominantBaseline="central" className={`${LABEL} ${cell.matched ? 'font-700' : ''}`}>{number(cell.count)}</text>
              </Group>
            );
          })}
        </Group>
      ))}
    </svg>
  );
}

/** Cumulative revenue against target pace (dashed), with the values named at the line ends. */
export function RevenueChart({ points, money, label }: { points: Array<{ label: string; value: number; pace: number }>; money: (n: number) => string; label: string }) {
  const { t } = useI18n();
  const W = 520, H = 220, M = { t: 12, r: 92, b: 26, l: 48 };
  const x = scaleBand({ domain: points.map(p => p.label), range: [M.l, W - M.r], padding: TICK_GAP });
  const y = scaleLinear({ domain: [0, chartMax(points.flatMap(p => [p.value, p.pace]))], range: [H - M.b, M.t], nice: true });
  const cx = (p: { label: string }) => round1((x(p.label) ?? 0) + x.bandwidth() / 2);
  const last = points.at(-1);
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className={SVG} role="img" aria-label={label}>
      <AxisLeft scale={y} left={M.l} numTicks={4} hideAxisLine hideTicks tickFormat={v => money(Number(v))} tickLabelProps={{ ...TICK, textAnchor: 'end', dx: -4 }} />
      <AxisBottom scale={x} top={H - M.b} hideTicks axisLineClassName="stroke-report-chart-reference" tickLabelProps={{ ...TICK, textAnchor: 'middle' }} />
      <LinePath data={points} x={cx} y={p => round1(y(p.pace))} fill="none" className="stroke-report-chart-reference" strokeWidth={2} strokeDasharray="6 4" />
      <LinePath data={points} x={cx} y={p => round1(y(p.value))} fill="none" className="stroke-report-chart-series" strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
      {last && (
        <>
          <text x={cx(last) + 8} y={y(last.value)} dominantBaseline="central" className={`${LABEL} font-700`}>{t('report.business.you', { value: money(last.value) })}</text>
          <text x={cx(last) + 8} y={y(last.pace) + (last.pace > last.value ? -14 : 14)} dominantBaseline="central" className={MUTED}>{t('report.business.pace', { value: money(last.pace) })}</text>
        </>
      )}
    </svg>
  );
}

/** Each funnel stage over the run against its cumulative ideal (the tick). The bottleneck stage is hatched. */
export function FunnelChart({ stages, label }: { stages: Array<{ key: string; name: string; value: number; ideal: number; bottleneck: boolean }>; label: string }) {
  const { t, number } = useI18n();
  const id = useId().replace(/[^a-zA-Z0-9_]/g, '');
  const W = 520, ROW = 34, LEFT = 110, RIGHT = 120;
  const H = ROW * stages.length + 8;
  const x = scaleLinear({ domain: [0, chartMax(stages.flatMap(s => [s.value, s.ideal]))], range: [0, W - LEFT - RIGHT] });
  const y = scaleBand({ domain: stages.map(s => s.key), range: [4, H - 4], padding: ROW_GAP });
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className={SVG} role="img" aria-label={label}>
      <PatternLines id={`${id}hatch`} height={6} width={6} orientation={['diagonal']} strokeWidth={2} className="stroke-report-chart-attention" />
      {stages.map(s => {
        const top = y(s.key) ?? 0, h = y.bandwidth();
        return (
          <Group key={s.key} top={top}>
            <text x={0} y={h / 2} dominantBaseline="central" className={`${LABEL} ${s.bottleneck ? 'font-700' : ''}`}>{s.name}</text>
            <Bar x={LEFT} y={0} width={W - LEFT - RIGHT} height={h} rx={4} className="fill-report-chart-cell" />
            <Bar x={LEFT} y={0} width={x(s.value)} height={h} rx={4}
              className={s.bottleneck ? 'stroke-report-chart-attention' : 'fill-report-chart-series'} fill={s.bottleneck ? `url(#${id}hatch)` : undefined} strokeWidth={s.bottleneck ? 1.5 : 0} />
            <Line from={{ x: LEFT + x(s.ideal), y: -4 }} to={{ x: LEFT + x(s.ideal), y: h + 4 }} className="stroke-report-chart-reference" strokeWidth={2} />
            <text x={W - RIGHT + 10} y={h / 2} dominantBaseline="central" className={MUTED}>
              {t('report.business.stageValue', { value: number(Math.round(s.value)), ideal: number(Math.round(s.ideal)) })}
            </text>
          </Group>
        );
      })}
    </svg>
  );
}

export type TrajectoryMetric = 'morale' | 'trust' | 'result';
/** Line pattern per metric, so the lines read without colour. */
export const TRAJECTORY_LINES: Record<TrajectoryMetric, { className: string; dash?: string; stroke: number }> = {
  morale: { className: 'stroke-report-chart-series', stroke: 2.5 },
  trust: { className: 'stroke-report-chart-second', dash: '6 3', stroke: 2 },
  result: { className: 'stroke-report-chart-third', dash: '1 3.5', stroke: 2.5 }
};

/** One person's Morale, Trust and Result from the start of the run to its end, 0 to 100. */
export function TrajectoryChart({ points, label }: { points: Array<Record<TrajectoryMetric, number>>; label: string }) {
  const W = 240, H = 84, PAD = 4;
  const x = scaleLinear({ domain: [0, Math.max(1, points.length - 1)], range: [PAD, W - PAD] });
  const y = scaleLinear({ domain: [0, 100], range: [H - PAD, PAD] });
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={label}>
      <Line from={{ x: PAD, y: y(50) }} to={{ x: W - PAD, y: y(50) }} className="stroke-line-default" strokeWidth={1} />
      {(Object.keys(TRAJECTORY_LINES) as TrajectoryMetric[]).map(m => {
        const l = TRAJECTORY_LINES[m];
        return (
          <LinePath key={m} data={points} x={(_, i) => round1(x(i))} y={p => round1(y(p[m]))} fill="none" className={l.className}
            strokeWidth={l.stroke} strokeDasharray={l.dash} strokeLinecap="round" strokeLinejoin="round" />
        );
      })}
    </svg>
  );
}

/** A short sample of each line pattern, for the legend. */
export function LineSample({ metric }: { metric: TrajectoryMetric }) {
  const l = TRAJECTORY_LINES[metric];
  return (
    <svg viewBox="0 0 24 8" className="h-2 w-6" aria-hidden="true">
      <Line from={{ x: 1, y: 4 }} to={{ x: 23, y: 4 }} className={l.className} strokeWidth={l.stroke} strokeDasharray={l.dash} strokeLinecap="round" />
    </svg>
  );
}
