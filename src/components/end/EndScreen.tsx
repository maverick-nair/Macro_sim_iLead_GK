import { useEffect, useRef } from 'react';
import { useApi } from '../../api';
import { NoWrapButton } from '../../ds/Button';
import { useI18n } from '../../i18n';
import { useMoney } from '../../i18n/money';
import { BadgeShelf } from '../gamification/Badge';
import { around, EYEBROW, sharePercent, TONE_TEXT, toneOf } from './display';
import { EndMoments } from './EndMoments';
import { EndReflection } from './EndReflection';
import type { EndScreenProps } from './types';
import './messages';
import { ILeadLogo } from '../shell/Logo';

const FOCUS = 'focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accent-secondary';
/** The canvas's results grid (D232): square tiles sharing their borders. */
const TILE = 'flex flex-col border-e border-b border-line-default bg-surface-card px-4 py-3.5';

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
  /** No email service (a SCORM package, D208): Email me is left out. */
  const email = useApi().features?.email !== false;
  const h1 = useRef<HTMLHeadingElement>(null);
  const focusOnOpen = !!p.focusOnOpen;
  useEffect(() => {
    if (focusOnOpen) h1.current?.focus({ preventScroll: true });
  }, [focusOnOpen]);

  const unit = p.periodUnit;
  const r = p.results;
  const tierName = p.tiers.find(x => x.key === p.tier)?.name ?? p.tier;
  const [before, after] = around(t('end.title', { tier: MARK }), MARK);
  const kpis = r.kpis.map(k => {
    const end = Math.round(k.end), change = end - Math.round(k.start);
    return { key: k.metric, label: t('metric.team', { metric: t('metric.nameLower', { metric: k.metric }) }), value: number(end), note: delta(change), tone: toneOf(change) };
  });
  const tiles = [{ key: 'conversions', label: r.conversionsLabel ?? t('end.results.conversions', { custom: 'no', UnitMany: '' }), value: number(r.conversions), note: r.conversionsNote, tone: r.conversionsTone }, ...kpis];

  return (
    <div className="relative flex w-full flex-1 flex-col bg-surface-page text-fg-primary" style={{ minHeight: p.minHeight }}>
      {/* The canvas's navy hero (D232), in both modes: the headline in the display serif, the score in the mono, the tiers as chips. */}
      <section className="il-scheme-dark bg-(--il-color-canvas-navy) text-fg-primary">
        <div className="mx-auto flex w-full max-w-(--il-end-max-width) flex-col gap-6 px-11 pt-5 pb-8 tablet:px-8">
          <header className="flex min-h-11 items-center gap-5">
            <ILeadLogo size="sm" />
            <span className="text-14 text-fg-body">{t('end.header')}</span>
            {p.onLookAtBoard && (
              <>
                <span className="flex-1"></span>
                <button type="button" onClick={p.onLookAtBoard} className={`min-h-11 cursor-pointer rounded-4 border-0 bg-transparent px-1 py-0 text-14 text-fg-primary underline underline-offset-3 ${FOCUS}`}>
                  {t('end.lookAtBoard')}
                </button>
              </>
            )}
          </header>
          <div className="grid grid-cols-(--il-end-hero-columns) items-end gap-x-12 gap-y-6 tablet:grid-cols-1 text-large:grid-cols-1">
            <div className="flex flex-col gap-3">
              <span className="text-12 font-600 tracking-(--il-tracking-eyebrow-wide) text-accent-secondary uppercase">
                {t('end.eyebrow', { periods: p.periods, unit, people: p.people })}
              </span>
              <h1 ref={h1} tabIndex={-1} className="m-0 font-display text-58 leading-(--il-canvas-leading-display) font-400 text-balance outline-none">
                {before}<span className="bg-(image:--il-end-tier-fill) bg-clip-text text-transparent [filter:var(--il-end-tier-glow)]">{tierName}</span>{after}
              </h1>
              <p className="m-0 max-w-160 text-17 leading-relaxed text-pretty text-fg-body">{t('end.lead')}</p>
            </div>
            <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
              <div className="flex flex-col gap-1">
                <span className="text-13 text-fg-body">{t('end.score.label')}</span>
                <b className="flex items-baseline gap-3 font-mono text-72 leading-none font-400 tracking-(--il-end-score-tracking)">
                  {number(p.score)}
                  <span aria-hidden="true" className="text-19 text-fg-body">{t('end.score.of', { max: p.scoreMax })}</span>
                  <span className="sr-only"> {t('end.score.max', { max: p.scoreMax })}</span>
                </b>
              </div>
              <div role="img" aria-label={t('end.tier.aria', { tier: tierName, all: p.tiers.map(x => x.name).join(', ') })} className="flex flex-wrap gap-1">
                {p.tiers.map(x => (
                  <span key={x.key} aria-hidden="true"
                    className={`flex min-h-8 items-center border px-2.5 text-13 ${x.key === p.tier ? 'border-(--il-color-canvas-paper-light) bg-(--il-color-canvas-paper-light) font-600 text-(--il-color-canvas-ink)' : 'border-line-strong text-fg-body'}`}>
                    {x.name}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto flex w-full max-w-(--il-end-max-width) flex-1 flex-col gap-7 px-11 pt-7 pb-0 tablet:px-8">
        <section aria-label={t('end.results.aria')} className="grid grid-cols-(--il-end-results-columns) border-s border-t border-line-default text-large:grid-cols-(--il-end-results-columns-large) tablet-portrait:grid-cols-3">
          <div className={`${TILE} gap-2`}>
            <span className="text-13 text-fg-body">{t('end.results.target')}</span>
            <b className="font-mono text-26 font-500">
              {money.format(r.revenue)} <span className="font-sans text-13 font-400 text-fg-body">{t('end.results.of', { target: money.format(r.target) })}</span>
            </b>
            <div className="h-2 bg-track">
              <div className="h-full bg-accent-default" style={{ width: `${sharePercent(r.share)}%` }}></div>
            </div>
          </div>
          {tiles.map(x => (
            <div key={x.key} className={`${TILE} gap-1`}>
              <span className="text-13 text-fg-body">{x.label}</span>
              <b className={`font-mono text-26 font-500 ${x.tone === 'neutral' ? '' : TONE_TEXT[x.tone]}`}>{x.value}</b>
              <span className={`text-13 ${TONE_TEXT[x.tone]}`}>{x.note}</span>
            </div>
          ))}
        </section>

        <section className="grid grid-cols-(--il-end-body-columns) gap-8 tablet-portrait:grid-cols-1">
          <div className="flex flex-col gap-3">
            <EndMoments moments={p.moments} periods={p.periods} periodUnit={unit} />
            <div className="flex flex-col gap-3 pt-3">
              <h2 className={EYEBROW}>{t('end.badges.title')}</h2>
              <BadgeShelf badges={p.badges} />
            </div>
          </div>
          <EndReflection {...p.reflection} />
        </section>
        {p.cohort}
        {/* The report's actions stay in reach at the bottom of the window however far the page scrolls (D101). */}
        <div className="il-chrome sticky bottom-0 z-30 -mx-11 mt-auto flex flex-wrap items-center gap-2.5 border-b-0 px-11 py-3 tablet:-mx-8 tablet:px-8">
          <NoWrapButton variant="primary" size="lg" onClick={p.onViewReport}>{t('end.report.view')}</NoWrapButton>
          <NoWrapButton variant="secondary" size="lg" onClick={p.onDownload}>{t('end.report.pdf')}</NoWrapButton>
          {email && <NoWrapButton variant="ghost" size="lg" disabled={p.emailing} onClick={p.onEmail}>{t('end.report.email')}</NoWrapButton>}
        </div>
      </div>
    </div>
  );
}
