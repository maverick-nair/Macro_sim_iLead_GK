import { describe, expect, it, vi } from 'vitest';
import type { TranscriptResult } from '../types';
import { createHttpTranscriber, createMockTranscriber, TranscriberError } from './transcriber';

const chunk = new Uint8Array([1, 2, 3]);

describe('the mock transcriber', () => {
  it('reveals partials per chunk, commits finals, ignores a repeated seq and finishes on end', async () => {
    const seen: TranscriptResult[] = [];
    const s = await createMockTranscriber(['one two three', 'four'], 2).open({ mimeType: 'audio/webm', mode: 'pushToTalk', onResult: r => seen.push(r) });
    expect(await s.push(chunk, 0)).toEqual([{ kind: 'partial', text: 'one two' }]);
    expect(await s.push(chunk, 0)).toEqual([]);
    expect(await s.push(chunk, 1)).toEqual([{ kind: 'final', text: 'one two three' }, { kind: 'final', text: 'four' }]);
    expect(await s.end()).toEqual([]);
    expect(seen.map(r => r.kind)).toEqual(['partial', 'final', 'final']);
    await expect(s.push(chunk, 2)).rejects.toBeInstanceOf(TranscriberError);
  });

  it('refuses a gap in the sequence', async () => {
    const s = await createMockTranscriber('a b c').open({ mimeType: 'audio/webm', mode: 'openMic' });
    await expect(s.push(chunk, 3)).rejects.toMatchObject({ code: 'gap' });
  });
});

function fakeService(results: Record<string, unknown> = {}) {
  const calls: Array<{ url: string; method: string; headers: Record<string, string>; body: unknown }> = [];
  const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const u = String(url);
    calls.push({ url: u, method: init?.method ?? 'GET', headers: init?.headers as Record<string, string>, body: init?.body });
    if (init?.method === 'DELETE') return new Response(null, { status: 204 });
    if (u.endsWith('/transcriptions')) return Response.json({ id: 't 1' }, { status: 201 });
    const key = Object.keys(results).find(k => u.includes(k));
    const body = key ? results[key] : { results: [] };
    return body instanceof Response ? body : Response.json(body);
  });
  return { calls, fetchImpl };
}

describe('the HTTP transcriber', () => {
  it('speaks the chunked contract to the configured service with the key', async () => {
    const { calls, fetchImpl } = fakeService({ 'seq=0': { results: [{ kind: 'partial', text: 'hel' }] }, '/end': { results: [{ kind: 'final', text: 'hello there' }] } });
    const t = createHttpTranscriber({ url: 'https://speech.example/v1/', key: 'k-123', fetch: fetchImpl as typeof fetch });
    const s = await t.open({ mimeType: 'audio/webm;codecs=opus', mode: 'pushToTalk', language: 'en-US' });
    expect(s.id).toBe('t 1');
    expect(await s.push(chunk, 0)).toEqual([{ kind: 'partial', text: 'hel' }]);
    expect(await s.end()).toEqual([{ kind: 'final', text: 'hello there' }]);
    expect(calls.map(c => `${c.method} ${c.url}`)).toEqual([
      'POST https://speech.example/v1/transcriptions',
      'POST https://speech.example/v1/transcriptions/t%201/chunks?seq=0',
      'POST https://speech.example/v1/transcriptions/t%201/end'
    ]);
    expect(calls[0].headers.Authorization).toBe('Bearer k-123');
    expect(JSON.parse(calls[0].body as string)).toEqual({ mimeType: 'audio/webm;codecs=opus', mode: 'pushToTalk', language: 'en-US' });
    expect(calls[1].headers['Content-Type']).toBe('audio/webm;codecs=opus');
  });

  it('sends the key in a custom header without a scheme', async () => {
    const { calls, fetchImpl } = fakeService();
    const t = createHttpTranscriber({ url: 'https://s', key: 'abc', authHeader: 'x-api-key', authScheme: '', fetch: fetchImpl as typeof fetch });
    await t.open({ mimeType: 'audio/webm', mode: 'openMic' });
    expect(calls[0].headers['x-api-key']).toBe('abc');
    expect(calls[0].headers.Authorization).toBeUndefined();
  });

  it('turns an HTTP failure or a malformed body into a TranscriberError, and cancels with DELETE', async () => {
    const { calls, fetchImpl } = fakeService({ 'seq=0': new Response('no', { status: 502 }), 'seq=1': { nope: true } });
    const s = await createHttpTranscriber({ url: 'https://s', fetch: fetchImpl as typeof fetch }).open({ mimeType: 'audio/webm', mode: 'openMic' });
    await expect(s.push(chunk, 0)).rejects.toMatchObject({ code: 'http' });
    await expect(s.push(chunk, 1)).rejects.toMatchObject({ code: 'malformed' });
    await s.abort();
    expect(calls.at(-1)!.method).toBe('DELETE');
    await expect(s.push(chunk, 2)).rejects.toMatchObject({ code: 'closed' });
  });
});
