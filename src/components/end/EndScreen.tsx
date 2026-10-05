import { useEffect, useRef } from 'react';
import { NoWrapButton } from '../../ds/Button';
import { useI18n } from '../../i18n';
import { useMoney } from '../../i18n/money';
import { BadgeShelf } from '../gamification/Badge';
import { around, sharePercent, TONE_TEXT, tierBarHeight, tierBars, toneOf } from './display';
import { EndMoments } from './EndMoments';
import { EndReflection } from './EndReflection';
import type { EndScreenProps } from './types';

const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-secondary';
const TILE = 'flex flex-col rounded-20 border border-line-default bg-surface-card p-4';
/** Stands in for the tier's name in the headline, so the name can carry the spectrum fill. */
const MARK = '\u0001';

/**
 * The end of the simulation (frame e1): the tier reached and the Leadership Score, the results, up to
 * four key moments, the badges, and the reflection with the way to the report. Everything arrives as
 * props: the design gallery passes the design fixture, the playable app the engine's report
 * (`board/EngineEnd.tsx`). Holds no state of its own beyond which moments are open.
 */
export function EndScreen(p: EndScreenProps) {
  const { t, number, delta } = useI18n();
  const money = useMoney();
  const h1 = useRef<HTMLHeadingElement>(null);
  const focusOnOpen = !!p.focusOnOpen;
  useEffect(() => {
    if (focusOnOpen) h1.current?.focus({ preventScroll: true });
  }, [focusOnOpen]);

  const unit = p.periodUnit;
  const r = p.results;
  const bars = tierBars(p.tiers, p.tier);
  const tierName = p.tiers.find(x => x.key === p.tier)?.name ?? p.tier;
  const [before, after] = around(t('end.title', { tier: MARK }), MARK);
  const kpis = r.kpis.map(k => {
    const end = Math.round(k.end), change = end - Math.round(k.start);
    return { key: k.metric, label: t('metric.team', { metric: t('metric.nameLower', { metric: k.metric }) }), value: number(end), note: delta(change), tone: toneOf(change) };
  });
  const tiles = [{ key: 'conversions', label: t('end.results.conversions'), value: number(r.conversions), note: r.conversionsNote, tone: r.conversionsTone }, ...kpis];

  return (
    <div className="relative flex flex-1 flex-col gap-5.5 px-8 pt-5 pb-8" style={{ minHeight: p.minHeight }}>
      <div aria-hidden="true" className="pointer-events-none absolute top-0 left-1/2 h-125 w-225 -translate-x-1/2 bg-(image:--il-end-glow-fill)"></div>
      <header className="relative flex items-center gap-4">
        <span className="bg-(image:--il-fill-brand) bg-clip-text text-22 font-700 tracking-(--il-end-logo-tracking) text-transparent">{t('hud.logo')}</span>
        <span className="text-13 text-fg-secondary">{t('end.header')}</span>
        {p.onLookAtBoard && (
          <>
            <span className="flex-1"></span>
            <button type="button" onClick={p.onLookAtBoard} className={`cursor-pointer rounded-8 border-0 bg-transparent px-1 py-0.5 text-13 font-600 text-fg-secondary underline ${FOCUS}`}>
              {t('end.lookAtBoard')}
            </button>
          </>
        )}
      </header>

      <section className="relative grid grid-cols-(--il-end-hero-columns) items-end gap-8">
        <div className="flex flex-col gap-2.5">
          <span className="text-12 font-700 tracking-(--il-gamification-eyebrow-tracking) text-accent-secondary uppercase">
            {t('end.eyebrow', { periods: p.periods, unit, people: p.people })}
          </span>
          <h1 ref={h1} tabIndex={-1} className="m-0 text-60 leading-none font-700 tracking-(--il-end-display-tracking) outline-none">
            {before}<span className="bg-(image:--il-fill-spectrum) bg-clip-text text-transparent">{tierName}</span>{after}
          </h1>
          <p className="m-0 max-w-160 text-17 text-pretty text-fg-secondary">{t('end.lead')}</p>
        </div>
        <div className="flex items-center gap-4 rounded-24 border border-line-default bg-surface-card px-5.5 py-4">
          <div role="img" aria-label={t('end.tier.aria', { tier: tierName, all: p.tiers.map(x => x.name).join(', ') })} className="flex gap-1.5">
            {bars.map(b => (
              <span key={b.key} title={b.name} className={`w-3.5 self-end rounded-4 ${b.filled ? 'bg-(image:--il-fill-spectrum)' : 'bg-track'}`}
                style={{ height: `calc(var(--spacing) * ${tierBarHeight(b.step)})` }}></span>
            ))}
          </div>
          <div className="flex flex-col">
            <span className="text-12 text-fg-secondary">{t('end.score.label')}</span>
            <b className="text-34 tracking-(--il-end-score-tracking)">
              {number(p.score)}<span className="sr-only"> {t('end.score.max', { max: p.scoreMax })}</span>
            </b>
          </div>
        </div>
      </section>

      <section aria-label={t('end.results.aria')} className="relative grid grid-cols-(--il-end-results-columns) gap-3 text-large:grid-cols-(--il-end-results-columns-large)">
        <div className={`${TILE} gap-2`}>
          <span className="text-12 text-fg-secondary">{t('end.results.target')}</span>
          <b className="text-24">
            {money.format(r.revenue)} <span className="text-13 font-600 text-fg-secondary">{t('end.results.of', { target: money.format(r.target) })}</span>
          </b>
          <div className="h-2 rounded-4 bg-track">
            <div className="h-full rounded-4 bg-(image:--il-fill-meter)" style={{ width: `${sharePercent(r.share)}%` }}></div>
          </div>
        </div>
        {tiles.map(x => (
          <div key={x.key} className={`${TILE} gap-1`}>
            <span className="text-12 text-fg-secondary">{x.label}</span>
            <b className="text-24">{x.value}</b>
            <span className={`text-12 font-700 ${TONE_TEXT[x.tone]}`}>{x.note}</span>
          </div>
        ))}
      </section>

      <section className="relative grid grid-cols-(--il-end-body-columns) gap-5">
        <div className="flex flex-col gap-3">
          <EndMoments moments={p.moments} periods={p.periods} periodUnit={unit} />
          <div className="flex flex-col gap-2 pt-1.5">
            <h2 className="m-0 text-16 font-700">{t('end.badges.title')}</h2>
            <BadgeShelf badges={p.badges} />
          </div>
        </div>
        <EndReflection
          {...p.reflection}
          actions={(
            <>
              <NoWrapButton variant="primary" size="lg" onClick={p.onViewReport}>{t('end.report.view')}</NoWrapButton>
              <NoWrapButton variant="secondary" size="lg" onClick={p.onDownload}>{t('end.report.pdf')}</NoWrapButton>
              <NoWrapButton variant="ghost" size="lg" disabled={p.emailing} onClick={p.onEmail}>{t('end.report.email')}</NoWrapButton>
            </>
          )}
        />
      </section>
    </div>
  );
}
