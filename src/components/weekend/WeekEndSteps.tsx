import { useId } from 'react';
import { NoWrapButton } from '../../ds/Button';
import { useI18n } from '../../i18n';
import { BadgeAward } from '../gamification/Badge';
import { StarMeter } from '../gamification/StarMeter';
import { onRovingKey } from '../roving';
import { badgeIcon } from './badgeIcons';
import { newsArt, newsKind, REWARD_ART } from './display';
import type { ReactNode } from 'react';
import type { PeriodUnit, WeekEndBadge, WeekEndNews, WeekEndReward, WeekEndStep } from './types';
import './messages';
import { ILeadLogo } from '../shell/Logo';

export const FOCUS = 'focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accent-secondary';
const EYEBROW = 'text-12 font-600 tracking-(--il-tracking-eyebrow-wide) text-accent-secondary uppercase';
/** Step headings take focus when the step changes, so keyboard and screen reader users start at the top. */
const HEADING = 'm-0 font-600 outline-none';
const ENTER = 'animate-(--il-weekend-enter)';

export interface WeekEndHeaderProps {
  period: number;
  periods: number;
  periodUnit: PeriodUnit;
  /** The prototype's shortcut to the end of the run, in the design gallery only. */
  onShortcut?: () => void;
  /** The flow's steps and the one showing, as the canvas's row of tabs (D232). Not links: the flow moves on with its own buttons. */
  steps?: WeekEndStep[];
  step?: WeekEndStep;
  /** The storyline's organisation, as on the desk; the iLead logo without one. */
  organisation?: string | null;
  /** Revenue and score at the end, as on the desk. */
  status?: ReactNode;
}

/** The navy bar: the organisation, where the run stands ("Week 2 of 8 · Week end"), the steps, and the numbers. */
export function WeekEndHeader({ period, periods, periodUnit, onShortcut, steps = [], step, organisation, status }: WeekEndHeaderProps) {
  const { t } = useI18n();
  return (
    <header className="il-chrome flex min-h-16 flex-wrap items-center gap-x-6 px-8 tablet:px-5">
      {organisation ? <span className="font-serif text-22 leading-none">{organisation}</span> : <ILeadLogo size="sm" />}
      <span className="text-14 text-fg-body">{t('weekend.header', { unit: periodUnit, n: period, total: periods })}</span>
      {steps.length > 1 && (
        <ol aria-label={t('weekend.steps.aria')} className="m-0 flex list-none flex-wrap self-stretch p-0">
          {steps.map(s => (
            <li key={s} aria-current={s === step ? 'step' : undefined}
              className={`flex min-h-16 items-center border-b-2 px-3 text-14 ${s === step ? 'border-(--il-color-canvas-mint) text-fg-primary' : 'border-transparent text-fg-secondary'}`}>
              {t('weekend.step', { step: s, unit: periodUnit })}
            </li>
          ))}
        </ol>
      )}
      <span className="flex-1"></span>
      {status}
      {onShortcut && (
        <button type="button" onClick={onShortcut} className={`min-h-11 cursor-pointer border-0 bg-transparent px-1.5 py-0 text-13 font-500 text-fg-secondary ${FOCUS}`}>
          {t('weekend.shortcut')}
        </button>
      )}
    </header>
  );
}

export interface BannerStepProps {
  period: number;
  periodUnit: PeriodUnit;
  /** Engine text (D60). */
  headline: string;
  line: string;
  stars: number;
  onNext: () => void;
}

/** The canvas's lounge at the end of the day (D232), behind the banner on the right. */
export const LOUNGE = '/assets/lounge.webp';

/**
 * "End of week 2": the canvas's navy hero (D232), in both modes. The engine's headline in the
 * display serif, the stars earned and one line on how it went, left aligned, with the lounge
 * photo fading in on the right.
 */
export function BannerStep({ period, periodUnit, headline, line, stars, onNext }: BannerStepProps) {
  const { t } = useI18n();
  return (
    <div className="il-scheme-dark relative flex flex-1 overflow-hidden bg-(--il-color-canvas-navy) text-fg-primary">
      <div aria-hidden="true" className="absolute inset-y-0 end-0 w-(--il-canvas-lounge-width) tablet-portrait:hidden">
        <img src={LOUNGE} alt="" className="size-full object-cover" />
        <div className="absolute inset-0 bg-(image:--il-canvas-fade-lounge) rtl:bg-(image:--il-canvas-fade-lounge-rtl)"></div>
      </div>
      <div className="relative flex max-w-(--il-canvas-measure-hero) flex-col items-start justify-center gap-6 px-11 py-12 tablet:px-8">
        <span className={EYEBROW}>{t('weekend.banner.eyebrow', { unit: periodUnit, n: period })}</span>
        <h1 tabIndex={-1} className="m-0 font-display text-58 leading-(--il-canvas-leading-display) font-400 text-balance outline-none">{headline}</h1>
        <StarMeter earned={stars} total={3} />
        <p className="m-0 max-w-140 text-17 leading-relaxed text-pretty text-fg-body">{line}</p>
        <NoWrapButton variant="primary" size="lg" onClick={onNext}>{t('weekend.banner.cta', { unit: periodUnit })}</NoWrapButton>
      </div>
    </div>
  );
}

export interface BadgeStepProps {
  badge: WeekEndBadge;
  index: number;
  total: number;
  /** Skip the rest of the badges. */
  onSkip: () => void;
  onNext: () => void;
}

/** One newly earned badge, of however many this period brought. */
export function BadgeStep({ badge, index, total, onSkip, onNext }: BadgeStepProps) {
  const { t } = useI18n();
  return (
    <div className="flex flex-1 items-center justify-center">
      <h1 className="sr-only">{t('weekend.badges.heading', { n: total })}</h1>
      <BadgeAward name={badge.name} reason={badge.reason} icon={badgeIcon(badge.rule)} index={index} total={total} onSkip={onSkip} onContinue={onNext} />
    </div>
  );
}

export interface UnlockStepProps {
  sponsorFirstName: string;
  /** The period the reward is for. */
  period: number;
  periodUnit: PeriodUnit;
  rewards: WeekEndReward[];
  chosen: number | null;
  busy?: boolean;
  onChoose: (index: number) => void;
  onTake: () => void;
}

/** The sponsor's confidence crossed the unlock line: pick one reward. Nothing goes on until one is taken. */
export function UnlockStep({ sponsorFirstName, period, periodUnit, rewards, chosen, busy, onChoose, onTake }: UnlockStepProps) {
  const { t } = useI18n();
  return (
    <div className={`flex flex-1 flex-col items-center justify-center gap-5.5 ${ENTER}`}>
      <span className={EYEBROW}>{t('weekend.unlock.eyebrow', { name: sponsorFirstName })}</span>
      <h1 tabIndex={-1} className={`${HEADING} font-display text-48 leading-tight font-400`}>{t('weekend.unlock.title', { unit: periodUnit, n: period })}</h1>
      <div role="radiogroup" aria-label={t('weekend.unlock.aria')} className="grid grid-cols-(--il-weekend-reward-columns) gap-4">
        {rewards.map((r, i) => {
          const on = chosen === i;
          return (
            <button key={r.key} type="button" role="radio" aria-checked={on} tabIndex={on || (chosen === null && i === 0) ? 0 : -1}
              onClick={() => onChoose(i)} onKeyDown={e => onRovingKey(e, i, rewards.length, onChoose)}
              className={`flex cursor-pointer flex-col gap-2.5 rounded-4 border-solid p-5 text-start text-fg-primary [transition:var(--il-weekend-reward-transition)] ${FOCUS} ${on ? 'border-2 border-accent-default bg-surface-card p-4.75' : 'border border-line-strong bg-surface-card'}`}>
              <span aria-hidden="true" className={`h-22.5 ${REWARD_ART[i % REWARD_ART.length]}`}></span>
              <b className="font-serif text-21 font-400">{r.name}</b>
              <span className="text-14 text-fg-body">{r.description}</span>
            </button>
          );
        })}
      </div>
      <NoWrapButton variant="primary" size="lg" disabled={chosen === null || busy} onClick={onTake}>{t('weekend.unlock.take')}</NoWrapButton>
    </div>
  );
}

const ART_ICON = 'size-16 opacity-40';
/** The fallback illustration for a bulletin, by kind, in the stroke style of the other inline icons. */
function NewsArtIcon({ kind }: { kind: ReturnType<typeof newsKind> }) {
  const svg = { className: ART_ICON, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '2', strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const;
  switch (kind) {
    case 'opportunity':
      return <svg {...svg}><path d="M3 17 9 11l4 4 8-8" /><path d="M15 7h6v6" /></svg>;
    case 'signal':
      return <svg {...svg}><path d="M3 12h4l3-8 4 16 3-8h4" /></svg>;
    case 'crisis':
      return <svg {...svg}><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>;
    default:
      return <svg {...svg}><path d="M4 4h13a2 2 0 0 1 2 2v14H6a2 2 0 0 1-2-2z" /><path d="M19 9h2v9a2 2 0 0 1-2 2" /><path d="M8 8h7M8 12h7M8 16h4" /></svg>;
  }
}

export interface NewsStepProps {
  /** The period the news is for. */
  period: number;
  periodUnit: PeriodUnit;
  news: WeekEndNews;
  index: number;
  total: number;
  impact: boolean;
  /** A note over the art, as the design marks where GenieKreator's illustration goes. */
  artLabel?: string;
  nextLabel: string;
  busy?: boolean;
  onImpact: () => void;
  onPrevious: () => void;
  onNext: () => void;
}

/** One bulletin for the next period, with See impact when the engine says what it will change. */
export function NewsStep({ period, periodUnit, news, index, total, impact, artLabel, nextLabel, busy, onImpact, onPrevious, onNext }: NewsStepProps) {
  const { t } = useI18n();
  const id = useId();
  return (
    <div className={`flex flex-1 flex-col items-center justify-center gap-5 ${ENTER}`}>
      <h1 tabIndex={-1} className={`${HEADING} ${EYEBROW}`}>{t('weekend.news.eyebrow', { unit: periodUnit, n: period, index: index + 1, total })}</h1>
      <article aria-labelledby={`${id}title`} className="w-180 max-w-full overflow-hidden rounded-4 border border-line-strong bg-surface-card">
        <div className={`relative flex h-40 items-center justify-center text-button-on-solid ${newsArt(news.card)}`}>
          <NewsArtIcon kind={newsKind(news.card)} />
          {artLabel
            ? <span className="absolute top-3.5 start-4.5 text-12 font-600">{artLabel}</span>
            : <span className="absolute top-3.5 start-4.5 rounded-full border border-current px-2.5 py-0.5 text-12 font-600">{t('weekend.news.kind', { kind: newsKind(news.card) })}</span>}
        </div>
        <div className="flex flex-col gap-2.5 px-6 py-5.5">
          <h2 id={`${id}title`} className="m-0 font-display text-36 leading-tight font-400">{news.title}</h2>
          <p className="m-0 text-15 leading-normal text-fg-body">{news.body}</p>
          {impact && news.impact && <div id={`${id}impact`} className="border-s-2 border-accent-default bg-surface-page p-3 text-14">{news.impact}</div>}
          <div className="flex items-center gap-2.5">
            {news.impact && (
              <button type="button" aria-expanded={impact} aria-controls={impact ? `${id}impact` : undefined} onClick={onImpact}
                className={`min-h-11 cursor-pointer rounded-4 border border-line-strong bg-surface-card px-3.5 py-0 text-14 font-500 text-fg-primary ${FOCUS}`}>
                {t('weekend.news.impact')}
              </button>
            )}
            <span className="flex-1"></span>
            <NoWrapButton variant="secondary" size="md" disabled={index === 0} onClick={onPrevious}>{t('weekend.news.previous')}</NoWrapButton>
            <NoWrapButton variant="primary" size="md" disabled={busy} onClick={onNext}>{nextLabel}</NoWrapButton>
          </div>
        </div>
      </article>
    </div>
  );
}
