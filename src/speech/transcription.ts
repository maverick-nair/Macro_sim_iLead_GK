import { z } from 'zod';
import type { SpeechError, SpeechMode } from './types';

/**
 * Server side transcription. The browser never transcribes: MediaRecorderSpeechProvider streams
 * audio chunks to a `TranscriptionClient` and the server returns partial and final text. Only that
 * text is ever scored ("score the words, not the voice").
 */
export interface TranscriptionCallbacks {
  onPartial(text: string): void;
  onFinal(text: string): void;
  onError(error: SpeechError): void;
}

export interface TranscriptionOpenOptions extends TranscriptionCallbacks {
  /** Container and codec of the chunks, as MediaRecorder reports it, for example `audio/webm;codecs=opus`. */
  mimeType: string;
  mode: SpeechMode;
  /** BCP 47 language of the interaction, when known. */
  language?: string;
}

export interface TranscriptionStream {
  /** Queues one audio chunk. Chunks are delivered in order. */
  send(chunk: Blob): void;
  /** No more audio. Resolves once every final segment has been delivered through `onFinal`. */
  finish(): Promise<void>;
  /** Drops the stream; the server discards the audio. No further callbacks fire. */
  abort(): void;
}

export interface TranscriptionClient {
  open(options: TranscriptionOpenOptions): TranscriptionStream;
}

/* ------------------------------------------------------------------------------------------------
 * HTTP client
 *
 * Endpoint contract (also in docs/SPEECH.md). Chunked POSTs rather than one streaming request body,
 * because fetch upload streaming (duplex: 'half') is Chromium only and needs HTTP/2.
 *
 *   POST   {base}/transcriptions
 *          JSON { mimeType, mode, language? }                        -> 201 JSON { id }
 *   POST   {base}/transcriptions/{id}/chunks?seq={n}
 *          body: raw audio bytes, Content-Type: the mimeType          -> 200 JSON { results }
 *          seq starts at 0 and has no gaps. Chunk 0 carries the container header, so the server
 *          appends chunks by seq. A repeated seq must be ignored (safe retry).
 *   POST   {base}/transcriptions/{id}/end                              -> 200 JSON { results }
 *          No more audio. The response holds every remaining final segment.
 *   DELETE {base}/transcriptions/{id}                                  -> 204
 *          Cancel. The server discards audio and text.
 *
 *   results: Array<{ kind: 'partial' | 'final', text: string }>, in order. A partial replaces the
 *   previous partial; a final commits a segment and clears the partial.
 *
 * The server must not keep audio after transcription, must not score anything but the transcript,
 * and must not run emotion inference on the audio.
 * ---------------------------------------------------------------------------------------------- */

const Result = z.object({ kind: z.enum(['partial', 'final']), text: z.string() });
const Results = z.object({ results: z.array(Result) });
const Created = z.object({ id: z.string().min(1) });

export interface HttpTranscriptionOptions {
  fetch?: typeof fetch;
  /** Extra headers, for example auth. */
  headers?: Record<string, string>;
}

export function createHttpTranscriptionClient(baseUrl: string, options: HttpTranscriptionOptions = {}): TranscriptionClient {
  const base = baseUrl.replace(/\/+$/, '');
  const doFetch = options.fetch ?? ((...a: Parameters<typeof fetch>) => fetch(...a));
  const headers = options.headers ?? {};

  return {
    open(o) {
      const abort = new AbortController();
      let closed = false;
      let failed = false;
      let seq = 0;
      const fail = (message: string) => {
        if (closed || failed) return;
        failed = true;
        o.onError({ code: 'network', recoverable: true, message });
      };
      const deliver = (body: unknown) => {
        const parsed = Results.safeParse(body);
        if (!parsed.success) return fail('malformed transcription response');
        if (closed) return;
        for (const r of parsed.data.results) (r.kind === 'final' ? o.onFinal : o.onPartial)(r.text);
      };
      const call = async (path: string, init: RequestInit) => {
        const res = await doFetch(`${base}${path}`, { ...init, headers: { ...headers, ...(init.headers as Record<string, string>) }, signal: abort.signal });
        if (!res.ok) throw new Error(`transcription ${path} failed with ${res.status}`);
        return res.status === 204 ? null : res.json();
      };
      const id = call('/transcriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mimeType: o.mimeType, mode: o.mode, language: o.language })
      }).then(b => Created.parse(b).id);
      // Every request after creation runs in order on this chain, so chunks arrive by seq.
      let chain: Promise<unknown> = id.catch(e => fail(String(e)));
      const enqueue = (step: (id: string) => Promise<void>) => {
        chain = chain.then(async () => {
          if (closed || failed) return;
          try {
            await step(await id);
          } catch (e) {
            fail(String(e));
          }
        });
        return chain;
      };
      return {
        send(chunk) {
          if (closed || failed) return;
          const n = seq++;
          void enqueue(async sid => deliver(await call(`/transcriptions/${sid}/chunks?seq=${n}`, { method: 'POST', headers: { 'Content-Type': o.mimeType }, body: chunk })));
        },
        async finish() {
          await enqueue(async sid => deliver(await call(`/transcriptions/${sid}/end`, { method: 'POST' })));
        },
        abort() {
          if (closed) return;
          closed = true;
          abort.abort();
          id.then(sid => doFetch(`${base}/transcriptions/${sid}`, { method: 'DELETE', headers })).catch(() => {});
        }
      };
    }
  };
}

/* ------------------------------------------------------------------------------------------------
 * Mock client
 * ---------------------------------------------------------------------------------------------- */

export interface MockTranscriptionOptions {
  /** Words revealed per audio chunk. Default 2. */
  wordsPerChunk?: number;
  /** Fail with a network error after this many chunks. */
  failAfterChunks?: number;
}

export interface MockTranscriptionClient extends TranscriptionClient {
  /** What the client received, for assertions. */
  readonly received: { streams: number; chunks: number; bytes: number; mimeTypes: string[]; finished: number; aborted: number };
}

/**
 * Pretends to transcribe: each audio chunk reveals the next words of `script` as a partial, and a
 * segment becomes final once all its words are out. `finish()` commits whatever is left of the
 * script, the way a real recognizer catches up after the last chunk. `script` is one segment or a
 * list of segments; it restarts for every stream.
 */
export function createMockTranscriptionClient(script: string | string[], options: MockTranscriptionOptions = {}): MockTranscriptionClient {
  const segments = (Array.isArray(script) ? script : [script]).map(s => s.split(/\s+/).filter(Boolean));
  const per = options.wordsPerChunk ?? 2;
  const received = { streams: 0, chunks: 0, bytes: 0, mimeTypes: [] as string[], finished: 0, aborted: 0 };
  return {
    received,
    open(o) {
      received.streams++;
      received.mimeTypes.push(o.mimeType);
      let seg = 0;
      let word = 0;
      let chunks = 0;
      let closed = false;
      const reveal = (n: number) => {
        while (n > 0 && seg < segments.length) {
          const words = segments[seg]!;
          const take = Math.min(n, words.length - word);
          word += take;
          n -= take;
          if (word >= words.length) {
            o.onFinal(words.join(' '));
            seg++;
            word = 0;
          } else o.onPartial(words.slice(0, word).join(' '));
        }
      };
      return {
        send(chunk) {
          if (closed) return;
          received.chunks++;
          received.bytes += chunk.size;
          chunks++;
          if (options.failAfterChunks !== undefined && chunks > options.failAfterChunks) {
            closed = true;
            o.onError({ code: 'network', recoverable: true, message: 'mock transcription failure' });
            return;
          }
          queueMicrotask(() => !closed && reveal(per));
        },
        async finish() {
          await Promise.resolve();
          if (closed) return;
          received.finished++;
          reveal(Infinity);
          closed = true;
        },
        abort() {
          if (!closed) received.aborted++;
          closed = true;
        }
      };
    }
  };
}
