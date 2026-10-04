import { describe, expect, it, vi } from 'vitest';
import { createHttpTranscriptionClient, createMockTranscriptionClient, type TranscriptionOpenOptions } from './transcription';

function callbacks() {
  const log: string[] = [];
  const o: TranscriptionOpenOptions = {
    mimeType: 'audio/webm;codecs=opus',
    mode: 'pushToTalk',
    onPartial: t => log.push(`partial:${t}`),
    onFinal: t => log.push(`final:${t}`),
    onError: e => log.push(`error:${e.code}`)
  };
  return { o, log };
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('HTTP transcription client', () => {
  it('follows the endpoint contract: create, ordered chunks, end, and delivers results', async () => {
    const requests: Array<{ url: string; method: string; body: unknown; type?: string }> = [];
    const fetch = vi.fn(async (url: string, init: RequestInit) => {
      requests.push({ url, method: init.method!, body: init.body instanceof Blob ? init.body.size : init.body, type: (init.headers as Record<string, string>)['Content-Type'] });
      if (url.endsWith('/transcriptions')) return json({ id: 't1' }, 201);
      if (url.includes('/chunks?seq=0')) {
        await new Promise(r => setTimeout(r, 10)); // slow first chunk must not be overtaken
        return json({ results: [{ kind: 'partial', text: 'How is' }] });
      }
      if (url.includes('/chunks?seq=1')) return json({ results: [{ kind: 'final', text: 'How is it going?' }] });
      if (url.endsWith('/end')) return json({ results: [{ kind: 'final', text: 'Tell me more.' }] });
      return json({}, 404);
    });
    const client = createHttpTranscriptionClient('https://api.example/speech/', { fetch: fetch as unknown as typeof globalThis.fetch, headers: { Authorization: 'Bearer x' } });
    const { o, log } = callbacks();
    const s = client.open({ ...o, language: 'en' });
    s.send(new Blob([new Uint8Array(3)]));
    s.send(new Blob([new Uint8Array(5)]));
    await s.finish();
    expect(requests).toEqual([
      { url: 'https://api.example/speech/transcriptions', method: 'POST', body: JSON.stringify({ mimeType: 'audio/webm;codecs=opus', mode: 'pushToTalk', language: 'en' }), type: 'application/json' },
      { url: 'https://api.example/speech/transcriptions/t1/chunks?seq=0', method: 'POST', body: 3, type: 'audio/webm;codecs=opus' },
      { url: 'https://api.example/speech/transcriptions/t1/chunks?seq=1', method: 'POST', body: 5, type: 'audio/webm;codecs=opus' },
      { url: 'https://api.example/speech/transcriptions/t1/end', method: 'POST', body: undefined, type: undefined }
    ]);
    expect(log).toEqual(['partial:How is', 'final:How is it going?', 'final:Tell me more.']);
    expect((fetch.mock.calls[0]![1] as RequestInit).headers).toMatchObject({ Authorization: 'Bearer x' });
  });

  it('reports a recoverable network error once and stops sending', async () => {
    const fetch = vi.fn(async (url: string) => (url.endsWith('/transcriptions') ? json({ id: 't1' }) : json({}, 503)));
    const { o, log } = callbacks();
    const s = createHttpTranscriptionClient('/api', { fetch: fetch as unknown as typeof globalThis.fetch }).open(o);
    s.send(new Blob(['a']));
    s.send(new Blob(['b']));
    await s.finish();
    expect(log).toEqual(['error:network']);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('rejects malformed responses as a network error', async () => {
    const fetch = vi.fn(async (url: string) => (url.endsWith('/transcriptions') ? json({ id: 't1' }) : json({ results: [{ kind: 'maybe', text: 1 }] })));
    const { o, log } = callbacks();
    const s = createHttpTranscriptionClient('/api', { fetch: fetch as unknown as typeof globalThis.fetch }).open(o);
    s.send(new Blob(['a']));
    await s.finish();
    expect(log).toEqual(['error:network']);
  });

  it('abort cancels in flight requests, deletes the session and silences callbacks', async () => {
    const calls: string[] = [];
    const fetch = vi.fn(async (url: string, init: RequestInit) => {
      calls.push(`${init.method} ${url}`);
      if (url.endsWith('/transcriptions')) return json({ id: 't1' });
      return json({ results: [{ kind: 'final', text: 'late' }] });
    });
    const { o, log } = callbacks();
    const s = createHttpTranscriptionClient('/api', { fetch: fetch as unknown as typeof globalThis.fetch }).open(o);
    await Promise.resolve();
    s.abort();
    s.send(new Blob(['a']));
    await new Promise(r => setTimeout(r, 0));
    expect(log).toEqual([]);
    expect(calls).toEqual(['POST /api/transcriptions', 'DELETE /api/transcriptions/t1']);
  });
});

describe('mock transcription client', () => {
  it('reveals words per chunk and commits the rest on finish', async () => {
    const client = createMockTranscriptionClient(['one two three.', 'four five'], { wordsPerChunk: 2 });
    const { o, log } = callbacks();
    const s = client.open(o);
    s.send(new Blob(['x']));
    s.send(new Blob(['y']));
    await Promise.resolve();
    await s.finish();
    expect(log).toEqual(['partial:one two', 'final:one two three.', 'partial:four', 'final:four five']);
    expect(client.received).toMatchObject({ streams: 1, chunks: 2, bytes: 2, finished: 1 });
  });
});
