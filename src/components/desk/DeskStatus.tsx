import { useI18n } from '../../i18n';
import { useMoney } from '../../i18n/money';
import { mark, rich } from '../stylesetting/rich';

export interface DeskStatusProps {
  /** Money earned so far and the run's target, in the storyline's money. */
  value: number;
  target: number;
  /** The Leadership Score now. */
  score: number;
  /** What the score gained this period, shown after it when it moved ("+33"). */
  delta?: number | null;
}

/**
 * Where the run stands, at the end of the navy header on the screens that are not the desk (style setting, the week's
 * end), as the approved canvas shows it (D227): the revenue against the target and the score, numbers in Geist Mono.
 */
export function DeskStatus({ value, target, score, delta }: DeskStatusProps) {
  const { t, number, delta: signed } = useI18n();
  const money = useMoney();
  const n = (s: string, k: string) => <b key={k} className="font-mono font-500 text-fg-primary">{s}</b>;
  return (
    <span role="group" aria-label={t('desk.status.aria')} className="flex items-center gap-5.5 text-13 whitespace-nowrap text-fg-secondary">
      <span>{rich(t('desk.status.revenue', { value: mark(0), target: money.compact(target) }), [n(money.compact(value), 'v')])}</span>
      <span>
        {rich(t('desk.status.score', { score: mark(0) }), [n(number(score), 's')])}
        {delta ? <span className="ms-1 font-mono text-accent-secondary">{signed(delta)}</span> : null}
      </span>
    </span>
  );
}
