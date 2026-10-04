import type { MetricKey } from '../../engine/contract';
import { useI18n } from '../../i18n';

/** Values under this are "low": amber bar, amber number, and ", low" for screen readers. */
export const LOW_BELOW = 30;

export interface MetricTrackProps {
  value: number;
  low?: boolean;
}

/** The shared 0 to 100 scale. Width animates to new engine values (instant under reduced motion). */
export function MetricTrack({ value, low = false }: MetricTrackProps) {
  return (
    <div className="h-1.25 rounded-3 bg-track">
      <div
        className={`h-full rounded-3 [transition:var(--il-metric-bar-transition)] ${low ? 'bg-status-attention' : 'bg-(image:--il-metric-bar-fill)'}`}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

export interface MetricBarProps {
  metric: MetricKey;
  value: number;
}

/** One metric row on a member card: label, bar on the shared scale, value. Read as one image ("skill 62", ", low" under 30). */
export function MetricBar({ metric, value }: MetricBarProps) {
  const { t, number } = useI18n();
  const low = value < LOW_BELOW;
  return (
    <div role="img" aria-label={t('metric.bar.aria', { metric: t('metric.nameLower', { metric }), value, low: String(low) })} className="grid grid-cols-(--il-metric-bar-columns) items-center gap-1.5 text-12">
      <span className="text-fg-secondary">{t('metric.name', { metric })}</span>
      <MetricTrack value={value} low={low} />
      <b className={`text-right font-700 ${low ? 'text-status-attention' : ''}`}>{number(value)}</b>
    </div>
  );
}
