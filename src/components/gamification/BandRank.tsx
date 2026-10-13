import type { EngineView } from '../../engine/contract';
import { useI18n } from '../../i18n';
import { useLeaderboard } from './leaderboard';

export interface BandRankProps {
  view: Pick<EngineView, 'gamification' | 'score' | 'report' | 'periods'>;
  onOpen: () => void;
}

/**
 * The rank in the desk's status band (D211, D215): "Rank 6 of 24", a way to the leaderboard. The rank is
 * the cohort API's; until it answers (or when it cannot) the button reads Leaderboard, so the way there
 * never depends on the network. Loaded on demand, only when the storyline turns the leaderboard on.
 */
export default function BandRank({ view, onOpen }: BandRankProps) {
  const { t, number } = useI18n();
  const board = useLeaderboard(view);
  const you = board?.entries.find(e => e.you);
  const values = you && board ? { known: 'yes', rank: number(you.rank), total: number(board.total) } : { known: 'no', rank: '', total: '' };
  return (
    <button type="button" onClick={onOpen} aria-label={t('desk.rank.aria', values)} data-band-rank=""
      className="inline-flex min-h-6 cursor-pointer items-center self-start rounded-4 border-0 bg-transparent p-0 text-13 font-600 whitespace-nowrap text-fg-primary underline decoration-line-control underline-offset-3 hover:decoration-fg-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-secondary">
      {t('desk.rank', values)}
    </button>
  );
}
