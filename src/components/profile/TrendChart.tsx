import { useId, useState } from 'react';
import { useI18n } from '../../i18n';

export interface TrendPoint {
  /** "Start", "End of week 1", "Now". */
  label: string;
  /** Null where the person was not on the team yet. */
  value: number | null;
}

export interface TrendChartProps {
  /** Shown above the line: "Result trend". */
  title: string;
  points: TrendPoint[];
}

/**
 * A person's result over the run (D96, 1.0's Result Trend): a line on the shared 0 to 100 scale, one point
 * per period start and one for now, with "Show as table" for a real table with the same numbers.
 */
export function TrendChart({ title, points }: TrendChartProps) {
  const { t, number } = useI18n();
  const [table, setTable] = useState(false);
  const id = useId();
  const known = points.map((p, i) => ({ ...p, i })).filter((p): p is TrendPoint & { i: number; value: number } => p.value !== null);
  // The view box is 100 wide and 40 tall; the stroke does not scale with it.
  const x = (i: number) => (points.length < 2 ? 50 : 4 + i / (points.length - 1) * 92);
  const y = (v: number) => 37 - v / 100 * 34;
  const first = known[0], last = known[known.length - 1];
  const summary = first && last ? t('profile.trend.aria', { from: number(first.value), to: number(last.value), n: known.length }) : t('profile.trend.none');
  return (
    <section aria-labelledby={id} className="flex flex-col gap-1.5" data-tour="trend">
      <div className="flex items-baseline justify-between gap-2">
        <h3 id={id} className="m-0 text-13 font-700">{title}</h3>
        <button type="button" aria-pressed={table} onClick={() => setTable(v => !v)}
          className="cursor-pointer border-0 bg-transparent px-1 text-12 font-700 text-accent-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-secondary">
          {t('profile.trend.table', { on: String(table) })}
        </button>
      </div>
      {table ? (
        <table className="w-full border-collapse text-12">
          <caption className="sr-only">{title}</caption>
          <tbody>
            {points.map((p, i) => (
              <tr key={i} className="border-b border-line-default">
                <th scope="row" className="py-1 text-start font-400 text-fg-secondary">{p.label}</th>
                <td className="py-1 text-end font-700 tabular-nums">{p.value === null ? t('profile.trend.absent') : number(p.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="relative h-(--il-panel-trend-height) rounded-12 bg-surface-raised">
          <svg role="img" aria-label={summary} viewBox="0 0 100 40" preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible">
            <line x1="0" x2="100" y1={y(50)} y2={y(50)} className="stroke-line-default" strokeWidth="1" strokeDasharray="2 2" vectorEffect="non-scaling-stroke" />
            {known.length > 1 && <polyline fill="none" className="stroke-accent-secondary" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke"
              points={known.map(p => `${x(p.i)},${y(p.value)}`).join(' ')} />}
          </svg>
          {/* The dots are drawn in HTML so they stay round however the box stretches. */}
          {known.map(p => (
            <span key={p.i} aria-hidden="true" title={`${p.label}: ${number(p.value)}`} className="absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-round bg-accent-secondary"
              style={{ left: `${x(p.i)}%`, top: `${y(p.value) / 40 * 100}%` }} />
          ))}
          {last && <span aria-hidden="true" className="absolute end-2 top-1 text-12 font-700">{number(last.value)}</span>}
        </div>
      )}
    </section>
  );
}
