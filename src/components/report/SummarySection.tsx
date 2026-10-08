import { useId } from 'react';
import { useI18n } from '../../i18n';
import { usePurpose } from './context';
import { TONE_TEXT } from './display';
import type { SummaryExtras, VerdictData } from './types';
import './messages';

const LEDE = 'm-0 text-16 leading-(--il-report-lede-leading) text-pretty';
const BOX = 'flex flex-col gap-1 rounded-16 border border-line-default px-3.5 py-3';

export interface SummarySectionProps {
  /** The authored narrative for the overall level: the design's opening paragraph. */
  narrative: string | null;
  /** Engine only: overall level, strengths, priorities and the business line; in assessment, the verdict. */
  extras?: SummaryExtras;
}

/** The overall verdict (assessment, D75): the label first, the bar, what it rests on and who reviewed it. */
export function VerdictCard({ verdict }: { verdict: VerdictData }) {
  const { t } = useI18n();
  return (
    <div className="flex flex-col gap-2 rounded-16 border-2 border-line-control px-4 py-3.5">
      <span className="text-12 text-fg-secondary">{t('report.verdict.title')}</span>
      <b className={`text-24 font-700 ${TONE_TEXT[verdict.tone]}`}>{verdict.label}</b>
      <span className="text-14 text-pretty">{verdict.bar}</span>
      <span className="text-13 text-fg-secondary">{verdict.evidence}{t('report.separator')}{verdict.review}</span>
      {verdict.quotes.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-12 font-700 text-fg-secondary">{t('report.verdict.quotes')}</span>
          {verdict.quotes.map(q => (
            <span key={q.text} className="text-13 text-fg-secondary text-pretty">{t('report.quote', { text: q.text })}{' '}<span className="whitespace-nowrap">{q.when}</span></span>
          ))}
        </div>
      )}
      <span className="text-12 text-fg-secondary break-words">{verdict.records}</span>
    </div>
  );
}

/** "What drove your results" (D145): the decisions and patterns that moved the outcomes most, each with its numbers. */
function Drivers({ drivers }: { drivers: NonNullable<SummaryExtras['drivers']> }) {
  const { t } = useI18n();
  const purpose = usePurpose();
  const id = useId();
  return (
    <div className="flex flex-col gap-2">
      <h3 id={`${id}d`} className="m-0 text-16 font-700">{t('report.drivers.title', { purpose })}</h3>
      <p className="m-0 text-13 text-fg-secondary">{t('report.drivers.intro', { purpose })}</p>
      <ul aria-labelledby={`${id}d`} className="m-0 flex list-none flex-col gap-1.5 p-0 text-14">
        {drivers.map(d => (
          <li key={d.key} className="text-pretty">
            <b className={TONE_TEXT[d.tone === 'positive' ? 'gain' : 'attention']}>{t('report.drivers.tone', { tone: d.tone })}</b>{t('report.separator')}{d.text}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The executive summary. In the design it is the opening paragraph under the name. Assessment reports lead with the verdict. */
export function SummarySection({ narrative, extras }: SummarySectionProps) {
  const { t } = useI18n();
  const purpose = usePurpose();
  const id = useId();
  if (!extras) return <p className={LEDE}>{narrative}</p>;
  const list = (items: string[]) => (items.length
    ? <ul className="m-0 flex list-none flex-col gap-0.5 p-0 text-14">{items.map(s => <li key={s}>{s}</li>)}</ul>
    : <span className="text-14 text-fg-secondary">{t('report.summary.none')}</span>);
  return (
    <section aria-labelledby={`${id}h`} className="flex flex-col gap-4">
      <h2 id={`${id}h`} className="sr-only">{t('report.summary.title')}</h2>
      {extras.verdict && <VerdictCard verdict={extras.verdict} />}
      {extras.headline && <p className="m-0 text-20 font-700 text-pretty">{extras.headline}</p>}
      {narrative && <p className={LEDE}>{narrative}</p>}
      {extras.lines && extras.lines.length > 0 && <p className={LEDE}>{extras.lines.join(' ')}</p>}
      <div className="grid gap-2.5 grid-cols-3 text-large:grid-cols-(--il-report-tiles-columns)">
        <div className={BOX}>
          <span className="text-12 text-fg-secondary">{t('report.summary.level')}</span>
          {extras.level ? <b className="text-20">{extras.level}</b> : <span className="text-14">{t('report.summary.noLevel')}</span>}
        </div>
        <div className={BOX}>
          <span className="text-12 text-fg-secondary">{t('report.summary.strengths', { purpose })}</span>
          {list(extras.strengths)}
        </div>
        <div className={BOX}>
          <span className="text-12 text-fg-secondary">{t('report.summary.priorities', { purpose })}</span>
          {list(extras.priorities)}
        </div>
      </div>
      <p className="m-0 text-14 text-pretty">{extras.business}</p>
      {extras.drivers && extras.drivers.length > 0 && <Drivers drivers={extras.drivers} />}
    </section>
  );
}
