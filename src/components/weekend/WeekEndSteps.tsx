import { useId } from 'react';
import { NoWrapButton } from '../../ds/Button';
import { useI18n } from '../../i18n';
import { BadgeAward } from '../gamification/Badge';
import { StarMeter } from '../gamification/StarMeter';
import { onRovingKey } from '../roving';
import { badgeIcon } from './badgeIcons';
import { newsArt, REWARD_ART } from './display';
import type { PeriodUnit, WeekEndBadge, WeekEndNews, WeekEndReward } from './types';
import './messages';

export const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-secondary';
const EYEBROW = 'text-12 font-700 tracking-(--il-gamification-eyebrow-tracking) text-accent-secondary uppercase';
/** Step headings take focus when the step changes, so keyboard and screen reader users start at the top. */
const HEADING = 'm-0 font-700 outline-none';
const ENTER = 'animate-(--il-weekend-enter)';

export interface WeekEndHeaderProps {
  period: number;
  periods: number;
  periodUnit: PeriodUnit;
  /** The prototype's shortcut to the end of the run, in the design gallery only. */
  onShortcut?: () => void;
}

/** Logo and where the run stands: "Week 2 of 8 · Week end". */
export function WeekEndHeader({ period, periods, periodUnit, onShortcut }: WeekEndHeaderProps) {
  const { t } = useI18n();
  return (
    <header className="flex items-center gap-4">
      <span className="bg-(image:--il-fill-brand) bg-clip-text text-22 font-700 tracking-(--il-weekend-logo-tracking) text-transparent">{t('hud.logo')}</span>
      <span className="text-13 text-fg-secondary">{t('weekend.header', { unit: periodUnit, n: period, total: periods })}</span>
      <span className="flex-1"></span>
      {onShortcut && (
        <button type="button" onClick={onShortcut} className={`cursor-pointer border-0 bg-transparent px-1.5 py-0.25 text-12 font-600 text-fg-secondary ${FOCUS}`}>
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

/** "End of week 2": the engine's headline, the stars earned and one line on how it went. */
export function BannerStep({ period, periodUnit, headline, line, stars, onNext }: BannerStepProps) {
  const { t } = useI18n();
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
      <div aria-hidden="true" className="absolute top-(--il-weekend-glow-top) left-1/2 size-140 -translate-x-1/2 -translate-y-1/2 rounded-round bg-(image:--il-weekend-glow-fill)"></div>
      <span className={`relative ${EYEBROW}`}>{t('weekend.banner.eyebrow', { unit: periodUnit, n: period })}</span>
      <h1 tabIndex={-1} className={`${HEADING} relative text-64 leading-none tracking-(--il-weekend-display-tracking)`}>{headline}</h1>
      <StarMeter earned={stars} total={3} />
      <p className="relative m-0 max-w-140 text-17 text-pretty text-fg-secondary">{line}</p>
      <div className="relative">
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
      <h1 tabIndex={-1} className={`${HEADING} text-40 tracking-(--il-weekend-title-tracking)`}>{t('weekend.unlock.title', { unit: periodUnit, n: period })}</h1>
      <div role="radiogroup" aria-label={t('weekend.unlock.aria')} className="grid grid-cols-(--il-weekend-reward-columns) gap-4">
        {rewards.map((r, i) => {
          const on = chosen === i;
          return (
            <button key={r.key} type="button" role="radio" aria-checked={on} tabIndex={on || (chosen === null && i === 0) ? 0 : -1}
              onClick={() => onChoose(i)} onKeyDown={e => onRovingKey(e, i, rewards.length, onChoose)}
              className={`flex cursor-pointer flex-col gap-2.5 rounded-24 border-2 border-solid p-5 text-left text-fg-primary [transition:var(--il-weekend-reward-transition)] ${FOCUS} ${on ? 'border-accent-secondary bg-accent-soft [transform:var(--il-weekend-reward-lift)]' : 'border-line-default bg-surface-card'}`}>
              <span aria-hidden="true" className={`h-22.5 rounded-16 ${REWARD_ART[i % REWARD_ART.length]}`}></span>
              <b className="text-17">{r.name}</b>
              <span className="text-13 text-fg-secondary">{r.description}</span>
            </button>
          );
        })}
      </div>
      <NoWrapButton variant="primary" size="lg" disabled={chosen === null || busy} onClick={onTake}>{t('weekend.unlock.take')}</NoWrapButton>
    </div>
  );
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
      <article aria-labelledby={`${id}title`} className="w-180 max-w-full overflow-hidden rounded-28 border border-line-strong bg-surface-material">
        <div className={`relative h-55 ${newsArt(news.card)}`}>
          {artLabel && <span className="absolute top-3.5 left-4.5 text-12 font-700 text-brand-deep-space">{artLabel}</span>}
        </div>
        <div className="flex flex-col gap-2.5 px-6 py-5.5">
          <h2 id={`${id}title`} className="m-0 text-26 font-700 tracking-(--il-weekend-title-tracking)">{news.title}</h2>
          <p className="m-0 text-fg-secondary">{news.body}</p>
          {impact && news.impact && <div id={`${id}impact`} className="rounded-14 bg-surface-raised p-3 text-13">{news.impact}</div>}
          <div className="flex items-center gap-2.5">
            {news.impact && (
              <button type="button" aria-expanded={impact} aria-controls={impact ? `${id}impact` : undefined} onClick={onImpact}
                className={`cursor-pointer border-0 bg-transparent p-0 text-13 font-700 text-accent-secondary ${FOCUS}`}>
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
