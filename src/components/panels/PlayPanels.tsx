import type { EngineView } from '../../engine/contract';
import { ActionsListPanel } from './ActionsListPanel';
import { HistoryPanel } from './HistoryPanel';
import type { HistoryFilter } from './history';
import { LeaderboardPanel } from './LeaderboardPanel';
import { ObjectivesPanel } from './ObjectivesPanel';
import { OverviewPanel } from './OverviewPanel';
import { TutorialPanel } from './TutorialPanel';
import './messages';

/** Which in play panel is open (D89). */
export type PlayPanel =
  | { kind: 'objectives' }
  | { kind: 'tutorial' }
  | { kind: 'history'; filter?: Partial<HistoryFilter> }
  | { kind: 'overview'; tab?: 'results' | 'stages' }
  | { kind: 'leaderboard' }
  | { kind: 'actions' };

export interface PlayPanelsProps {
  panel: PlayPanel;
  view: EngineView;
  nameOf: (id: string) => string | null;
  availability: Record<string, string>;
  onClose: () => void;
  onTour?: () => void;
  returnFocus?: () => HTMLElement | null | undefined;
}

/**
 * The in play panels, loaded on demand with their copy (D89): the board's first load carries only the
 * menu that opens them.
 */
export default function PlayPanels({ panel, view, nameOf, availability, onClose, onTour, returnFocus }: PlayPanelsProps) {
  const common = { onClose, returnFocus };
  switch (panel.kind) {
    case 'objectives': return <ObjectivesPanel view={view} {...common} />;
    case 'tutorial': return <TutorialPanel view={view} onTour={onTour} {...common} />;
    case 'history': return <HistoryPanel view={view} nameOf={nameOf} initial={panel.filter} {...common} />;
    case 'overview': return <OverviewPanel view={view} tab={panel.tab} {...common} />;
    case 'leaderboard': return <LeaderboardPanel view={view} {...common} />;
    case 'actions': return <ActionsListPanel view={view} availability={availability} {...common} />;
  }
}
