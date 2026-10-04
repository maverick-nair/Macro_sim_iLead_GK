import { EngineView, Intent, IntentResult } from './contract';

/**
 * The one way the UI talks to the engine. Two adapters: the in-browser mock, which runs the same
 * engine code against a storyline fixture, and HTTP to the authoritative server. Both return
 * payloads parsed by the contract, so the copy rules apply to engine text either way.
 */
export interface EngineClient {
  view(): Promise<EngineView>;
  send(intent: Intent): Promise<IntentResult>;
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
      res = await fetchImpl(`${root}${path}`, { ...init, headers: { 'content-type': 'application/json', ...init?.headers } });
    } catch {
      throw new EngineError('Network error', 'network', true);
    }
    const body = await res.json().catch(() => null);
    if (!res.ok) throw new EngineError(body?.message ?? res.statusText, body?.code ?? `http${res.status}`, res.status >= 500);
    return body;
  }
  return {
    async view() {
      return parse(EngineView, await call('/view'));
    },
    async send(intent) {
      return parse(IntentResult, await call('/intents', { method: 'POST', body: JSON.stringify(parse(Intent, intent)) }));
    }
  };
}

/** Defers loading a client until first use, so the mock engine stays out of the initial bundle. */
export function lazyClient(load: () => Promise<EngineClient>): EngineClient {
  let client: Promise<EngineClient> | null = null;
  const get = () => (client ??= load());
  return { view: async () => (await get()).view(), send: async i => (await get()).send(i) };
}

/** HTTP when `VITE_ILEAD_ENGINE_URL` is set, otherwise the mock engine, loaded on first use. */
export function createDefaultClient(sessionId = 'local'): EngineClient {
  const url = import.meta.env.VITE_ILEAD_ENGINE_URL as string | undefined;
  return url ? createHttpClient(url, sessionId) : lazyClient(() => import('./mock').then(m => m.createMockClient()));
}
