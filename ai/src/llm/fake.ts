import { NO_USAGE, type LlmRequest, type LlmResult, type LlmStreamEvent, type LlmTransport } from './transport';

/**
 * A scripted transport for tests and recorded fixtures: no network. Each call takes the next scripted
 * reply (or computes one from the request). Requests are kept for assertions. Streaming splits the text
 * into small chunks and honours the abort signal between chunks.
 */

export type FakeReply =
  | string
  | { text: string; stopReason?: string; model?: string; usage?: Partial<LlmResult['usage']> }
  | { error: Error }
  | ((req: LlmRequest) => string | { text: string; stopReason?: string } | { error: Error });

export interface FakeTransport extends LlmTransport {
  readonly requests: LlmRequest[];
  /** Replies left in the script. */
  readonly pending: number;
}

export interface FakeOptions {
  /** Characters per streamed chunk. Default 6. */
  chunkSize?: number;
  /** Wait between streamed chunks, in ms. Default 0 (a microtask). */
  delayMs?: number;
  /** Reply when the script runs out. Default: throws. */
  fallback?: FakeReply;
}

const wait = (ms: number) => (ms > 0 ? new Promise(r => setTimeout(r, ms)) : Promise.resolve());

export function createFakeTransport(script: FakeReply[] = [], options: FakeOptions = {}): FakeTransport {
  const queue = [...script];
  const requests: LlmRequest[] = [];
  const next = (req: LlmRequest): LlmResult => {
    requests.push(structuredClone(req));
    let r = queue.length ? queue.shift()! : options.fallback;
    if (r === undefined) throw new Error(`fake transport: no scripted reply for ${req.label}`);
    if (typeof r === 'function') r = r(req);
    if (typeof r === 'string') r = { text: r };
    if ('error' in r) throw r.error;
    const rr = r as { text: string; stopReason?: string; model?: string; usage?: Partial<LlmResult['usage']> };
    return { text: rr.text, stopReason: rr.stopReason ?? 'end_turn', model: rr.model ?? req.settings.model, usage: { ...NO_USAGE, ...(rr.usage ?? {}) } };
  };
  return {
    requests,
    get pending() { return queue.length; },
    async complete(req, signal) {
      if (signal?.aborted) throw Object.assign(new Error('aborted'), { name: 'AbortError' });
      return next(req);
    },
    async *stream(req, signal): AsyncGenerator<LlmStreamEvent> {
      if (signal?.aborted) return;
      const result = next(req);
      const size = options.chunkSize ?? 6;
      for (let i = 0; i < result.text.length; i += size) {
        await wait(options.delayMs ?? 0);
        if (signal?.aborted) return;
        yield { type: 'text', text: result.text.slice(i, i + size) };
      }
      if (signal?.aborted) return;
      yield { type: 'end', result };
    }
  };
}
