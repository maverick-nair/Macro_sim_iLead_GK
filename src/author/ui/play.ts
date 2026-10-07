import { DRAFT_KEY, type AuthorDraft } from '../model/draft';
import { toStoryline } from '../model/export';

/**
 * "Play a week" and "Preview week 1 as a participant": the draft as a storyline, left where the
 * participant mock reads it (DRAFT_KEY, src/engine/mock.ts), opened in a new tab. Anything that still
 * needs the author plays with Kora's placeholder (the drafted deal value, for one). Returns false when
 * the storyline does not parse, so the caller can send the author to the checks.
 */
export function playDraft(d: AuthorDraft, open: (url: string) => void = u => { window.open(u, '_blank', 'noopener'); }): { ok: boolean; issues: string[] } {
  const { storyline, issues } = toStoryline(d);
  if (issues.length) return { ok: false, issues };
  const json = JSON.stringify(storyline);
  for (const get of [() => sessionStorage, () => localStorage]) { try { get().setItem(DRAFT_KEY, json); } catch { /* storage blocked */ } }
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
