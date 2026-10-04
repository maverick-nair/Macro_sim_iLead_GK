import type { StyleKey } from '../../data/types';
import { useI18n } from '../../i18n';
import { mark, rich } from './rich';
import type { PeriodUnit } from './types';

export interface LastPeriodTagProps {
  periodUnit: PeriodUnit;
  /** Last period's style, or null in the first period. */
  style: StyleKey | null;
  reaction: 'pos' | 'neg' | null;
}

/**
 * The small tag on a style setting card: last period's style and whether the member reacted well
 * (green, up arrow) or badly (red, down arrow). Neutral when there was no style last period.
 */
export function LastPeriodTag({ periodUnit, style, reaction }: LastPeriodTagProps) {
  const { t } = useI18n();
  const box = 'flex h-5.5 items-center gap-1.25 self-start rounded-pill px-2 text-12 font-600';
  const neutral = `${box} bg-surface-raised text-fg-secondary`;
  if (style === null) return <span className={neutral}>{t('stylesetting.last.none', { unit: periodUnit })}</span>;
  const text = rich(t('stylesetting.last.tag', { unit: periodUnit, style: mark(0) }), [<span key="s">{t('style.name', { style })}</span>]);
  if (reaction === null) return <span className={neutral}>{text}</span>;
  const pos = reaction === 'pos';
  return (
    <span className={`${box} ${pos ? 'bg-status-gain-soft' : 'bg-status-decline-soft'}`}>
      <span aria-hidden="true" className={pos ? 'text-status-gain' : 'text-status-decline'}>{t('stylesetting.reaction.arrow', { reaction })}</span>
      {text}
      <span className="sr-only">{t('stylesetting.reaction.aside', { reaction })}</span>
    </span>
  );
}
