import { useI18n } from '../../i18n';
import { WithClientLogo } from '../../theme/brand';
import { usePurpose } from './context';
import type { ReportHeaderData } from './types';
import './messages';
import { ILeadLogo } from '../shell/Logo';

const BOX = 'flex flex-col border border-line-default bg-surface-page px-4 py-3';

/** The client's logo (D72) and the wordmark, "Development report", the participant's name (the page's h1), the run line, tier and score. */
export function ReportHeader({ name, line, tier, score }: ReportHeaderData) {
  const { t } = useI18n();
  const purpose = usePurpose();
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex flex-col gap-1.5">
        <WithClientLogo className="self-start">
          <ILeadLogo size="md" className="self-start" />
        </WithClientLogo>
        <span className="text-13 font-600 tracking-(--il-tracking-eyebrow-wide) text-fg-body uppercase">{t('report.eyebrow', { purpose })}</span>
        <h1 tabIndex={-1} className="m-0 font-display text-58 leading-(--il-report-title-leading) font-400 outline-0">{name}</h1>
        <span className="text-15 text-fg-body">{line}</span>
      </div>
      <div className="flex gap-2.5">
        {tier && (
          <div className={BOX}>
            <span className="text-13 text-fg-body">{t('report.tier')}</span>
            <b className="font-serif text-26 font-400">{tier}</b>
          </div>
        )}
        <div className={BOX}>
          <span className="text-13 text-fg-body">{t('report.score')}</span>
          <b className="font-mono text-26 font-500">{score}</b>
        </div>
      </div>
    </header>
  );
}
