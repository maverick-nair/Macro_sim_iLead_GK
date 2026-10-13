import { useCallback, useEffect } from 'react';
import type { StoreApi } from 'zustand';
import { AUTHOR_WINDOW, PREVIEW_META_KEY, PREVIEW_WINDOW, previewKey, previewUrl, readMeta, type PreviewMeta, type PreviewTarget } from '../../components/preview/mode';
import { DRAFT_KEY, type AuthorDraft } from '../model/draft';
import { toStoryline } from '../model/export';
import { isQuota, trimVersions } from '../model/history';
import { useAuthorStore, type AuthorState } from '../model/store';

export type { PreviewTarget };

/** Why a preview did not start: the draft does not play yet, or it could not be handed to the preview tab. */
export type PlayResult = { ok: true; issues: [] } | { ok: false; issues: string[]; reason: 'invalid' | 'storage' };

export const PLAY_STORAGE_FULL = 'Preview could not start: your browser\'s storage for this site is full, so the draft cannot be passed to the preview. Download a copy of your draft, free some space, then try again.';
export const PLAY_STORAGE_BLOCKED = 'Preview could not start: this browser is blocking storage for this site, so the draft cannot be passed to the preview.';

type Stores = Array<() => Storage>;
const DEFAULT_STORES: Stores = [() => sessionStorage, () => localStorage];
/** This GenieKreator tab has opened a preview: its saves go on to the preview tab (D194). Kept for this tab only. */
const ACTIVE_KEY = previewKey('active');

/** Opens (or refreshes) the one preview tab, and names this tab so the preview's Back finds it (D194, D198). */
function openPreview(url: string) {
  try { if (!window.name) window.name = AUTHOR_WINDOW; } catch { /* a sandboxed frame */ }
  const w = window.open(url, PREVIEW_WINDOW);
  w?.focus();
}

/** Writes `value` under `key` in every store that takes it, making room from stored versions when one is full. */
function store(key: string, value: string, stores: Stores): { inLocal: boolean; full: boolean } {
  let full = false;
  for (const get of stores) {
    let s: Storage;
    try { s = get(); } catch { continue; }
    try { s.removeItem(key); } catch { /* blocked */ }
    for (let i = 0; i < 25; i++) {
      try {
        s.setItem(key, value);
        break;
      } catch (e) {
        if (!isQuota(e)) break;
        full = true;
        if (!trimVersions(s)) break;
      }
    }
  }
  // The preview tab reads local storage (the last store): session storage is copied to a new tab once, then goes stale.
  let inLocal = false;
  try { inLocal = stores[stores.length - 1]().getItem(key) === value; } catch { inLocal = false; }
  return { inLocal, full };
}

function writeMeta(d: AuthorDraft, savedAt: number | null, stores: Stores, previewId?: string | null) {
  const last = stores[stores.length - 1];
  try {
    const s = last();
    const before = readMeta(s);
    const meta: PreviewMeta = { rev: (before?.rev ?? 0) + 1, version: d.publish.version + 1, savedAt: savedAt ?? Date.now(), title: d.title, previewId: previewId === undefined ? before?.previewId ?? null : previewId };
    s.setItem(PREVIEW_META_KEY, JSON.stringify(meta));
  } catch { /* storage blocked: the preview shows no version line */ }
}

/** The draft as a storyline, left where the preview reads it, with the meta that names its version and save time. */
function handOver(d: AuthorDraft, stores: Stores, savedAt: number | null, previewId?: string | null): { result: PlayResult; storyline: unknown } {
  const { storyline, issues } = toStoryline(d);
  if (issues.length) return { result: { ok: false, issues, reason: 'invalid' }, storyline: null };
  const { inLocal, full } = store(DRAFT_KEY, JSON.stringify(storyline), stores);
  if (!inLocal) return { result: { ok: false, issues: [full ? PLAY_STORAGE_FULL : PLAY_STORAGE_BLOCKED], reason: 'storage' }, storyline };
  writeMeta(d, savedAt, stores, previewId);
  return { result: { ok: true, issues: [] }, storyline };
}

/**
 * Preview (D194): the draft as a storyline, left where the participant mock reads it (DRAFT_KEY,
 * src/engine/mock.ts), opened as a preview (`?preview=1`) in the one preview tab, at `target`. Anything
 * that still needs the author plays with Kora's placeholder (the drafted deal value, for one).
 *
 * The participant view plays its bundled storyline when it finds no draft, so this never opens a tab
 * unless the draft is in storage (D123): an older draft left there is removed first, a full storage
 * gives up stored versions to make room, and the write is read back. When none of that works, it
 * returns `reason: 'storage'` with a message to show, and the caller must not mark the draft played.
 */
export function playDraft(d: AuthorDraft, open: (url: string) => void = openPreview, stores: Stores = DEFAULT_STORES, opts: { target?: PreviewTarget; savedAt?: number | null } = {}): PlayResult {
  const { result } = handOver(d, stores, opts.savedAt ?? null, null);
  if (!result.ok) return result;
  open(previewUrl({ target: opts.target ?? 'onboarding', light: d.brand.look === 'light' }));
  return result;
}

const genieUrl = () => ((import.meta.env.VITE_GENIE_URL as string | undefined) ?? '').replace(/\/$/, '') || null;
const markActive = () => { try { sessionStorage.setItem(ACTIVE_KEY, '1'); } catch { /* blocked: saves are not passed on */ } };
const isActive = () => { try { return sessionStorage.getItem(ACTIVE_KEY) === '1'; } catch { return false; } };

/**
 * Previews the latest saved draft (D194): saves first if a save is waiting, then hands over what was just
 * saved. With a GenieKreator server (`VITE_GENIE_URL`) the draft is also sent to `POST /author/preview`,
 * which checks it, keeps it as a preview storyline (never a published version) and plays it on the server
 * (D195); if the server cannot, the preview plays on the mock in the browser.
 */
export async function previewDraft(s: StoreApi<AuthorState>, target: PreviewTarget = 'onboarding', opts: { genie?: string | null; stores?: Stores; fetchImpl?: typeof fetch } = {}): Promise<PlayResult> {
  s.getState().flush();
  const { draft, savedAt } = s.getState();
  const stores = opts.stores ?? DEFAULT_STORES;
  const genie = opts.genie === undefined ? genieUrl() : opts.genie;
  markActive();
  if (!genie) return playDraft(draft, openPreview, stores, { target, savedAt });

  // A tab must open on the click itself; it is pointed at the server's preview once that answers.
  try { if (!window.name) window.name = AUTHOR_WINDOW; } catch { /* a sandboxed frame */ }
  const tab = window.open('', PREVIEW_WINDOW);
  const { result, storyline } = handOver(draft, stores, savedAt, null);
  const light = draft.brand.look === 'light';
  if (!result.ok) {
    try { if (tab?.location.href === 'about:blank') tab.close(); } catch { /* not ours */ }
    return result;
  }
  let url = previewUrl({ target, light });
  try {
    const res = await (opts.fetchImpl ?? fetch)(`${genie}/author/preview`, {
      method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ config: storyline, target, draftVersion: draft.publish.version + 1, savedAt: new Date(savedAt ?? Date.now()).toISOString() })
    });
    if (!res.ok) throw new Error(`POST /author/preview failed with ${res.status}`);
    const body = (await res.json()) as { id: string };
    writeMeta(draft, savedAt, stores, body.id);
    url = previewUrl({ target, light, previewId: body.id });
  } catch (e) {
    console.warn('The server preview did not start; previewing in this browser', e);
  }
  if (tab) { tab.location.href = url; tab.focus(); } else openPreview(url);
  return result;
}

let current: StoreApi<AuthorState> | null = null;

/**
 * Passes every save on to an open preview (D194): once this tab has previewed, each save that changes the
 * storyline is handed over again, and the preview tab offers Reload. A save that does not play yet is not.
 * Mounted once, by the workspace header; it also makes `previewAt` work from any tab.
 */
export function usePreviewSync() {
  const s = useAuthorStore();
  useEffect(() => {
    current = s;
    const off = s.subscribe((st, prev) => {
      if (st.savedAt === prev.savedAt || st.savedAt === null || !isActive()) return;
      const { storyline, issues } = toStoryline(st.draft);
      if (issues.length) return;
      const json = JSON.stringify(storyline);
      let stored: string | null = null;
      try { stored = localStorage.getItem(DRAFT_KEY); } catch { return; }
      if (stored === json) return;
      const { inLocal } = store(DRAFT_KEY, json, DEFAULT_STORES);
      if (inLocal) writeMeta(st.draft, st.savedAt, DEFAULT_STORES);
    });
    return () => { off(); if (current === s) current = null; };
  }, [s]);
}

/**
 * Previews the draft at a point (D196): `onboarding`, `styles`, `board`, `event:<key>`, `action:<key>`,
 * `weekend`, `end` or `report` (a week may follow: `board:3`). For any tab: the workspace header keeps the store.
 */
export function previewAt(target: PreviewTarget): Promise<PlayResult> {
  if (!current) return Promise.resolve({ ok: false, issues: ['Open the workspace to preview the draft.'], reason: 'invalid' });
  return previewDraft(current, target);
}

/** `previewAt` with the draft marked played, as the header's Preview does. */
export function usePreviewAt() {
  const s = useAuthorStore();
  return useCallback(async (target: PreviewTarget) => {
    const r = await previewDraft(s, target);
    if (r.ok) s.getState().edit(d => { d.publish.played = true; }, { history: false });
    return r;
  }, [s]);
}

export function download(name: string, value: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
