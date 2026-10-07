import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { ServerContext } from '../context';
import { forbidden, HttpError, notFound } from '../http/errors';
import type { TranscriptionSession, TranscriptResult, Transcriber } from '../ports';

const Err = { description: 'Error: `{ message, code }`' };
const Results = z.object({ results: z.array(z.object({ kind: z.enum(['partial', 'final']), text: z.string() })) });

interface Open { owner: string; session: TranscriptionSession; next: number; touched: number }

/** A batch transcriber behind the streaming contract: chunks are buffered, transcribed on `end`, then dropped. */
function sessionOf(t: Transcriber, opts: { mimeType: string; mode: string; language?: string }): Promise<TranscriptionSession> | TranscriptionSession {
  if ('open' in t) return t.open(opts);
  const parts: Uint8Array[] = [];
  return {
    async chunk(audio) { parts.push(audio); return []; },
    async end() {
      const audio = Buffer.concat(parts);
      parts.length = 0;
      const r = await t.transcribe({ audio, mimeType: opts.mimeType, language: opts.language });
      const text = typeof r === 'string' ? r : r.text;
      return text.trim() ? [{ kind: 'final', text }] : [];
    },
    cancel() { parts.length = 0; }
  };
}

/**
 * Speech transcription proxy (src/speech/transcription.ts, docs/SPEECH.md): chunked uploads, one request at
 * a time, transcript only. Audio lives in memory for one transcription and is never stored or logged.
 * Open transcriptions are per instance: with several instances, route `/speech/*` by session (sticky).
 */
export function registerSpeech(ctx: ServerContext) {
  const { routes } = ctx;
  const open = new Map<string, Open>();
  const IDLE_MS = 5 * 60_000;
  const sweep = setInterval(() => {
    const t = Date.now();
    for (const [id, o] of open) if (t - o.touched > IDLE_MS) { void o.session.cancel(); open.delete(id); }
  }, 60_000);
  sweep.unref();

  const get = (id: string, who: string) => {
    const o = open.get(id);
    if (!o) throw notFound('No such transcription', 'unknownTranscription');
    if (o.owner !== who) throw forbidden();
    o.touched = Date.now();
    return o;
  };
  const off = () => new HttpError(501, 'speechOff', 'Speech is not set up here.');

  routes.add({ method: 'post', path: '/speech/transcriptions', tag: 'speech', auth: ['participant'], limit: 'ai',
    body: z.object({ mimeType: z.string().min(3).max(100).regex(/^audio\/[\w.+-]+(;\s*codecs=[\w.,"' -]+)?$/), mode: z.string().min(1).max(20), language: z.string().max(35).optional() }),
    summary: 'Start a transcription', responses: { 201: { description: '{ id }', schema: z.object({ id: z.string() }) }, 501: Err }
  }, async (c, { body, principal }) => {
    if (!ctx.ai.transcriber) throw off();
    const id = randomUUID();
    open.set(id, { owner: principal!.id, session: await sessionOf(ctx.ai.transcriber, body), next: 0, touched: Date.now() });
    return c.json({ id }, 201);
  });

  routes.add({ method: 'post', path: '/speech/transcriptions/{id}/chunks', tag: 'speech', auth: ['participant'], rawBody: 'audio/*',
    query: z.object({ seq: z.coerce.number().int().min(0) }),
    summary: 'One audio chunk, in order (seq from 0; a repeated seq is ignored)', responses: { 200: { description: 'Results', schema: Results }, 404: Err, 409: Err, 413: Err }
  }, async (c, { params, query, principal }) => {
    const o = get(params.id, principal!.id);
    const audio = new Uint8Array(await c.req.arrayBuffer());
    if (audio.byteLength > ctx.config.AUDIO_CHUNK_LIMIT_KB * 1024) throw new HttpError(413, 'tooLarge', 'The audio chunk is too large.');
    if (query.seq < o.next) return c.json({ results: [] });
    if (query.seq > o.next) throw new HttpError(409, 'outOfOrder', `Expected chunk ${o.next}`);
    o.next++;
    const results: TranscriptResult[] = await o.session.chunk(audio, query.seq);
    return c.json({ results });
  });

  routes.add({ method: 'post', path: '/speech/transcriptions/{id}/end', tag: 'speech', auth: ['participant'],
    summary: 'No more audio: every remaining final segment', responses: { 200: { description: 'Results', schema: Results }, 404: Err }
  }, async (c, { params, principal }) => {
    const o = get(params.id, principal!.id);
    try {
      return c.json({ results: await o.session.end() });
    } finally {
      open.delete(params.id);
    }
  });

  routes.add({ method: 'delete', path: '/speech/transcriptions/{id}', tag: 'speech', auth: ['participant'],
    summary: 'Cancel: the audio and text are dropped', responses: { 204: { description: 'Cancelled' } }
  }, async (c, { params, principal }) => {
    const o = open.get(params.id);
    if (o && o.owner === principal!.id) { await o.session.cancel(); open.delete(params.id); }
    return c.body(null, 204);
  });

  return () => clearInterval(sweep);
}
