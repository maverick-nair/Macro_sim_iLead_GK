import { useId } from 'react';
import { useI18n } from '../../i18n';
import type { BusinessVariableData, DecisionData } from './types';
import './messages';

/**
 * "Decisions and consequences" (D137): the business variables from the start of the run to the end, then each
 * choice the participant made (or left to its default): the option, what happened, what it changed, the later
 * events it led to and the leadership it showed. Built in the key moments' card language.
 */
export function DecisionsSection({ decisions, variables }: { decisions: DecisionData[]; variables: BusinessVariableData[] }) {
  const { t } = useI18n();
  const id = useId();
  return (
    <section aria-labelledby={`${id}h`} className="flex flex-col gap-3">
      <h2 id={`${id}h`} className="m-0 text-20 font-700">{t('report.decisions.title')}</h2>
      {variables.length > 0 && (
        <table className="w-full border-collapse text-13">
          <caption className="mb-1.5 text-start text-14 font-700">{t('report.decisions.variablesTitle')}</caption>
          <thead>
            <tr className="text-12 text-fg-secondary">
              <th scope="col" className="py-1 text-start font-700">{t('report.decisions.column', { column: 'name' })}</th>
              <th scope="col" className="py-1 text-end font-700">{t('report.decisions.column', { column: 'start' })}</th>
              <th scope="col" className="py-1 text-end font-700">{t('report.decisions.column', { column: 'end' })}</th>
            </tr>
          </thead>
          <tbody>
            {variables.map(v => (
              <tr key={v.key} className="border-t border-line-default">
                <th scope="row" className="py-1.5 text-start font-600">{v.name}</th>
                <td className="py-1.5 text-end tabular-nums">{v.start}</td>
                <td className={`py-1.5 text-end font-700 tabular-nums ${v.better === null ? '' : v.better ? 'text-status-gain' : 'text-status-decline'}`}>
                  {v.end}<span className="sr-only">{t('report.decisions.direction', { dir: v.direction, better: String(v.better) })}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {decisions.length === 0 && <p className="m-0 text-14 text-fg-secondary">{t('report.decisions.none')}</p>}
      <div className="grid grid-cols-(--il-report-cards-columns) gap-2.5">
        {decisions.map(d => (
          <article key={d.key} aria-labelledby={`${id}${d.key}`} className="flex flex-col gap-2 rounded-16 border border-line-default px-3.5 py-3 text-13">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className={`rounded-pill border px-2 py-0.5 text-12 font-700 ${d.by === 'you' ? 'border-line-strong text-fg-primary' : 'border-status-attention text-status-attention'}`}>
                {t('report.decisions.by', { by: d.by })}
              </span>
              <span className="text-12 text-fg-secondary">{d.when}</span>
            </div>
            <h3 id={`${id}${d.key}`} className="m-0 text-15 font-700 text-pretty">{d.title}</h3>
            <dl className="m-0 flex flex-col gap-1.5">
              <div><dt className="text-12 font-700 text-fg-secondary">{t('report.decisions.term', { term: 'option' })}</dt><dd className="m-0 text-pretty">{d.option ?? t('report.decisions.nothing')}</dd></div>
              {d.outcome && <div><dt className="text-12 font-700 text-fg-secondary">{t('report.decisions.term', { term: 'outcome' })}</dt><dd className="m-0 text-pretty">{d.outcome}</dd></div>}
              {d.changes.length > 0 && <div><dt className="text-12 font-700 text-fg-secondary">{t('report.decisions.term', { term: 'changed' })}</dt><dd className="m-0"><ul className="m-0 flex list-none flex-col gap-0.5 p-0">{d.changes.map((c, i) => <li key={i}>{c}</li>)}</ul></dd></div>}
              {d.led.length > 0 && <div><dt className="text-12 font-700 text-fg-secondary">{t('report.decisions.term', { term: 'led' })}</dt><dd className="m-0"><ul className="m-0 flex list-none flex-col gap-0.5 p-0">{d.led.map((c, i) => <li key={i}>{c}</li>)}</ul></dd></div>}
              {d.read.length > 0 && <div><dt className="text-12 font-700 text-fg-secondary">{t('report.decisions.term', { term: 'read' })}</dt><dd className="m-0"><ul className="m-0 flex list-none flex-col gap-0.5 p-0">{d.read.map((c, i) => <li key={i}>{c}</li>)}</ul></dd></div>}
            </dl>
          </article>
        ))}
      </div>
    </section>
  );
}
