import type { MetricKey } from '../../engine/contract';
import { useI18n } from '../../i18n';

export interface ReasonChipProps {
  /** First name of the person the change belongs to. */
  name: string;
  metric: MetricKey;
  delta: number;
  /** Words ("Kent morale up") by default; exact numbers ("Kent Morale +8") once tapped. */
  showNumbers: boolean;
  onToggle: () => void;
  size?: 'sm' | 'md';
}

/**
 * A metric change on the outcome panel. Small by design: the spec replaces large delta overlays
 * with these chips, exact numbers on tap. The arrow is decorative and left out of the accessible
 * name, which says the direction in words ("Kent morale up", "Kent Morale +8, up").
 */
export function ReasonChip({ name, metric, delta, showNumbers, onToggle, size = 'sm' }: ReasonChipProps) {
  const { t, delta: fmt } = useI18n();
  const up = delta > 0;
  const text = showNumbers
    ? t('reason.chip.numbers', { name, metric: t('metric.name', { metric }), delta: fmt(delta) })
    : t('reason.chip.words', { name, metric: t('metric.nameLower', { metric }), direction: up ? 'up' : 'down' });
  const sizing = size === 'md' ? 'h-7.5 px-3 text-13' : 'h-6.5 px-2.5 text-12 cursor-pointer';
  // Buttons carry UA padding and font; the chip sets every box property itself.
  return (
    <button
      type="button"
      aria-pressed={showNumbers}
      onClick={onToggle}
      className={`${sizing} py-0 whitespace-nowrap rounded-pill border border-line-default font-700 text-fg-primary ${up ? 'bg-status-gain-soft' : 'bg-status-decline-soft'}`}
    >
      <span aria-hidden="true" className={up ? 'text-status-gain' : 'text-status-decline'}>{up ? '▲' : '▼'}</span> {text}
      {showNumbers && <span className="sr-only">{t('reason.chip.direction', { direction: up ? 'up' : 'down' })}</span>}
    </button>
  );
}
