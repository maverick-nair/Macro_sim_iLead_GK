import { createContext, useContext } from 'react';
import { createStore, useStore, type StoreApi } from 'zustand';
import { AuthorDraft, WORKSPACE_KEY, type Mark } from './draft';
import { emptyChat, seedDraft } from './seed';

/**
 * The author's draft in memory and in local storage (D105). Every change goes through `edit`, which
 * clones the draft, applies the change and marks the paths it touched: the author's edit turns `ai`
 * into `edited` and leaves `you` as it is; Kora's change (`by: 'ai'`) marks `ai`. Storage can be
 * missing, full or blocked (private windows, a policy): reading and writing never throw, the draft
 * keeps working in memory and the header says it could not save.
 */

export interface AuthorState {
  draft: AuthorDraft;
  /** When the draft last reached storage; null before the first save. */
  savedAt: number | null;
  /** True when the last save failed. */
  saveFailed: boolean;
  edit(change: (d: AuthorDraft) => void, mark?: string | string[], by?: 'you' | 'ai'): void;
  replace(draft: AuthorDraft): void;
  /** Starts over with a blank chat. */
  reset(): void;
}

export function freshDraft(): AuthorDraft {
  return seedDraft(emptyChat(), 'chat');
}

export function loadDraft(storage: Storage | null): AuthorDraft | null {
  try {
    const raw = storage?.getItem(WORKSPACE_KEY);
    if (!raw) return null;
    const r = AuthorDraft.safeParse(JSON.parse(raw));
    return r.success ? r.data : null;
  } catch {
    return null;
  }
}

function save(storage: Storage | null, d: AuthorDraft): boolean {
  if (!storage) return false;
  try {
    storage.setItem(WORKSPACE_KEY, JSON.stringify(d));
    return true;
  } catch {
    return false;
  }
}

export function nextMark(current: Mark | undefined, by: 'you' | 'ai'): Mark {
  if (by === 'ai') return 'ai';
  return current === 'ai' || current === 'edited' ? 'edited' : 'you';
}

const defaultStorage = (): Storage | null => {
  try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; }
};

export function createAuthorStore(initial?: AuthorDraft, storage: Storage | null = defaultStorage()): StoreApi<AuthorState> {
  const draft = initial ?? loadDraft(storage) ?? freshDraft();
  let timer: ReturnType<typeof setTimeout> | null = null;
  const store = createStore<AuthorState>()((set, get) => ({
    draft,
    savedAt: null,
    saveFailed: false,
    edit(change, mark, by = 'you') {
      const next = structuredClone(get().draft);
      change(next);
      for (const p of mark === undefined ? [] : Array.isArray(mark) ? mark : [mark]) next.marks[p] = nextMark(next.marks[p], by);
      set({ draft: next });
    },
    replace(d) { set({ draft: d }); },
    reset() { set({ draft: freshDraft() }); }
  }));
  // Saves after a short pause, so typing does not write on every key.
  store.subscribe((s, prev) => {
    if (s.draft === prev.draft) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      const ok = save(storage, store.getState().draft);
      store.setState({ savedAt: ok ? Date.now() : store.getState().savedAt, saveFailed: !ok && !!storage });
    }, 300);
  });
  return store;
}

export const AuthorStoreContext = createContext<StoreApi<AuthorState> | null>(null);

export function useAuthor<T>(select: (s: AuthorState) => T): T {
  const store = useContext(AuthorStoreContext);
  if (!store) throw new Error('useAuthor needs an AuthorStoreContext provider');
  return useStore(store, select);
}

/** The draft, and an editor that marks what it changed. */
export function useDraft() {
  const draft = useAuthor(s => s.draft);
  const edit = useAuthor(s => s.edit);
  return { draft, edit };
}
