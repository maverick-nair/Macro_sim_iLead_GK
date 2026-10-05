import { useId } from 'react';
import { useI18n } from '../../i18n';
import { ChartBlock } from './ChartBlock';
import { FitGridChart, StyleSharesChart } from './charts';
import { fitClass } from './display';
import { STYLE_KEYS, type FitRow, type PeriodUnit, type StyleExtras } from './types';
import './messages';

const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-secondary';

export interface StyleFitSectionProps {
  unit: PeriodUnit;
  /** Period numbers, one column each. */
  periods: number[];
  rows: FitRow[];
  /** "You matched 61 of 80 choices." */
  summary: string;
  /** Engine only: style shares, capability, the used vs needed grid and the narrative. */
  extras?: StyleExtras;
}

/**
 * "Style fit, week by week": the style chosen for each person each period and whether it fit, as a
 * table (it is the data itself), plus the engine's style flexibility charts.
 */
export function StyleFitSection({ unit, periods, rows, summary, extras }: StyleFitSectionProps) {
  const { t, number } = useI18n();
  const id = useId();
  const title = t('report.fit.title', { unit });
  const columns = `var(--il-report-fit-name) repeat(${periods.length},minmax(0,1fr))`;
  const legend = [
    ['matched', 'bg-accent-default'],
    ['off', 'border-2 border-solid border-accent-default'],
    ['missed', 'border border-solid border-status-attention bg-(image:--il-report-fit-missed-swatch)']
  ] as const;

  return (
    <section aria-labelledby={`${id}h`} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id={`${id}h`} className="m-0 text-20 font-700">{title}</h2>
        <div className="flex gap-3 text-12 text-fg-secondary">
          {legend.map(([fit, cls]) => (
            <span key={fit} className="flex items-center gap-1.25">
              <span className={`size-3.5 rounded-4 ${cls}`}></span>{t('report.fit.legend', { fit })}
            </span>
          ))}
        </div>
      </div>
      {/* Scrolls sideways when narrow, so it takes focus (arrow keys scroll it) and is named after the table. */}
      <div role="region" aria-label={title} tabIndex={0} className={`overflow-x-auto ${FOCUS}`}>
        {/* Rows are display:contents wrappers, so the grid lays out the cells directly. */}
        <div role="table" aria-label={t('report.fit.tableAria', { unit })} className="grid gap-1 min-w-0" style={{ gridTemplateColumns: columns }}>
          <div role="row" className="contents">
            <span role="columnheader"><span className="sr-only">{t('report.fit.person')}</span></span>
            {periods.map(p => (
              <span key={p} role="columnheader" className="text-center text-12 text-fg-secondary">
                <span aria-hidden="true">{t('report.fit.week', { unit, n: p })}</span>
                <span className="sr-only">{t('time.period', { unit, n: p })}</span>
              </span>
            ))}
          </div>
          {rows.map(r => (
            <div key={r.id} role="row" className="contents">
              <span role="rowheader" className="self-center overflow-hidden text-13 font-600 text-ellipsis whitespace-nowrap text-large:whitespace-normal text-large:break-words">
                {r.name}{r.left && <span className="sr-only">{` ${t('report.left')}`}</span>}
              </span>
              {r.cells.map((c, i) => {
                const label = c
                  ? t('report.fit.cell', { name: r.fullName, unit, n: periods[i], style: t('style.name', { style: c.style }), fit: c.fit })
                  : t('report.fit.cellNone', { name: r.fullName, unit, n: periods[i] });
                return (
                  <span key={i} role="cell" title={label} aria-label={label}
                    className={`flex min-h-7 items-center justify-center rounded-6 text-12 font-700 ${fitClass(c)}`}>
                    {c?.style}
                  </span>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <span className="text-13 text-fg-secondary">{summary}</span>
      {extras && (
        <>
          <p className="m-0 text-14">{t('report.style.capability', { pct: number(extras.capability) })}</p>
          <div className="grid gap-5 grid-cols-2">
            <ChartBlock
              title={t('report.style.sharesTitle')}
              chart={<StyleSharesChart shares={extras.shares} total={extras.total} dominant={extras.dominant}
                label={t('report.style.sharesAria', {
                  total: extras.total,
                  list: STYLE_KEYS.map(k => t('report.style.shareItem', { style: t('style.name', { style: k }), count: extras.shares[k] })).join(t('report.listSeparator')),
                  dominant: extras.dominant.map(k => t('style.name', { style: k })).join(t('report.listAnd'))
                })} />}
              table={{
                columns: [t('report.style.column', { column: 'style' }), t('report.style.column', { column: 'choices' }), t('report.style.column', { column: 'share' })],
                rows: STYLE_KEYS.map(k => ({ key: k, header: t('style.name', { style: k }), cells: [number(extras.shares[k]), t('report.percent', { pct: extras.total ? Math.round((extras.shares[k] / extras.total) * 100) : 0 })] }))
              }}
            />
            <ChartBlock
              title={t('report.style.gridTitle')}
              chart={<FitGridChart grid={extras.grid} label={t('report.style.gridAria', { matched: STYLE_KEYS.reduce((a, _, i) => a + (extras.grid[i]?.[i] ?? 0), 0), total: extras.grid.flat().reduce((a, b) => a + b, 0) })} />}
              table={{
                columns: [t('report.style.gridCorner'), ...STYLE_KEYS.map(k => t('report.style.used', { style: t('style.name', { style: k }) }))],
                rows: STYLE_KEYS.map((k, r) => ({ key: k, header: t('report.style.needed', { style: t('style.name', { style: k }) }), cells: STYLE_KEYS.map((_, c) => number(extras.grid[r]?.[c] ?? 0)) }))
              }}
            />
          </div>
          {extras.narrative.map(line => <p key={line} className="m-0 text-14 text-pretty">{line}</p>)}
        </>
      )}
    </section>
  );
}
