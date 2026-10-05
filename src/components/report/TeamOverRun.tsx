import { useId } from 'react';
import { LinePath } from '@visx/shape';
import { scaleLinear } from '@visx/scale';
import { useI18n } from '../../i18n';
import { DataTable, useReport, useTableAlternative } from './context';
import { round1 } from './display';
import type { PeriodUnit, TeamSeries } from './types';
import './messages';

/** The small multiples' drawing space, as in the design: 100 by 44, stretched to the card. */
const W = 100;
const H = 44;

function Multiple({ s }: { s: TeamSeries }) {
  const n = Math.max(1, s.values.length - 1);
  const x = scaleLinear({ domain: [0, n], range: [0, W] });
  const y = scaleLinear({ domain: s.domain, range: [H - 2, 2] });
  const px = (_: number, i: number) => round1(x(i));
  const py = (v: number) => round1(y(v));
  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={s.summary}>
      {s.target && <LinePath data={s.target} x={px} y={py} fill="none" className="stroke-line-strong" strokeWidth={1} strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />}
      <LinePath data={s.values} x={px} y={py} fill="none" className="stroke-accent-default" strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
}

export interface TeamOverRunProps {
  periods: number;
  unit: PeriodUnit;
  series: TeamSeries[];
}

/** "Your team over eight weeks": revenue against target pace and the four team metrics, as small multiples or a table. */
export function TeamOverRun({ periods, unit, series }: TeamOverRunProps) {
  const { t } = useI18n();
  const { layout } = useReport();
  const id = useId();
  const alt = useTableAlternative('chart');
  const title = t('report.team.title', { n: periods, unit });
  const labels = Array.from({ length: periods }, (_, i) => t('time.period', { unit, n: i + 1 }));
  const rows = series.flatMap(s => [
    { key: s.key, header: s.label, cells: s.cells },
    ...(s.targetCells ? [{ key: `${s.key}-target`, header: t('report.team.target', { label: s.label }), cells: s.targetCells }] : [])
  ]);
  const table = <DataTable caption={title} columns={[t('report.table.measure'), ...labels]} rows={rows} hidden={!alt.showTable} />;
  return (
    <section aria-labelledby={`${id}h`} className="flex flex-col gap-3">
      {alt.button ? (
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 id={`${id}h`} className="m-0 text-20 font-700">{title}</h2>
          {alt.button}
        </div>
      ) : <h2 id={`${id}h`} className="m-0 text-20 font-700">{title}</h2>}
      {alt.showTable ? table : (
        <>
          <div className={`grid gap-2.5 ${layout === 'phone' ? 'grid-cols-(--il-report-team-columns-phone)' : 'grid-cols-(--il-report-team-columns)'}`}>
            {series.map(s => (
              <div key={s.key} className="flex flex-col gap-1.5 rounded-16 border border-line-default p-3">
                <div className="flex justify-between text-12">
                  <span className="text-fg-secondary">{s.label}</span>
                  <b>{s.end}</b>
                </div>
                <Multiple s={s} />
                <span className="text-12 text-fg-secondary">{s.note}</span>
              </div>
            ))}
          </div>
          {alt.srTable && table}
        </>
      )}
    </section>
  );
}
