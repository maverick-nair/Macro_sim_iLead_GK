import { describe, expect, it, vi } from 'vitest';
import { createHttpClient, EngineError, lazyClient } from './client';
import { createMockClient } from './mock';

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

  it('lazy: loads the client once, on first use', async () => {
    const load = vi.fn(async () => createMockClient());
    const c = lazyClient(load);
    expect(load).not.toHaveBeenCalled();
    await c.view();
    await c.view();
    expect(load).toHaveBeenCalledTimes(1);
  });
});
