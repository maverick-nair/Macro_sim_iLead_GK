import { useEffect, useState, type RefObject } from 'react';
import type { EngineView } from '../../../engine/contract';
import { useUi } from '../../../app/uiStore';
import type { PlayPanel } from '../../panels/PlayPanels';
import type { SheetTab } from '../TabletBoard';

/** The action being planned: which drawer card is chosen, who is picked, and whether the nudge was waved off. */
export interface Flow { key: string; choice: string | null; picks: string[]; nudgeOk: boolean }

/**
 * What is open over the board: the action being planned, the in play panels (D89), the legend, the score
 * breakdown, the sponsor meter, the badge shelf, the command palette, the tablet's actions drawer (D73), a
 * decision (D137) and the stakeholders panel (D162). The keys that open and close them are bound here.
 */
export function usePanels({ paletteOk }: { paletteOk: RefObject<boolean> }) {
  const [flow, setFlow] = useState<Flow | null>(null);
  /** The in play panel that is open (D89), if any. */
  const [panel, setPanel] = useState<PlayPanel | null>(null);
  const [legend, setLegend] = useState(false);
  const [scoreOpen, setScoreOpen] = useState(false);
  const [sponsorOpen, setSponsorOpen] = useState(false);
  const [badgesOpen, setBadgesOpen] = useState(false);
  const [pal, setPal] = useState(false);
  const [query, setQuery] = useState('');
  /** A choice opened from the business bar, and a choice just decided whose outcome the dialog is showing (D137). */
  const [deciding, setDeciding] = useState<string | null>(null);
  const [decided, setDecided] = useState<EngineView['openChoices'][number] | null>(null);
  /** The stakeholders panel (D162), open on one of them or on all. */
  const [stakeholdersOpen, setStakeholdersOpen] = useState<{ focus: string | null } | null>(null);
  /** The tablet's actions drawer: which tab is open, or null when it is closed (D73). */
  const [sheet, setSheet] = useState<SheetTab | null>(null);
  /** The drawer is lowered so people can be picked on the board. */
  const [lowered, setLowered] = useState(false);
  /** The tablet board's code has loaded and it is on screen. */
  const [tabletReady, setTabletReady] = useState(false);
  /** Selecting someone opens a folded Actions panel for them; folding it again while they are selected leaves it folded. */
  const [foldedFor, setFoldedFor] = useState<string | null>(null);

  // Keys. The palette (Ctrl or Cmd K) is for the plain board only: not during style setting, a
  // conversation, or with a modal open. The handler reads the store directly so it never re-binds.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        if (!paletteOk.current) return;
        e.preventDefault(); setQuery(''); setPal(true);
      }
      if (e.key === 'Escape') { setFlow(null); setLegend(false); setSheet(null); setLowered(false); useUi.getState().openPanel('none'); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [paletteOk]);

  const openPalette = () => { setQuery(''); setPal(true); };
  const closePalette = () => setPal(false);
  const toggleLegend = () => setLegend(l => !l);
  const toggleSponsor = () => setSponsorOpen(o => !o);
  return {
    flow, setFlow, panel, setPanel, legend, toggleLegend, scoreOpen, setScoreOpen, sponsorOpen, setSponsorOpen, toggleSponsor, badgesOpen, setBadgesOpen,
    pal, query, setQuery, openPalette, closePalette, deciding, setDeciding, decided, setDecided, stakeholdersOpen, setStakeholdersOpen,
    sheet, setSheet, lowered, setLowered, tabletReady, setTabletReady, foldedFor, setFoldedFor
  };
}
