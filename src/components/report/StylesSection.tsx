import { useId } from 'react';
import { useI18n } from '../../i18n';
import { ChartBlock } from './ChartBlock';
import { BarsChart, FitGridChart, type BarSeries } from './charts';
import { SeriesLegend } from './ResultsSections';
import type { ConsistencyData, StylesData } from './types';
import './messages';

const CARD = 'flex flex-col gap-1.5 rounded-16 border border-line-default px-3.5 py-3 text-13';

/**
 * "Leadership styles summary" (the 1.0 report's styles page, lens aware, D70): proportion and accuracy per
 * style as bars, where each style was used against what people needed (rows: the lens's needs, columns:
 * its styles, 2 to 6), a card per style with its narrative, and the preferred style.
 */
export function StylesSection({ data }: { data: StylesData }) {
  const { t, number } = useI18n();
  const id = useId();
  const series: BarSeries[] = [{ key: 'proportion', label: t('report.styles.measure', { measure: 'proportion' }), look: 'solid' }, { key: 'accuracy', label: t('report.styles.measure', { measure: 'accuracy' }), look: 'hatch' }];
  const total = data.grid.flat().reduce((a, b) => a + b, 0);
  const matched = data.grid.reduce((a, row, r) => a + row.reduce((b, n, c) => b + (data.fit[r]?.[c] === 0 ? n : 0), 0), 0);
  const pctText = (n: number) => t('report.percent', { pct: n });
  return (
    <section aria-labelledby={`${id}h`} className="flex flex-col gap-3">
      <h2 id={`${id}h`} className="m-0 text-20 font-700">{t('report.styles.title')}</h2>
      <p className="m-0 text-13 text-fg-secondary text-pretty">{t('report.styles.intro')}</p>
      <div className="grid gap-5 grid-cols-(--il-report-halves-columns)">
        <div className="flex flex-col gap-2">
          <ChartBlock
            title={t('report.styles.chartTitle')}
            chart={<BarsChart series={series} max={100}
              label={t('report.styles.chartAria', { list: data.styles.map(s => t('report.styles.item', { style: s.name, proportion: s.proportion, used: String(s.accuracy !== null), accuracy: s.accuracy ?? 0 })).join(t('report.listSeparator')) })}
              rows={data.styles.map(s => ({ key: s.key, label: s.name, values: [{ value: s.proportion, text: pctText(s.proportion) }, { value: s.accuracy ?? 0, text: s.accuracy === null ? t('report.styles.notUsed') : pctText(s.accuracy) }] }))} />}
            table={{
              columns: [t('report.styles.column', { column: 'style' }), t('report.styles.column', { column: 'uses' }), t('report.styles.column', { column: 'proportion' }), t('report.styles.column', { column: 'accuracy' })],
              rows: data.styles.map(s => ({ key: s.key, header: s.name, cells: [number(s.count), pctText(s.proportion), s.accuracy === null ? t('report.styles.notUsed') : pctText(s.accuracy)] }))
            }}
          />
          <SeriesLegend series={series} />
        </div>
        <ChartBlock
          title={t('report.styles.gridTitle')}
          chart={<FitGridChart grid={data.grid} fit={data.fit} styles={data.styles} needs={data.needs} label={t('report.style.gridAria', { matched, total })} />}
          table={{
            columns: [t('report.style.gridCorner'), ...data.styles.map(s => t('report.style.used', { style: s.name }))],
            rows: data.needs.map((n, r) => ({ key: n.key, header: t('report.style.needed', { need: n.label, short: n.short }), cells: data.styles.map((_, c) => number(data.grid[r]?.[c] ?? 0)) }))
          }}
        />
      </div>
      <div className="grid gap-2.5 grid-cols-(--il-report-tiles-columns)">
        {data.styles.map(s => (
          <article key={s.key} aria-labelledby={`${id}${s.key}`} className={CARD}>
            <h3 id={`${id}${s.key}`} className="m-0 text-15 font-700">{s.name}</h3>
            <span className="flex flex-wrap gap-x-3 text-12 font-600 text-fg-secondary">
              <span>{t('report.styles.proportion', { pct: s.proportion })}</span>
              <span>{t('report.styles.accuracy', { used: String(s.accuracy !== null), pct: s.accuracy ?? 0 })}</span>
            </span>
            {s.narrative.map(l => <p key={l} className="m-0 text-pretty">{l}</p>)}
          </article>
        ))}
      </div>
      {data.preferred && <p className="m-0 text-14 font-600 text-pretty">{data.preferred}</p>}
    </section>
  );
}

/**
 * "Consistency in styles" (the 1.0 report's consistency page): needed against used, intended against
 * used, needed against intended, as deviations with their narratives, and each person's predominant
 * needed, intended and used style as a table.
 */
export function ConsistencySection({ data }: { data: ConsistencyData }) {
  const { t } = useI18n();
  const id = useId();
  const series: BarSeries[] = [{ key: 'deviation', label: t('report.consistency.chartTitle'), look: 'solid' }];
  const measure = (k: ConsistencyData['deviations'][number]['key']) => t('report.consistency.measure', { key: k });
  const none = t('report.consistency.none');
  return (
    <section aria-labelledby={`${id}h`} className="flex flex-col gap-3">
      <h2 id={`${id}h`} className="m-0 text-20 font-700">{t('report.consistency.title')}</h2>
      <p className="m-0 text-13 text-fg-secondary text-pretty">{t('report.consistency.intro', { actions: data.actions.join(t('report.listSeparator')) })}</p>
      <div className="grid gap-2.5 grid-cols-(--il-report-tiles-columns)">
        {data.deviations.map(d => (
          <article key={d.key} aria-labelledby={`${id}${d.key}`} className={CARD}>
            <h3 id={`${id}${d.key}`} className="m-0 text-15 font-700">{measure(d.key)}</h3>
            <b className="text-22">{t('report.consistency.deviation', { has: String(d.value !== null), pct: d.value ?? 0 })}</b>
            <span className="text-12 text-fg-secondary text-pretty">{t('report.consistency.explain', { key: d.key })}</span>
            {d.narrative && <p className="m-0 text-pretty">{d.narrative}</p>}
          </article>
        ))}
      </div>
      <ChartBlock
        title={t('report.consistency.chartTitle')}
        printAs="table"
        chart={<BarsChart series={series} max={100}
          label={t('report.consistency.chartAria', { list: data.deviations.map(d => t('report.consistency.item', { measure: measure(d.key), has: String(d.value !== null), pct: d.value ?? 0 })).join(t('report.listSeparator')) })}
          rows={data.deviations.map(d => ({ key: d.key, label: measure(d.key), values: [{ value: d.value ?? 0, text: d.value === null ? none : t('report.percent', { pct: d.value }) }] }))} />}
        table={{
          columns: [t('report.objectives.column', { column: 'measure' }), t('report.consistency.chartTitle')],
          rows: data.deviations.map(d => ({ key: d.key, header: measure(d.key), cells: [d.value === null ? none : t('report.percent', { pct: d.value })] }))
        }}
      />
      {data.members.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <h3 className="m-0 text-15 font-700">{t('report.consistency.membersTitle')}</h3>
          <div role="region" aria-label={t('report.consistency.membersTitle')} tabIndex={0} className="overflow-x-auto focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-secondary">
            <table className="w-full border-collapse text-13">
              <caption className="sr-only">{t('report.consistency.membersTitle')}</caption>
              <thead>
                <tr>
                  {(['person', 'needed', 'intended', 'used'] as const).map(c => (
                    <th key={c} scope="col" className="border-b border-line-default px-2 py-1 text-left font-700 text-fg-secondary">{t('report.consistency.column', { column: c })}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.members.map(m => (
                  <tr key={m.id}>
                    <th scope="row" className="border-b border-line-default px-2 py-1 text-left font-600">{m.name}</th>
                    <td className="border-b border-line-default px-2 py-1">{m.needed ?? none}</td>
                    <td className="border-b border-line-default px-2 py-1">{m.intended ?? none}</td>
                    <td className="border-b border-line-default px-2 py-1">{m.used ?? none}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
