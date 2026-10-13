import { lazy, Suspense, useEffect, useId, useRef } from 'react';
import { useI18n } from '../../i18n';
import { useMoney } from '../../i18n/money';
import type { PeriodUnit } from '../action/days';
import { Arrow, DISPLAY, EYEBROW, PRIMARY } from './IntroHeader';
// The microphone test and the speech layer load with the objectives, not in the first load.
const MicCheck = lazy(() => import('./MicCheck'));

export interface ObjectivesProps {
  organisation: string | null;
  /** "eight weeks", worded. */
  length: string;
  periods: number;
  periodUnit: PeriodUnit;
  target: number;
  /** Money earned so far (the start of the run). */
  start: number;
  team: Array<{ id: string; name: string; img: string | null }>;
  /** Live conversations a period. */
  liveCap: number;
  sponsor: { name: string; title: string; img: string | null; initials: string; quote: string };
  onStart: () => void;
  /** The mic test heard the participant: voice is on. */
  onVoice: () => void;
  /** Use text instead. */
  onText: () => void;
}

const TILE = 'flex flex-col gap-2.5 rounded-6 border border-line-default bg-surface-raised p-5 short:p-4';
const LABEL = 'm-0 text-12 font-600 uppercase tracking-(--il-tracking-eyebrow-wide) text-fg-secondary';
const STAT = 'font-mono text-34 leading-none font-500 tracking-[-0.03em] short:text-30';
const AVATARS = 6;

/**
 * The objectives (D219, the canvas's Ready, D227): the run's length with a track of its periods, the target, the team
 * with their faces, how you win, the sponsor's word, then Start simulation, which shows after five seconds (hidden
 * until then, so it cannot be reached early; at once where motion is reduced; a line and a bar say the first period
 * opens shortly meanwhile), and an optional microphone test with Use text instead. The canvas no longer has How you
 * are scored (D220): the score's make up is in the report and the menu, not before the first week.
 */
export function Objectives(p: ObjectivesProps) {
  const { t } = useI18n();
  const money = useMoney();
  const ids = { win: useId(), mic: useId() };
  const h1 = useRef<HTMLHeadingElement>(null);
  useEffect(() => { h1.current?.focus({ preventScroll: true }); }, []);
  const shown = p.team.slice(0, AVATARS);
  const win = [
    [t('intro.objectives.win.1'), t('intro.objectives.win.1b')],
    [t('intro.objectives.win.2', { cap: p.liveCap, unit: p.periodUnit }), t('intro.objectives.win.2b')],
    [t('intro.objectives.win.3', { name: p.sponsor.name.split(' ')[0] }), t('intro.objectives.win.3b')]
  ];
  return (
    <main className="grid min-h-0 flex-1 grid-cols-(--il-intro-objectives-columns) bg-surface-card tablet:grid-cols-1 tablet:grid-rows-(--il-intro-objectives-rows)">
      <div className="flex min-h-0 flex-col gap-9 overflow-y-auto px-16 py-9 short:gap-6 short:py-6 tablet:gap-5 tablet:px-8 tablet:py-6 [&>*:first-child]:mt-auto [&>*:last-child]:mb-auto">
        <div className="flex flex-col gap-2.5">
          <p className={`${EYEBROW} text-13 tracking-[0.16em]`}>{t('intro.objectives.eyebrow')}</p>
          <h1 ref={h1} tabIndex={-1} className={`${DISPLAY} text-58 leading-[1.05] outline-0 short:text-48 tablet:text-40`}>
            {t('intro.objectives.title', { length: p.length.charAt(0).toUpperCase() + p.length.slice(1), organisation: p.organisation ?? 'none' })}
          </h1>
        </div>
        <ul className="m-0 grid list-none grid-cols-3 gap-3.5 p-0 text-large:grid-cols-1">
          <li className={TILE}>
            <h2 className={LABEL}>{t('intro.objectives.time')}</h2>
            <b className={STAT}>{t('intro.objectives.timeValue', { n: p.periods, unit: p.periodUnit })}</b>
            <span role="img" aria-label={t('intro.objectives.timeAria', { n: p.periods, unit: p.periodUnit })} className="flex h-2 gap-1">
              {Array.from({ length: p.periods }, (_, i) => <span key={i} className={`h-2 flex-1 rounded-2 ${i === 0 ? 'bg-accent-secondary' : 'bg-(--il-color-canvas-charcoal-800)'}`} />)}
            </span>
            <span className="text-14 leading-[1.45] text-fg-secondary">{t('intro.objectives.timeNote', { unit: p.periodUnit })}</span>
          </li>
          <li className={TILE}>
            <h2 className={LABEL}>{t('intro.objectives.target')}</h2>
            <b className={`${STAT} text-accent-secondary`}>{money.compact(p.target)}</b>
            <span aria-hidden="true" className="relative block h-2 rounded-2 bg-(--il-color-canvas-charcoal-800)"><span className="absolute inset-y-0 start-0 block min-w-0.75 bg-accent-secondary" style={{ width: `${Math.round((p.start / Math.max(1, p.target)) * 100)}%` }} /></span>
            <span className="text-14 leading-[1.45] text-fg-secondary">{t('intro.objectives.targetNote', { start: money.format(p.start) })}</span>
          </li>
          <li className={TILE}>
            <h2 className={LABEL}>{t('intro.objectives.team')}</h2>
            <b className={STAT}>{t('intro.objectives.teamValue', { n: p.team.length })}</b>
            <span className="-my-1.75 ms-1.5 flex h-5.5 items-center">
              {shown.map(m => (m.img
                ? <img key={m.id} src={m.img} alt="" title={m.name} className="-ms-1.5 size-5.5 rounded-round border-2 border-surface-raised bg-(--il-color-canvas-sky-100) object-cover object-top" />
                : <span key={m.id} aria-hidden="true" className="-ms-1.5 flex size-5.5 items-center justify-center rounded-round border-2 border-surface-raised bg-surface-solid text-11 font-600">{m.name[0]}</span>))}
              {p.team.length > AVATARS && <span className="ms-1.5 font-mono text-12 font-500 text-fg-secondary"><span aria-hidden="true">{t('intro.objectives.more', { n: p.team.length - AVATARS })}</span></span>}
            </span>
            <span className="text-14 leading-[1.45] text-fg-secondary">{t('intro.objectives.teamNote')}</span>
          </li>
        </ul>
        <section aria-labelledby={ids.win} className="flex flex-col gap-2.5">
          <h2 id={ids.win} className={LABEL}>{t('intro.objectives.win')}</h2>
          <ol className="m-0 flex list-none flex-col p-0">
            {win.map(([lead, rest], i) => (
              <li key={i} className="grid grid-cols-[28px_minmax(0,1fr)] items-baseline gap-3 border-b border-line-default py-3.25 text-16 leading-[1.45] short:py-2">
                <span aria-hidden="true" className="font-mono text-12 font-500 text-accent-secondary">{String(i + 1).padStart(2, '0')}</span>
                <span className="text-fg-secondary"><b className="font-600 text-fg-primary">{lead}</b> {rest}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>
      <aside className="flex min-h-0 flex-col justify-center gap-6.5 overflow-y-auto border-s border-line-default bg-surface-solid px-11 py-9 short:gap-4 short:py-6 tablet:gap-3 tablet:border-s-0 tablet:border-t tablet:px-8 tablet:py-4">
        <figure className="m-0 flex flex-col gap-3.5 tablet:hidden">
          <blockquote className="m-0 font-serif text-26 leading-[1.3] text-fg-primary">{t('intro.objectives.quote', { quote: p.sponsor.quote })}</blockquote>
          <figcaption className="flex items-center gap-3 text-14 text-fg-secondary">
            {p.sponsor.img ? <img src={p.sponsor.img} alt="" className="size-10 rounded-round object-cover object-top" /> : <span aria-hidden="true" className="flex size-10 items-center justify-center rounded-round bg-(--il-color-canvas-navy-800) font-serif text-16 text-fg-primary">{p.sponsor.initials}</span>}
            <span className="flex flex-col"><b className="font-600 text-fg-primary">{p.sponsor.name}</b><span>{p.sponsor.title}</span></span>
          </figcaption>
        </figure>
        <div className="relative grid min-h-30 border-t border-line-default tablet:min-h-0 tablet:border-t-0">
          {/* Until Start simulation shows: a line and a bar filling up. Where motion is reduced it never shows (D227). */}
          <div aria-hidden="true" className="il-wait col-start-1 row-start-1 flex flex-col justify-center gap-3.5 pt-6 short:pt-4 tablet:pt-0">
            <span className="text-15 leading-normal text-fg-secondary">{t('intro.objectives.wait', { period: t('time.period', { unit: p.periodUnit, n: 1 }) })}</span>
            <span className="block h-1 bg-(--il-color-canvas-charcoal-800)"><span className="il-wait-bar block h-1 bg-accent-secondary" /></span>
          </div>
          <div className="il-reveal-later col-start-1 row-start-1 flex flex-col items-stretch justify-center gap-2.5 pt-6 short:pt-4 tablet:pt-0" data-intro-start="">
            <button type="button" onClick={p.onStart} className={`${PRIMARY} min-h-15 text-18`}>{t('intro.objectives.start')}<Arrow /></button>
            <span className="text-center text-13 text-fg-secondary">{t('intro.objectives.startNote')}</span>
          </div>
        </div>
        <section aria-labelledby={ids.mic} className="flex flex-col gap-2 border-t border-line-default pt-4.5 short:pt-3">
          <h2 id={ids.mic} className={LABEL}>{t('intro.mic.title')}</h2>
          <Suspense fallback={null}><MicCheck onHeard={p.onVoice} onText={p.onText} /></Suspense>
        </section>
      </aside>
    </main>
  );
}
