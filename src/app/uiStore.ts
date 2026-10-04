import { create } from 'zustand';

/**
 * UI only state: what is selected and open. Nothing here affects outcomes; the engine view is the
 * single source of truth for the simulation (brief, rule 1).
 */
export type Panel = 'none' | 'inbox' | 'history' | 'profile' | 'palette';

export interface UiState {
  selectedIds: string[];
  actionKey: string | null;
  optionKey: string | null;
  panel: Panel;
  profileId: string | null;
  messageId: string | null;
  interactionId: string | null;
  whyOpen: string | null;
  showNumbers: boolean;
  toggleMember(id: string, multi?: boolean): void;
  chooseAction(key: string | null, option?: string | null): void;
  openPanel(panel: Panel, ref?: string | null): void;
  setInteraction(id: string | null): void;
  setWhy(id: string | null): void;
  setShowNumbers(v: boolean): void;
  reset(): void;
}

const initial = {
  selectedIds: [] as string[], actionKey: null, optionKey: null, panel: 'none' as Panel,
  profileId: null, messageId: null, interactionId: null, whyOpen: null, showNumbers: false
};

export const useUi = create<UiState>(set => ({
  ...initial,
  toggleMember: (id, multi = false) => set(s => ({
    selectedIds: s.selectedIds.includes(id) ? s.selectedIds.filter(x => x !== id) : multi ? [...s.selectedIds, id] : [id]
  })),
  chooseAction: (key, option = null) => set({ actionKey: key, optionKey: option }),
  openPanel: (panel, ref = null) => set({ panel, profileId: panel === 'profile' ? ref : null, messageId: panel === 'inbox' ? ref : null }),
  setInteraction: id => set({ interactionId: id }),
  setWhy: id => set({ whyOpen: id }),
  setShowNumbers: v => set({ showNumbers: v }),
  reset: () => set(initial)
}));
