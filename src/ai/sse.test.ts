import { describe, expect, it, vi } from 'vitest';
import { readSse } from './sse';
import type { StreamChunk } from '../engine/contract';

/** A Response whose body arrives in the given pieces (strings or raw bytes). */
function response(pieces: Array<string | Uint8Array>, init: ResponseInit = {}) {
  const enc = new TextEncoder();
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({
    pull(ctl) {
      const p = pieces.shift();
      if (p === undefined) return ctl.close();
      ctl.enqueue(typeof p === 'string' ? enc.encode(p) : p);
    },
    cancel() {
      cancelled = true;
    }
  });
  return { res: new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' }, ...init }), cancelled: () => cancelled };
}

async function all(it: AsyncIterable<StreamChunk>) {
  const out: StreamChunk[] = [];
  for await (const c of it) out.push(c);
  return out;
}

const ev = (c: StreamChunk) => `data: ${JSON.stringify(c)}\n\n`;

describe('readSse', () => {
  it('parses events into validated chunks', async () => {
    const { res } = response([ev({ type: 'token', text: 'Hello' }) + ev({ type: 'token', text: ' there' }), ev({ type: 'done', turnId: 't1' })]);
    expect(await all(readSse(res))).toEqual([
      { type: 'token', text: 'Hello' },
      { type: 'token', text: ' there' },
      { type: 'done', turnId: 't1' }
    ]);
  });

  it('handles events, lines, CRLF and UTF 8 characters split across network chunks', async () => {
    const text = 'Café 👍';
    const bytes = new TextEncoder().encode(`data: {"type":"token","text":"${text}"}\r\n\r\n`);
    const cut = bytes.indexOf(0xc3) + 1; // inside the two byte "é"
    const crlf = bytes.length - 3; // between \r and \n of the first line end
    const { res } = response([
      bytes.slice(0, cut),
      bytes.slice(cut, crlf),
      bytes.slice(crlf),
      'da',
      'ta: {"type":"tok',
      'en","text":" ok"}\r',
      '\n',
      '\r\n',
      'data: {"type":"done","turnId":"t2"}\n\n'
    ]);
    expect(await all(readSse(res))).toEqual([
      { type: 'token', text },
      { type: 'token', text: ' ok' },
      { type: 'done', turnId: 't2' }
    ]);
  });

  it('joins multi line data and ignores comments, event, id and retry fields', async () => {
    const { res } = response([': keep alive\n', 'event: chunk\nid: 7\nretry: 1000\n', 'data: {"type":\ndata: "token","text":"a"}\n\n', 'data:{"type":"done","turnId":"x"}\n\n']);
    expect(await all(readSse(res))).toEqual([
      { type: 'token', text: 'a' },
      { type: 'done', turnId: 'x' }
    ]);
  });

  it('skips malformed events and keeps going', async () => {
    const onMalformed = vi.fn();
    const { res } = response([
      'data: not json\n\n',
      ev({ type: 'token', text: 'ok' }),
      'data: {"type":"token"}\n\n',
      'data: {"type":"mystery","text":"x"}\n\n',
      'data: [DONE]\n\n',
      ev({ type: 'done', turnId: 't' })
    ]);
    expect(await all(readSse(res, undefined, { onMalformed }))).toEqual([
      { type: 'token', text: 'ok' },
      { type: 'done', turnId: 't' }
    ]);
    expect(onMalformed).toHaveBeenCalledTimes(3);
    expect(onMalformed.mock.calls[0]).toEqual(['not json', 'not JSON']);
  });

  it('stops after done and cancels the rest of the body', async () => {
    const r = response([ev({ type: 'done', turnId: 't' }), ev({ type: 'token', text: 'after' })]);
    expect(await all(readSse(r.res))).toEqual([{ type: 'done', turnId: 't' }]);
    await Promise.resolve();
    expect(r.cancelled()).toBe(true);
  });

  it('passes an error chunk through and ends', async () => {
    const { res } = response([ev({ type: 'token', text: 'a' }), ev({ type: 'error', retryable: false }), ev({ type: 'token', text: 'b' })]);
    expect(await all(readSse(res))).toEqual([
      { type: 'token', text: 'a' },
      { type: 'error', retryable: false }
    ]);
  });

  it('reports a cut off stream as a retryable error, and dispatches a last event without its blank line', async () => {
    expect(await all(readSse(response([ev({ type: 'token', text: 'a' })]).res))).toEqual([
      { type: 'token', text: 'a' },
      { type: 'error', retryable: true }
    ]);
    expect(await all(readSse(response(['data: {"type":"done","turnId":"t"}']).res))).toEqual([{ type: 'done', turnId: 't' }]);
  });

  it('maps HTTP failures to error chunks', async () => {
    expect(await all(readSse(new Response('x', { status: 503 })))).toEqual([{ type: 'error', retryable: true }]);
    expect(await all(readSse(new Response('x', { status: 429 })))).toEqual([{ type: 'error', retryable: true }]);
    expect(await all(readSse(new Response('x', { status: 400 })))).toEqual([{ type: 'error', retryable: false }]);
  });

  it('aborts mid stream: ends quietly and cancels the body', async () => {
    let push: (s: string) => void = () => {};
    let cancelled = false;
    const enc = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      start(ctl) {
        push = s => ctl.enqueue(enc.encode(s));
      },
      cancel() {
        cancelled = true;
      }
    });
    const ac = new AbortController();
    const out: StreamChunk[] = [];
    const reading = (async () => {
      for await (const c of readSse(new Response(body), ac.signal)) {
        out.push(c);
        if (out.length === 1) setTimeout(() => ac.abort(), 0);
      }
    })();
    push(ev({ type: 'token', text: 'one' }));
    await reading;
    expect(out).toEqual([{ type: 'token', text: 'one' }]);
    expect(cancelled).toBe(true);
  });
});
