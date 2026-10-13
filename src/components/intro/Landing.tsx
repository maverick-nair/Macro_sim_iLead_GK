import { useEffect, useId, useRef, useState } from 'react';
import { useI18n } from '../../i18n';
import { DISPLAY, EYEBROW, FOCUS, LINK } from './IntroHeader';

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

const Play = () => <svg className="size-2.75" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4l13 8-13 8z" /></svg>;

/**
 * The landing (D219, the canvas's Main, D227): the photo with the navy wash across it, what the simulation is in one
 * paragraph and three facts, and, a moment later, a video message from the sponsor sliding in (no slide under reduced
 * motion), on paper. The notification lands in a polite live region, so screen readers hear it arrive. The heading
 * takes focus on arrival.
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
    <main className="relative flex min-h-0 flex-1 flex-col justify-center overflow-y-auto px-24 pb-18 short:pb-8 tablet:px-12">
      <div className="flex max-w-152 flex-col gap-6 short:gap-5">
        <p className={`${EYEBROW} text-13 tracking-[0.16em]`}>{t('intro.landing.eyebrow')}</p>
        <h1 ref={h1} tabIndex={-1} className={`${DISPLAY} text-72 outline-0 short:text-64 tablet:text-54`}>{title}</h1>
        <p className="m-0 max-w-[48ch] text-18 leading-[1.6] text-(--il-color-canvas-mist-light)">{body}</p>
        <h2 id={factsId} className="sr-only">{t('intro.landing.facts')}</h2>
        <ul aria-labelledby={factsId} className="m-0 mt-1 flex list-none flex-wrap gap-x-7 gap-y-2.5 p-0 text-15 text-(--il-color-canvas-mist-light)">
          {facts.map(f => <li key={f} className="flex items-center gap-2"><span aria-hidden="true" className="size-1.5 flex-none bg-accent-secondary" />{f}</li>)}
        </ul>
        <span><button type="button" onClick={onSkip} className={LINK}>{t('intro.landing.skip')}</button></span>
      </div>
      <div role="status" aria-live="polite" className="absolute end-12 top-5 tablet:end-8">
        {notice && (
          // The message arrives on paper, as the canvas draws it: a light scheme inside the navy screen.
          <section aria-label={t('intro.landing.notice')} data-intro-notice="" className="il-slide-in flex w-115 max-w-full items-center gap-3.5 rounded-6 bg-(--il-color-canvas-paper-light) p-4 text-fg-primary shadow-(--il-event-card-shadow) [color-scheme:light] tablet:w-105">
            <span className="relative flex-none">
              {sponsor.img
                ? <img src={sponsor.img} alt="" className="size-16 rounded-round object-cover object-top" />
                : <span aria-hidden="true" className="flex size-16 items-center justify-center rounded-round bg-(--il-color-canvas-sky-100) font-display text-24 text-(--il-color-canvas-button)">{sponsor.initials}</span>}
              <span aria-hidden="true" className="absolute -end-0.5 -bottom-0.5 flex size-6.5 items-center justify-center rounded-round border-2 border-(--il-color-canvas-paper-light) bg-(--il-color-canvas-button) text-(--il-color-white)"><Play /></span>
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.75">
              <span className="text-12 font-600 uppercase tracking-(--il-tracking-eyebrow-wide) text-accent-secondary">{t('intro.landing.notice')}</span>
              <b className="text-16 font-600">{t('intro.landing.from', { name: sponsor.name, title: sponsor.title })}</b>
              <span className="text-14 leading-[1.4] text-(--il-color-canvas-slate-700)">{t('intro.landing.teaser')}</span>
            </span>
            <button type="button" onClick={onWatch} aria-label={t('intro.landing.watchAria', { name: sponsor.name })}
              className={`min-h-11 flex-none cursor-pointer rounded-4 border-0 bg-(--il-color-canvas-button) px-4 text-15 font-600 text-(--il-color-white) ${FOCUS}`}>
              {t('intro.landing.watch')}
            </button>
          </section>
        )}
      </div>
    </main>
  );
}

/** The photo and the navy wash behind the landing, under its header (decorative). */
export function LandingPhoto({ src }: { src: string }) {
  return (
    <>
      <img src={src} alt="" fetchPriority="high" className="pointer-events-none absolute inset-0 size-full object-cover opacity-55" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,var(--il-color-canvas-navy)_0%,rgb(11_18_32/0.88)_38%,rgb(11_18_32/0.35)_75%,rgb(11_18_32/0.2)_100%)] rtl:-scale-x-100" />
    </>
  );
}
