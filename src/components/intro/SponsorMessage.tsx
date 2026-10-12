import { useEffect, useId, useRef, useState } from 'react';
import { clockText } from '../../app/sessionClock';
import { useI18n } from '../../i18n';
import { Arrow, EYEBROW, FOCUS, LINK, PRIMARY } from './IntroHeader';
import { chapterAt, type IntroMessage } from './intro';

export interface SponsorMessageProps {
  message: IntroMessage;
  sponsor: { name: string; title: string; img: string | null; initials: string };
  /** Muted from the header's Mute video. */
  muted: boolean;
  /** The storyline has a product portfolio: the end card offers it, else the objectives. */
  hasProducts: boolean;
  onNext: () => void;
  /** Seconds each caption stays when there is no video to time them (the letter read as the message). */
  secondsPerCaption?: number;
  /** Starts playing on arrival (off in stories). */
  autoPlay?: boolean;
}

const PlayIcon = ({ playing }: { playing: boolean }) => (
  <svg className="size-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d={playing ? 'M6 4h4v16H6zM14 4h4v16h-4z' : 'M7 4l13 8-13 8z'} /></svg>
);

/**
 * The sponsor's video message (D219, the canvas's Sponsor): the storyline's video when it has one, else the
 * sponsor's portrait with the welcome letter as the message, timed line by line. Captions are on by default
 * and read out politely; Play and Pause, a position slider, CC, and three chapters to jump to (the challenge,
 * what I expect, your goal). At the end a card offers the products (or the objectives) and Watch again.
 */
export function SponsorMessage({ message, sponsor, muted, hasProducts, onNext, secondsPerCaption = 6, autoPlay = true }: SponsorMessageProps) {
  const { t } = useI18n();
  const video = useRef<HTMLVideoElement>(null);
  const endHeading = useRef<HTMLHeadingElement>(null);
  const [videoLength, setVideoLength] = useState<number | null>(null);
  const duration = Math.max(1, Math.round(videoLength ?? message.captions.length * secondsPerCaption));
  const [at, setAt] = useState(0);
  const [playing, setPlaying] = useState(autoPlay);
  const [cc, setCc] = useState(true);
  const chaptersId = useId();
  const ended = at >= duration;
  const per = duration / Math.max(1, message.captions.length);
  const line = Math.min(message.captions.length - 1, Math.floor(at / per));
  const chapter = chapterAt(message.chapters, line);

  // Without a video the message keeps its own time, a second at a time.
  useEffect(() => {
    if (message.video || !playing || ended) return;
    const id = setInterval(() => setAt(a => Math.min(duration, a + 1)), 1000);
    return () => clearInterval(id);
  }, [message.video, playing, ended, duration]);
  useEffect(() => {
    const v = video.current;
    if (!v) return;
    v.muted = muted;
  }, [muted]);
  useEffect(() => {
    const v = video.current;
    if (!v) return;
    if (playing && !ended) void v.play().catch(() => setPlaying(false));
    else v.pause();
  }, [playing, ended]);
  useEffect(() => { if (ended) endHeading.current?.focus({ preventScroll: true }); }, [ended]);

  const seek = (s: number) => {
    const to = Math.max(0, Math.min(duration, s));
    setAt(to);
    if (video.current) video.current.currentTime = to;
  };
  const again = () => { seek(0); setPlaying(true); };

  return (
    <main className="grid min-h-0 flex-1 grid-cols-(--il-intro-message-columns) gap-8 overflow-y-auto px-12 py-6 tablet:grid-cols-1 tablet:px-6">
      <h1 className="sr-only">{t('intro.message.title', { name: sponsor.name })}</h1>
      <section aria-label={t('intro.message.title', { name: sponsor.name })} className="relative flex min-h-110 flex-col overflow-hidden rounded-16 border border-line-default bg-surface-solid">
        <div className="relative flex min-h-0 flex-1 items-center justify-center bg-surface-raised">
          {message.video ? (
            // The captions show over the video from the transcript (aria-live below); the storyline's track, when it has one, goes along.
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <video ref={video} src={message.video.src} poster={message.video.poster ?? undefined} muted={muted} playsInline preload="metadata" aria-hidden="true"
              onLoadedMetadata={e => { const d = e.currentTarget.duration; if (Number.isFinite(d) && d > 0) setVideoLength(d); }}
              onTimeUpdate={e => setAt(e.currentTarget.currentTime)} onEnded={() => setAt(duration)} className="absolute inset-0 size-full object-cover">
              {message.video.track && <track kind="captions" src={message.video.track} default />}
            </video>
          ) : sponsor.img
            ? <img src={sponsor.img} alt="" className="absolute inset-0 size-full object-cover object-top opacity-90" />
            : <span aria-hidden="true" className="flex size-40 items-center justify-center rounded-round bg-brand text-48 font-700 text-brand-deep-space">{sponsor.initials}</span>}
          <span className="absolute start-4 top-4 rounded-8 bg-surface-material px-3 py-1.5 text-13"><b>{sponsor.name}</b> <span className="text-fg-secondary">{sponsor.title}</span></span>
          {/* Captions, on by default and read out politely; off, the region stays and says nothing. */}
          <div role="region" aria-label={t('intro.message.captions')} className="absolute inset-x-6 bottom-6 flex justify-center">
            <p aria-live="polite" className={`m-0 max-w-180 rounded-10 bg-surface-material px-4 py-2.5 text-center text-18 leading-snug ${cc && !ended ? '' : 'hidden'}`}>{cc && !ended ? message.captions[line] : ''}</p>
          </div>
          {ended && (
            <div data-intro-end="" className="absolute inset-0 flex flex-col items-center justify-center gap-5 bg-surface-material px-6 text-center backdrop-blur-12">
              <p className={EYEBROW}>{t('intro.message.end')}</p>
              <h2 ref={endHeading} tabIndex={-1} className="m-0 text-34 font-700 outline-0">{t('intro.message.endTitle', { products: hasProducts ? 'yes' : 'no' })}</h2>
              <button type="button" onClick={onNext} className={PRIMARY}>{hasProducts ? t('intro.message.explore') : t('intro.message.objectives')}<Arrow /></button>
              <button type="button" onClick={again} className={LINK}>{t('intro.message.again')}</button>
            </div>
          )}
        </div>
        <div className="flex flex-none items-center gap-3 px-4 py-3">
          <button type="button" onClick={() => (ended ? again() : setPlaying(p => !p))} aria-label={t('intro.message.play', { playing: playing && !ended ? 'yes' : 'no' })}
            className={`flex size-11 flex-none cursor-pointer items-center justify-center rounded-round border border-line-strong bg-surface-raised text-fg-primary ${FOCUS}`}>
            <PlayIcon playing={playing && !ended} />
          </button>
          <input type="range" min={0} max={duration} step={1} value={Math.round(at)} onChange={e => seek(Number(e.target.value))}
            aria-label={t('intro.message.seek')} aria-valuetext={t('intro.message.time', { at: clockText(Math.round(at)), total: clockText(duration) })}
            className={`h-11 min-w-0 flex-1 cursor-pointer accent-(--il-color-accent-default) ${FOCUS}`} />
          <span aria-hidden="true" className="flex-none text-13 tabular-nums text-fg-secondary">{clockText(Math.round(at))} / {clockText(duration)}</span>
          <button type="button" onClick={() => setCc(c => !c)} aria-pressed={cc} aria-label={t('intro.message.cc')}
            className={`flex min-h-11 min-w-11 flex-none cursor-pointer items-center justify-center rounded-8 border px-2 text-13 font-700 ${cc ? 'border-accent-secondary text-fg-primary' : 'border-line-strong text-fg-secondary'} bg-transparent ${FOCUS}`}>
            <span aria-hidden="true">{t('intro.message.ccShort')}</span>
          </button>
        </div>
      </section>
      <section aria-labelledby={chaptersId} className="flex flex-col gap-2">
        <h2 id={chaptersId} className={EYEBROW}>{t('intro.message.chapters')}</h2>
        <ol className="m-0 flex list-none flex-col gap-2 p-0">
          {message.chapters.map((c, i) => {
            const title = t('intro.message.chapter', { key: c.key });
            const start = Math.round(c.start * per);
            return (
              <li key={c.key}>
                <button type="button" onClick={() => { seek(start); setPlaying(true); }} aria-current={i === chapter && !ended ? 'step' : undefined}
                  aria-label={t('intro.message.chapterAria', { n: i + 1, title, at: clockText(start) })}
                  className={`flex w-full cursor-pointer flex-col gap-1 rounded-12 border bg-surface-card p-4 text-start text-fg-primary ${i === chapter && !ended ? 'border-accent-secondary' : 'border-line-default'} ${FOCUS}`}>
                  <span className="flex justify-between text-13 text-fg-secondary"><span>{t('intro.message.part', { n: i + 1 })}</span><span className="tabular-nums">{clockText(start)}</span></span>
                  <b className="text-16">{title}</b>
                  <span className="text-14 text-fg-secondary">{c.summary}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </section>
    </main>
  );
}
