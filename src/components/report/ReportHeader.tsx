import { useI18n } from '../../i18n';
import { useReport } from './context';
import type { ReportHeaderData } from './types';

const BOX = 'flex flex-col rounded-18 border border-line-default px-4 py-3';

/** Wordmark, "Development report", the participant's name (the page's h1), the run line, tier and score. */
export function ReportHeader({ name, line, tier, score }: ReportHeaderData) {
  const { t } = useI18n();
  const { layout } = useReport();
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex flex-col gap-1.5">
        <span className="self-start bg-(image:--il-fill-brand) bg-clip-text text-20 font-700 tracking-(--il-report-logo-tracking) text-transparent">{t('hud.logo')}</span>
        <span className="text-12 font-700 tracking-(--il-tracking-eyebrow-wide) text-fg-secondary uppercase">{t('report.eyebrow')}</span>
        <h1 tabIndex={-1} className={`m-0 font-700 outline-0 leading-(--il-report-title-leading) tracking-(--il-report-title-tracking) ${layout === 'phone' ? 'text-34' : 'text-48'}`}>{name}</h1>
        <span className="text-14 text-fg-secondary">{line}</span>
      </div>
      <div className="flex gap-2.5">
        {tier && (
          <div className={BOX}>
            <span className="text-12 text-fg-secondary">{t('report.tier')}</span>
            <b className="text-24">{tier}</b>
          </div>
        )}
        <div className={BOX}>
          <span className="text-12 text-fg-secondary">{t('report.score')}</span>
          <b className="text-24">{score}</b>
        </div>
      </div>
    </header>
  );
}
