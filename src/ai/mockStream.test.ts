import { describe, expect, it } from 'vitest';
import { createManualClock } from '../lib/clock';
import type { StreamChunk } from '../engine/contract';
import { mockStream, wordTokens } from './mockStream';
import { createAiStreamStore } from './store';

describe('mockStream', () => {
  it('splits into word tokens that rebuild the text', () => {
    expect(wordTokens('  Hi there,\nKent.')).toEqual(['  Hi', ' there,', '\nKent.']);
    expect(wordTokens('').length).toBe(0);
  });

  it('yields word tokens at a steady rate on the clock, then done', async () => {
    const clock = createManualClock();
    const seen: Array<[number, StreamChunk]> = [];
    const run = (async () => {
      for await (const c of mockStream('We hit the target', { clock, tokensPerSecond: 10, turnId: 'n1' })) seen.push([clock.now(), c]);
    })();
    await clock.advance(1000);
    await run;
    expect(seen).toEqual([
      [100, { type: 'token', text: 'We' }],
      [200, { type: 'token', text: ' hit' }],
      [300, { type: 'token', text: ' the' }],
      [400, { type: 'token', text: ' target' }],
      [400, { type: 'done', turnId: 'n1' }]
    ]);
  });

  it('aborts mid stream and the store reports the text that was shown', async () => {
    const clock = createManualClock();
    const store = createAiStreamStore();
    const done = store.start(signal => mockStream('I hear you. Let me think about the follow-up plan.', { clock, signal, tokensPerSecond: 10 }));
    await clock.advance(350);
    expect(store.getState()).toMatchObject({ text: 'I hear you.', streaming: true });
    const shown = store.cancel();
    expect(shown).toEqual({ text: 'I hear you.', rawLength: 'I hear you.'.length, turnId: null });
    await clock.advance(1000);
    const final = await done;
    expect(final).toMatchObject({ text: 'I hear you.', streaming: false, cancelled: true, done: false, shown });
    // The aborted generator scheduled nothing more.
    expect(clock.pending()).toBe(0);
  });

  it('can end in a scripted error', async () => {
    const clock = createManualClock();
    const out: StreamChunk[] = [];
    const run = (async () => {
      for await (const c of mockStream('a b c', { clock, failAfterTokens: 1, retryable: false })) out.push(c);
    })();
    await clock.advance(1000);
    await run;
    expect(out).toEqual([{ type: 'token', text: 'a' }, { type: 'error', retryable: false }]);
  });
});
