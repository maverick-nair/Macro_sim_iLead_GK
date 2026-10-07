import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { silentLogger, type HttpSpeechSettings } from '../config';
import type { AiLogger, Transcriber, TranscriberOpenOptions, TranscriberSession, TranscriptResult } from '../types';

/**
 * Server side speech to text. The browser posts audio chunks to the server (docs/SPEECH.md); the server
 * forwards them to a `Transcriber` and returns the text. Only text comes back: no audio is kept and
 * nothing is inferred from the voice.
 *
 * `createHttpTranscriber` is vendor neutral: it speaks the same chunked contract the browser uses, to
 * the service at `url`, with the key in a header. A vendor with that contract plugs in directly; any
 * other vendor (websocket streaming, a different body shape) needs a thin shim in front of it, or a new
 * `Transcriber` beside this one (docs/AI.md, Speech).
 */

export class TranscriberError extends Error {
  constructor(message: string, readonly code: 'gap' | 'closed' | 'http' | 'malformed' | 'timeout') { super(message); this.name = 'TranscriberError'; }
}

/** Shared bookkeeping: `seq` order, repeated `seq` ignored, nothing after end or abort. */
function sequencer() {
  let next = 0;
  let chain: Promise<unknown> = Promise.resolve();
  return {
    /** Runs `step` after every earlier one; a repeated seq resolves to no results. */
    run<T>(seq: number, step: () => Promise<T>, none: T): Promise<T> {
      if (seq < next) return Promise.resolve(none);
      if (seq > next) return Promise.reject(new TranscriberError(`chunk ${seq} arrived before chunk ${next}`, 'gap'));
      next++;
      const p = chain.then(step);
      chain = p.catch(() => {});
      return p;
    },
    after<T>(step: () => Promise<T>): Promise<T> {
      const p = chain.then(step);
      chain = p.catch(() => {});
      return p;
    }
  };
}

const Result = z.object({ kind: z.enum(['partial', 'final']), text: z.string() });
const Results = z.object({ results: z.array(Result) });
const Created = z.object({ id: z.string().min(1) });

export function createHttpTranscriber(s: HttpSpeechSettings, logger: AiLogger = silentLogger): Transcriber {
  const base = s.url.replace(/\/+$/, '');
  const doFetch = s.fetch ?? ((...a: Parameters<typeof fetch>) => fetch(...a));
  const auth: Record<string, string> = s.key ? { [s.authHeader ?? 'Authorization']: `${s.authScheme ?? 'Bearer'} ${s.key}`.trim() } : {};
  const timeout = s.timeoutMs ?? 15_000;

  async function call(path: string, init: RequestInit, signal?: AbortSignal): Promise<unknown> {
    const signals = [AbortSignal.timeout(timeout), ...(signal ? [signal] : [])];
    let res: Response;
    try {
      res = await doFetch(`${base}${path}`, { ...init, headers: { ...s.headers, ...auth, ...(init.headers as Record<string, string>) }, signal: AbortSignal.any(signals) });
    } catch (e) {
      if (e instanceof Error && e.name === 'TimeoutError') throw new TranscriberError(`speech service timed out on ${path}`, 'timeout');
      throw e;
    }
    if (!res.ok) throw new TranscriberError(`speech service answered ${res.status} on ${path}`, 'http');
    return res.status === 204 ? null : res.json();
  }

  const results = (body: unknown, o: TranscriberOpenOptions): TranscriptResult[] => {
    const r = Results.safeParse(body);
    if (!r.success) throw new TranscriberError('speech service sent a malformed result', 'malformed');
    for (const x of r.data.results) o.onResult?.(x);
    return r.data.results;
  };

  return {
    provider: 'http',
    async open(o) {
      const created = Created.safeParse(await call('/transcriptions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mimeType: o.mimeType, mode: o.mode, language: o.language }) }, o.signal));
      if (!created.success) throw new TranscriberError('speech service sent no transcription id', 'malformed');
      const id = created.data.id;
      const seqs = sequencer();
      let closed = false;
      const live = () => { if (closed) throw new TranscriberError('the transcription has ended', 'closed'); };
      const session: TranscriberSession = {
        id,
        push(chunk, seq) {
          live();
          return seqs.run(seq, async () => results(await call(`/transcriptions/${encodeURIComponent(id)}/chunks?seq=${seq}`, { method: 'POST', headers: { 'Content-Type': o.mimeType }, body: chunk as Uint8Array<ArrayBuffer> }, o.signal), o), []);
        },
        end() {
          live();
          closed = true;
          return seqs.after(async () => results(await call(`/transcriptions/${encodeURIComponent(id)}/end`, { method: 'POST' }, o.signal), o));
        },
        async abort() {
          if (closed) return;
          closed = true;
          try {
            await call(`/transcriptions/${encodeURIComponent(id)}`, { method: 'DELETE' });
          } catch (e) {
            logger.warn('speech: cancel failed; the service should expire the audio itself', { id, error: String(e) });
          }
        }
      };
      return session;
    }
  };
}

/**
 * Pretends to transcribe: each chunk reveals the next words of the script as a partial, a segment turns
 * final once all its words are out, and `end` commits the rest (the same behaviour as the browser's
 * mock client in src/speech/transcription.ts).
 */
export function createMockTranscriber(script: string | string[] = 'Hello, I wanted to check in on how your week is going.', wordsPerChunk = 2): Transcriber {
  const segments = (Array.isArray(script) ? script : [script]).map(s => s.split(/\s+/).filter(Boolean));
  return {
    provider: 'mock',
    async open(o) {
      let seg = 0;
      let word = 0;
      let closed = false;
      const seqs = sequencer();
      const reveal = (n: number): TranscriptResult[] => {
        const out: TranscriptResult[] = [];
        while (n > 0 && seg < segments.length) {
          const words = segments[seg]!;
          const take = Math.min(n, words.length - word);
          word += take;
          n -= take;
          if (word >= words.length) { out.push({ kind: 'final', text: words.join(' ') }); seg++; word = 0; } else out.push({ kind: 'partial', text: words.slice(0, word).join(' ') });
        }
        for (const r of out) o.onResult?.(r);
        return out;
      };
      const live = () => { if (closed) throw new TranscriberError('the transcription has ended', 'closed'); };
      return {
        id: randomUUID(),
        push(_chunk, seq) { live(); return seqs.run(seq, async () => reveal(wordsPerChunk), []); },
        end() { live(); closed = true; return seqs.after(async () => reveal(Infinity)); },
        async abort() { closed = true; }
      };
    }
  };
}
