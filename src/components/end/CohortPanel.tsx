import { useId } from 'react';
import { useI18n } from '../../i18n';
import type { Cohort, CohortRow } from './cohort';
import './messages';

export interface CohortPanelProps extends Cohort {
  /** Who is ranked: the cohort, the business unit or every participant (Configuration Spec, Leaderboard). */
  scope: 'cohort' | 'unit' | 'global';
  /** How many the top shows. */
  size: number;
}

const CELL = 'px-3 py-2';

/**
 * The cohort leaderboard on the end screen: the top N by Leadership Score with rank, name (or "A
 * colleague" when anonymous), score and tier, this participant's row marked You and highlighted, and
 * their own row after a gap when outside the top. Ranks are the server's. A real table with headers.
 */
export function CohortPanel({ scope, size, top, outside, you }: CohortPanelProps) {
  const { t, number } = useI18n();
  const id = useId();
  const row = (r: CohortRow, key: string) => (
    <tr key={key} aria-current={r.you || undefined}
      className={`border-t border-line-default ${r.you ? 'bg-accent-soft font-700 text-fg-primary' : ''}`}>
      <td className={`${CELL} text-right`}>{number(r.rank)}</td>
      <th scope="row" className={`${CELL} text-left ${r.you ? 'font-700' : 'font-400'}`}>
        <span className="flex flex-wrap items-center gap-2">
          {r.name !== null && <span>{r.name}</span>}
          {r.you && <span className="rounded-pill border border-accent-secondary px-2 text-12 text-fg-primary">{t('end.cohort.you')}</span>}
        </span>
      </th>
      <td className={`${CELL} text-right`}>{number(r.score)}</td>
      <td className={CELL}>{r.tier}</td>
    </tr>
  );
  return (
    <section aria-labelledby={id} className="relative flex max-w-180 flex-col gap-3 rounded-20 border border-line-default bg-surface-card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id={id} className="m-0 text-16 font-700">{t('end.cohort.title', { scope })}</h2>
        {you && <span className="text-13 font-600 text-fg-secondary">{t('end.cohort.rank', { rank: you.rank, total: you.total })}</span>}
      </div>
      <table className="w-full border-collapse text-13">
        <caption className="sr-only">{t('end.cohort.caption', { scope, size, outside: String(!!outside) })}</caption>
        <thead>
          <tr className="text-12 text-fg-secondary">
            <th scope="col" className={`${CELL} text-right font-600`}>{t('end.cohort.col.rank')}</th>
            <th scope="col" className={`${CELL} text-left font-600`}>{t('end.cohort.col.name')}</th>
            <th scope="col" className={`${CELL} text-right font-600`}>{t('end.cohort.col.score')}</th>
            <th scope="col" className={`${CELL} text-left font-600`}>{t('end.cohort.col.tier')}</th>
          </tr>
        </thead>
        <tbody>{top.map((r, i) => row(r, String(i)))}</tbody>
        {outside && <tbody className="border-t-2 border-line-strong">{row(outside, 'you')}</tbody>}
      </table>
    </section>
  );
}
