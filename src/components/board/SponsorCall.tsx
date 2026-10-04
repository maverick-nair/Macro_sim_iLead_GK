import { NoWrapButton } from '../../ds/Button';
import { useI18n } from '../../i18n';

export interface SponsorCallProps {
  /** Who is calling: "Priya Nair". */
  name: string;
  /** Shown on the brand fill when there is no portrait: "PN". */
  initials: string;
  img?: string | null;
  /** Their role and what the call is about: "Regional Sales Director. About the Ashcroft discount." */
  line: string;
  /** "Call back within 1 day", or "Later" when the call is due now. */
  laterLabel: string;
  onAnswer: () => void;
  onLater: () => void;
}

/**
 * The incoming sponsor call over the board (frame b13): the caller in a pulsing ring, who is
 * calling and why, Later and Take the call. It is an alert, so screen readers hear it as it rings;
 * it does not take focus, and the board stays usable around it.
 */
export function SponsorCall({ name, initials, img, line, laterLabel, onAnswer, onLater }: SponsorCallProps) {
  const { t } = useI18n();
  return (
    <div role="alert" className="mx-6 mt-0 mb-3 flex animate-(--il-event-call-enter) items-center gap-3.5 rounded-18 border border-accent-default bg-surface-material py-2.5 pr-3 pl-2.5 shadow-(--il-event-call-shadow)">
      <div className="relative size-11">
        <div className="absolute -inset-1 animate-(--il-event-call-ring) rounded-round border-2 border-accent-default" />
        <div className="flex size-11 items-center justify-center overflow-hidden rounded-round bg-(image:--il-fill-brand) font-700 text-brand-deep-space">
          {img ? <img src={img} alt="" className="size-full object-cover object-top mix-blend-multiply" /> : initials}
        </div>
      </div>
      <div className="flex flex-col"><b>{t('events.call.title', { name })}</b><span className="text-12 text-fg-secondary">{line}</span></div>
      <span className="flex-1" />
      <NoWrapButton variant="secondary" size="sm" onClick={onLater}>{laterLabel}</NoWrapButton>
      <NoWrapButton variant="primary" size="sm" onClick={onAnswer}>{t('events.call.answer')}</NoWrapButton>
    </div>
  );
}
