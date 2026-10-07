import type { EngineView } from '../../engine/contract';
import { useI18n } from '../../i18n';
import { CohortPanel } from '../end/CohortPanel';
import { cohortRows } from '../end/cohort';
import { useLeaderboard } from '../gamification/leaderboard';
import { PanelShell } from './PanelShell';

export interface LeaderboardPanelProps {
  view: Pick<EngineView, 'gamification' | 'score' | 'report' | 'periods'>;
  onClose: () => void;
  returnFocus?: () => HTMLElement | null | undefined;
}

/**
 * The leaderboard during play (D89), when the storyline has it on: the cohort table the end screen shows,
 * ranked by the server (the UI never ranks). Loading and errors say so in words.
 */
export function LeaderboardPanel({ view, onClose, returnFocus }: LeaderboardPanelProps) {
  const { t } = useI18n();
  const lb = view.gamification.leaderboard;
  const board = useLeaderboard(view);
  return (
    <PanelShell title={t('panels.leaderboard.title')} intro={t('panels.leaderboard.intro', { scope: lb.scope })} onClose={onClose} returnFocus={returnFocus}>
      {board
        ? <CohortPanel scope={lb.scope} size={lb.size} {...cohortRows(t, board, view.gamification.tiers, lb.size)} />
        : <p role="status" className="m-0 text-14 text-fg-secondary">{t('panels.leaderboard.loading')}</p>}
    </PanelShell>
  );
}
