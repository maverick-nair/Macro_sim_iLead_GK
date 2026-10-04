import { parseStoryline, type StorylineConfig } from './config';
import { EngineView, Intent, IntentResult } from './contract';
import type { Evaluator } from './sim/evaluator';
import { createEngine, IntentError } from './sim/engine';
import salesElevator from './storylines/sales-elevator.json';

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

function parse<T>(schema: { safeParse(v: unknown): { success: true; data: T } | { success: false; error: { message: string } } }, value: unknown): T {
  const r = schema.safeParse(value);
  if (!r.success) throw new EngineError(r.error.message, 'badPayload');
  return r.data;
}

export function defaultStoryline(): StorylineConfig {
  const r = parseStoryline(salesElevator);
  if (!r.ok) throw new Error(r.issues.join('\n'));
  return r.config;
}

export function createMockClient(opts: { config?: StorylineConfig; seed?: number; evaluator?: Evaluator; latencyMs?: number } = {}): EngineClient {
  const engine = createEngine(opts.config ?? defaultStoryline(), { seed: opts.seed ?? 1, evaluator: opts.evaluator });
  const wait = () => (opts.latencyMs ? new Promise(r => setTimeout(r, opts.latencyMs)) : Promise.resolve());
  return {
    async view() {
      await wait();
      return parse(EngineView, engine.view());
    },
    async send(intent) {
      const checked = parse(Intent, intent);
      await wait();
      try {
        return parse(IntentResult, await engine.dispatch(checked));
      } catch (e) {
        if (e instanceof IntentError) throw new EngineError(e.message, e.code);
        throw e;
      }
    }
  };
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

/** HTTP when `VITE_ILEAD_ENGINE_URL` is set, otherwise the mock engine. */
export function createDefaultClient(sessionId = 'local'): EngineClient {
  const url = import.meta.env.VITE_ILEAD_ENGINE_URL as string | undefined;
  return url ? createHttpClient(url, sessionId) : createMockClient();
}
