/**
 * A preview on the server (D195): GenieKreator's `VITE_GENIE_URL` serves an ephemeral preview storyline
 * and its runs, flagged `preview` and left out of every report. The preview tab plays it through the
 * engine contract at `{VITE_GENIE_URL}/preview/sessions/{previewId}`, as the author (their own session).
 */
const base = () => ((import.meta.env.VITE_GENIE_URL as string | undefined) ?? '').replace(/\/$/, '');

/** The preview storyline's engine, for `createHttpClient`. Null without a server. */
export const previewEngineBase = () => (base() ? `${base()}/preview` : null);

async function call(path: string, init: RequestInit): Promise<unknown> {
  const res = await fetch(`${base()}${path}`, { ...init, credentials: 'include', headers: { 'content-type': 'application/json', accept: 'application/json', ...init.headers } });
  if (!res.ok) throw new Error(`${init.method ?? 'GET'} ${path} failed with ${res.status}`);
  return res.status === 204 ? null : res.json();
}

/** Starts the preview over on a fresh run, played forward to `target` (`board:3`, `report`). */
export async function restartPreview(previewId: string, target: string | null) {
  await call(`/preview/sessions/${encodeURIComponent(previewId)}/restart`, { method: 'POST', body: JSON.stringify(target ? { target } : {}) });
}

/** Replaces the preview's storyline with the draft GenieKreator saved since (checked as on create). */
export async function updatePreview(previewId: string, config: unknown, meta: { draftVersion?: number; savedAt?: string }) {
  await call(`/author/preview/${encodeURIComponent(previewId)}`, { method: 'PUT', body: JSON.stringify({ config, ...meta }) });
}
