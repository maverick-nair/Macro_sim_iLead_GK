import type { I18n } from '../../i18n';
import type { PeriodUnit } from '../action/days';

/**
 * Display mappings for the game scores. They word engine values and place them against thresholds
 * the engine sends; they never compute a score, a star or a bonus.
 */

export interface StreakFacts {
  /** Periods in a row at `minStars` or more (`view.streak`). */
  count: number;
  /** Periods still needed for the next bonus, from the last period summary; null once the cap is reached; undefined before any period has ended. */
  next: number | null | undefined;
  periodUnit: PeriodUnit;
  /** The authored rule (`view.gamification.streak`). */
  rule: { length: number; minStars: number; bonus: number; cap: number };
}

/**
 * The streak in one sentence, in the period unit: "2 weeks in a row. 1 more week for a +25 bonus."
 * Before any period has ended, or with no streak running, it states the rule instead.
 */
export function streakText(t: I18n['t'], s: StreakFacts): string {
  const unit = s.periodUnit;
  const count = t('score.streak.count', { n: s.count, unit });
  const start = t('score.streak.start', { length: s.rule.length, unit, stars: s.rule.minStars, bonus: s.rule.bonus });
  const next = s.next === null ? t('score.streak.capped', { cap: s.rule.cap })
    : s.next === undefined || s.count === 0 ? start
    : t('score.streak.next', { n: s.next, unit, bonus: s.rule.bonus });
  return t('score.streak.sentence', { count, next: next.charAt(0).toUpperCase() + next.slice(1) });
}

export interface Tier { key: string; name: string; min: number }

/**
 * The tier a total falls in, by the engine's thresholds (highest first, the last starts at 0). Once
 * the run has ended the engine names the tier itself, and that one wins.
 */
export function currentTier(total: number, tiers: Tier[], final?: { key: string } | null): string | null {
  if (final) return final.key;
  return (tiers.find(x => total >= x.min) ?? tiers[tiers.length - 1])?.key ?? null;
}

export interface ShelfBadge { key: string; rule: string; name: string; description: string; earned: boolean; period: number | null; reason: string | null }

/** Earned badges first, in the order they were earned; then the rest in the library's order. */
export function shelfOrder<B extends ShelfBadge>(badges: B[]): B[] {
  const earned = badges.filter(b => b.earned).map((b, i) => ({ b, i })).sort((x, y) => (x.b.period ?? 0) - (y.b.period ?? 0) || x.i - y.i).map(x => x.b);
  return [...earned, ...badges.filter(b => !b.earned)];
}

/** Two letters for a name without a portrait: "Paula Jacob" is PJ. */
export const initials = (name: string) => name.split(/\s+/).filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase();
