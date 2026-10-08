import { createContext, useContext } from 'react';
import { createStore, useStore, type StoreApi } from 'zustand';
import { AuthorDraft, WORKSPACE_BACKUP_KEY, WORKSPACE_KEY, WORKSPACE_VERSIONS_KEY, type Mark } from './draft';
import { differs, inferChange, isQuota, labelOfMark, MAX_VERSIONS, pushStep, readVersions, trimVersions, writeVersions, type Step, type Version } from './history';
import { clampDraft, repairDraft } from './repair';
import { emptyChat, seedDraft } from './seed';

/**
 * The author's draft in memory and in local storage (D105, D122 to D124).
 *
 * Every change goes through `edit` (or `replace`), which clones the draft, applies the change, clamps
 * it to the schema and marks the paths it touched: the author's edit turns `ai` into `edited` and
 * leaves `you` as it is; Kora's change (`by: 'ai'`) marks `ai`. Every change is one step of undo,
 * named by its `label` (or a name read from the change), and typing into one field merges into one
 * step. A change that replaces or removes work saves a named version first (history.ts).
 *
 * Saving: a short pause after the last change, and at once when the page is hidden or closed
 * (`bindAuthorStore`). Storage can be missing, full or blocked: reading and writing never throw, the
 * draft keeps working in memory and `saveFailed` says why ('full', 'blocked'). Before each write the
 * store checks that the stored draft is still the one it last read or wrote; when another tab has
 * changed it, the store stops saving and sets `conflict` until the author picks a version.
 *
 * Loading: a stored draft that does not parse is kept as it was under WORKSPACE_BACKUP_KEY (never
 * removed) and repaired field by field (repair.ts); `recovery` lists what changed, or says that the
 * draft could not be read at all.
 */

export type SaveProblem = 'full' | 'blocked' | 'conflict';

/** How a change is named and kept. Every field is optional. */
export interface EditOptions {
  /** The fields the change touches, marked by who made it. */
  mark?: string | string[];
  by?: 'you' | 'ai';
  /** What undo and the history call it ("Change lens"). Default: read from the change. */
  label?: string;
  /** Save a named version of the draft before the change. Default: true for a change that replaces or removes work. */
  restorePoint?: boolean;
  /** False: not a step of undo (only for bookkeeping that is not the author's work). */
  history?: boolean;
  /** Changes with the same key less than COALESCE_MS apart are one step. Default: the marked fields, for the author's edits. */
  coalesce?: string;
}

/** What the recovery notice shows after a stored draft could not be read as it was. */
export interface Recovery {
  /** One plain line per fix. */
  notes: string[];
  /** True when nothing could be kept and a new draft was started. */
  unreadable: boolean;
  /** The stored text as it was (also kept under WORKSPACE_BACKUP_KEY). */
  original: string;
  /** True when the original parses as a draft today, so it can be restored as it was. */
  restorable: boolean;
}

export interface AuthorState {
  draft: AuthorDraft;
  /** When the draft last reached storage; null before the first save. */
  savedAt: number | null;
  /** Why the last save did not happen; false when it did. */
  saveFailed: false | SaveProblem;
  /** Undo and redo steps, oldest first. */
  past: Step[];
  future: Step[];
  /** The last thing undo, redo or restore did, for the live region; `n` changes on each. */
  announcement: { text: string; n: number } | null;
  /** Named versions, oldest first. */
  versions: Version[];
  /** True when a version could not be kept in storage (it stays for this visit). */
  versionsFailed: boolean;
  /** Another tab changed the stored draft; saving is paused until the author picks one. */
  conflict: { at: number } | null;
  recovery: Recovery | null;

  /** Changes the draft. `options` may be the marked path(s), as before, or EditOptions. */
  edit(change: (d: AuthorDraft) => void, options?: string | string[] | EditOptions, by?: 'you' | 'ai'): void;
  replace(draft: AuthorDraft, options?: EditOptions): void;
  /** Starts over with a blank chat (a version of the old draft is kept). */
  reset(): void;
  undo(): void;
  redo(): void;
  /** Saves a named version of the draft as it is now. */
  checkpoint(label: string): void;
  /** Puts a version back, as a step of undo (a version of the draft before is kept too). */
  restore(id: string): void;
  /** Saves now if a save is waiting. */
  flush(): void;
  /** The stored draft changed in another tab (the `storage` event's new value). */
  external(raw: string | null): void;
  /** Ends a conflict: 'theirs' loads the other tab's draft, 'mine' saves this one over it. */
  resolveConflict(pick: 'theirs' | 'mine'): void;
  dismissRecovery(): void;
  /** Puts the original stored draft back, when it parses. */
  restoreOriginal(): void;
}

export function freshDraft(): AuthorDraft {
  return seedDraft(emptyChat(), 'chat');
}

/** What was in storage: the draft (repaired if it had to be), the raw text, and what the repair did. */
export function readStored(storage: Storage | null): { draft: AuthorDraft | null; raw: string | null; recovery: Recovery | null } {
  let raw: string | null | undefined;
  try {
    raw = storage?.getItem(WORKSPACE_KEY);
  } catch {
    return { draft: null, raw: null, recovery: null };
  }
  if (!raw) return { draft: null, raw: null, recovery: null };
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    backUp(storage, raw);
    return { draft: null, raw, recovery: { notes: ['The saved draft could not be read, so a new draft was started.'], unreadable: true, original: raw, restorable: false } };
  }
  const r = AuthorDraft.safeParse(value);
  if (r.success) return { draft: r.data, raw, recovery: null };
  backUp(storage, raw);
  let fixed: ReturnType<typeof repairDraft> = null;
  try { fixed = repairDraft(value, freshDraft); } catch { fixed = null; }
  if (!fixed) return { draft: null, raw, recovery: { notes: ['The saved draft could not be read, so a new draft was started.'], unreadable: true, original: raw, restorable: false } };
  return { draft: fixed.draft, raw, recovery: { notes: fixed.notes, unreadable: false, original: raw, restorable: false } };
}

export function loadDraft(storage: Storage | null): AuthorDraft | null {
  return readStored(storage).draft;
}

/** Keeps the value that did not parse, so nothing the author wrote is lost to a repair. Never removed. */
function backUp(storage: Storage | null, raw: string): void {
  try { storage?.setItem(WORKSPACE_BACKUP_KEY, raw); } catch { /* storage full or blocked: the repair still runs, the notice offers the original */ }
}

/** Writes the draft; when storage is full, drops the oldest stored versions to make room first. */
function write(storage: Storage, json: string): true | 'full' | 'blocked' {
  for (let i = 0; i <= MAX_VERSIONS; i++) {
    try {
      storage.setItem(WORKSPACE_KEY, json);
      return true;
    } catch (e) {
      if (!isQuota(e)) return 'blocked';
      if (!trimVersions(storage)) return 'full';
    }
  }
  return 'full';
}

export function nextMark(current: Mark | undefined, by: 'you' | 'ai'): Mark {
  if (by === 'ai') return 'ai';
  return current === 'ai' || current === 'edited' ? 'edited' : 'you';
}

const defaultStorage = (): Storage | null => {
  try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; }
};

const normalize = (options: string | string[] | EditOptions | undefined, by: 'you' | 'ai' | undefined): EditOptions =>
  options === undefined || typeof options === 'string' || Array.isArray(options) ? { mark: options, by } : { ...options, by: options.by ?? by };

/** Where the author is (the chat, or the draft) follows undo only when it crosses the chat. */
const keepStage = (target: AuthorDraft, current: AuthorDraft): AuthorDraft =>
  target.stage === 'chat' || current.stage === 'chat' || target.stage === current.stage ? target : { ...target, stage: current.stage };

/** The draft as text, the same way whatever order its keys were set in, to compare two tabs' drafts. */
const canonical = (raw: string | null): string | null => {
  if (raw === null) return null;
  try {
    const r = AuthorDraft.safeParse(JSON.parse(raw));
    return r.success ? JSON.stringify(r.data) : raw;
  } catch {
    return raw;
  }
};

let ids = 0;
const versionId = () => `${Date.now().toString(36)}-${(ids++).toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

export function createAuthorStore(initial?: AuthorDraft, storage: Storage | null = defaultStorage()): StoreApi<AuthorState> {
  const stored = initial ? null : readStored(storage);
  const draft = initial ?? stored?.draft ?? freshDraft();
  let recovery = stored?.recovery ?? null;
  if (recovery) {
    // The original may read as a draft today (a value an older or newer version wrote).
    try { recovery = { ...recovery, restorable: AuthorDraft.safeParse(JSON.parse(recovery.original)).success }; } catch { /* not JSON */ }
  }
  /** The stored text this tab last read or wrote: anything else in storage was written by another tab. */
  let known: string | null = (() => { try { return storage?.getItem(WORKSPACE_KEY) ?? null; } catch { return null; } })();
  let timer: ReturnType<typeof setTimeout> | null = null;
  let seq = 0;

  const store = createStore<AuthorState>()((set, get) => {
    const saveVersion = (d: AuthorDraft, label: string) => {
      const v: Version = { id: versionId(), at: Date.now(), label, draft: d };
      const { kept, ok } = writeVersions(storage, [...get().versions, v]);
      const list = ok ? kept : [...get().versions.filter(x => x.id !== v.id), v].slice(-MAX_VERSIONS);
      set({ versions: list, versionsFailed: !ok && !!storage });
    };
    const announce = (text: string) => set({ announcement: { text, n: ++seq } });

    /** Applies a change as one step of undo, saving a version first when it replaces or removes work. */
    const commit = (before: AuthorDraft, next: AuthorDraft, o: EditOptions) => {
      if (o.history === false || !differs(before, next)) { set({ draft: next }); return; }
      const marks = o.mark === undefined ? [] : Array.isArray(o.mark) ? o.mark : [o.mark];
      const by = o.by ?? 'you';
      const inferred = inferChange(before, next, by, marks.length > 0);
      const label = o.label ?? inferred?.label ?? (marks.length ? labelOfMark(before, marks[0]) : 'Change');
      const restorePoint = o.restorePoint ?? inferred?.restorePoint ?? false;
      const key = restorePoint || inferred ? null : o.coalesce ?? (marks.length && by === 'you' ? `${label}|${marks.join('|')}` : null);
      if (restorePoint) saveVersion(before, `Before: ${label}`);
      set({ draft: next, past: pushStep(get().past, before, { label, restorePoint, key }, Date.now()), future: [] });
      if (next.publish.version > before.publish.version) saveVersion(next, `Published version ${next.publish.version}`);
    };

    return {
      draft,
      savedAt: null,
      saveFailed: false,
      past: [],
      future: [],
      announcement: null,
      versions: readVersions(storage),
      versionsFailed: false,
      conflict: null,
      recovery,
      edit(change, options, by) {
        const o = normalize(options, by);
        const before = get().draft;
        const next = structuredClone(before);
        change(next);
        clampDraft(next);
        for (const p of o.mark === undefined ? [] : Array.isArray(o.mark) ? o.mark : [o.mark]) next.marks[p] = nextMark(next.marks[p], o.by ?? 'you');
        commit(before, next, o);
      },
      replace(d, options) { commit(get().draft, clampDraft(structuredClone(d)), { label: 'Replace the draft', ...options }); },
      reset() { commit(get().draft, freshDraft(), { label: 'Start a new draft', restorePoint: true }); },
      undo() {
        const { past, future, draft: current } = get();
        const step = past[past.length - 1];
        if (!step) return;
        set({ draft: keepStage(step.draft, current), past: past.slice(0, -1), future: [...future, { draft: current, label: step.label, at: Date.now(), key: null }] });
        announce(`Undid: ${step.label}`);
      },
      redo() {
        const { past, future, draft: current } = get();
        const step = future[future.length - 1];
        if (!step) return;
        set({ draft: keepStage(step.draft, current), future: future.slice(0, -1), past: [...past, { draft: current, label: step.label, at: Date.now(), key: null }] });
        announce(`Redid: ${step.label}`);
      },
      checkpoint(label) { saveVersion(get().draft, label); },
      restore(id) {
        const v = get().versions.find(x => x.id === id);
        if (!v) return;
        const current = get().draft;
        commit(current, keepStage(structuredClone(v.draft), current), { label: `Restore "${v.label}"`, restorePoint: true });
        announce(`Restored: ${v.label}`);
      },
      flush() {
        if (!timer) return;
        clearTimeout(timer);
        timer = null;
        persist();
      },
      external(raw) {
        if (raw === null) { known = null; return; }
        if (canonical(raw) === canonical(JSON.stringify(get().draft))) { known = raw; if (get().conflict) set({ conflict: null, saveFailed: false }); return; }
        if (timer) { clearTimeout(timer); timer = null; }
        set({ conflict: { at: Date.now() }, saveFailed: 'conflict' });
      },
      resolveConflict(pick) {
        if (!get().conflict) return;
        if (pick === 'mine') {
          set({ conflict: null, saveFailed: false });
          persist(true);
          return;
        }
        const theirs = readStored(storage);
        set({ conflict: null, saveFailed: false });
        known = theirs.raw;
        if (theirs.draft) {
          const current = get().draft;
          commit(current, keepStage(theirs.draft, current), { label: 'Load the changes from another tab', restorePoint: true });
          announce('Loaded the changes from another tab');
        }
      },
      dismissRecovery() { set({ recovery: null }); },
      restoreOriginal() {
        const r = get().recovery;
        if (!r) return;
        let parsed: ReturnType<typeof AuthorDraft.safeParse> | null = null;
        try { parsed = AuthorDraft.safeParse(JSON.parse(r.original)); } catch { parsed = null; }
        if (!parsed?.success) return;
        commit(get().draft, parsed.data, { label: 'Restore the original draft', restorePoint: true });
        set({ recovery: null });
      }
    };
  });

  /** Writes the draft unless another tab changed it since this tab last read or wrote it. */
  function persist(force = false) {
    if (!storage) return;
    const s = store.getState();
    if (s.conflict && !force) return;
    let current: string | null = null;
    try { current = storage.getItem(WORKSPACE_KEY); } catch { current = known; }
    if (!force && current !== null && current !== known && canonical(current) !== canonical(JSON.stringify(s.draft))) {
      store.setState({ conflict: { at: Date.now() }, saveFailed: 'conflict' });
      return;
    }
    const json = JSON.stringify(s.draft);
    if (json === current) { known = json; store.setState({ savedAt: Date.now(), saveFailed: false }); return; }
    const ok = write(storage, json);
    if (ok === true) known = json;
    store.setState({ savedAt: ok === true ? Date.now() : s.savedAt, saveFailed: ok === true ? false : ok });
    // Versions dropped to make room are dropped from the list too.
    if (ok === true && s.versions.length) {
      const left = new Set(readVersions(storage).map(v => v.id));
      if (s.versions.some(v => !left.has(v.id))) store.setState({ versionsFailed: true });
    }
  }

  // Saves after a short pause, so typing does not write on every key.
  store.subscribe((s, prev) => {
    if (s.draft === prev.draft || s.conflict) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { timer = null; persist(); }, 300);
  });
  return store;
}

/**
 * Ties a store to the page: saves at once when the page is hidden or closed, and listens for another
 * tab changing the draft or its versions. Returns the cleanup.
 */
type Target = Pick<EventTarget, 'addEventListener' | 'removeEventListener'>;
export function bindAuthorStore(store: StoreApi<AuthorState>, { win = window, doc = document, storage = defaultStorage() }: { win?: Target; doc?: Target & Pick<Document, 'visibilityState'>; storage?: Storage | null } = {}): () => void {
  const flush = () => store.getState().flush();
  const onVisibility = () => { if (doc.visibilityState === 'hidden') flush(); };
  const onStorage = (e: Event) => {
    const ev = e as StorageEvent;
    if (storage && ev.storageArea && ev.storageArea !== storage) return;
    if (ev.key === WORKSPACE_KEY) store.getState().external(ev.newValue);
    if (ev.key === WORKSPACE_VERSIONS_KEY) store.setState({ versions: readVersions(storage) });
  };
  win.addEventListener('pagehide', flush);
  win.addEventListener('beforeunload', flush);
  win.addEventListener('storage', onStorage);
  doc.addEventListener('visibilitychange', onVisibility);
  return () => {
    win.removeEventListener('pagehide', flush);
    win.removeEventListener('beforeunload', flush);
    win.removeEventListener('storage', onStorage);
    doc.removeEventListener('visibilitychange', onVisibility);
  };
}

export const AuthorStoreContext = createContext<StoreApi<AuthorState> | null>(null);

export function useAuthor<T>(select: (s: AuthorState) => T): T {
  const store = useContext(AuthorStoreContext);
  if (!store) throw new Error('useAuthor needs an AuthorStoreContext provider');
  return useStore(store, select);
}

/** The store itself, for handlers that read the latest state (undo keys, flush before leaving). */
export function useAuthorStore(): StoreApi<AuthorState> {
  const store = useContext(AuthorStoreContext);
  if (!store) throw new Error('useAuthorStore needs an AuthorStoreContext provider');
  return store;
}

/** The draft, and an editor that marks what it changed. */
export function useDraft() {
  const draft = useAuthor(s => s.draft);
  const edit = useAuthor(s => s.edit);
  return { draft, edit };
}
