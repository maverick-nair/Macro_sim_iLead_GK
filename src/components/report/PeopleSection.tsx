import { useId } from 'react';
import { useI18n } from '../../i18n';
import { LineSample, TrajectoryChart, type TrajectoryMetric } from './charts';
import { DataTable, useReport, useTableAlternative } from './context';
import type { PersonData } from './types';

const METRICS: TrajectoryMetric[] = ['morale', 'trust', 'result'];

/**
 * "People over the run": each person's Morale, Trust and Result from start to end, with the actions and
 * days spent on them. Charts on screen with one "Show as table" for the section; tables in print,
 * where ten small line charts would not read.
 */
export function PeopleSection({ people }: { people: PersonData[] }) {
  const { t, number, delta } = useI18n();
  const { print } = useReport();
  const id = useId();
  const alt = useTableAlternative('table');
  const metric = (m: TrajectoryMetric) => t('report.people.metric', { metric: m });
  return (
    <section aria-labelledby={`${id}h`} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id={`${id}h`} className="m-0 text-20 font-700">{t('report.people.title')}</h2>
        <div className="flex flex-wrap items-center gap-3 text-12 text-fg-secondary">
          {!alt.showTable && METRICS.map(m => <span key={m} className="flex items-center gap-1.25"><LineSample metric={m} />{metric(m)}</span>)}
          {alt.button}
        </div>
      </div>
      <div className={`grid gap-2.5 ${print ? 'grid-cols-2' : 'grid-cols-(--il-report-cards-columns)'}`}>
        {people.map(p => {
          const first = p.points[0], last = p.points.at(-1) ?? first;
          const table = (
            <DataTable hidden={!alt.showTable} caption={t('report.people.tableCaption', { name: p.name })}
              columns={[t('report.table.measure'), ...p.points.map(x => x.label)]}
              rows={METRICS.map(m => ({ key: m, header: metric(m), cells: p.points.map(x => number(x[m])) }))} />
          );
          return (
            <div key={p.id} role="group" aria-labelledby={`${id}${p.id}`} className="flex min-w-0 flex-col gap-2 rounded-16 border border-line-default px-3.5 py-3">
              <div className="flex items-baseline justify-between gap-2">
                <h3 id={`${id}${p.id}`} className="m-0 text-14 font-700">{p.name}</h3>
                {p.left && <span className="text-12 text-fg-secondary">{t('report.left')}</span>}
              </div>
              {alt.showTable ? table : (
                <>
                  {first && last && (
                    <TrajectoryChart points={p.points} label={t('report.people.aria', {
                      name: p.name,
                      morale: first.morale, moraleEnd: last.morale, trust: first.trust, trustEnd: last.trust, result: first.result, resultEnd: last.result
                    })} />
                  )}
                  {alt.srTable && table}
                </>
              )}
              <span className="text-12 text-fg-secondary">
                {t('report.people.stats', { actions: p.actions, days: p.days, change: delta(p.resultChange) })}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
