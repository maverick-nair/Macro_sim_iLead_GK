import { NoWrapButton } from '../../ds/Button';
import type { MetricKey } from '../../engine/contract';
import { useI18n } from '../../i18n';
import type { PeriodUnit, SubPeriodUnit } from '../action/days';
import { AppDialog, DialogTitle } from './AppDialog';

export interface ResumeRecapMessage {
  id: string;
  /** "Email from Kent", worded by the caller. */
  from: string;
  title: string;
  urgent: boolean;
  /** "Due in 1 day", "Due today", or null when it has no due. */
  due: string | null;
}

export interface ResumeRecapPromise {
  id: string;
  /** First name of the person it was made to. */
  name: string;
  text: string;
  /** "Due in 2 days", "Due today". */
  due: string;
}

export interface ResumeRecapChange {
  metric: MetricKey;
  /** At the start of this period and now, from the engine. */
  start: number;
  now: number;
  trend: 'up' | 'down' | 'flat';
}

export interface ResumeRecapProps {
  period: number;
  periodUnit: PeriodUnit;
  sub: number;
  subPeriodUnit: SubPeriodUnit;
  /** "2½ days left", worded by the caller in the storyline's unit. */
  left: string;
  /** The engine's headline for the last outcome, or null before anything has happened this run. */
  headline: string | null;
  /** Open inbox items, urgent first. */
  inbox: ResumeRecapMessage[];
  /** Open promises with their due. */
  promises: ResumeRecapPromise[];
  /** Team KPIs at the start of the period and now, or over the last period (`since: 'last'`). */
  changes: ResumeRecapChange[];
  since: 'this' | 'last';
  onBack: () => void;
  frozen?: boolean;
  returnFocus?: () => HTMLElement | null;
}

const ROW = 'flex items-center gap-2.5 rounded-12 bg-surface-raised px-3 py-2.5 text-13';
const SECTION = 'flex flex-col gap-2';
const LABEL = 'm-0 text-13 font-700';
const TREND: Record<ResumeRecapChange['trend'], string> = { up: 'text-status-gain', down: 'text-status-decline', flat: 'text-fg-secondary' };

/**
 * Welcome back, on the engine: where the run stands (period, time left), the last outcome, what is
 * waiting in the inbox (urgent first), the promises still open and how the team moved since the
 * period began. Same shell as the design's recap (frame x3), which keeps its fixture.
 */
export function ResumeRecap(p: ResumeRecapProps) {
  const { t, number } = useI18n();
  return (
    <AppDialog onDismiss={p.onBack} frozen={p.frozen} returnFocus={p.returnFocus} className="flex max-h-full w-130 flex-col gap-4.5 overflow-y-auto p-7">
      <span className="text-12 font-700 tracking-(--il-appdialog-eyebrow-tracking) text-fg-secondary uppercase">{t('settings.resume.eyebrow')}</span>
      <div className="flex flex-col gap-1">
        <DialogTitle className="m-0 text-24 font-700">{t('settings.resume.title', { period: p.periodUnit, n: p.period, sub: p.subPeriodUnit, subN: p.sub })}</DialogTitle>
        <span className="text-13 text-fg-secondary">{p.left}</span>
      </div>
      {p.headline && (
        <section className={SECTION}>
          <h3 className={LABEL}>{t('settings.resume.last')}</h3>
          <p className={`${ROW} m-0`}>{p.headline}</p>
        </section>
      )}
      <section className={SECTION}>
        <h3 className={LABEL}>{t('settings.resume.inbox', { count: p.inbox.length })}</h3>
        {p.inbox.length > 0 && (
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
            {p.inbox.map(m => (
              <li key={m.id} className={ROW}>
                <span className="flex min-w-0 flex-1 flex-col">
                  <b className="font-700">{m.title}</b>
                  <span className="text-12 text-fg-secondary">{m.from}</span>
                </span>
                <span className="flex flex-none flex-col items-end text-12">
                  {m.urgent && <b className="text-status-attention">{t('settings.resume.urgent')}</b>}
                  {m.due && <span className="text-fg-secondary">{m.due}</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
      {p.promises.length > 0 && (
        <section className={SECTION}>
          <h3 className={LABEL}>{t('settings.resume.promises', { count: p.promises.length })}</h3>
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
            {p.promises.map(x => (
              <li key={x.id} className={ROW}>
                <span className="min-w-0 flex-1">{t('settings.resume.promise', { name: x.name, text: x.text })}</span>
                <span className="flex-none text-12 text-fg-secondary">{x.due}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {p.changes.length > 0 && (
        <section className={SECTION}>
          <h3 className={LABEL}>{t('settings.resume.since', { unit: p.periodUnit, which: p.since })}</h3>
          <dl className="m-0 grid grid-cols-2 gap-1.5">
            {p.changes.map(c => (
              <div key={c.metric} className={`${ROW} justify-between`}>
                <dt>{t('settings.resume.metric', { metric: c.metric })}</dt>
                <dd className={`m-0 font-700 ${TREND[c.trend]}`}>{t('settings.resume.move', { start: number(c.start), now: number(c.now) })}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
      <div className="flex justify-end">
        <NoWrapButton variant="primary" size="md" onClick={p.onBack}>{t('settings.resume.back')}</NoWrapButton>
      </div>
    </AppDialog>
  );
}
