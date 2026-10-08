import { describe, expect, it } from 'vitest';
import { Brief } from '../api/author';
import { DrafterError, DRAFT_TIMEOUT_MS, failureText, firstAnswer, MockDrafter, ServerDrafter, TURN_TIMEOUT_MS } from './drafter';

/** A server that never answers: only the request's own signal ends it. */
const hanging = (async (_url: string, init: RequestInit = {}) => new Promise<Response>((_, reject) => {
  init.signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
})) as unknown as typeof fetch;

const req = { brief: Brief.parse({}), asked: [], answers: {} };

describe('the server drafter never waits for ever (D148)', () => {
  it('has a 30 second turn and a 120 second draft', () => {
    expect(TURN_TIMEOUT_MS).toBe(30_000);
    expect(DRAFT_TIMEOUT_MS).toBe(120_000);
  });

  it('a turn that does not answer in time is a timeout, and the templates are not used behind the author\'s back', async () => {
    const server = new ServerDrafter('https://genie.example', hanging, { turn: 20, draft: 20 });
    await expect(server.turn(req)).rejects.toMatchObject({ name: 'DrafterError', code: 'timeout' });
    // firstAnswer hands a failure to the chat, which offers Retry and Continue offline.
    const e = await firstAnswer([server, new MockDrafter()], d => d.turn(req)).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(DrafterError);
    // The chat's error state says what happened and both ways on.
    expect(failureText(e)).toBe('Kora\'s server took longer than 0 seconds. Retry, or continue offline with Kora\'s built-in rules.');
    expect(failureText(new DrafterError('timeout', `Kora's server took longer than ${TURN_TIMEOUT_MS / 1000} seconds.`))).toMatch(/^Kora's server took longer than 30 seconds\. Retry, or continue offline/);
  });

  it('Cancel stops a turn at once', async () => {
    const server = new ServerDrafter('https://genie.example', hanging, { turn: 60_000, draft: 60_000 });
    const ctl = new AbortController();
    const turn = server.turn(req, { signal: ctl.signal });
    ctl.abort();
    const e = await turn.catch((x: unknown) => x);
    expect(e).toMatchObject({ code: 'cancelled' });
    expect(failureText(e)).toBe('You stopped Kora. Retry, or continue offline with Kora\'s built-in rules.');
  });

  it('a server error or an answer the app cannot use fails plainly; 404 and 501 still hand over to the templates', async () => {
    const broken = new ServerDrafter('https://genie.example', (async () => new Response('', { status: 500 })) as unknown as typeof fetch);
    await expect(broken.turn(req)).rejects.toMatchObject({ code: 'failed', message: 'Kora\'s server did not answer (error 500).' });
    const nonsense = new ServerDrafter('https://genie.example', (async () => Response.json({ kind: 'question' })) as unknown as typeof fetch);
    await expect(nonsense.turn(req)).rejects.toMatchObject({ code: 'failed' });
    const absent = new ServerDrafter('https://genie.example', (async () => new Response('', { status: 501 })) as unknown as typeof fetch);
    expect((await firstAnswer([absent, new MockDrafter()], d => d.turn(req))).source).toBe('templates');
  });
});
