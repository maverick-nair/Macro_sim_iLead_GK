import type { I18n } from '../../i18n';
import type { PeriodUnit } from '../action/days';

/**
 * How a person is delivering, for the line on their card (D241): their result's band and how far it moved this
 * period. A rule on the result alone, never the lens's need, so the line is a cue and never names the style that fits.
 * Pure, so it is unit tested.
 */

export type PerformanceBand = 'strong' | 'steady' | 'below' | 'struggling';

/** From 75 strong, from 55 steady, from 40 below par, else struggling. */
export function performanceBand(result: number): PerformanceBand {
  return result >= 75 ? 'strong' : result >= 55 ? 'steady' : result >= 40 ? 'below' : 'struggling';
}

/**
 * The result's move since this period started, from the engine's trend (each period's start, then now), or null
 * without two points. A move under 2 either way reads as holding.
 */
export function performanceMove(trend: ReadonlyArray<number | null> | undefined): number | null {
  if (!trend || trend.length < 2) return null;
  const start = trend[trend.length - 2], now = trend[trend.length - 1];
  if (start === null || now === null) return null;
  const move = Math.round(now - start);
  return Math.abs(move) < 2 ? 0 : move;
}

export interface Performance {
  /** In words, for screen readers and the profile: "Below par · down 4 this week". */
  text: string;
  /** On the card: "Below par", then the move as "▼4" in its colour. */
  band: string;
  move: string;
  dir: 'up' | 'down' | 'flat';
}

export function performance(t: I18n['t'], result: number, trend: ReadonlyArray<number | null> | undefined, unit: PeriodUnit): Performance {
  const m = performanceMove(trend);
  const dir = m ? (m > 0 ? 'up' : 'down') : 'flat';
  const n = Math.abs(m ?? 0);
  const band = performanceBand(result);
  return { text: t('desk.card.performance', { band, dir, n, unit }), band: t('desk.card.band', { band }), move: t('desk.card.move', { dir, n }), dir };
}
