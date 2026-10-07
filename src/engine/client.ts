import { loadEngineCopy } from '../i18n/locales';
import type { EngineView, Intent, IntentResult, StreamChunk } from './contract';

/**
 * The contract (Zod and every schema) loads beside the first request, not in the first load (D87): the
 * view cannot be parsed before it arrives anyway.
 */
const contract = () => import('./contract');

/**
 * The one way the UI talks to the engine. Two adapters: the in-browser mock, which runs the same
 * engine code against a storyline fixture, and HTTP to the authoritative server. Both return
 * payloads parsed by the contract, so the copy rules apply to engine text either way.
 */
export interface EngineClient {
  view(): Promise<EngineView>;
  send(intent: Intent): Promise<IntentResult>;
  /**
   * Streams an NPC turn's words as the AI writes them (brief: streaming AI, cancellable). Abort the
   * signal to stop it; then send `interruptTurn` with how much was shown.
   */
  streamTurn(interactionId: string, turn: { id: string; text: string }, signal: AbortSignal): AsyncIterable<StreamChunk>;
}

/**
 * The first view requested by index.html's inline script before the app's code arrived (D87), once,
 * for this session only.
 */
function takeEarlyView(sessionId: string): Promise<unknown> | null {
  const g = globalThis as { __ileadEarlyView?: { session: string; view: Promise<unknown> } | null };
  const e = g.__ileadEarlyView;
  g.__ileadEarlyView = null;
  return e && e.session === sessionId ? e.view : null;
}

/** An intent the engine refused. `code` is stable; the UI maps it to a catalog message. */
export class EngineError extends Error {
  constructor(message: string, readonly code: string, readonly retryable = false) {
    super(message);
  }
}

export function parse<T>(schema: { safeParse(v: unknown): { success: true; data: T } | { success: false; error: { message: string } } }, value: unknown): T {
  const r = schema.safeParse(value);
  if (!r.success) throw new EngineError(r.error.message, 'badPayload');
  return r.data;
}

/**
 * `suffix` addresses a sub resource of the session: `/demo` is the demo round's own engine (D92), which
 * never takes the early first view.
 */
export function createHttpClient(baseUrl: string, sessionId: string, fetchImpl: typeof fetch = fetch, suffix = ''): EngineClient & { sendWithId(intent: Intent, requestId?: string): Promise<IntentResult> } {
  const root = `${baseUrl.replace(/\/$/, '')}/sessions/${encodeURIComponent(sessionId)}${suffix}`;
  async function call(path: string, init?: RequestInit) {
    let res: Response;
    try {
      // The session cookie identifies the participant to the server, as with the API adapter.
      res = await fetchImpl(`${root}${path}`, { ...init, credentials: 'include', headers: { 'content-type': 'application/json', ...init?.headers } });
    } catch {
      throw new EngineError('Network error', 'network', true);
    }
    const body = await res.json().catch(() => null);
    if (!res.ok) throw new EngineError(body?.message ?? res.statusText, body?.code ?? `http${res.status}`, res.status >= 500);
    return body;
  }
  /** With a request id, a retried intent the server already applied is answered, not applied again (D86). */
  async function sendWithId(intent: Intent, requestId?: string): Promise<IntentResult> {
    const headers: Record<string, string> = requestId ? { 'idempotency-key': requestId } : {};
    const c = await contract();
    const [body] = await Promise.all([call('/intents', { method: 'POST', body: JSON.stringify(parse(c.Intent, intent)), headers }), loadEngineCopy()]);
    return parse(c.IntentResult, body);
  }
  return {
    // The engine's copy is worded as a payload is parsed: its catalog loads beside the first request (D83).
    async view() {
      // The first view may already be on its way from the page's head (D87); a failed one is asked again.
      const early = suffix ? null : takeEarlyView(sessionId);
      const body = early ? early.catch(() => call('/view')) : call('/view');
      const [b, c] = await Promise.all([body, contract(), loadEngineCopy()]);
      return parse(c.EngineView, b);
    },
    send: intent => sendWithId(intent),
    sendWithId,
    async *streamTurn(interactionId, turn, signal) {
      let res: Response;
      try {
        res = await fetchImpl(`${root}/interactions/${encodeURIComponent(interactionId)}/turns/${encodeURIComponent(turn.id)}/stream`, { headers: { accept: 'text/event-stream' }, credentials: 'include', signal });
      } catch {
        if (signal.aborted) return;
        yield { type: 'error', retryable: true };
        return;
      }
      const { readSse } = await import('../ai/sse');
      yield* readSse(res, signal);
    }
  };
}

/** Defers loading a client until first use, so the mock engine stays out of the initial bundle. */
export function lazyClient(load: () => Promise<EngineClient>): EngineClient {
  let client: Promise<EngineClient> | null = null;
  // A failed load is not cached: the next call tries again.
  const get = () => (client ??= load().catch(e => { client = null; throw e; }));
  return {
    view: async () => (await get()).view(),
    send: async i => (await get()).send(i),
    async *streamTurn(id, turn, signal) { yield* (await get()).streamTurn(id, turn, signal); }
  };
}

/**
 * The demo round's engine (D92): the server's demo resource, or a mock engine of its own on the same
 * storyline and the demo seed. Either way it is a separate engine, so the real run is never touched.
 * `end` drops it on the server.
 */
export function createDemoClient(sessionId = 'local', fetchImpl: typeof fetch = fetch): EngineClient & { end(): Promise<void> } {
  const url = import.meta.env.VITE_ILEAD_ENGINE_URL as string | undefined;
  if (url) {
    const c = createHttpClient(url, sessionId, fetchImpl, '/demo');
    const end = () => fetchImpl(`${url.replace(/\/$/, '')}/sessions/${encodeURIComponent(sessionId)}/demo`, { method: 'DELETE', credentials: 'include' }).then(() => undefined, () => undefined);
    return { view: c.view, send: c.send, streamTurn: c.streamTurn, end };
  }
  const q = new URLSearchParams(globalThis.location?.search ?? '');
  const c = lazyClient(() => import('./mock').then(m => m.createMockDemoClient({ lens: q.get('lens') })));
  return { ...c, end: async () => undefined };
}

/** HTTP when `VITE_ILEAD_ENGINE_URL` is set, otherwise the mock engine, loaded on first use. */
export function createDefaultClient(sessionId = 'local'): EngineClient {
  const url = import.meta.env.VITE_ILEAD_ENGINE_URL as string | undefined;
  // `?period=N` opens the mock at a later period, for demos and tests. The real engine ignores it.
  // `?lens=six_styles` plays the mock with the Six Leadership Styles test lens (D70).
  const q = new URLSearchParams(globalThis.location?.search ?? '');
  const period = Number(q.get('period')) || undefined;
  return url ? createHttpClient(url, sessionId) : lazyClient(() => import('./mock').then(m => m.createMockClient({ startPeriod: period, lens: q.get('lens') })));
}
