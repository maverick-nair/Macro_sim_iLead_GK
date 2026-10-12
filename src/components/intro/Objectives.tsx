import { lazy, Suspense, useEffect, useId, useRef } from 'react';
import { useI18n } from '../../i18n';
import { useMoney } from '../../i18n/money';
import type { PeriodUnit } from '../action/days';
import { Arrow, EYEBROW, PRIMARY } from './IntroHeader';
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
  /** The Leadership Score's weights, 0 to 1. */
  weights: { business: number; people: number; leadership: number };
  sponsor: { name: string; title: string; img: string | null; initials: string; quote: string };
  onStart: () => void;
  /** The mic test heard the participant: voice is on. */
  onVoice: () => void;
  /** Use text instead. */
  onText: () => void;
}

const TILE = 'flex flex-col gap-3 rounded-14 border border-line-default bg-surface-card p-5';
const LABEL = 'm-0 text-12 font-700 uppercase tracking-(--il-desk-band-eyebrow-tracking) text-fg-secondary';
const AVATARS = 6;
const ORDER = ['leadership', 'business', 'people'] as const;
const BAR: Record<(typeof ORDER)[number], string> = { leadership: 'bg-accent-secondary', business: 'bg-accent-default', people: 'bg-status-attention' };

/**
 * The objectives (D219, the canvas's Ready): the run's length with a track of its periods, the target, the team
 * with their faces, how you win, how you are scored (the storyline's weights), the sponsor's word, then Start
 * simulation, which shows after five seconds (hidden until then, so it cannot be reached early; at once where
 * motion is reduced), and an optional microphone test with Use text instead.
 */
export function Objectives(p: ObjectivesProps) {
  const { t } = useI18n();
  const money = useMoney();
  const ids = { win: useId(), score: useId(), mic: useId() };
  const h1 = useRef<HTMLHeadingElement>(null);
  useEffect(() => { h1.current?.focus({ preventScroll: true }); }, []);
  const pct = (w: number) => Math.round(w * 100);
  const shown = p.team.slice(0, AVATARS);
  const win = [
    [t('intro.objectives.win.1'), t('intro.objectives.win.1b')],
    [t('intro.objectives.win.2', { cap: p.liveCap, unit: p.periodUnit }), t('intro.objectives.win.2b')],
    [t('intro.objectives.win.3', { name: p.sponsor.name.split(' ')[0] }), t('intro.objectives.win.3b')]
  ];
  return (
    <main className="grid min-h-0 flex-1 grid-cols-(--il-intro-objectives-columns) tablet:grid-cols-1 tablet:grid-rows-(--il-intro-objectives-rows)">
      <div className="flex min-h-0 flex-col gap-7 overflow-y-auto px-16 py-10 short:gap-5 short:py-6 tablet:px-6 [&>*:first-child]:mt-auto [&>*:last-child]:mb-auto">
        <div className="flex flex-col gap-2">
          <p className={EYEBROW}>{t('intro.objectives.eyebrow')}</p>
          <h1 ref={h1} tabIndex={-1} className="m-0 text-48 leading-tight font-700 tracking-(--il-tracking-title) outline-0 tablet:text-36">
            {t('intro.objectives.title', { length: p.length.charAt(0).toUpperCase() + p.length.slice(1), organisation: p.organisation ?? 'none' })}
          </h1>
        </div>
        <ul className="m-0 grid list-none grid-cols-3 gap-4 p-0 text-large:grid-cols-1">
          <li className={TILE}>
            <h2 className={LABEL}>{t('intro.objectives.time')}</h2>
            <b className="text-34 leading-none font-700 tabular-nums">{t('intro.objectives.timeValue', { n: p.periods, unit: p.periodUnit })}</b>
            <span role="img" aria-label={t('intro.objectives.timeAria', { n: p.periods, unit: p.periodUnit })} className="flex gap-1">
              {Array.from({ length: p.periods }, (_, i) => <span key={i} className={`h-1.5 flex-1 rounded-2 ${i === 0 ? 'bg-accent-secondary' : 'bg-track'}`} />)}
            </span>
            <span className="text-14 text-fg-secondary">{t('intro.objectives.timeNote', { unit: p.periodUnit })}</span>
          </li>
          <li className={TILE}>
            <h2 className={LABEL}>{t('intro.objectives.target')}</h2>
            <b className="text-34 leading-none font-700 tabular-nums text-accent-secondary">{money.compact(p.target)}</b>
            <span aria-hidden="true" className="block h-1.5 rounded-2 bg-track"><span className="block h-full rounded-2 bg-accent-secondary" style={{ width: `${Math.max(1, Math.round((p.start / Math.max(1, p.target)) * 100))}%` }} /></span>
            <span className="text-14 text-fg-secondary">{t('intro.objectives.targetNote', { start: money.format(p.start) })}</span>
          </li>
          <li className={TILE}>
            <h2 className={LABEL}>{t('intro.objectives.team')}</h2>
            <b className="text-34 leading-none font-700 tabular-nums">{t('intro.objectives.teamValue', { n: p.team.length })}</b>
            <span className="flex items-center">
              {shown.map(m => (m.img
                ? <img key={m.id} src={m.img} alt="" title={m.name} className="-me-2 size-8 rounded-round border-2 border-surface-solid bg-surface-raised object-cover object-top" />
                : <span key={m.id} aria-hidden="true" className="-me-2 flex size-8 items-center justify-center rounded-round border-2 border-surface-solid bg-surface-raised text-11 font-700">{m.name[0]}</span>))}
              {p.team.length > AVATARS && <span className="ms-4 text-13 text-fg-secondary"><span aria-hidden="true">{t('intro.objectives.more', { n: p.team.length - AVATARS })}</span></span>}
            </span>
            <span className="text-14 text-fg-secondary">{t('intro.objectives.teamNote')}</span>
          </li>
        </ul>
        <section aria-labelledby={ids.win} className="flex flex-col gap-1">
          <h2 id={ids.win} className={LABEL}>{t('intro.objectives.win')}</h2>
          <ol className="m-0 flex list-none flex-col p-0">
            {win.map(([lead, rest], i) => (
              <li key={i} className="flex items-baseline gap-5 border-b border-line-default py-3 text-16">
                <span aria-hidden="true" className="text-12 tabular-nums text-accent-secondary">{String(i + 1).padStart(2, '0')}</span>
                <span><b>{lead}</b> <span className="text-fg-secondary">{rest}</span></span>
              </li>
            ))}
          </ol>
        </section>
        <section aria-labelledby={ids.score} className="flex flex-col gap-2">
          <h2 id={ids.score} className={LABEL}>{t('intro.objectives.scored')}</h2>
          <div role="img" aria-label={t('intro.objectives.scoredAria', { leadership: pct(p.weights.leadership), business: pct(p.weights.business), people: pct(p.weights.people) })} className="flex gap-1">
            {ORDER.map(k => (
              <span key={k} className="flex min-w-0 flex-col gap-1.5" style={{ flexGrow: Math.max(1, pct(p.weights[k])), flexBasis: 0 }}>
                <span className={`block h-1.5 rounded-2 ${BAR[k]}`} />
                <span aria-hidden="true" className="truncate text-14"><b className="tabular-nums">{t('intro.objectives.weight', { n: pct(p.weights[k]) })}</b> {t('intro.objectives.pillar', { pillar: k })} <span className="text-fg-secondary">· {t('intro.objectives.pillarLine', { pillar: k })}</span></span>
              </span>
            ))}
          </div>
        </section>
      </div>
      <aside className="flex min-h-0 flex-col justify-center gap-6 overflow-y-auto border-s border-line-default px-10 py-10 short:gap-4 short:py-6 tablet:gap-3 tablet:border-s-0 tablet:border-t tablet:px-6 tablet:py-4">
        <figure className="m-0 flex flex-col gap-4 tablet:hidden">
          <blockquote className="m-0 text-24 leading-snug">{p.sponsor.quote}</blockquote>
          <figcaption className="flex items-center gap-3">
            {p.sponsor.img ? <img src={p.sponsor.img} alt="" className="size-10 rounded-round object-cover object-top" /> : <span aria-hidden="true" className="flex size-10 items-center justify-center rounded-round bg-brand text-13 font-700 text-brand-deep-space">{p.sponsor.initials}</span>}
            <span className="flex flex-col text-14"><b>{p.sponsor.name}</b><span className="text-fg-secondary">{p.sponsor.title}</span></span>
          </figcaption>
        </figure>
        <div className="il-reveal-later flex flex-col items-stretch gap-2 border-t border-line-default pt-6 short:pt-4 tablet:border-t-0 tablet:pt-0" data-intro-start="">
          <button type="button" onClick={p.onStart} className={PRIMARY}>{t('intro.objectives.start')}<Arrow /></button>
          <span className="text-center text-13 text-fg-secondary">{t('intro.objectives.startNote')}</span>
        </div>
        <section aria-labelledby={ids.mic} className="flex flex-col gap-3 border-t border-line-default pt-6 short:pt-4">
          <h2 id={ids.mic} className={LABEL}>{t('intro.mic.title')}</h2>
          <Suspense fallback={null}><MicCheck onHeard={p.onVoice} onText={p.onText} /></Suspense>
        </section>
      </aside>
    </main>
  );
}
