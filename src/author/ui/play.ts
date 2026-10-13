import { DRAFT_KEY, type AuthorDraft } from '../model/draft';
import { toStoryline } from '../model/export';
import { isQuota, trimVersions } from '../model/history';

/** Why a play did not start: the draft does not play yet, or it could not be handed to the new tab. */
export type PlayResult = { ok: true; issues: [] } | { ok: false; issues: string[]; reason: 'invalid' | 'storage' };

export const PLAY_STORAGE_FULL = 'Play a week could not start: your browser\'s storage for this site is full, so the draft cannot be passed to the participant view. Download a copy of your draft, free some space, then try again.';
export const PLAY_STORAGE_BLOCKED = 'Play a week could not start: this browser is blocking storage for this site, so the draft cannot be passed to the participant view.';

/**
 * "Play a week" and "Preview week 1 as a participant": the draft as a storyline, left where the
 * participant mock reads it (DRAFT_KEY, src/engine/mock.ts), opened in a new tab. Anything that still
 * needs the author plays with Kora's placeholder (the drafted deal value, for one).
 *
 * The participant view plays its bundled storyline when it finds no draft, so this never opens a tab
 * unless the draft is in storage (D123): an older draft left there is removed first, a full storage
 * gives up stored versions to make room, and the write is read back. When none of that works, it
 * returns `reason: 'storage'` with a message to show, and the caller must not mark the draft played.
 */
export function playDraft(
  d: AuthorDraft,
  open: (url: string) => void = u => { window.open(u, '_blank', 'noopener'); },
  stores: Array<() => Storage> = [() => sessionStorage, () => localStorage]
): PlayResult {
  const { storyline, issues } = toStoryline(d);
  if (issues.length) return { ok: false, issues, reason: 'invalid' };
  const json = JSON.stringify(storyline);
  let full = false;
  for (const get of stores) {
    let s: Storage;
    try { s = get(); } catch { continue; }
    try { s.removeItem(DRAFT_KEY); } catch { /* blocked */ }
    for (let i = 0; i < 25; i++) {
      try {
        s.setItem(DRAFT_KEY, json);
        break;
      } catch (e) {
        if (!isQuota(e)) break;
        full = true;
        if (!trimVersions(s)) break;
      }
    }
  }
  // The new tab reads local storage (the last store): session storage is not shared with a tab opened without an opener.
  let inLocal = false;
  try { inLocal = stores[stores.length - 1]().getItem(DRAFT_KEY) === json; } catch { inLocal = false; }
  if (!inLocal) return { ok: false, issues: [full ? PLAY_STORAGE_FULL : PLAY_STORAGE_BLOCKED], reason: 'storage' };
  const q = new URLSearchParams({ storyline: 'draft', start: 'onboarding', participant: 'author_draft' });
  if (d.brand.look === 'light') q.set('theme', 'light');
  open(`/?${q}`);
  return { ok: true, issues: [] };
}

export function download(name: string, value: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
