/**
 * A tiny clock abstraction so timed behavior (speech mocks, token streams, level polling) is
 * deterministic in tests, Storybook and the mock engine. Production code uses `systemClock`.
 */
export interface Clock {
  now(): number;
  /** Schedules `fn` after `ms`. Returns a function that cancels it. */
  setTimeout(fn: () => void, ms: number): () => void;
}

export const systemClock: Clock = {
  now: () => (typeof performance !== 'undefined' ? performance.now() : Date.now()),
  setTimeout(fn, ms) {
    const id = globalThis.setTimeout(fn, ms);
    return () => globalThis.clearTimeout(id);
  }
};

/** Repeats `fn` every `ms` on `clock`. Returns a function that stops it. */
export function every(clock: Clock, ms: number, fn: () => void): () => void {
  let stop = () => {};
  let stopped = false;
  const tick = () => {
    if (stopped) return;
    fn();
    if (!stopped) stop = clock.setTimeout(tick, ms);
  };
  stop = clock.setTimeout(tick, ms);
  return () => {
    stopped = true;
    stop();
  };
}

/** Waits `ms` on `clock`. Resolves `true` when the time passed, `false` when `signal` aborted first. */
export function sleep(clock: Clock, ms: number, signal?: AbortSignal): Promise<boolean> {
  if (signal?.aborted) return Promise.resolve(false);
  return new Promise(resolve => {
    const onAbort = () => {
      cancel();
      resolve(false);
    };
    const cancel = clock.setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve(true);
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

export interface ManualClock extends Clock {
  /**
   * Moves time forward by `ms`, firing due timers in order. Between timers it lets pending promise
   * callbacks run, so async code that schedules its next timer after an await keeps up.
   */
  advance(ms: number): Promise<void>;
  /** Number of timers waiting. */
  pending(): number;
}

/** A clock that only moves when told to. For tests and scripted demos. */
export function createManualClock(start = 0): ManualClock {
  let now = start;
  let seq = 0;
  const timers = new Map<number, { at: number; fn: () => void }>();
  const flush = () => new Promise<void>(r => globalThis.setTimeout(r, 0));
  return {
    now: () => now,
    setTimeout(fn, ms) {
      const id = ++seq;
      timers.set(id, { at: now + Math.max(0, ms), fn });
      return () => void timers.delete(id);
    },
    pending: () => timers.size,
    async advance(ms) {
      const target = now + ms;
      await flush();
      for (;;) {
        let next: [number, { at: number; fn: () => void }] | undefined;
        for (const entry of timers) if (entry[1].at <= target && (!next || entry[1].at < next[1].at || (entry[1].at === next[1].at && entry[0] < next[0]))) next = entry;
        if (!next) break;
        timers.delete(next[0]);
        now = next[1].at;
        next[1].fn();
        await flush();
      }
      now = target;
      await flush();
    }
  };
}
