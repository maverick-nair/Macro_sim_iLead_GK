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
    <div role="alert" className="mx-8 mt-3 flex animate-(--il-event-call-enter) items-center gap-3.5 border-2 border-accent-default bg-surface-card py-2.5 pe-3 ps-2.5 tablet:mx-5 tablet-portrait:mx-6">
      <div className="relative size-11">
        <div className="absolute -inset-1 animate-(--il-event-call-ring) rounded-round border-2 border-accent-default" />
        <div className="flex size-11 items-center justify-center overflow-hidden rounded-round bg-(image:--il-fill-brand) font-600 text-button-on-solid">
          {img ? <img src={img} alt="" className="size-full object-cover object-top mix-blend-multiply" /> : initials}
        </div>
      </div>
      <div className="flex flex-col"><b className="text-15 font-600">{t('events.call.title', { name })}</b><span className="text-13 text-fg-body">{line}</span></div>
      <span className="flex-1" />
      <NoWrapButton variant="secondary" size="md" onClick={onLater}>{laterLabel}</NoWrapButton>
      <NoWrapButton variant="primary" size="md" onClick={onAnswer}>{t('events.call.answer')}</NoWrapButton>
    </div>
  );
}
