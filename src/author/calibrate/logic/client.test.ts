import { describe, expect, it } from 'vitest';
import raw from '../../../engine/storylines/sales-elevator.json';
import { createChunkedRunner } from './chunked';
import { createRunner, createServerRunner, createWorkerRunner, type CalibrationRunner } from './client';
import { runCalibration } from './run';

const settings = { personas: { beginner: 1, expert: 1 }, probes: false, seed: 2 };

/** A fake GenieKreator server: one job that finishes on the second poll. */
async function fakeServer() {
  const out = await runCalibration(raw, settings, { ranOn: 'server', yieldEvery: async () => undefined });
  const calls: Array<{ method: string; url: string; key: string | null }> = [];
  let polls = 0;
  const job = (status: string) => ({ id: '00000000-0000-4000-8000-000000000001', status, progress: { done: status === 'done' ? 2 : 1, total: 2 }, results: status === 'done' ? out.results : null, error: null, createdAt: out.results.createdAt, finishedAt: null });
  const fetch = (async (url: string, init: RequestInit = {}) => {
    calls.push({ method: init.method ?? 'GET', url, key: new Headers(init.headers).get('idempotency-key') });
    if (init.method === 'POST') return Response.json(job('running'), { status: 202 });
    if (url.includes('/playthroughs/')) return Response.json(out.playthroughs.find(p => url.endsWith(`/${p.persona}/${p.index}`)) ?? { message: 'no', code: 'notFound' }, { status: url.endsWith('/0') ? 200 : 404 });
    return Response.json(job(++polls >= 2 ? 'done' : 'running'));
  }) as typeof globalThis.fetch;
  return { fetch, calls, out };
}

describe('calibration runners', () => {
  it('run in the page when there is no Worker, a playthrough at a time', async () => {
    const progress: number[] = [];
    const run = await createWorkerRunner(undefined, createChunkedRunner()).run(raw, settings, { onProgress: d => progress.push(d) });
    expect(run.results.ranOn).toBe('browser');
    expect(progress).toEqual([0, 1, 2]);
    expect((await run.playthrough('expert', 0)).persona).toBe('expert');
    await expect(run.playthrough('expert', 4)).rejects.toMatchObject({ code: 'notFound' });
  });

  it('say so when there is no Worker and no fallback', async () => {
    await expect(createWorkerRunner().run(raw, settings)).rejects.toMatchObject({ code: 'noWorker' });
  });

  it('report a draft that does not play with its issues, and a cancel', async () => {
    await expect(createChunkedRunner().run({ ...raw, stages: [] }, settings)).rejects.toMatchObject({ code: 'badStoryline', issues: expect.arrayContaining([expect.stringMatching(/^stages/)]) });
    const ctl = new AbortController();
    ctl.abort();
    await expect(createChunkedRunner().run(raw, settings, { signal: ctl.signal })).rejects.toMatchObject({ code: 'cancelled' });
  });

  it('start a server job with an Idempotency-Key, poll it and read playthroughs', async () => {
    const s = await fakeServer();
    const progress: Array<[number, number]> = [];
    const run = await createServerRunner('/genie/', { fetch: s.fetch, pollMs: 1 }).run(raw, settings, { onProgress: (d, t) => progress.push([d, t]) });
    expect(run.results.runs).toHaveLength(2);
    expect(s.calls[0]).toMatchObject({ method: 'POST', url: '/genie/calibrations' });
    expect(s.calls[0].key).toMatch(/^[A-Za-z0-9_.:]{8,200}$/);
    expect(progress.at(-1)).toEqual([2, 2]);
    expect((await run.playthrough('beginner', 0)).persona).toBe('beginner');
  });

  it('fall back to the browser when the server does not offer calibrations, and not for a refused draft', async () => {
    const local: CalibrationRunner = { run: async () => ({ results: { local: true } as never, playthrough: async () => ({}) as never }) };
    const notOffered = (async () => new Response(null, { status: 404 })) as unknown as typeof fetch;
    const runner = createRunner('/genie', { fetch: notOffered, local });
    expect((await runner.run(raw, settings)).results).toEqual({ local: true });
    expect(runner.lastRanOn()).toBe('browser');
    const refused = (async () => Response.json({ message: 'This draft does not play yet.', code: 'badStoryline', issues: ['members: Too small'] }, { status: 400 })) as unknown as typeof fetch;
    await expect(createRunner('/genie', { fetch: refused, local }).run(raw, settings)).rejects.toMatchObject({ code: 'badStoryline', issues: ['members: Too small'] });
    const s = await fakeServer();
    const server = createRunner('/genie', { fetch: s.fetch, local });
    await server.run(raw, settings);
    expect(server.lastRanOn()).toBe('server');
  });

  it('stop the server job when a poll fails, and read an aborted fetch as a cancel', async () => {
    const s = await fakeServer();
    let polls = 0;
    const failing = (async (url: string, init: RequestInit = {}) => {
      if ((init.method ?? 'GET') === 'GET' && ++polls === 1) throw new TypeError('Failed to fetch');
      return s.fetch(url, init);
    }) as typeof globalThis.fetch;
    await expect(createServerRunner('/genie', { fetch: failing, pollMs: 1 }).run(raw, settings)).rejects.toMatchObject({ code: 'pollFailed' });
    await new Promise(r => setTimeout(r, 0));
    expect(s.calls.map(c => c.method)).toEqual(['POST', 'DELETE']);
    // A poll that rejects with AbortError is a cancel, whatever the signal says.
    const aborting = (async (url: string, init: RequestInit = {}) => {
      if ((init.method ?? 'GET') === 'GET') throw Object.assign(new Error('The operation was aborted.'), { name: 'AbortError' });
      return s.fetch(url, init);
    }) as typeof globalThis.fetch;
    await expect(createServerRunner('/genie', { fetch: aborting, pollMs: 1 }).run(raw, settings)).rejects.toMatchObject({ code: 'cancelled' });
  });

  it('remove the abort listener once a poll wait resolves', async () => {
    const s = await fakeServer();
    const ctl = new AbortController();
    let added = 0;
    let removed = 0;
    const signal = ctl.signal;
    const add = signal.addEventListener.bind(signal);
    const remove = signal.removeEventListener.bind(signal);
    signal.addEventListener = ((...a: Parameters<typeof add>) => { added++; add(...a); }) as typeof add;
    signal.removeEventListener = ((...a: Parameters<typeof remove>) => { removed++; remove(...a); }) as typeof remove;
    await createServerRunner('/genie', { fetch: s.fetch, pollMs: 1 }).run(raw, settings, { signal });
    expect(added).toBeGreaterThan(1);
    expect(removed).toBe(added);
  });
});
