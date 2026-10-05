import type { Leaderboard } from '../../api/types';
import type { I18n } from '../../i18n';
import { currentTier, type Tier } from '../gamification/display';
import './messages';

/** One row of the cohort table. Rank and order are the server's (it breaks ties); nothing is ranked here. */
export interface CohortRow {
  rank: number;
  /** The person's name, or "A colleague" when anonymous. Null for this participant when their name is not known (the row says You). */
  name: string | null;
  you: boolean;
  /** Leadership Score, rounded for display. */
  score: number;
  /** The tier the score falls in, by the engine's thresholds. */
  tier: string;
}

export interface Cohort {
  /** The top N, in the server's order. */
  top: CohortRow[];
  /** This participant's own row when outside the top N, else null. */
  outside: CohortRow | null;
  /** This participant's place, for "Rank 14 of 15"; null if the server left them out. */
  you: { rank: number; total: number } | null;
}

/**
 * The cohort table from the leaderboard API: the top `size` as sent, and this participant's own row
 * apart when the server appends it after the top. `tiers` are the engine's, highest first.
 */
export function cohortRows(t: I18n['t'], board: Leaderboard, tiers: Tier[], size: number): Cohort {
  const row = (e: Leaderboard['entries'][number]): CohortRow => {
    const key = currentTier(e.score, tiers);
    return {
      rank: e.rank,
      name: e.name ?? (e.you ? null : t('end.cohort.colleague')),
      you: e.you,
      score: Math.round(e.score),
      tier: tiers.find(x => x.key === key)?.name ?? ''
    };
  };
  const rows = board.entries.map(row);
  const top = rows.slice(0, size);
  const mine = rows.find(r => r.you) ?? null;
  return {
    top,
    outside: mine && !top.includes(mine) ? mine : null,
    you: mine ? { rank: mine.rank, total: board.total } : null
  };
}
