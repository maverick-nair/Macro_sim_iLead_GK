import { useEffect, useId, useRef, useState } from 'react';
import { clockText } from '../../app/sessionClock';
import { useI18n } from '../../i18n';
import { Arrow, DISPLAY, EYEBROW, FOCUS, LINK, PRIMARY } from './IntroHeader';
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
 * The sponsor's video message (D219, the canvas's Sponsor, D232): the storyline's video when it has one, else the
 * sponsor's portrait with the welcome letter as the message, timed line by line. Captions are on by default and read
 * out politely; Play and Pause, a position slider, CC, and three chapters to jump to (the challenge, what I expect,
 * your goal). The controls sit on the video, as a player's do. At the end a card offers the products (or the
 * objectives) and Watch again.
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
    <main className="grid min-h-0 flex-1 grid-cols-(--il-intro-message-columns) gap-8 overflow-y-auto px-12 pt-2 pb-10 short:pb-6 tablet:grid-cols-1 tablet:px-8">
      <h1 className="sr-only">{t('intro.message.title', { name: sponsor.name })}</h1>
      <section aria-label={t('intro.message.title', { name: sponsor.name })} className="relative flex min-h-110 flex-col overflow-hidden rounded-4 bg-black">
        <div className="relative flex min-h-0 flex-1 items-center justify-center">
          {message.video ? (
            // The captions show over the video from the transcript (aria-live below); the storyline's track, when it has one, goes along.
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <video ref={video} src={message.video.src} poster={message.video.poster ?? undefined} muted={muted} playsInline preload="metadata" aria-hidden="true"
              onLoadedMetadata={e => { const d = e.currentTarget.duration; if (Number.isFinite(d) && d > 0) setVideoLength(d); }}
              onTimeUpdate={e => setAt(e.currentTarget.currentTime)} onEnded={() => setAt(duration)} className="absolute inset-0 size-full object-cover">
              {message.video.track && <track kind="captions" src={message.video.track} default />}
            </video>
          ) : sponsor.img
            ? <img src={sponsor.img} alt="" className="absolute inset-0 size-full object-cover object-(--il-canvas-video-position)" />
            : <span aria-hidden="true" className="flex size-40 items-center justify-center rounded-round bg-(--il-color-canvas-navy-800) font-display text-60 text-(--il-color-canvas-mist-light)">{sponsor.initials}</span>}
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-(--il-canvas-video-fade-height) bg-(image:--il-canvas-fade-video)" />
          <span className="absolute start-4 top-4 flex items-center gap-2 rounded-4 bg-(--il-canvas-veil-soft) px-2.5 py-1.5 text-13"><b className="font-600">{sponsor.name}</b> <span className="text-fg-secondary">{sponsor.title}</span></span>
          {/* Captions, on by default and read out politely; off, the region stays and says nothing. */}
          <div role="region" aria-label={t('intro.message.captions')} className="absolute inset-x-(--il-canvas-video-caption-inset) bottom-18.5 flex justify-center">
            <p aria-live="polite" className={`m-0 text-center text-20 leading-(--il-canvas-leading-line) text-(--il-color-white) [text-shadow:0_1px_3px_rgb(0_0_0/0.9)] ${cc && !ended ? '' : 'hidden'}`}>{cc && !ended ? message.captions[line] : ''}</p>
          </div>
          {ended && (
            <div data-intro-end="" className="absolute inset-0 flex flex-col items-center justify-center gap-4.5 bg-(--il-canvas-veil-strong) px-6 text-center">
              <p className={`${EYEBROW} text-13 tracking-(--il-tracking-eyebrow-wide)`}>{t('intro.message.end')}</p>
              <h2 ref={endHeading} tabIndex={-1} className={`${DISPLAY} max-w-(--il-canvas-measure-narrow) text-40 leading-(--il-canvas-leading-title) outline-0`}>{t('intro.message.endTitle', { products: hasProducts ? 'yes' : 'no' })}</h2>
              <button type="button" onClick={onNext} className={`${PRIMARY} min-h-14 px-7 text-17`}>{hasProducts ? t('intro.message.explore') : t('intro.message.objectives')}<Arrow /></button>
              <button type="button" onClick={again} className={`${LINK} text-14`}>{t('intro.message.again')}</button>
            </div>
          )}
          <div className={`absolute inset-x-0 bottom-0 flex items-center gap-3 px-4 py-3 ${ended ? 'hidden' : ''}`}>
            <button type="button" onClick={() => (ended ? again() : setPlaying(p => !p))} aria-label={t('intro.message.play', { playing: playing && !ended ? 'yes' : 'no' })}
              className={`flex size-11 flex-none cursor-pointer items-center justify-center rounded-round border-0 bg-(--il-color-canvas-paper-light) text-(--il-color-canvas-navy) ${FOCUS}`}>
              <PlayIcon playing={playing && !ended} />
            </button>
            <input type="range" min={0} max={duration} step={1} value={Math.round(at)} onChange={e => seek(Number(e.target.value))}
              aria-label={t('intro.message.seek')} aria-valuetext={t('intro.message.time', { at: clockText(Math.round(at)), total: clockText(duration) })}
              className={`h-11 min-w-0 flex-1 cursor-pointer accent-(--il-color-canvas-mint) ${FOCUS}`} />
            <span aria-hidden="true" className="flex-none font-mono text-13 text-(--il-color-canvas-mist-light)">{clockText(Math.round(at))} / {clockText(duration)}</span>
            <button type="button" onClick={() => setCc(c => !c)} aria-pressed={cc} aria-label={t('intro.message.cc')}
              className={`flex min-h-11 min-w-11 flex-none cursor-pointer items-center justify-center rounded-4 border bg-transparent px-3 text-13 font-600 ${cc ? 'border-(--il-color-white) text-(--il-color-white)' : 'border-(--il-color-canvas-steel) text-(--il-color-canvas-mist)'} ${FOCUS}`}>
              <span aria-hidden="true">{t('intro.message.ccShort')}</span>
            </button>
          </div>
        </div>
      </section>
      <section aria-labelledby={chaptersId} className="flex flex-col gap-3">
        <h2 id={chaptersId} className="m-0 text-12 font-600 uppercase tracking-(--il-tracking-eyebrow-wide) text-fg-secondary">{t('intro.message.chapters')}</h2>
        <ol className="m-0 flex list-none flex-col gap-2 p-0">
          {message.chapters.map((c, i) => {
            const title = t('intro.message.chapter', { key: c.key });
            const start = Math.round(c.start * per);
            const on = i === chapter && !ended;
            return (
              <li key={c.key}>
                <button type="button" onClick={() => { seek(start); setPlaying(true); }} aria-current={on ? 'step' : undefined}
                  aria-label={t('intro.message.chapterAria', { n: i + 1, title, at: clockText(start) })}
                  className={`flex w-full cursor-pointer flex-col gap-1.5 rounded-4 border px-4 py-3.5 text-start text-fg-primary ${on ? 'border-accent-secondary bg-(--il-color-canvas-navy-800)' : 'border-(--il-color-canvas-navy-750) bg-transparent'} ${FOCUS}`}>
                  <span className="flex justify-between gap-2 text-13 text-fg-secondary"><span>{t('intro.message.part', { n: i + 1 })}</span><span className="font-mono">{clockText(start)}</span></span>
                  <b className="text-16 font-600">{title}</b>
                  <span className="text-14 leading-normal text-(--il-color-canvas-mist-light)">{c.summary}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </section>
    </main>
  );
}
