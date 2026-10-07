import { useState } from 'react';
import type { EngineView } from '../../engine/contract';
import { useI18n } from '../../i18n';
import { useMoney } from '../../i18n/money';
import { averageRow, resultColumns, resultRows, share, stageWeeks, teamMetrics, type ResultColumn } from './overview';
import { PanelHeading, PanelShell } from './PanelShell';

export type OverviewTab = 'results' | 'stages';

export interface OverviewPanelProps {
  view: EngineView;
  tab?: OverviewTab;
  onClose: () => void;
  returnFocus?: () => HTMLElement | null | undefined;
}

const CELL = 'px-2.5 py-1.5 text-end tabular-nums';
const HEAD = 'px-2.5 py-1.5 text-12 font-600 text-fg-secondary';

/**
 * The result overview and the stage (module) overview during play (D96), as 1.0's two buttons on the
 * board: results against the targets with each person's result week by week and the team average, and
 * the funnel by stage this week and so far, week by week. Real tables, so they read without the bars.
 */
export function OverviewPanel({ view, tab: initial = 'results', onClose, returnFocus }: OverviewPanelProps) {
  const { t, number, delta } = useI18n();
  const money = useMoney();
  const [tab, setTab] = useState<OverviewTab>(initial);
  const { clock } = view;
  const cols = resultColumns(clock, view.phase);
  const rows = resultRows(view, cols.length);
  const avg = averageRow(rows, cols.length);
  const colLabel = (c: ResultColumn) => (c.kind === 'start' ? t('panels.overview.start') : c.kind === 'now' ? t('panels.overview.now') : t('panels.overview.end', { period: t('time.period', { unit: clock.periodUnit, n: c.period }) }));
  const pace = view.money.target * clock.runShare;
  const stages = stageWeeks(view);
  const tabs = [{ key: 'results' as const, label: t('panels.overview.tab', { tab: 'results' }) }, { key: 'stages' as const, label: t('panels.overview.tab', { tab: 'stages' }) }];
  return (
    <PanelShell wide title={t('panels.overview.title')} intro={t('panels.overview.intro', { unit: clock.periodUnit })} tabs={tabs} tab={tab} onTab={setTab} onClose={onClose} returnFocus={returnFocus}>
      {tab === 'results' && (
        <>
          <section aria-labelledby="overview-targets" className="flex flex-col gap-2">
            <PanelHeading id="overview-targets">{t('panels.overview.targets')}</PanelHeading>
            <div className="flex flex-col gap-1.5 rounded-16 border border-line-default bg-surface-card p-4">
              <span className="text-14">{t('panels.overview.money', { value: money.format(view.money.value), target: money.format(view.money.target) })}</span>
              <div role="img" aria-label={t('panels.overview.moneyAria', { pct: Math.round(share(view.money.value, view.money.target) * 100), pace: Math.round(clock.runShare * 100) })} className="relative h-2.5 overflow-hidden rounded-5 bg-track">
                <div className="h-full rounded-5 bg-(image:--il-fill-brand)" style={{ width: `${share(view.money.value, view.money.target) * 100}%` }} />
                <div aria-hidden="true" className="absolute top-0 h-full w-0.5 bg-fg-primary" style={{ insetInlineStart: `${clock.runShare * 100}%` }} />
              </div>
              <span className="text-12 text-fg-secondary">{t('panels.overview.pace', { pace: money.format(pace), unit: clock.periodUnit, n: clock.period })}</span>
            </div>
            <table className="w-full border-collapse text-13">
              <caption className="sr-only">{t('panels.overview.metricsCaption')}</caption>
              <thead><tr className="border-b border-line-default">
                <th scope="col" className={`${HEAD} text-start`}>{t('panels.overview.metric')}</th>
                <th scope="col" className={`${HEAD} text-end`}>{t('panels.overview.runStart')}</th>
                <th scope="col" className={`${HEAD} text-end`}>{t('panels.overview.periodStart', { unit: clock.periodUnit })}</th>
                <th scope="col" className={`${HEAD} text-end`}>{t('panels.overview.now')}</th>
              </tr></thead>
              <tbody>
                {teamMetrics(view).map(m => (
                  <tr key={m.metric} className="border-b border-line-default">
                    <th scope="row" className="px-2.5 py-1.5 text-start font-600">{t('panels.overview.teamMetric', { metric: t('metric.nameLower', { metric: m.metric }) })}</th>
                    <td className={CELL}>{number(m.runStart)}</td>
                    <td className={CELL}>{number(m.periodStart)}</td>
                    <td className={`${CELL} font-700`}>{number(m.now)}{m.now !== m.runStart && <span className="ms-1.5 text-12 font-600 text-fg-secondary">{t('panels.overview.since', { delta: delta(m.now - m.runStart) })}</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          <section aria-labelledby="overview-people" className="flex flex-col gap-2">
            <PanelHeading id="overview-people">{t('panels.overview.people')}</PanelHeading>
            {/* The table scrolls sideways inside the panel late in a long run; it takes focus so the keyboard can scroll it. */}
            <div role="region" aria-labelledby="overview-people" tabIndex={0} className="overflow-x-auto rounded-12 focus-visible:outline-2 focus-visible:outline-accent-secondary">
              <table className="w-full border-collapse text-13">
                <caption className="sr-only">{t('panels.overview.peopleCaption', { unit: clock.periodUnit })}</caption>
                <thead><tr className="border-b border-line-default">
                  <th scope="col" className={`${HEAD} text-start`}>{t('panels.overview.person')}</th>
                  {cols.map((c, i) => <th key={i} scope="col" className={`${HEAD} text-end whitespace-nowrap`}>{colLabel(c)}</th>)}
                </tr></thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.id} className="border-b border-line-default">
                      <th scope="row" className="px-2.5 py-1.5 text-start font-600 whitespace-nowrap">{r.name}</th>
                      {r.values
                        ? r.values.map((v, i) => <td key={i} className={CELL}>{v === null ? t('panels.overview.notYet') : number(v)}</td>)
                        : <td colSpan={cols.length} className="px-2.5 py-1.5 text-end text-12 text-fg-secondary">{t('member.stats.hidden')}</td>}
                    </tr>
                  ))}
                </tbody>
                <tfoot><tr>
                  <th scope="row" className="px-2.5 py-1.5 text-start font-700">{t('panels.overview.average')}</th>
                  {avg.map((v, i) => <td key={i} className={`${CELL} font-700`}>{v === null ? t('panels.overview.notYet') : number(v)}</td>)}
                </tr></tfoot>
              </table>
            </div>
          </section>
        </>
      )}
      {tab === 'stages' && (
        <>
          <section aria-labelledby="overview-week" className="flex flex-col gap-2.5">
            <PanelHeading id="overview-week">{t('panels.overview.thisWeek', { unit: clock.periodUnit })}</PanelHeading>
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {view.funnel.map(f => (
                <li key={f.key} className="grid grid-cols-(--il-panel-funnel-columns) items-center gap-3 text-13">
                  <b className="truncate text-large:whitespace-normal">{f.name}</b>
                  <div role="img" aria-label={t('panels.overview.stageAria', { stage: f.name, output: number(f.throughput), ideal: number(f.idealThroughput) })} className="h-2.5 overflow-hidden rounded-5 bg-track">
                    <div className={`h-full rounded-5 ${f.bottleneck ? 'bg-status-attention' : 'bg-(image:--il-fill-brand)'}`} style={{ width: `${share(f.throughput, f.idealThroughput) * 100}%` }} />
                  </div>
                  <span className="text-end text-fg-secondary tabular-nums">{t('panels.overview.of', { output: number(f.throughput), ideal: number(f.idealThroughput) })}</span>
                </li>
              ))}
            </ul>
          </section>
          <section aria-labelledby="overview-stages" className="flex flex-col gap-2">
            <PanelHeading id="overview-stages">{t('panels.overview.byWeek', { unit: clock.periodUnit })}</PanelHeading>
            <div role="region" aria-labelledby="overview-stages" tabIndex={0} className="overflow-x-auto rounded-12 focus-visible:outline-2 focus-visible:outline-accent-secondary">
              <table className="w-full border-collapse text-13">
                <caption className="sr-only">{t('panels.overview.stagesCaption', { unit: clock.periodUnit })}</caption>
                <thead><tr className="border-b border-line-default">
                  <th scope="col" className={`${HEAD} text-start`}>{t('panels.overview.periodCol', { unit: clock.periodUnit })}</th>
                  {view.funnel.map(f => <th key={f.key} scope="col" className={`${HEAD} text-end`}>{f.name}</th>)}
                </tr></thead>
                <tbody>
                  {stages.weeks.map(w => (
                    <tr key={w.period} className="border-b border-line-default">
                      <th scope="row" className="px-2.5 py-1.5 text-start font-600 whitespace-nowrap">{w.current ? t('panels.overview.soFarThis', { unit: clock.periodUnit, n: w.period }) : t('time.period', { unit: clock.periodUnit, n: w.period })}</th>
                      {w.cells.map((c, i) => <td key={i} className={CELL}>{t('panels.overview.of', { output: number(c.output), ideal: number(c.ideal) })}</td>)}
                    </tr>
                  ))}
                </tbody>
                <tfoot><tr>
                  <th scope="row" className="px-2.5 py-1.5 text-start font-700">{t('panels.overview.soFar')}</th>
                  {stages.total.map((c, i) => <td key={i} className={`${CELL} font-700`}>{t('panels.overview.of', { output: number(c.output), ideal: number(c.ideal) })}</td>)}
                </tr></tfoot>
              </table>
            </div>
            <p className="m-0 text-12 text-fg-secondary">{t('panels.overview.stagesNote', { unit: clock.periodUnit })}</p>
          </section>
        </>
      )}
    </PanelShell>
  );
}
