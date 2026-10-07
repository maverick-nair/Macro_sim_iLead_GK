import { describe, expect, it, vi } from 'vitest';
import { createHttpClient, EngineError, lazyClient } from './client';
import { createMockClient, createMockDemoClient } from './mock';

describe('engine client', () => {
  it('mock: runs the engine and returns parsed views', async () => {
    const c = createMockClient({ seed: 1 });
    const v = await c.view();
    expect(v.phase).toBe('style');
    await expect(c.send({ type: 'planAction', action: 'f2f', memberIds: ['kent'] })).rejects.toBeInstanceOf(EngineError);
  });

  it('mock: rejects malformed intents before the engine sees them', async () => {
    const c = createMockClient();
    await expect(c.send({ type: 'dismissCard', cardId: '' })).rejects.toMatchObject({ code: 'badPayload' });
  });

  it('http: posts intents and sanitizes what comes back', async () => {
    const view = await createMockClient({ seed: 2 }).view();
    view.members[0].title = 'Sales - East';
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ view, changes: [] }), { status: 200 }));
    const c = createHttpClient('https://engine.test/', 'abc', fetchImpl as unknown as typeof fetch);
    const r = await c.send({ type: 'clearOutcome' });
    expect(fetchImpl).toHaveBeenCalledWith('https://engine.test/sessions/abc/intents', expect.objectContaining({ method: 'POST' }));
    expect(r.view.members[0].title).not.toMatch(/-/);
  });

  it('http: maps server errors to EngineError with a code', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ message: 'No days left', code: 'noCapacity' }), { status: 409 }));
    const c = createHttpClient('https://engine.test', 'abc', fetchImpl as unknown as typeof fetch);
    await expect(c.send({ type: 'endPeriod' })).rejects.toMatchObject({ code: 'noCapacity', retryable: false });
  });

  it('demo: its own engine, instant decisions only, the real run untouched (D92)', async () => {
    const real = createMockClient({ seed: 1 });
    const before = await real.view();
    const demo = createMockDemoClient();
    const v = await demo.view();
    await demo.send({ type: 'confirmStyles', styles: Object.fromEntries(v.members.map(m => [m.id, 'G'])) });
    const key = v.guide.demo.action!;
    const r = await demo.send({ type: 'planAction', action: key, option: v.actions.find(a => a.key === key)!.options[0].key, memberIds: [v.guide.demo.with!] });
    expect(r.view.outcome).not.toBeNull();
    await expect(demo.send({ type: 'planAction', action: 'f2f', memberIds: ['kent'] })).rejects.toMatchObject({ code: 'notInDemo' });
    await expect(demo.send({ type: 'endPeriod' })).rejects.toMatchObject({ code: 'notInDemo' });
    expect(await real.view()).toEqual(before);
  });

  it('http: the demo resource lives under the session and never takes the early first view', async () => {
    const view = await createMockClient({ seed: 2 }).view();
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(view), { status: 200 }));
    const early = Promise.reject(new Error('not this one'));
    early.catch(() => undefined);
    (globalThis as { __ileadEarlyView?: unknown }).__ileadEarlyView = { session: 'abc', view: early };
    const c = createHttpClient('https://engine.test', 'abc', fetchImpl as unknown as typeof fetch, '/demo');
    await c.view();
    expect(fetchImpl).toHaveBeenCalledWith('https://engine.test/sessions/abc/demo/view', expect.anything());
    (globalThis as { __ileadEarlyView?: unknown }).__ileadEarlyView = null;
  });

  it('lazy: loads the client once, on first use', async () => {
    const load = vi.fn(async () => createMockClient());
    const c = lazyClient(load);
    expect(load).not.toHaveBeenCalled();
    await c.view();
    await c.view();
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('mock: streams an NPC turn word by word, and stops when aborted', async () => {
    const c = createMockClient({ seed: 1, tokensPerSecond: 1000 });
    const ctl = new AbortController();
    const out: string[] = [];
    for await (const chunk of c.streamTurn('i1', { id: 't1', text: 'One two three four' }, ctl.signal)) {
      if (chunk.type === 'token') { out.push(chunk.text); if (out.length === 2) ctl.abort(); }
    }
    expect(out.join('').trim().split(/\s+/).length).toBeLessThanOrEqual(3);
  });

  it('http: reads the turn stream as server sent events', async () => {
    const body = 'data: {"type":"token","text":"Hi "}\n\ndata: {"type":"token","text":"there"}\n\ndata: {"type":"done","turnId":"t1"}\n\n';
    const fetchImpl = vi.fn(async () => new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } }));
    const c = createHttpClient('https://engine.test', 'abc', fetchImpl as unknown as typeof fetch);
    const chunks = [];
    for await (const ch of c.streamTurn('i1', { id: 't1', text: '' }, new AbortController().signal)) chunks.push(ch);
    expect(fetchImpl).toHaveBeenCalledWith('https://engine.test/sessions/abc/interactions/i1/turns/t1/stream', expect.anything());
    expect(chunks.map(x => x.type)).toEqual(['token', 'token', 'done']);
  });
});
