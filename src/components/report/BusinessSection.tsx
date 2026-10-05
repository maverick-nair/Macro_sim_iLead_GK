import { useId } from 'react';
import { useI18n } from '../../i18n';
import { ChartBlock } from './ChartBlock';
import { FunnelChart, RevenueChart } from './charts';
import { useReport } from './context';
import type { BusinessData, PeriodUnit } from './types';
import './messages';

/** "Business results": revenue against target pace, the funnel over the run against its ideal, the bottleneck and conversions. */
export function BusinessSection({ data, unit, periods }: { data: BusinessData; unit: PeriodUnit; periods: number }) {
  const { t, number } = useI18n();
  const { layout } = useReport();
  const id = useId();
  const last = data.revenue.at(-1);
  const bottleneck = data.funnel.find(f => f.bottleneck);
  return (
    <section aria-labelledby={`${id}h`} className="flex flex-col gap-3">
      <h2 id={`${id}h`} className="m-0 text-20 font-700">{t('report.business.title')}</h2>
      <p className="m-0 text-14 text-pretty">{data.line}</p>
      <div className={`grid gap-5 ${layout === 'phone' ? 'grid-cols-1' : 'grid-cols-2'}`}>
        <ChartBlock
          title={t('report.business.revenueTitle')}
          chart={<RevenueChart points={data.revenue} money={data.money}
            label={t('report.business.revenueAria', { value: data.money(last?.value ?? 0), pace: data.money(last?.pace ?? 0), unit, n: data.revenue.length })} />}
          table={{
            columns: [t('report.business.column', { column: 'period' }), t('report.business.column', { column: 'revenue' }), t('report.business.column', { column: 'pace' })],
            rows: data.revenue.map(r => ({ key: r.label, header: r.label, cells: [data.money(r.value), data.money(r.pace)] }))
          }}
        />
        <ChartBlock
          title={t('report.business.funnelTitle')}
          chart={<FunnelChart stages={data.funnel} label={t('report.business.funnelAria', {
            list: data.funnel.map(f => t('report.business.funnelItem', { stage: f.name, value: number(Math.round(f.value)), ideal: number(Math.round(f.ideal)) })).join(t('report.listSeparator')),
            bottleneck: bottleneck?.name ?? ''
          })} />}
          table={{
            columns: [t('report.business.column', { column: 'stage' }), t('report.business.column', { column: 'actual' }), t('report.business.column', { column: 'ideal' })],
            rows: data.funnel.map(f => ({ key: f.key, header: f.bottleneck ? t('report.business.bottleneckRow', { stage: f.name }) : f.name, cells: [number(Math.round(f.value)), number(Math.round(f.ideal))] }))
          }}
        />
      </div>
      {data.bottleneck && (
        <p className="m-0 text-13 text-pretty">
          <b className="text-status-attention">{t('report.business.bottleneck', { stage: data.bottleneck.name, n: data.bottleneck.periods, total: periods, unit })}</b>
          {data.bottleneck.why && ` ${data.bottleneck.why}`}
        </p>
      )}
      <p className="m-0 text-13 text-fg-secondary">{t('report.business.conversions', { n: data.conversions })}</p>
    </section>
  );
}
