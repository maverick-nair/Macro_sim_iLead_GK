import type { I18n } from '../../i18n';
import type { FunnelView, PeriodUnit, SponsorLevel, WeekEndFunnel, WeekEndNews } from './types';
import './messages';

/**
 * Display mappings for the week end. None of these decides an outcome: they turn engine values into
 * words, bar lengths and art, using the thresholds the engine sends.
 */

const LEVELS: SponsorLevel[] = ['low', 'wavering', 'steady', 'confident', 'champion'];
/** How many levels the sponsor moved, and which way. */
export function levelSteps(from: SponsorLevel, to: SponsorLevel): { steps: number; dir: 'up' | 'down' | 'same' } {
  const d = LEVELS.indexOf(to) - LEVELS.indexOf(from);
  return { steps: Math.abs(d), dir: d > 0 ? 'up' : d < 0 ? 'down' : 'same' };
}

/** Funnel counts as shown: whole numbers from 10, one decimal below (the engine keeps fractions). */
export function funnelNumber(n: number): number {
  return n >= 10 ? Math.round(n) : Math.round(n * 10) / 10;
}

/** Bar length for a funnel value: a share of the track, 0 to 100. */
export function barPercent(value: number, scale: number): number {
  if (!(scale > 0)) return 0;
  return Math.max(0, Math.min(100, Math.round((value / scale) * 100)));
}

/** The track length for a set of funnel values: the largest value or ideal plus a little room, as in the design. */
export function funnelScale(values: number[]): number {
  const max = Math.max(0, ...values);
  return max > 0 ? max * 1.1 : 1;
}

/** The values a funnel row shows in a view. */
export function funnelRow(stage: WeekEndFunnel['stages'][number], view: FunnelView) {
  return view === 'total' && stage.total ? stage.total : { value: stage.value, ideal: stage.ideal };
}

/** The streak card's note: the rule, then where the streak stands (earned now, how far to the next bonus, or maxed). */
export function streakNote(
  { t }: Pick<I18n, 't'>,
  streak: { count: number; bonus: number; next: number | null },
  rules: { minStars: number; bonus: number },
  unit: PeriodUnit
): string {
  const parts = [t('weekend.streak.rule', { unit, min: rules.minStars })];
  if (streak.bonus > 0) parts.push(t('weekend.streak.earned', { bonus: streak.bonus }));
  if (streak.next === null) parts.push(t('weekend.streak.maxed'));
  else parts.push(t('weekend.streak.next', { next: streak.next, unit, bonus: rules.bonus }));
  return parts.join(' ');
}

/** The art behind a news bulletin, by card type. */
export function newsArt(card: WeekEndNews['card']): string {
  switch (card) {
    case 'opportunity':
    case 'signal':
      return 'bg-(image:--il-weekend-news-art-mint)';
    case 'crisis':
      return 'bg-(image:--il-weekend-news-art-warm)';
    default:
      return 'bg-(image:--il-weekend-news-art-blue)';
  }
}

/** The art on a reward card, by its place in the offer, as the design shows three. */
export const REWARD_ART = ['bg-(image:--il-weekend-reward-art-1)', 'bg-(image:--il-weekend-reward-art-2)', 'bg-(image:--il-weekend-reward-art-3)'];
