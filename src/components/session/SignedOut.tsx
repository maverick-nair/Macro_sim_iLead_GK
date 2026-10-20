import { useEffect, useRef } from 'react';
import { NoWrapButton } from '../../ds/Button';
import { useI18n } from '../../i18n';
import { useMoney } from '../../i18n/money';

export interface SignedOutProps {
  /** When the participant signed out (epoch ms). */
  at: number;
  /** Where the run stands: "Week 1", "Day 3", "3 days left". */
  where: { period: string; sub: string; left: string };
  score: { total: number; tier: string | null };
  money: { label: string; value: number; target: number };
  live: { used: number; cap: number };
  /** Back to the board. */
  onBack: () => void;
}

/**
 * Signed out (D213, the approved canvas): shown when the participant signs out of a launch with no return
 * address. The run was saved first; this says where it stands and offers the way back. Its heading takes
 * focus, so the change is read out.
 */
export function SignedOut({ at, where, score, money: m, live, onBack }: SignedOutProps) {
  const { t, number } = useI18n();
  const money = useMoney();
  const h1 = useRef<HTMLHeadingElement>(null);
  useEffect(() => { h1.current?.focus({ preventScroll: true }); }, []);
  const fact = (label: string, value: string, rest: string | null) => (
    <div className="flex flex-col gap-1">
      <dt className="text-13 text-fg-secondary">{label}</dt>
      <dd className="m-0 text-15 text-fg-secondary"><b className="text-24 font-600 text-fg-primary tabular-nums">{value}</b>{rest && <> {rest}</>}</dd>
    </div>
  );
  return (
    <section data-signed-out="" className="flex flex-1 flex-col justify-end gap-6 px-12 py-14 tablet:px-8">
      <div className="flex max-w-195 flex-col gap-6">
        <span className="text-13 font-600 uppercase tracking-(--il-desk-band-eyebrow-tracking) text-fg-secondary">{t('signedOut.eyebrow', { at })}</span>
        <h1 ref={h1} tabIndex={-1} className="m-0 text-48 leading-tight font-600 tracking-(--il-tracking-title) outline-0">{t('signedOut.title')}</h1>
        <p className="m-0 text-18 text-fg-secondary">{t('signedOut.body', where)}</p>
        <dl className="m-0 grid grid-cols-3 gap-4.5 border-t border-line-strong pt-4.5 text-large:grid-cols-1">
          {fact(t('signedOut.score'), number(score.total), score.tier)}
          {fact(t('signedOut.money', { label: m.label }), money.format(m.value), t('signedOut.moneyOf', { target: money.format(m.target) }))}
          {fact(t('signedOut.live'), number(live.used), t('signedOut.liveOf', { cap: number(live.cap) }))}
        </dl>
        <div className="flex flex-wrap items-center gap-3.5">
          <NoWrapButton variant="primary" size="lg" onClick={onBack}>{t('signedOut.back')}</NoWrapButton>
        </div>
        <p className="m-0 text-14 text-fg-secondary">{t('signedOut.privacy')}</p>
      </div>
    </section>
  );
}
