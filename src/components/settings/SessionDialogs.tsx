import { NoWrapButton } from '../../ds/Button';
import type { MetricKey } from '../../engine/contract';
import { useI18n } from '../../i18n';
import type { PeriodUnit, SubPeriodUnit } from '../action/days';
import { AppDialog, DialogDescription, DialogTitle } from './AppDialog';

interface Common {
  frozen?: boolean;
  returnFocus?: () => HTMLElement | null;
}

export interface PauseDialogProps extends Common {
  onResume: () => void;
}

/** Paused: the clock has stopped. Resume, Escape or a click on the scrim carries on. */
export function PauseDialog({ onResume, frozen, returnFocus }: PauseDialogProps) {
  const { t } = useI18n();
  return (
    <AppDialog onDismiss={onResume} frozen={frozen} returnFocus={returnFocus} described className="flex w-110 flex-col items-center gap-4 p-8 text-center">
      <div aria-hidden="true" className="flex size-16 items-center justify-center gap-1.5 rounded-round bg-(image:--il-fill-brand)">
        <span className="h-5.5 w-1.5 rounded-2 bg-brand-deep-space" />
        <span className="h-5.5 w-1.5 rounded-2 bg-brand-deep-space" />
      </div>
      <DialogTitle className="m-0 text-24 font-700">{t('settings.paused.title')}</DialogTitle>
      <DialogDescription className="m-0 text-pretty text-fg-secondary">{t('settings.paused.body')}</DialogDescription>
      <NoWrapButton variant="primary" size="lg" onClick={onResume}>{t('settings.paused.resume')}</NoWrapButton>
    </AppDialog>
  );
}

export interface ExitDialogProps extends Common {
  onStay: () => void;
  onExit: () => void;
}

/**
 * Exit (D89): the run is saved on every step, so leaving loses nothing. Stay, Escape or a click on the scrim
 * carries on; Exit goes back to the learning platform's address from the launch.
 */
export function ExitDialog({ onStay, onExit, frozen, returnFocus }: ExitDialogProps) {
  const { t } = useI18n();
  return (
    <AppDialog onDismiss={onStay} frozen={frozen} returnFocus={returnFocus} described className="flex w-110 flex-col gap-4 p-7">
      <DialogTitle className="m-0 text-24 font-700">{t('settings.exit.title')}</DialogTitle>
      <DialogDescription className="m-0 text-pretty text-fg-secondary">{t('settings.exit.body')}</DialogDescription>
      <div className="flex flex-wrap justify-end gap-2.5">
        <NoWrapButton variant="secondary" size="md" onClick={onStay}>{t('settings.exit.stay')}</NoWrapButton>
        <NoWrapButton variant="primary" size="md" onClick={onExit}>{t('settings.exit.leave')}</NoWrapButton>
      </div>
    </AppDialog>
  );
}

export interface RecapItem {
  img: string;
  /** What happened, from the engine: "1:1 with Beth went well". */
  title: string;
  metric: MetricKey;
  delta: number;
}

export interface ResumeDialogProps extends Common {
  period: number;
  periodUnit: PeriodUnit;
  sub: number;
  subPeriodUnit: SubPeriodUnit;
  /** The last outcomes, newest first. */
  recent: RecapItem[];
  /** First names of the people with open messages. */
  waiting: string[];
  onBack: () => void;
}

/** Welcome back: where you are, the last outcomes and who is waiting on you. */
export function ResumeDialog({ period, periodUnit, sub, subPeriodUnit, recent, waiting, onBack, frozen, returnFocus }: ResumeDialogProps) {
  const { t, delta, locale } = useI18n();
  return (
    <AppDialog onDismiss={onBack} frozen={frozen} returnFocus={returnFocus} className="flex w-130 flex-col gap-4.5 p-7">
      <span className="text-12 font-700 tracking-(--il-appdialog-eyebrow-tracking) text-fg-secondary uppercase">{t('settings.resume.eyebrow')}</span>
      <DialogTitle className="m-0 text-24 font-700">{t('settings.resume.title', { period: periodUnit, n: period, sub: subPeriodUnit, subN: sub })}</DialogTitle>
      <div className="flex flex-col gap-2">
        <span className="text-13 font-700">{t('settings.resume.recent', { count: recent.length })}</span>
        {recent.map(r => (
          <div key={r.title} className="flex items-center gap-2.5 rounded-12 bg-surface-raised px-3 py-2.5">
            <img src={r.img} alt="" className="size-8 rounded-round bg-brand-pale-lavender object-cover object-top" />
            <span className="flex-1 text-13">{r.title}</span>
            <span className={`text-12 font-700 ${r.delta < 0 ? 'text-status-decline' : 'text-status-gain'}`}>{t('settings.resume.change', { metric: t('metric.name', { metric: r.metric }), delta: delta(r.delta) })}</span>
          </div>
        ))}
      </div>
      {waiting.length > 0 && (
        <span className="text-13 text-fg-secondary">{t('settings.resume.waiting', { count: waiting.length, names: new Intl.ListFormat(locale, { type: 'conjunction' }).format(waiting) })}</span>
      )}
      <div className="flex justify-end">
        <NoWrapButton variant="primary" size="md" onClick={onBack}>{t('settings.resume.back')}</NoWrapButton>
      </div>
    </AppDialog>
  );
}

export interface SessionExpiredDialogProps extends Common {
  onSignIn: () => void;
}

/** The session timed out: an alert dialog that only signing in again closes. */
export function SessionExpiredDialog({ onSignIn, frozen, returnFocus }: SessionExpiredDialogProps) {
  const { t } = useI18n();
  return (
    <AppDialog onDismiss={null} role="alertdialog" frozen={frozen} returnFocus={returnFocus} described className="flex w-110 flex-col items-center gap-3.5 p-8 text-center">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true" className="text-accent-secondary">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
      <DialogTitle className="m-0 text-22 font-700">{t('settings.expired.title')}</DialogTitle>
      <DialogDescription className="m-0 text-pretty text-fg-secondary">{t('settings.expired.body')}</DialogDescription>
      <NoWrapButton variant="primary" size="md" onClick={onSignIn}>{t('settings.expired.signIn')}</NoWrapButton>
    </AppDialog>
  );
}
