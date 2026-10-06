import { useId } from 'react';
import { useI18n } from '../../i18n';
import { ChartBlock } from './ChartBlock';
import { BarsChart, type BarSeries } from './charts';
import { usePurpose } from './context';
import { impactClass } from './display';
import { SeriesLegend } from './ResultsSections';
import type { ActionRowData, DistributionData, ImpactBand } from './types';
import './messages';

const IMPACTS: ImpactBand[] = ['none', 'veryLow', 'low', 'moderate', 'high'];

/** An impact band as a swatch and its name, so it never relies on colour alone. */
function ImpactTag({ impact }: { impact: ImpactBand }) {
  const { t } = useI18n();
  return (
    <span className="flex items-center gap-1.25 whitespace-nowrap">
      <span aria-hidden="true" className={`size-3.5 shrink-0 rounded-4 ${impactClass(impact)}`}></span>{t('report.actions.impact', { impact })}
    </span>
  );
}

/**
 * "Summary of actions" (the 1.0 report's actions pages): for each action, what it is for, its narrative,
 * its impact and its frequency, and a chart of frequency with the impact written beside each bar.
 */
export function ActionsSection({ rows }: { rows: ActionRowData[] }) {
  const { t, number } = useI18n();
  const id = useId();
  const series: BarSeries[] = [{ key: 'frequency', label: t('report.actions.term', { term: 'frequency' }), look: 'solid' }];
  const impact = (b: ImpactBand) => t('report.actions.impact', { impact: b });
  return (
    <section aria-labelledby={`${id}h`} className="flex flex-col gap-3">
      <h2 id={`${id}h`} className="m-0 text-20 font-700">{t('report.actions.title')}</h2>
      <p className="m-0 text-13 text-fg-secondary text-pretty">{t('report.actions.intro')}</p>
      <ChartBlock
        title={t('report.actions.chartTitle')}
        chart={<BarsChart series={series}
          label={t('report.actions.chartAria', { list: rows.map(r => t('report.actions.item', { action: r.name, n: r.frequency, impact: impact(r.impact) })).join(t('report.listSeparator')) })}
          rows={rows.map(r => ({ key: r.key, label: r.name, values: [{ value: r.frequency, text: `${number(r.frequency)}${t('report.separator')}${impact(r.impact)}` }] }))} />}
        table={{
          columns: [t('report.actions.column', { column: 'action' }), t('report.actions.column', { column: 'frequency' }), t('report.actions.column', { column: 'impact' })],
          rows: rows.map(r => ({ key: r.key, header: r.name, cells: [number(r.frequency), impact(r.impact)] }))
        }}
      />
      <SeriesLegend series={series} />
      <div className="grid gap-2.5 grid-cols-(--il-report-halves-columns)">
        {rows.map(r => (
          <article key={r.key} aria-labelledby={`${id}${r.key}`} className="flex flex-col gap-1.5 rounded-16 border border-line-default px-3.5 py-3 text-13">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <h3 id={`${id}${r.key}`} className="m-0 text-15 font-700">{r.name}</h3>
              <dl className="m-0 flex flex-wrap gap-x-4 gap-y-1 text-12">
                <div className="flex gap-1"><dt className="text-fg-secondary">{t('report.actions.term', { term: 'impact' })}</dt><dd className="m-0 font-700"><ImpactTag impact={r.impact} /></dd></div>
                <div className="flex gap-1"><dt className="text-fg-secondary">{t('report.actions.term', { term: 'frequency' })}</dt><dd className="m-0 font-700">{number(r.frequency)}</dd></div>
              </dl>
            </div>
            {r.description && <p className="m-0 text-fg-secondary text-pretty">{r.description}</p>}
            <p className="m-0 text-pretty">{r.narrative}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

/**
 * "Actions across your team" (the 1.0 report's distribution matrix): people by action, each cell the times
 * an action reached that person, filled by its impact (fill, outline, lines or hatching, with a legend in
 * words), people ordered by total impact. Print shows the table: fills do not read in black and white.
 */
export function DistributionSection({ data }: { data: DistributionData }) {
  const { t, number } = useI18n();
  const purpose = usePurpose();
  const id = useId();
  const impact = (b: ImpactBand) => t('report.actions.impact', { impact: b });
  const columns = `var(--il-report-dist-name) repeat(${data.actions.length}, minmax(var(--il-report-dist-cell), 1fr))`;
  const tableTitle = t('report.distribution.tableTitle');
  const matrix = (
    // Scrolls sideways when narrow, so it takes focus (arrow keys scroll it); the matrix is one image, its table is the alternative.
    <div role="region" aria-label={tableTitle} tabIndex={0} className="overflow-x-auto focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-secondary">
      <div role="img" aria-label={t('report.distribution.matrixAria', { n: data.members.length })} className="grid min-w-max gap-1" style={{ gridTemplateColumns: columns }}>
        <span></span>
        {data.actions.map(a => (
          <span key={a.key} className="flex h-(--il-report-dist-head) items-end justify-center">
            <span className="rotate-180 text-12 text-fg-secondary [writing-mode:vertical-rl]">{a.name}</span>
          </span>
        ))}
        {data.members.map(m => (
          <div key={m.id} className="contents">
            <span className="self-center text-13 font-600 break-words">{m.name}</span>
            {m.cells.map((c, i) => (
              <span key={data.actions[i].key} title={t('report.distribution.cell', { name: m.name, action: data.actions[i].name, n: c.count, impact: impact(c.impact) })}
                className={`flex min-h-7 items-center justify-center rounded-6 text-12 font-700 ${impactClass(c.count ? c.impact : 'none')}`}>
                {number(c.count)}
              </span>
            ))}
          </div>
        ))}
        <span className="self-center text-13 font-700">{t('report.distribution.everyone')}</span>
        {data.totals.map((n, i) => <span key={data.actions[i].key} className="flex min-h-7 items-center justify-center text-12 font-700">{number(n)}</span>)}
      </div>
    </div>
  );
  return (
    <section aria-labelledby={`${id}h`} className="flex flex-col gap-3">
      <h2 id={`${id}h`} className="m-0 text-20 font-700">{t('report.distribution.title', { purpose })}</h2>
      <p className="m-0 text-13 text-fg-secondary text-pretty">{t('report.distribution.intro')}</p>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-12 text-fg-secondary">
        <span className="font-700">{t('report.distribution.legend')}</span>
        {IMPACTS.map(b => <ImpactTag key={b} impact={b} />)}
      </div>
      <ChartBlock
        title={tableTitle}
        printAs="table"
        chart={matrix}
        table={{
          columns: [t('report.distribution.person'), ...data.actions.map(a => a.name)],
          rows: [
            ...data.members.map(m => ({ key: m.id, header: m.name, cells: m.cells.map(c => t('report.distribution.cellTable', { n: c.count, impact: impact(c.impact) })) })),
            { key: 'total', header: t('report.distribution.everyone'), cells: data.totals.map(n => number(n)) }
          ]
        }}
      />
    </section>
  );
}
