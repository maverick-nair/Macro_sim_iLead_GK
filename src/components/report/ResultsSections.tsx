import { useId } from 'react';
import { useI18n } from '../../i18n';
import { ChartBlock } from './ChartBlock';
import { BarsChart, BarSwatch, type BarSeries } from './charts';
import { usePurpose } from './context';
import type { AdaptabilityData, ObjectivesData } from './types';
import './messages';

/** A chart legend in words with each series' swatch, so the bars read without colour. */
export function SeriesLegend({ series }: { series: BarSeries[] }) {
  return (
    <ul className="m-0 flex list-none flex-wrap gap-x-3 gap-y-1 p-0 text-12 text-fg-secondary">
      {series.map(s => <li key={s.key} className="flex items-center gap-1.25"><BarSwatch look={s.look} />{s.label}</li>)}
    </ul>
  );
}

/** "Objectives": revenue against target, conversions, and the team's skill, morale and result at the start and the end (the 1.0 report's objectives page). */
export function ObjectivesSection({ data }: { data: ObjectivesData }) {
  const { t, number, delta } = useI18n();
  const purpose = usePurpose();
  const id = useId();
  const money = data.money;
  const revenueSeries: BarSeries[] = [{ key: 'actual', label: t('report.objectives.bar', { bar: 'actual' }), look: 'solid' }, { key: 'target', label: t('report.objectives.bar', { bar: 'target' }), look: 'outline' }];
  const teamSeries: BarSeries[] = [{ key: 'start', label: t('report.objectives.legend', { when: 'start' }), look: 'outline' }, { key: 'end', label: t('report.objectives.legend', { when: 'end' }), look: 'solid' }];
  const teamTitle = t('report.objectives.teamTitle', { purpose });
  return (
    <section aria-labelledby={`${id}h`} className="flex flex-col gap-3">
      <h2 id={`${id}h`} className="m-0 text-20 font-700">{t('report.objectives.title')}</h2>
      <p className="m-0 text-14 text-pretty">{data.narrative}</p>
      <div className="grid gap-5 grid-cols-(--il-report-halves-columns)">
        <div className="flex flex-col gap-2">
          <ChartBlock
            title={t('report.objectives.revenueTitle')}
            chart={<BarsChart series={revenueSeries} label={t('report.objectives.revenueAria', { revenue: money(data.revenue), target: money(data.target), share: data.share })}
              rows={[{ key: 'revenue', label: t('report.team.metric', { metric: 'revenue' }), values: [{ value: data.revenue, text: money(data.revenue) }, { value: data.target, text: money(data.target) }] }]} />}
            table={{
              columns: [t('report.objectives.column', { column: 'measure' }), t('report.team.metric', { metric: 'revenue' })],
              rows: [
                { key: 'actual', header: revenueSeries[0].label, cells: [money(data.revenue)] },
                { key: 'target', header: revenueSeries[1].label, cells: [money(data.target)] },
                { key: 'share', header: t('report.progress.metric', { metric: 'target' }), cells: [data.share] }
              ]
            }}
          />
          <SeriesLegend series={revenueSeries} />
          <p className="m-0 text-14 font-700">{t('report.objectives.conversions', { n: data.conversions })}</p>
          <p className="m-0 text-12 text-fg-secondary">{t('report.objectives.revenueNote')}</p>
        </div>
        <div className="flex flex-col gap-2">
          <ChartBlock
            title={teamTitle}
            chart={<BarsChart series={teamSeries} max={100}
              label={t('report.objectives.teamAria', { list: data.team.map(k => t('report.objectives.teamItem', { metric: k.label, start: number(k.start), end: number(k.end) })).join(t('report.listSeparator')) })}
              rows={data.team.map(k => ({ key: k.key, label: k.label, values: [{ value: k.start, text: number(k.start) }, { value: k.end, text: number(k.end) }] }))} />}
            table={{
              columns: [t('report.objectives.column', { column: 'measure' }), t('report.objectives.column', { column: 'start' }), t('report.objectives.column', { column: 'end' }), t('report.objectives.column', { column: 'change' })],
              rows: data.team.map(k => ({ key: k.key, header: k.label, cells: [number(k.start), number(k.end), delta(k.end - k.start)] }))
            }}
          />
          <SeriesLegend series={teamSeries} />
        </div>
      </div>
    </section>
  );
}

/** "Overall leadership adaptability": the share of style choices that fit, as a number and a meter, with its narrative. */
export function AdaptabilitySection({ data }: { data: AdaptabilityData }) {
  const { t } = useI18n();
  const id = useId();
  return (
    <section aria-labelledby={`${id}h`} className="flex flex-col gap-3">
      <h2 id={`${id}h`} className="m-0 text-20 font-700">{t('report.adaptability.title')}</h2>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="flex flex-col gap-1.5">
          <b className="text-40 font-700">{t('report.adaptability.value', { pct: data.pct })}</b>
          <div role="img" aria-label={t('report.adaptability.aria', { pct: data.pct })} className="h-(--il-report-meter-height) w-60 overflow-hidden rounded-pill bg-track">
            <div className="h-full rounded-pill bg-accent-default" style={{ inlineSize: `${data.pct}%` }}></div>
          </div>
        </div>
        <p className="m-0 min-w-0 flex-1 basis-80 text-14 text-pretty">{data.narrative}</p>
      </div>
      <p className="m-0 text-12 text-fg-secondary text-pretty">{t('report.adaptability.note')}</p>
    </section>
  );
}
