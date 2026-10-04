import { StreamChunk } from '../engine/contract';

export type { StreamChunk };

export interface ReadSseOptions {
  /** Called for every event whose data is not a valid StreamChunk. Such events are skipped. */
  onMalformed?: (data: string, reason: string) => void;
}

/**
 * Parses a Server Sent Events body into StreamChunk objects, validated with the engine contract.
 *
 * - Follows the SSE wire format: `data:` lines (joined with newlines) up to a blank line make one
 *   event; `event:`, `id:`, `retry:` and `:` comment lines are ignored; CRLF, CR and LF all work;
 *   events and UTF 8 characters may be split across network chunks.
 * - Malformed or unknown events are skipped (and reported to `onMalformed`), as is an OpenAI style
 *   `[DONE]` sentinel. One bad event never ends the reply.
 * - Ends after a `done` or `error` chunk. A body that ends without either yields a retryable error,
 *   since the reply was cut off. A failed HTTP status yields an error (retryable on 408, 429, 5xx).
 * - Aborting `signal` cancels the body and ends the iteration quietly.
 */
export async function* readSse(response: Response, signal?: AbortSignal, options: ReadSseOptions = {}): AsyncGenerator<StreamChunk> {
  if (!response.ok) {
    yield { type: 'error', retryable: response.status === 408 || response.status === 429 || response.status >= 500 };
    return;
  }
  if (!response.body) {
    yield { type: 'error', retryable: true };
    return;
  }
  if (signal?.aborted) {
    void response.body.cancel().catch(() => {});
    return;
  }
  const reader = response.body.getReader();
  const onAbort = () => void reader.cancel().catch(() => {});
  signal?.addEventListener('abort', onAbort, { once: true });
  const decoder = new TextDecoder();
  let buffer = '';
  let data: string[] = [];

  /** Turns one complete event's data into a chunk, or null when it is to be skipped. */
  const dispatch = (): StreamChunk | null => {
    if (!data.length) return null;
    const raw = data.join('\n');
    data = [];
    if (raw.trim() === '[DONE]') return null;
    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      options.onMalformed?.(raw, 'not JSON');
      return null;
    }
    const parsed = StreamChunk.safeParse(json);
    if (!parsed.success) {
      options.onMalformed?.(raw, parsed.error.issues.map(i => i.message).join('; '));
      return null;
    }
    return parsed.data;
  };

  /** Consumes complete lines from the buffer, returning the chunks they complete. */
  function* lines(final: boolean): Generator<StreamChunk> {
    for (;;) {
      const m = /\r\n|\r|\n/.exec(buffer);
      // A trailing CR may be the first half of a CRLF split across reads; wait for more.
      if (!m || (m[0] === '\r' && m.index === buffer.length - 1 && !final)) break;
      const line = buffer.slice(0, m.index);
      buffer = buffer.slice(m.index + m[0].length);
      if (line === '') {
        const chunk = dispatch();
        if (chunk) yield chunk;
        continue;
      }
      if (line.startsWith(':')) continue;
      const colon = line.indexOf(':');
      const field = colon === -1 ? line : line.slice(0, colon);
      let value = colon === -1 ? '' : line.slice(colon + 1);
      if (value.startsWith(' ')) value = value.slice(1);
      if (field === 'data') data.push(value);
    }
  }

  try {
    for (;;) {
      if (signal?.aborted) return;
      let result: ReadableStreamReadResult<Uint8Array>;
      try {
        result = await reader.read();
      } catch {
        if (signal?.aborted) return;
        yield { type: 'error', retryable: true };
        return;
      }
      if (signal?.aborted) return;
      if (result.done) {
        buffer += decoder.decode();
        // Lenient: a last event without its closing blank line is still dispatched.
        buffer += '\n\n';
        for (const chunk of lines(true)) {
          yield chunk;
          if (chunk.type !== 'token') return;
        }
        break;
      }
      buffer += decoder.decode(result.value, { stream: true });
      for (const chunk of lines(false)) {
        if (signal?.aborted) return;
        yield chunk;
        if (chunk.type !== 'token') return;
      }
    }
    // The body ended without `done` or `error`: the reply was cut off.
    if (!signal?.aborted) yield { type: 'error', retryable: true };
  } finally {
    signal?.removeEventListener('abort', onAbort);
    // Also runs when the consumer stops early (break, return): the body is never left open.
    void reader.cancel().catch(() => {});
  }
}
