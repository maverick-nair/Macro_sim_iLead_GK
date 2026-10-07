import { useId, useState } from 'react';
import type { EngineView } from '../../engine/contract';
import { useI18n } from '../../i18n';
import { historyOptions, historyWeeks, type HistoryEntry, type HistoryFilter } from './history';
import { PANEL_FOCUS, PanelShell } from './PanelShell';

export interface HistoryPanelProps {
  view: Pick<EngineView, 'history' | 'members' | 'actions' | 'clock' | 'sponsor'>;
  /** Names for people who have left the team, by id (the view only lists who is here now). */
  nameOf: (id: string) => string | null;
  /** Opens filtered: one person (from an outcome's View history), one kind of entry, or both. */
  initial?: Partial<HistoryFilter>;
  onClose: () => void;
  returnFocus?: () => HTMLElement | null | undefined;
}

const SELECT = `min-h-9 rounded-10 border border-line-control bg-surface-card px-2.5 text-13 text-fg-primary ${PANEL_FOCUS}`;

/**
 * The team wide History (D95): every week, newest first, with each entry's people and what changed for
 * each of them (skill, morale, result and trust) and why, as the engine logged it. Filter by person and by
 * action. Opened from the menu, and from an outcome's View history. The current week starts open.
 */
export function HistoryPanel({ view, nameOf, initial, onClose, returnFocus }: HistoryPanelProps) {
  const { t } = useI18n();
  const [filter, setFilter] = useState<HistoryFilter>({ person: initial?.person ?? null, what: initial?.what ?? null });
  const personId = useId(), whatId = useId();
  const options = historyOptions(view, nameOf);
  const weeks = historyWeeks(view, filter, nameOf);
  const actionName = (k: string) => view.actions.find(a => a.key === k)?.name;
  const whatLabel = (k: string) => actionName(k) ?? t('panels.history.what', { what: k });
  const toolbar = (
    <div className="flex flex-wrap items-end gap-3">
      <label htmlFor={personId} className="flex flex-col gap-1 text-12 text-fg-secondary">
        {t('panels.history.person')}
        <select id={personId} value={filter.person ?? ''} onChange={e => setFilter(f => ({ ...f, person: e.target.value || null }))} className={SELECT}>
          <option value="">{t('panels.history.everyone')}</option>
          {options.people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </label>
      <label htmlFor={whatId} className="flex flex-col gap-1 text-12 text-fg-secondary">
        {t('panels.history.action')}
        <select id={whatId} value={filter.what ?? ''} onChange={e => setFilter(f => ({ ...f, what: e.target.value || null }))} className={SELECT}>
          <option value="">{t('panels.history.everything')}</option>
          {options.what.map(k => <option key={k} value={k}>{whatLabel(k)}</option>)}
        </select>
      </label>
      {(filter.person || filter.what) && (
        <button type="button" onClick={() => setFilter({ person: null, what: null })} className={`min-h-9 cursor-pointer rounded-pill border-0 bg-transparent px-2 text-13 font-700 text-accent-secondary ${PANEL_FOCUS}`}>
          {t('panels.history.clear')}
        </button>
      )}
    </div>
  );
  return (
    <PanelShell title={t('panels.history.title')} intro={t('panels.history.intro', { unit: view.clock.periodUnit })} toolbar={toolbar} onClose={onClose} returnFocus={returnFocus}>
      <p role="status" className="sr-only">{t('panels.history.count', { n: weeks.reduce((s, w) => s + w.entries.length, 0) })}</p>
      {weeks.length === 0 && <p className="m-0 text-14 text-fg-secondary">{filter.person || filter.what ? t('panels.history.noneFiltered') : t('panels.history.none')}</p>}
      {weeks.map((w, i) => (
        <details key={w.period} open={i === 0} className="group flex flex-col rounded-16 border border-line-default bg-surface-card">
          <summary className={`flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-16 px-4 text-15 font-700 ${PANEL_FOCUS}`}>
            <span>{t('time.period', { unit: view.clock.periodUnit, n: w.period })}</span>
            <span className="text-12 font-600 text-fg-secondary">{t('panels.history.entries', { n: w.entries.length })}</span>
          </summary>
          <ol className="m-0 flex list-none flex-col gap-0 border-t border-line-default p-0">
            {w.entries.map(e => <Entry key={e.id} entry={e} view={view} />)}
          </ol>
        </details>
      ))}
    </PanelShell>
  );
}

function Entry({ entry: e, view }: { entry: HistoryEntry; view: HistoryPanelProps['view'] }) {
  const { t, delta, locale } = useI18n();
  const list = (xs: string[]) => new Intl.ListFormat(locale, { type: 'unit', style: 'short' }).format(xs);
  return (
    <li className="flex flex-col gap-1.5 border-b border-line-default px-4 py-3 last:border-b-0">
      <span className="text-12 text-fg-secondary">{t('profile.timeline.when', { period: t('time.period', { unit: view.clock.periodUnit, n: e.when.period }), sub: t('time.subPeriod', { unit: view.clock.subPeriodUnit, n: e.when.sub }) })}</span>
      <b className="text-14">{e.title}</b>
      {e.quote && <span className="rounded-10 bg-surface-raised px-2.5 py-2 text-13">{t('common.quote', { text: e.quote })}</span>}
      {e.people.length > 0 && (
        <ul className="m-0 flex list-none flex-col gap-1 p-0">
          {e.people.map(p => (
            <li key={p.id} className="flex flex-col text-13">
              <span className="flex flex-wrap gap-x-2">
                <b>{p.name}</b>
                {p.changes.length
                  ? <span className="font-600">{list(p.changes.map(c => t('profile.timeline.change', { metric: t('metric.name', { metric: c.metric }), delta: delta(c.delta) })))}</span>
                  : <span className="text-fg-secondary">{t('profile.timeline.noChange')}</span>}
              </span>
              {p.reasons.length > 0 && <span className="text-12 text-fg-secondary">{p.reasons.join(' ')}</span>}
            </li>
          ))}
        </ul>
      )}
      {e.sponsor !== null && <span className="text-12 text-fg-secondary">{t('panels.history.sponsor', { name: view.sponsor.name.split(' ')[0], delta: delta(e.sponsor) })}</span>}
    </li>
  );
}
