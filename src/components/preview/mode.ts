/**
 * Preview from GenieKreator (D190 to D199): what GenieKreator and the participant app agree on. The
 * author's Preview leaves the draft (as a storyline) and this meta in local storage and opens the
 * participant app in one named tab, with `?preview=1`. In that tab nothing a participant's history,
 * runs or reports read is written: anything the app keeps on the device goes under `ilead.preview.`.
 *
 * In the participant's first load: no imports beyond types.
 */
import type { JumpTarget } from '../../engine/jump';

/** The one tab every preview opens in, so a new preview refreshes it (D194). */
export const PREVIEW_WINDOW = 'ilead-preview';
/** GenieKreator's tab, so Back to GenieKreator finds it again. */
export const AUTHOR_WINDOW = 'ilead-author';
/** Everything a preview keeps on the device goes under this prefix. */
export const PREVIEW_PREFIX = 'ilead.preview.';
export const previewKey = (name: string) => `${PREVIEW_PREFIX}${name}`;
/** Which draft the preview plays: written by GenieKreator after the storyline, so its change means the draft is in. */
export const PREVIEW_META_KEY = previewKey('meta');
/** Where GenieKreator leaves the draft as a storyline (`DRAFT_KEY` in src/engine/mock.ts and the author model). */
export const PREVIEW_DRAFT_KEY = 'ilead.author.draft';
/** The participant id a preview plays as, on the mock engine and the mock API. Never remembered as a run. */
export const PREVIEW_PARTICIPANT = 'preview';

/**
 * Where GenieKreator can open a preview (D196): the welcome, week 1's styles, the desk, an event's or an
 * action's week, the week end, the end screen or the report. A week may follow styles, board and weekend (`board:3`).
 */
export type PreviewTarget = 'onboarding' | 'styles' | 'board' | 'weekend' | 'end' | 'report' | `event:${string}` | `action:${string}` | `${'styles' | 'board' | 'weekend'}:${number}`;
export type { JumpTarget };

export interface PreviewMeta {
  /** Goes up by one on every save GenieKreator hands over. */
  rev: number;
  /** The version this draft becomes when it is published. */
  version: number;
  /** When the draft was saved (ms since the epoch). */
  savedAt: number;
  title: string;
  /** The server's preview storyline, when the preview plays on the server (D195). */
  previewId?: string | null;
}

type Read = Pick<Storage, 'getItem'>;
const local = (): Storage | null => { try { return globalThis.localStorage ?? null; } catch { return null; } };

export function readMeta(storage: Read | null = local()): PreviewMeta | null {
  try {
    const raw = storage?.getItem(PREVIEW_META_KEY);
    const m = raw ? (JSON.parse(raw) as Partial<PreviewMeta>) : null;
    return m && typeof m.rev === 'number' && typeof m.savedAt === 'number' ? { rev: m.rev, version: Number(m.version) || 1, savedAt: m.savedAt, title: String(m.title ?? ''), previewId: m.previewId ?? null } : null;
  } catch {
    return null;
  }
}

/** This page is a preview from GenieKreator. */
export const isPreview = (search = globalThis.location?.search ?? '') => new URLSearchParams(search).get('preview') === '1';

/** The participant app's address for a preview at a target (`previewId`: on the server, D195). */
export function previewUrl(opts: { target?: PreviewTarget | string; light?: boolean; previewId?: string | null }): string {
  const q = new URLSearchParams({ preview: '1', storyline: 'draft', participant: PREVIEW_PARTICIPANT, jump: opts.target ?? 'onboarding' });
  if (opts.previewId) q.set('previewId', opts.previewId);
  if (opts.light) q.set('theme', 'light');
  return `/?${q}`;
}

/** The app screen a jump opens on: the welcome, or the board (which shows the week's style setting, the week end or the end). */
export const screenFor = (jump: string | null) => (!jump || jump === 'onboarding' ? undefined : 'board' as const);
