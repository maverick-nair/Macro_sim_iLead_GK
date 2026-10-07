import { readSse } from '../ai/sse';
import { loadEngineCopy } from '../i18n/locales';
import { EngineView, Intent, IntentResult, type StreamChunk } from './contract';

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

export function createHttpClient(baseUrl: string, sessionId: string, fetchImpl: typeof fetch = fetch): EngineClient {
  const root = `${baseUrl.replace(/\/$/, '')}/sessions/${encodeURIComponent(sessionId)}`;
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
  return {
    // The engine's copy is worded as a payload is parsed: its catalog loads beside the first request (D83).
    async view() {
      const [body] = await Promise.all([call('/view'), loadEngineCopy()]);
      return parse(EngineView, body);
    },
    async send(intent) {
      const [body] = await Promise.all([call('/intents', { method: 'POST', body: JSON.stringify(parse(Intent, intent)) }), loadEngineCopy()]);
      return parse(IntentResult, body);
    },
    async *streamTurn(interactionId, turn, signal) {
      let res: Response;
      try {
        res = await fetchImpl(`${root}/interactions/${encodeURIComponent(interactionId)}/turns/${encodeURIComponent(turn.id)}/stream`, { headers: { accept: 'text/event-stream' }, credentials: 'include', signal });
      } catch {
        if (signal.aborted) return;
        yield { type: 'error', retryable: true };
        return;
      }
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

/** HTTP when `VITE_ILEAD_ENGINE_URL` is set, otherwise the mock engine, loaded on first use. */
export function createDefaultClient(sessionId = 'local'): EngineClient {
  const url = import.meta.env.VITE_ILEAD_ENGINE_URL as string | undefined;
  // `?period=N` opens the mock at a later period, for demos and tests. The real engine ignores it.
  // `?lens=six_styles` plays the mock with the Six Leadership Styles test lens (D70).
  const q = new URLSearchParams(globalThis.location?.search ?? '');
  const period = Number(q.get('period')) || undefined;
  return url ? createHttpClient(url, sessionId) : lazyClient(() => import('./mock').then(m => m.createMockClient({ startPeriod: period, lens: q.get('lens') })));
}
