import { describe, expect, it } from 'vitest';
import type { StreamChunk } from '../engine/contract';
import { AI_LABEL, createAiStreamStore } from './store';

/** A stream the test feeds by hand. */
function manualStream() {
  const queue: Array<IteratorResult<StreamChunk>> = [];
  let wake: (() => void) | null = null;
  let returned = false;
  const push = (r: IteratorResult<StreamChunk>) => {
    queue.push(r);
    wake?.();
  };
  const iterable: AsyncIterable<StreamChunk> = {
    [Symbol.asyncIterator]: () => ({
      async next() {
        while (!queue.length) await new Promise<void>(r => (wake = r));
        return queue.shift()!;
      },
      async return() {
        returned = true;
        return { done: true, value: undefined };
      }
    })
  };
  return {
    iterable,
    token: (text: string) => push({ done: false, value: { type: 'token', text } }),
    chunk: (value: StreamChunk) => push({ done: false, value }),
    end: () => push({ done: true, value: undefined }),
    returned: () => returned
  };
}
const tick = () => new Promise(r => setTimeout(r, 0));

describe('AI stream store', () => {
  it('accumulates tokens, sanitizes the text for the copy rules and is always labelled', async () => {
    const s = manualStream();
    const store = createAiStreamStore();
    expect(store.getState().label).toBe(AI_LABEL);
    const done = store.start(s.iterable);
    s.token('Targets went from 6-');
    await tick();
    s.token('10 — a real follow-');
    s.token('up win');
    await tick();
    expect(store.getState()).toMatchObject({ text: 'Targets went from 6 to 10, a real follow up win', streaming: true, label: 'aiGenerated' });
    s.chunk({ type: 'done', turnId: 'npc7' });
    expect(await done).toMatchObject({ streaming: false, done: true, turnId: 'npc7', error: null, shown: null, cancelled: false });
  });

  it('cancel aborts, reports what was shown and ignores later tokens', async () => {
    const s = manualStream();
    const store = createAiStreamStore();
    let aborted = false;
    const done = store.start(signal => {
      signal.addEventListener('abort', () => (aborted = true));
      return s.iterable;
    });
    s.token('Honestly — I');
    s.token(' feel');
    await tick();
    const shown = store.cancel();
    expect(shown).toEqual({ text: 'Honestly, I feel', rawLength: 'Honestly — I feel'.length, turnId: null });
    expect(aborted).toBe(true);
    s.token(' ignored');
    await tick();
    expect(s.returned()).toBe(true);
    expect(store.getState()).toMatchObject({ text: 'Honestly, I feel', streaming: false, cancelled: true, shown });
    expect(store.cancel()).toBeNull();
    s.end();
    await done;
  });

  it('error chunks stop the stream and keep what was shown', async () => {
    const s = manualStream();
    const store = createAiStreamStore();
    const done = store.start(s.iterable);
    s.token('Partial');
    s.chunk({ type: 'error', retryable: true });
    expect(await done).toMatchObject({ text: 'Partial', streaming: false, error: { retryable: true }, shown: { text: 'Partial', rawLength: 7 } });
  });

  it('a stream that ends without done is a retryable error; a throwing stream too', async () => {
    const s = manualStream();
    const store = createAiStreamStore();
    const done = store.start(s.iterable);
    s.end();
    expect(await done).toMatchObject({ error: { retryable: true }, done: false });
    const failing: AsyncIterable<StreamChunk> = {
      [Symbol.asyncIterator]: () => ({ next: () => Promise.reject(new Error('boom')) })
    };
    expect(await store.start(failing)).toMatchObject({ error: { retryable: true }, streaming: false });
  });

  it('starting again cancels the running stream', async () => {
    const a = manualStream();
    const b = manualStream();
    const store = createAiStreamStore();
    const first = store.start(a.iterable);
    a.token('old');
    await tick();
    const second = store.start(b.iterable);
    a.token(' stale');
    b.token('new');
    b.chunk({ type: 'done', turnId: 'b' });
    expect(await second).toMatchObject({ text: 'new', done: true });
    a.end();
    await first;
    expect(store.getState().text).toBe('new');
  });

  it('hold stops taking tokens until released, and cancel still ends a held stream', async () => {
    const s = manualStream();
    const store = createAiStreamStore();
    void store.start(s.iterable);
    s.token('Hello');
    await tick();
    store.hold(true);
    s.token(' there');
    s.token(' friend');
    await tick();
    // At most the token already asked for lands; the rest wait.
    expect(store.getState().text.length).toBeLessThanOrEqual('Hello there'.length);
    expect(store.getState().streaming).toBe(true);
    store.hold(false);
    await tick();
    expect(store.getState().text).toBe('Hello there friend');
    store.hold(true);
    expect(store.cancel()?.text).toBe('Hello there friend');
    expect(store.getState()).toMatchObject({ cancelled: true, streaming: false });
  });

  it('notifies subscribers and resets', async () => {
    const s = manualStream();
    const store = createAiStreamStore();
    let n = 0;
    store.subscribe(() => n++);
    void store.start(s.iterable);
    s.token('x');
    await tick();
    expect(n).toBeGreaterThanOrEqual(2);
    store.reset();
    expect(store.getState()).toMatchObject({ text: '', streaming: false, shown: null });
  });
});
