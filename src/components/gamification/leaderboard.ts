import { useEffect, useState } from 'react';
import { useApi } from '../../api';
import type { Leaderboard, LeaderboardResult } from '../../api/types';
import type { EngineView } from '../../engine/contract';

/**
 * The cohort leaderboard (scoring-and-report.md 6; Configuration Spec, Leaderboard). Ranks come from
 * the cohort API, which places this participant among the others and breaks ties; the UI never ranks.
 */

export interface LeaderboardRequest { size: number; anonymous: boolean; you: LeaderboardResult }

/**
 * What to ask the cohort API for, or null when the leaderboard is off (selection use, or authored off).
 * `you` is this participant's own result: the Leadership Score, the run's conversions (the report's
 * once the run has ended; during play the weeks' funnel output so far, rounded down) and contextual
 * capability %.
 */
export function leaderboardRequest(view: Pick<EngineView, 'gamification' | 'score' | 'report' | 'periods'>): LeaderboardRequest | null {
  const lb = view.gamification.leaderboard;
  if (!lb.enabled) return null;
  const conversions = view.report?.results.conversions ?? Math.floor(view.periods.reduce((s, p) => s + p.week.funnel.output, 0));
  return { size: lb.size, anonymous: lb.anonymous, you: { score: view.score.total, conversions, capability: view.score.capability } };
}

/**
 * The leaderboard for this view, fetched on mount and again when this participant's result changes.
 * Null before the first answer, on error (the caller simply leaves it out) and when the leaderboard is
 * off. While a newer result is on its way the last answer stays.
 */
export function useLeaderboard(view: Pick<EngineView, 'gamification' | 'score' | 'report' | 'periods'>): Leaderboard | null {
  const api = useApi();
  const req = leaderboardRequest(view);
  const key = req && JSON.stringify(req);
  const [board, setBoard] = useState<Leaderboard | null>(null);
  useEffect(() => {
    if (!key) return;
    let live = true;
    api.getLeaderboard(JSON.parse(key) as LeaderboardRequest).then(
      b => { if (live) setBoard(b); },
      () => { if (live) setBoard(null); }
    );
    return () => { live = false; };
  }, [api, key]);
  return key ? board : null;
}
