import { createContext, useContext } from 'react';
import { createStore, useStore, type StoreApi } from 'zustand';
import { AuthorDraft, WORKSPACE_BACKUP_KEY, WORKSPACE_KEY, type Mark } from './draft';
import { clampDraft, repairDraft } from './repair';
import { emptyChat, seedDraft } from './seed';

/**
 * The author's draft in memory and in local storage (D105). Every change goes through `edit`, which
 * clones the draft, applies the change and marks the paths it touched: the author's edit turns `ai`
 * into `edited` and leaves `you` as it is; Kora's change (`by: 'ai'`) marks `ai`, or `edited` on a field the author owns. Storage can be
 * missing, full or blocked (private windows, a policy): reading and writing never throw, the draft
 * keeps working in memory and the header says it could not save. A stored draft that no longer parses
 * is kept as it was under WORKSPACE_BACKUP_KEY and repaired field by field (D120); every edit clamps
 * the draft to the schema's limits so what is saved always reads back.
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
  let raw: string | null | undefined;
  try {
    raw = storage?.getItem(WORKSPACE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    backUp(storage, raw);
    return null;
  }
  const r = AuthorDraft.safeParse(value);
  if (r.success) return r.data;
  backUp(storage, raw);
  try {
    return repairDraft(value, freshDraft);
  } catch {
    return null;
  }
}

/** Keeps the value that did not parse, so nothing the author wrote is lost to a repair. */
function backUp(storage: Storage | null, raw: string): void {
  try { storage?.setItem(WORKSPACE_BACKUP_KEY, raw); } catch { /* storage full or blocked: the repair still runs */ }
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

/** Kora's change to a field the author owns keeps it theirs, as Edited, so Regenerate never takes it back (D126). */
export function nextMark(current: Mark | undefined, by: 'you' | 'ai'): Mark {
  if (by === 'ai') return current === 'you' || current === 'edited' ? 'edited' : 'ai';
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
      clampDraft(next);
      for (const p of mark === undefined ? [] : Array.isArray(mark) ? mark : [mark]) next.marks[p] = nextMark(next.marks[p], by);
      set({ draft: next });
    },
    replace(d) { set({ draft: clampDraft(structuredClone(d)) }); },
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
