import { sleep, systemClock, type Clock } from '../lib/clock';
import type { StreamChunk } from '../engine/contract';

export interface MockStreamOptions {
  signal?: AbortSignal;
  /** Default 12 tokens a second, about the pace of a spoken NPC reply. */
  tokensPerSecond?: number;
  clock?: Clock;
  /** Id carried by the closing `done` chunk. Default `mock`. */
  turnId?: string;
  /** Ends with `{ type: 'error', retryable }` after this many tokens instead of `done`. */
  failAfterTokens?: number;
  retryable?: boolean;
}

/** Splits text into word tokens that keep their leading whitespace, so joining them gives the text back. */
export function wordTokens(text: string): string[] {
  return text.match(/\s*\S+/g) ?? [];
}

/**
 * A fake AI reply for the mock engine: yields word tokens at a steady rate, then `done`.
 * Aborting `signal` ends the iteration at once, without a `done`. With a manual clock the timing
 * is fully deterministic.
 */
export async function* mockStream(text: string, options: MockStreamOptions = {}): AsyncGenerator<StreamChunk> {
  const clock = options.clock ?? systemClock;
  const gap = 1000 / (options.tokensPerSecond ?? 12);
  let n = 0;
  for (const token of wordTokens(text)) {
    if (!(await sleep(clock, gap, options.signal))) return;
    if (options.failAfterTokens !== undefined && n >= options.failAfterTokens) {
      yield { type: 'error', retryable: options.retryable ?? true };
      return;
    }
    n++;
    yield { type: 'token', text: token };
  }
  if (options.signal?.aborted) return;
  yield { type: 'done', turnId: options.turnId ?? 'mock' };
}
