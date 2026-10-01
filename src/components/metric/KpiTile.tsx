import type { MetricKey } from '../../engine/contract';
import { useI18n } from '../../i18n';
import { MetricTrack } from './MetricBar';

/**
 * Team KPI in the metrics strip. For 3 seconds after a change it shows the engine's delta,
 * then a trend word (spec, metrics strip). The engine supplies both; the tile only renders.
 */
export type KpiTrend = { kind: 'delta'; delta: number } | { kind: 'direction'; direction: 'up' | 'down' | 'flat' };

export interface KpiTileProps {
  metric: MetricKey;
  value: number;
  trend: KpiTrend;
}

export function KpiTile({ metric, value, trend }: KpiTileProps) {
  const { t, delta, number } = useI18n();
  const sign = trend.kind === 'delta' ? Math.sign(trend.delta) : trend.direction === 'up' ? 1 : trend.direction === 'down' ? -1 : 0;
  const trendText = trend.kind === 'delta' && trend.delta !== 0 ? delta(trend.delta)
    : sign > 0 ? t('metric.trend.rising') : sign < 0 ? t('metric.trend.easing') : t('metric.trend.steady');
  const tone = sign > 0 ? 'text-status-gain' : sign < 0 ? 'text-status-decline' : 'text-fg-secondary';
  const name = t('metric.nameLower', { metric });
  return (
    <div aria-label={t('metric.team.aria', { metric: name, value })} className="flex flex-col gap-1.5 rounded-16 border border-line-default bg-surface-card px-3.5 py-2.5 backdrop-blur-12">
      <span className="text-12 text-fg-secondary">{t('metric.team', { metric: name })}</span>
      <div className="flex items-baseline gap-2">
        <b className="text-22 font-700">{number(value)}</b>
        <span className={`text-12 font-700 ${tone}`}>{trendText}</span>
      </div>
      <MetricTrack value={value} />
    </div>
  );
}
