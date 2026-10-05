import { useId, useState } from 'react';
import { NoWrapButton } from '../../ds/Button';
import { useI18n } from '../../i18n';
import { StarRow } from '../gamification/StarMeter';
import { barPercent, funnelNumber, funnelRow, levelSteps } from './display';
import type { FunnelView, PeriodUnit, WeekEndReport as Report } from './types';

const CARD = 'flex flex-col rounded-24 border border-line-default bg-surface-card p-5 backdrop-blur-14';
const SMALL_BOX = 'flex flex-col rounded-24 border p-4.5';
const SMALL_CARD = `${SMALL_BOX} border-line-default bg-surface-card`;
const H2 = 'm-0 text-20 font-700';
const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-secondary';
/** Arrow glyphs beside a change. Decorative: the words say up or down. */
const UP = '▲';
const DOWN = '▼';

const FLAME = 'M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z';

export interface WeekEndReportProps {
  /** `phone`: one column at 390. */
  layout?: 'desktop' | 'phone';
  report: Report;
  period: number;
  periodUnit: PeriodUnit;
  /** The run is over: the bottleneck is "the last week", not "going into week 9". */
  last: boolean;
  subPeriodUnit: string;
  continueLabel: string;
  onContinue: () => void;
}

/**
 * The weekly report: funnel against ideal, the team's KPIs from start to end, the stars and what made
 * the score, the streak, sponsor confidence and Team Pulse. Every value comes from the engine (or the
 * design fixture); the only state here is which funnel view shows.
 */
export function WeekEndReport({ report: r, period, periodUnit: unit, last, subPeriodUnit, continueLabel, onContinue, layout = 'desktop' }: WeekEndReportProps) {
  const { t, number, delta } = useI18n();
  const [view, setView] = useState<FunnelView>('period');
  const id = useId();
  const hasTotal = r.funnel.stages.some(s => s.total) && period > 1;
  const shown: FunnelView = hasTotal ? view : 'period';
  const scale = shown === 'total' ? r.funnel.totalScale ?? r.funnel.scale : r.funnel.scale;
  const bottleneck = r.funnel.stages.find(s => s.key === r.funnel.bottleneck);
  const sponsorMove = levelSteps(r.sponsor.from, r.sponsor.to);
  const level = (l: string) => t('weekend.sponsor.level', { level: l });
  const change = t('weekend.sponsor.change', { steps: sponsorMove.steps, dir: sponsorMove.dir });
  const pulse = r.pulse;
  const moods = [['upbeat', pulse.upbeat], ['steady', pulse.steady], ['struggling', pulse.struggling]] as const;
  const legend = <span className="text-12 text-fg-secondary">{t('weekend.funnel.legend', { view: shown, unit })}</span>;
  const pulseTitle = pulse.value
    ? t('weekend.pulse.titleValue', { value: pulse.value.to, n: Math.abs(pulse.value.to - pulse.value.from), dir: pulse.value.to > pulse.value.from ? 'up' : pulse.value.to < pulse.value.from ? 'down' : 'same' })
    : t('weekend.pulse.title');

  return (
    <div className={`grid flex-1 animate-(--il-weekend-enter) ${layout === 'phone' ? 'grid-cols-1' : 'grid-cols-(--il-weekend-report-columns)'} gap-5`}>
      <div className="flex flex-col gap-5">
        <section aria-labelledby={`${id}funnel`} className={`${CARD} gap-3`}>
          <div className="flex justify-between">
            <h2 id={`${id}funnel`} className={H2}>{t('weekend.funnel.title', { view: shown, unit })}</h2>
            {hasTotal ? (
              <div className="flex items-center gap-3">
                {legend}
                <div role="group" aria-label={t('weekend.funnel.viewAria')} className="flex gap-0.5 rounded-pill border border-line-default bg-surface-raised p-0.5">
                  {(['period', 'total'] as const).map(k => (
                    <button key={k} type="button" aria-pressed={shown === k} onClick={() => setView(k)}
                      className={`cursor-pointer rounded-pill border-0 px-2.5 py-0.5 text-12 font-600 ${FOCUS} ${shown === k ? 'bg-accent-soft text-fg-primary' : 'bg-transparent text-fg-secondary'}`}>
                      {t('weekend.funnel.view', { view: k, unit })}
                    </button>
                  ))}
                </div>
              </div>
            ) : legend}
          </div>
          {r.funnel.stages.map(s => {
            const { value, ideal } = funnelRow(s, shown);
            const isBottleneck = s.key === r.funnel.bottleneck;
            const v = number(funnelNumber(value)), i = number(funnelNumber(ideal));
            return (
              <div key={s.key} className="grid grid-cols-(--il-weekend-funnel-columns) items-center gap-3 text-13">
                <span>{s.name}</span>
                <div role="img" aria-label={t('weekend.funnel.bar', { stage: s.name, value: v, ideal: i, bottleneck: String(isBottleneck) })} className="relative h-3 rounded-6 bg-track">
                  <div className={`h-full rounded-6 ${isBottleneck ? 'bg-status-attention' : 'bg-(image:--il-fill-meter)'}`} style={{ width: `${barPercent(value, scale)}%` }}></div>
                  <div className="absolute -top-1 -bottom-1 w-(--il-weekend-funnel-tick) bg-fg-primary" style={{ left: `${barPercent(ideal, scale)}%` }}></div>
                </div>
                <b aria-hidden="true" className="text-right">{t('weekend.funnel.value', { value: v, ideal: i })}</b>
              </div>
            );
          })}
          {bottleneck && (
            <span className="text-13 font-600 text-status-attention">
              {t('weekend.funnel.bottleneck', { stage: bottleneck.name, last: String(last), unit, next: period + 1 })}
            </span>
          )}
        </section>

        <section aria-labelledby={`${id}team`} className={`${CARD} gap-2.5`}>
          <h2 id={`${id}team`} className={H2}>{t('weekend.team.title', { unit })}</h2>
          <div role="table" aria-labelledby={`${id}team`} className="flex flex-col gap-2.5">
            <div role="row" className="grid grid-cols-(--il-weekend-kpi-columns) gap-2 text-12 font-700 text-fg-secondary">
              <span role="columnheader"><span className="sr-only">{t('weekend.team.column', { column: 'metric' })}</span></span>
              <span role="columnheader" className="text-right">{t('weekend.team.column', { column: 'start' })}</span>
              <span role="columnheader" className="text-right">{t('weekend.team.column', { column: 'change' })}</span>
              <span role="columnheader" className="text-right">{t('weekend.team.column', { column: 'end' })}</span>
            </div>
            {r.kpis.map(k => {
              const d = k.end - k.start;
              return (
                <div key={k.metric} role="row" className="grid grid-cols-(--il-weekend-kpi-columns) gap-2 border-t border-line-default py-2 text-14">
                  <span role="rowheader">{t('weekend.team.metric', { metric: k.metric })}</span>
                  <span role="cell" className="text-right">{number(k.start)}</span>
                  <b role="cell" className={`text-right ${d > 0 ? 'text-status-gain' : 'text-fg-secondary'}`}>{delta(d)}</b>
                  <b role="cell" className="text-right">{number(k.end)}</b>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <div className="flex flex-col gap-5">
        <section aria-labelledby={`${id}stars`} className={`${CARD} gap-3`}>
          <h2 id={`${id}stars`} className={H2}>{t('weekend.stars.title')}</h2>
          {r.stars.map((s, i) => <StarRow key={s.kind ?? i} kind={s.kind} title={s.title} earned={s.earned} detail={s.detail} />)}
          {r.scoreParts && r.scoreParts.length > 0 && (
            <ul aria-label={t('weekend.stars.partsAria')} className="m-0 flex list-none flex-col gap-1 border-t border-line-default p-0 pt-3 text-12 text-fg-secondary">
              {r.scoreParts.map(p => <li key={p}>{p}</li>)}
            </ul>
          )}
        </section>
        <div className="grid grid-cols-2 gap-3.5">
          <div className={`${SMALL_CARD} gap-1.5`}>
            <span className="text-12 text-fg-secondary">{t('weekend.streak.title')}</span>
            <b className="flex items-center gap-1.5 text-26">
              <svg className="size-5.5 fill-hud-streak" viewBox="0 0 24 24" aria-hidden="true"><path d={FLAME}></path></svg>
              {t('weekend.streak.count', { unit: r.streak.unit, n: r.streak.count })}
            </b>
            <span className="text-12 text-fg-secondary">{r.streak.note}</span>
          </div>
          <div className={`${SMALL_CARD} gap-1.5`}>
            <span className="text-12 text-fg-secondary">{t('weekend.sponsor.title')}</span>
            <b className="text-22">{sponsorMove.dir === 'same' ? level(r.sponsor.to) : t('weekend.sponsor.levels', { from: level(r.sponsor.from), to: level(r.sponsor.to) })}</b>
            <span className={`text-12 font-700 ${sponsorMove.dir === 'up' ? 'text-status-gain' : sponsorMove.dir === 'down' ? 'text-status-decline' : 'text-fg-secondary'}`}>
              {sponsorMove.dir !== 'same' && <span aria-hidden="true">{sponsorMove.dir === 'up' ? UP : DOWN}</span>}
              {sponsorMove.dir !== 'same' && ' '}
              {r.sponsor.values ? t('weekend.sponsor.values', { change, from: number(r.sponsor.values.from), to: number(r.sponsor.values.to) }) : change}
            </span>
          </div>
          <div className={`col-span-full ${SMALL_CARD} gap-2`}>
            <span className="text-12 text-fg-secondary">{pulseTitle}</span>
            <div role="img" aria-label={t('weekend.pulse.aria', { upbeat: pulse.upbeat, steady: pulse.steady, struggling: pulse.struggling })} className="flex h-3 gap-0.5 overflow-hidden rounded-6">
              <div className="bg-metrics-pulse-upbeat" style={{ flex: pulse.upbeat }}></div>
              <div className="bg-metrics-pulse-steady" style={{ flex: pulse.steady }}></div>
              <div className="bg-metrics-pulse-struggling" style={{ flex: pulse.struggling }}></div>
            </div>
            <span className="text-13">
              {moods.map(([mood, n], i) => (
                <span key={mood} className="contents">
                  {i > 0 && t('weekend.pulse.separator')}
                  <b>{number(n)}</b>
                  {` ${t('weekend.pulse.mood', { mood })}`}
                </span>
              ))}
              {pulse.lastStruggling !== undefined && t('weekend.pulse.lastWeek', { n: pulse.lastStruggling, dir: pulse.lastStruggling > pulse.struggling ? 'up' : 'down', unit })}
            </span>
          </div>
        </div>
        {r.checkIn && (
          <div role="note" className={`${SMALL_BOX} gap-1 border-status-attention bg-status-attention-soft`}>
            <b className="text-14">{t('weekend.checkIn.title')}</b>
            <span className="text-13">{t('weekend.checkIn.body', { name: r.checkIn.sponsorName, line: r.checkIn.line, sub: subPeriodUnit, unit, n: period + 1 })}</span>
          </div>
        )}
        <div className="flex justify-end">
          <NoWrapButton variant="primary" size="lg" onClick={onContinue}>{continueLabel}</NoWrapButton>
        </div>
      </div>
    </div>
  );
}
