import type { EngineView } from '../../engine/contract';
import { useI18n } from '../../i18n';
import { useLeaderboard } from './leaderboard';

/**
 * One line in the score breakdown during play: "Rank 3 of 15 in your cohort". Fetched when the
 * breakdown opens (it mounts with it); nothing shows while loading, on error or when the leaderboard
 * is off. The rank is the server's. Loaded on demand, so the board's first load stays in budget.
 */
export default function CohortRank({ view }: { view: Pick<EngineView, 'gamification' | 'score' | 'report' | 'periods'> }) {
  const { t } = useI18n();
  const board = useLeaderboard(view);
  const you = board?.entries.find(e => e.you);
  if (!board || !you) return null;
  return <b className="text-12 font-700">{t('score.rank', { rank: you.rank, total: board.total, scope: view.gamification.leaderboard.scope })}</b>;
}
