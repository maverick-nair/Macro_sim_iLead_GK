import { useId } from 'react';
import { useI18n } from '../../i18n';
import type { AnalyticsData, MethodologyData } from './types';
import './messages';

/** "How you talked": conversation analytics. Descriptive only, never scored, and it says so. */
export function AnalyticsSection({ data }: { data: AnalyticsData }) {
  const { t, number } = useI18n();
  const id = useId();
  const stats = [
    ['conversations', number(data.conversations)],
    ['talkRatio', data.talkRatio === null ? t('report.analytics.none') : t('report.analytics.ratio', { ratio: number(data.talkRatio) })],
    ['openQuestions', number(data.openQuestions)],
    ['recognition', number(data.recognition)],
    ['spoken', number(data.spoken)]
  ] as const;
  return (
    <section aria-labelledby={`${id}h`} className="flex flex-col gap-3">
      <h2 id={`${id}h`} className="m-0 text-20 font-700">{t('report.analytics.title')}</h2>
      <p className="m-0 text-13 text-fg-secondary">{t('report.analytics.note')}</p>
      <dl className="m-0 grid gap-2.5 grid-cols-5 text-large:grid-cols-(--il-report-stats-large)">
        {stats.map(([key, value]) => (
          <div key={key} className="flex flex-col gap-1 rounded-16 border border-line-default px-3.5 py-3">
            <dt className="text-12 text-fg-secondary">{t('report.analytics.stat', { stat: key })}</dt>
            <dd className="m-0 text-20 font-700">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/** "How this report was made": authored methodology lines, the facts the engine fills in, and the review status. */
export function MethodologySection({ data }: { data: MethodologyData }) {
  const { t } = useI18n();
  const id = useId();
  return (
    <section aria-labelledby={`${id}h`} className="flex flex-col gap-2">
      <h2 id={`${id}h`} className="m-0 text-20 font-700">{t('report.method.title')}</h2>
      {data.lines.map(l => <p key={l} className="m-0 text-13 text-pretty">{l}</p>)}
      <p className="m-0 text-13 text-fg-secondary">{t('report.method.facts', { conversations: data.conversations, observations: data.observations })}</p>
      <p className="m-0 text-13 font-600">{t('report.method.reviewed', { reviewed: String(data.reviewed), count: data.reviewedCount ?? 0, total: data.conversations })}</p>
    </section>
  );
}
