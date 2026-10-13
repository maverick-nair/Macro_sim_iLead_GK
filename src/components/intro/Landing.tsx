import { useEffect, useId, useRef, useState } from 'react';
import { useI18n } from '../../i18n';
import { EYEBROW, FOCUS, LINK } from './IntroHeader';

export interface LandingProps {
  /** "Lead a team of ten through eight weeks that count." */
  title: string;
  /** One paragraph about the simulation. */
  body: string;
  /** Three short facts. */
  facts: string[];
  sponsor: { name: string; title: string; img: string | null; initials: string };
  /** Milliseconds before the sponsor's notification arrives (about 2 s; 0 in stories). */
  noticeAfter?: number;
  onWatch: () => void;
  onSkip: () => void;
}

const Play = () => <svg className="size-3" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4l13 8-13 8z" /></svg>;

/**
 * The landing (D219, the canvas's Main): what the simulation is in one paragraph and three facts, and, a moment
 * later, a video message from the sponsor sliding in (no slide under reduced motion). The notification lands
 * in a polite live region, so screen readers hear it arrive. The heading takes focus on arrival.
 */
export function Landing({ title, body, facts, sponsor, noticeAfter = 2000, onWatch, onSkip }: LandingProps) {
  const { t } = useI18n();
  const [notice, setNotice] = useState(noticeAfter === 0);
  const h1 = useRef<HTMLHeadingElement>(null);
  const factsId = useId();
  useEffect(() => { h1.current?.focus({ preventScroll: true }); }, []);
  useEffect(() => {
    if (notice) return;
    const id = setTimeout(() => setNotice(true), noticeAfter);
    return () => clearTimeout(id);
  }, [notice, noticeAfter]);
  return (
    <main className="relative flex min-h-0 flex-1 flex-col justify-center overflow-y-auto px-24 py-16 short:py-8 tablet:px-10">
      <div className="flex max-w-170 flex-col gap-6">
        <p className={EYEBROW}>{t('intro.landing.eyebrow')}</p>
        <h1 ref={h1} tabIndex={-1} className="m-0 text-60 leading-tight font-600 tracking-(--il-tracking-title) outline-0 tablet:text-48">{title}</h1>
        <p className="m-0 max-w-140 text-18 leading-relaxed text-fg-secondary">{body}</p>
        <h2 id={factsId} className="sr-only">{t('intro.landing.facts')}</h2>
        <ul aria-labelledby={factsId} className="m-0 flex list-none flex-wrap gap-x-6 gap-y-2 p-0 text-15">
          {facts.map(f => <li key={f} className="flex items-center gap-2"><span aria-hidden="true" className="size-1.5 flex-none bg-accent-secondary" />{f}</li>)}
        </ul>
        <span><button type="button" onClick={onSkip} className={LINK}>{t('intro.landing.skip')}</button></span>
      </div>
      <div role="status" aria-live="polite" className="absolute end-12 top-6 tablet:end-6">
        {notice && (
          <section aria-label={t('intro.landing.notice')} data-intro-notice="" className="il-slide-in flex w-115 max-w-full items-center gap-4 rounded-6 border border-line-strong bg-surface-solid p-4 shadow-(--il-event-card-shadow)">
            <span className="relative flex-none">
              {sponsor.img
                ? <img src={sponsor.img} alt="" className="size-16 rounded-round object-cover object-top" />
                : <span aria-hidden="true" className="flex size-16 items-center justify-center rounded-round bg-brand text-18 font-600 text-button-on-solid">{sponsor.initials}</span>}
              <span aria-hidden="true" className="absolute -end-1 -bottom-1 flex size-7 items-center justify-center rounded-round bg-surface-solid text-fg-primary ring-1 ring-line-strong"><Play /></span>
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-12 font-600 uppercase tracking-(--il-desk-band-eyebrow-tracking) text-fg-secondary">{t('intro.landing.notice')}</span>
              <b className="text-16">{t('intro.landing.from', { name: sponsor.name, title: sponsor.title })}</b>
              <span className="text-14 text-fg-secondary">{t('intro.landing.teaser')}</span>
            </span>
            <button type="button" onClick={onWatch} aria-label={t('intro.landing.watchAria', { name: sponsor.name })}
              className={`min-h-11 flex-none cursor-pointer rounded-4 border-0 bg-(image:--il-fill-brand) px-4 text-15 font-600 text-button-on-solid ${FOCUS}`}>
              {t('intro.landing.watch')}
            </button>
          </section>
        )}
      </div>
    </main>
  );
}
