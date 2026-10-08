import { useId } from 'react';
import { useI18n } from '../../i18n';
import type { StakeholderData } from './types';
import './messages';

/**
 * "Stakeholders" (D164): each stakeholder outside the team, how the relationship changed from the start of the run
 * to the end (trust and satisfaction), the key interactions with them (and requests left unanswered), and what moved
 * the relationship most. Built in the key moments' card language.
 */
export function StakeholdersSection({ stakeholders }: { stakeholders: StakeholderData[] }) {
  const { t } = useI18n();
  const id = useId();
  return (
    <section aria-labelledby={`${id}h`} className="flex flex-col gap-3">
      <h2 id={`${id}h`} className="m-0 text-20 font-700">{t('report.stakeholders.title')}</h2>
      <p className="m-0 text-14 text-fg-secondary">{t('report.stakeholders.intro')}</p>
      <div className="grid grid-cols-(--il-report-cards-columns) gap-2.5">
        {stakeholders.map(s => (
          <article key={s.key} aria-labelledby={`${id}${s.key}`} className="flex flex-col gap-2 rounded-16 border border-line-default px-3.5 py-3 text-13">
            <div className="flex flex-col gap-0.5">
              <h3 id={`${id}${s.key}`} className="m-0 text-15 font-700 text-pretty">{s.name}</h3>
              <span className="text-12 text-fg-secondary">{s.role}</span>
              <span className="text-13 font-600">{s.relationship}</span>
            </div>
            <table className="w-full border-collapse text-13">
              <caption className="sr-only">{t('report.stakeholders.tableCaption', { name: s.name })}</caption>
              <thead>
                <tr className="text-12 text-fg-secondary">
                  <th scope="col" className="py-1 text-start font-700">{t('report.stakeholders.column', { column: 'measure' })}</th>
                  <th scope="col" className="py-1 text-end font-700">{t('report.stakeholders.column', { column: 'start' })}</th>
                  <th scope="col" className="py-1 text-end font-700">{t('report.stakeholders.column', { column: 'end' })}</th>
                </tr>
              </thead>
              <tbody>
                {s.measures.map(m => (
                  <tr key={m.key} className="border-t border-line-default">
                    <th scope="row" className="py-1.5 text-start font-600">{m.name}</th>
                    <td className="py-1.5 text-end tabular-nums">{m.start}</td>
                    <td className={`py-1.5 text-end font-700 tabular-nums ${m.direction === 'up' ? 'text-status-gain' : m.direction === 'down' ? 'text-status-decline' : ''}`}>
                      {m.end}<span className="sr-only">{t('report.decisions.direction', { dir: m.direction, better: m.direction === 'flat' ? 'none' : String(m.direction === 'up') })}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <h4 className="m-0 text-13 font-700">{t('report.stakeholders.interactionsTitle')}</h4>
            {s.interactions.length === 0
              ? <p className="m-0 text-fg-secondary">{t('report.stakeholders.noInteractions', { name: s.name.split(' ')[0] })}</p>
              : (
                <ul className="m-0 flex list-none flex-col gap-2 p-0">
                  {s.interactions.map(x => (
                    <li key={x.key} className="flex flex-col gap-0.5 border-t border-line-default pt-1.5">
                      <span className="text-12 text-fg-secondary">{x.when}</span>
                      <span className="font-700 text-pretty">{x.title}</span>
                      <span>{x.how}</span>
                      {x.outcome && <span className="text-pretty">{x.outcome}</span>}
                      <span className="text-12 text-fg-secondary">{x.changes.join(t('report.listSeparator'))}</span>
                    </li>
                  ))}
                </ul>
              )}
            {s.moves.length > 0 && (
              <>
                <h4 className="m-0 text-13 font-700">{t('report.stakeholders.movesTitle')}</h4>
                <ul className="m-0 flex list-none flex-col gap-0.5 p-0">{s.moves.map((m, i) => <li key={i} className="text-pretty">{m}</li>)}</ul>
              </>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
