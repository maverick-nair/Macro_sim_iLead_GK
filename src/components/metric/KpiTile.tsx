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

/**
 * A group named in words ("Team skill 62, rising"; "Team morale 54, down 3" while a delta shows).
 * The trend glyph is decorative and hidden from screen readers.
 */
export function KpiTile({ metric, value, trend }: KpiTileProps) {
  const { t, delta, number } = useI18n();
  const sign = trend.kind === 'delta' ? Math.sign(trend.delta) : trend.direction === 'up' ? 1 : trend.direction === 'down' ? -1 : 0;
  const dir = sign > 0 ? 'up' : sign < 0 ? 'down' : 'flat';
  const showDelta = trend.kind === 'delta' && trend.delta !== 0;
  const word = t('metric.trend.word', { dir });
  const trendText = showDelta ? delta(trend.delta) : <><span aria-hidden="true">{t('metric.trend.glyph', { dir })}</span>{' '}{word}</>;
  const trendWords = showDelta ? t('metric.trend.delta', { dir, n: number(Math.abs(trend.delta)) }) : word;
  const tone = sign > 0 ? 'text-status-gain' : sign < 0 ? 'text-status-decline' : 'text-fg-secondary';
  const name = t('metric.nameLower', { metric });
  return (
    <div role="group" aria-label={t('metric.team.aria', { metric: name, value: number(value), trend: trendWords })} className="flex flex-col gap-1.5 rounded-16 border border-line-default bg-surface-card px-3.5 py-2.5 backdrop-blur-12 short:gap-1 short:py-1.5">
      <span className="text-12 text-fg-secondary">{t('metric.team', { metric: name })}</span>
      <div className="flex items-baseline gap-2">
        <b className="text-22 font-700 short:text-18">{number(value)}</b>
        <span className={`text-12 font-700 ${tone}`}>{trendText}</span>
      </div>
      <MetricTrack value={value} />
    </div>
  );
}
