import { Button } from '../../ds/Button';
import { useI18n } from '../../i18n';

export interface PracticeOfferProps {
  /** First name of the team member the practice is with. */
  name: string;
  busy?: boolean;
  onStart: () => void;
  onSkip: () => void;
}

/**
 * The Week 0 practice offer (spec, onboarding step 7; D16, D84), above week 1's style setting: a short
 * conversation in the live shell that is never scored. Built from the board's existing card, type and
 * buttons; no design of its own yet (D80 brings the canvas).
 */
export function PracticeOffer({ name, busy, onStart, onSkip }: PracticeOfferProps) {
  const { t } = useI18n();
  return (
    <section aria-labelledby="practice-offer-title" className="mx-6 mt-4 flex flex-none flex-wrap items-center gap-4 rounded-20 border border-line-strong bg-surface-raised p-5 short:mt-2 short:gap-3 short:px-4 short:py-2.5">
      <div className="flex min-w-0 flex-1 basis-80 flex-col gap-1">
        <h2 id="practice-offer-title" className="m-0 text-16 font-700">{t('board.practice.title')}</h2>
        <p className="m-0 text-14 text-fg-secondary">{t('board.practice.body', { name })}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" size="md" disabled={busy} onClick={onSkip}>{t('board.practice.skip')}</Button>
        <Button variant="primary" size="md" disabled={busy} onClick={onStart}>{t('board.practice.start', { name })}</Button>
      </div>
    </section>
  );
}
