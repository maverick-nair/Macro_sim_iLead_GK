import { useId } from 'react';
import { useI18n } from '../../i18n';
import { useReport } from './context';
import type { SummaryExtras } from './types';
import './messages';

const LEDE = 'm-0 text-16 leading-(--il-report-lede-leading) text-pretty';
const BOX = 'flex flex-col gap-1 rounded-16 border border-line-default px-3.5 py-3';

export interface SummarySectionProps {
  /** The authored narrative for the overall level: the design's opening paragraph. */
  narrative: string | null;
  /** Engine only: overall level, strengths, priorities and the business line. */
  extras?: SummaryExtras;
}

/** The executive summary. In the design it is the opening paragraph under the name. */
export function SummarySection({ narrative, extras }: SummarySectionProps) {
  const { t } = useI18n();
  const { layout } = useReport();
  const id = useId();
  if (!extras) return <p className={LEDE}>{narrative}</p>;
  const list = (items: string[]) => (items.length
    ? <ul className="m-0 flex list-none flex-col gap-0.5 p-0 text-14">{items.map(s => <li key={s}>{s}</li>)}</ul>
    : <span className="text-14 text-fg-secondary">{t('report.summary.none')}</span>);
  return (
    <section aria-labelledby={`${id}h`} className="flex flex-col gap-4">
      <h2 id={`${id}h`} className="sr-only">{t('report.summary.title')}</h2>
      {narrative && <p className={LEDE}>{narrative}</p>}
      <div className={`grid gap-2.5 ${layout === 'phone' ? 'grid-cols-1' : 'grid-cols-3'}`}>
        <div className={BOX}>
          <span className="text-12 text-fg-secondary">{t('report.summary.level')}</span>
          {extras.level ? <b className="text-20">{extras.level}</b> : <span className="text-14">{t('report.summary.noLevel')}</span>}
        </div>
        <div className={BOX}>
          <span className="text-12 text-fg-secondary">{t('report.summary.strengths')}</span>
          {list(extras.strengths)}
        </div>
        <div className={BOX}>
          <span className="text-12 text-fg-secondary">{t('report.summary.priorities')}</span>
          {list(extras.priorities)}
        </div>
      </div>
      <p className="m-0 text-14 text-pretty">{extras.business}</p>
    </section>
  );
}
