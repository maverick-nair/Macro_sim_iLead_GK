import { createStore, useStore } from 'zustand';

/**
 * Whether the author is in the publishing walkthrough (D244): while it is on, each page opens with Kora's check of
 * it and the page's Confirm. For this visit only (a reload leaves it; Review and publish starts it again where it was).
 */
export const walkStore = createStore<{ active: boolean; set(active: boolean): void }>(set => ({
  active: false,
  set: active => set({ active })
}));

export function useWalk<T>(select: (s: { active: boolean; set(active: boolean): void }) => T): T {
  return useStore(walkStore, select);
}
