import { useId } from 'react';
import { useI18n } from '../../i18n';
import { usePurpose } from './context';
import { TONE_TEXT } from './display';
import type { SummaryExtras, VerdictData } from './types';
import './messages';

const LEDE = 'm-0 text-16 leading-(--il-report-lede-leading) text-pretty';
const BOX = 'flex flex-col gap-1 border border-line-default px-3.5 py-3';

export interface SummarySectionProps {
  /** The authored narrative for the overall level: the design's opening paragraph. */
  narrative: string | null;
  /** Engine only: overall level, strengths, priorities and the business line; in assessment, the verdict. */
  extras?: SummaryExtras;
  /**
   * The first page (D235) shows the verdict, the headline and the overall level; what held them down is its
   * first finding. The full report's `rest` holds everything else. `all` (the default) is the whole summary.
   */
  part?: 'all' | 'first' | 'rest';
}

/** The overall verdict (assessment, D75): the label first, the bar, what it rests on and who reviewed it. */
export function VerdictCard({ verdict, why = true }: { verdict: VerdictData; why?: boolean }) {
  const { t } = useI18n();
  return (
    <div className="flex flex-col gap-2 border-2 border-line-control px-4 py-3.5">
      <span className="text-12 text-fg-secondary">{t('report.verdict.title')}</span>
      <b className={`text-24 font-600 ${TONE_TEXT[verdict.tone]}`}>{verdict.label}</b>
      {why && verdict.why && <span className="text-14 text-pretty">{verdict.why}</span>}
      <span className="text-14 text-pretty">{verdict.bar}</span>
      <span className="text-13 text-fg-secondary">{verdict.evidence}{t('report.separator')}{verdict.review}</span>
      {verdict.quotes.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-12 font-600 text-fg-secondary">{t('report.verdict.quotes')}</span>
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
      <h3 id={`${id}d`} className="m-0 text-16 font-600">{t('report.drivers.title', { purpose })}</h3>
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
export function SummarySection({ narrative, extras, part = 'all' }: SummarySectionProps) {
  const { t } = useI18n();
  const purpose = usePurpose();
  const id = useId();
  if (!extras) return <p className={LEDE}>{narrative}</p>;
  const first = part !== 'rest', rest = part !== 'first';
  const level = (why: boolean) => (
    <div className={BOX}>
      <span className="text-12 text-fg-secondary">{t('report.summary.level')}</span>
      {extras.level ? <b className="text-20">{extras.level}</b> : <span className="text-14">{t('report.summary.noLevel')}</span>}
      {why && extras.levelWhy && <span className="text-13 text-fg-secondary text-pretty">{extras.levelWhy}</span>}
    </div>
  );
  // A tile with nothing in it is left out (D235): the skills it would name had too little evidence.
  const tile = (label: string, items: string[]) => items.length > 0 && (
    <div className={BOX}>
      <span className="text-12 text-fg-secondary">{label}</span>
      <ul className="m-0 flex list-none flex-col gap-0.5 p-0 text-14">{items.map(s => <li key={s}>{s}</li>)}</ul>
    </div>
  );
  return (
    <section aria-labelledby={`${id}h`} className="flex flex-col gap-4">
      <h2 id={`${id}h`} className={part === 'rest' ? 'm-0 font-display text-36 leading-tight font-400' : 'sr-only'}>{t(part === 'rest' ? 'report.summary.rest' : 'report.summary.title')}</h2>
      {first && extras.verdict && <VerdictCard verdict={extras.verdict} why={part === 'all'} />}
      {first && extras.headline && <p className="m-0 font-display text-36 leading-tight font-400 text-pretty">{extras.headline}</p>}
      {part === 'first' && <div className="grid gap-2.5 grid-cols-3 text-large:grid-cols-(--il-report-tiles-columns)">{level(false)}</div>}
      {rest && narrative && <p className={LEDE}>{narrative}</p>}
      {rest && extras.lines && extras.lines.length > 0 && <p className={LEDE}>{extras.lines.join(' ')}</p>}
      {rest && (
        <div className="grid gap-2.5 grid-cols-3 text-large:grid-cols-(--il-report-tiles-columns)">
          {level(true)}
          {tile(t('report.summary.strengths', { purpose }), extras.strengths)}
          {tile(t('report.summary.priorities', { purpose }), extras.priorities)}
        </div>
      )}
      {rest && <p className="m-0 text-14 text-pretty">{extras.business}</p>}
      {rest && extras.drivers && extras.drivers.length > 0 && <Drivers drivers={extras.drivers} />}
    </section>
  );
}
