import type { StreamChunk } from '../engine/contract';
import { sanitizeCopy } from '../i18n/copy';

/** Every streamed AI text carries this label; the UI shows the AI label from it (brief: AI is labelled). */
export const AI_LABEL = 'aiGenerated' as const;

export interface AiStreamState {
  /** Text to show: the accumulated tokens passed through `sanitizeCopy`. */
  text: string;
  streaming: boolean;
  /** The stream finished with `done`. */
  done: boolean;
  turnId: string | null;
  error: { retryable: boolean } | null;
  /** True when `cancel()` stopped the stream. */
  cancelled: boolean;
  /**
   * What was on screen when the stream stopped early (cancel or error), so the engine can truncate
   * an interrupted NPC turn to what the participant actually saw. Null otherwise.
   */
  shown: Shown | null;
  label: typeof AI_LABEL;
}

export interface Shown {
  /** Sanitized text on screen. */
  text: string;
  /** Characters of the model's raw text received, before sanitizing. Truncate the raw turn here. */
  rawLength: number;
  turnId: string | null;
}

/** A stream, or a function that opens one and honours the signal (preferred: cancel stops the source). */
export type StreamSource = AsyncIterable<StreamChunk> | ((signal: AbortSignal) => AsyncIterable<StreamChunk>);

export interface AiStreamStore {
  getState(): AiStreamState;
  subscribe(fn: () => void): () => void;
  /** Starts consuming. A running stream is cancelled first. Resolves when the stream ends. */
  start(source: StreamSource): Promise<AiStreamState>;
  /** Aborts the stream. Returns what was shown, or null when nothing was streaming. */
  cancel(): Shown | null;
  reset(): void;
  /**
   * Holds the stream where it is (the run is paused): no more tokens are taken from the source until
   * it is released. Nothing is cut off, so the engine is not told of an interrupt. Holding before a
   * stream starts holds that stream too.
   */
  hold(on: boolean): void;
}

const IDLE: AiStreamState = { text: '', streaming: false, done: false, turnId: null, error: null, cancelled: false, shown: null, label: AI_LABEL };

/** Framework free state for one streamed AI reply. `useAiStream` binds it to React. */
export function createAiStreamStore(): AiStreamStore {
  let state = IDLE;
  let raw = '';
  let gen = 0;
  let abort: AbortController | null = null;
  let iterator: AsyncIterator<StreamChunk> | null = null;
  const listeners = new Set<() => void>();
  let held = false;
  let waiting: Array<() => void> = [];
  const wake = () => { const w = waiting; waiting = []; w.forEach(f => f()); };
  const set = (patch: Partial<AiStreamState>) => {
    state = { ...state, ...patch };
    listeners.forEach(l => l());
  };
  const shownNow = (): Shown => ({ text: state.text, rawLength: raw.length, turnId: state.turnId });
  const detach = () => {
    gen++;
    wake();
    abort?.abort();
    abort = null;
    const it = iterator;
    iterator = null;
    // Ask the source to stop; ignore what it does about it.
    void Promise.resolve()
      .then(() => it?.return?.())
      .catch(() => {});
  };

  const store: AiStreamStore = {
    getState: () => state,
    subscribe(fn) {
      listeners.add(fn);
      return () => void listeners.delete(fn);
    },
    async start(source) {
      if (state.streaming) store.cancel();
      const my = ++gen;
      raw = '';
      abort = new AbortController();
      set({ ...IDLE, streaming: true });
      const iterable = typeof source === 'function' ? source(abort.signal) : source;
      const it = iterable[Symbol.asyncIterator]();
      iterator = it;
      try {
        for (;;) {
          while (held && my === gen) await new Promise<void>(r => waiting.push(r));
          if (my !== gen) break;
          const r = await it.next();
          if (my !== gen) break;
          if (r.done) {
            // Ended without `done`: treat as a cut off reply.
            set({ streaming: false, error: { retryable: true }, shown: shownNow() });
            break;
          }
          const chunk = r.value;
          if (chunk.type === 'token') {
            raw += chunk.text;
            set({ text: sanitizeCopy(raw) });
          } else if (chunk.type === 'done') {
            set({ streaming: false, done: true, turnId: chunk.turnId });
            break;
          } else {
            set({ streaming: false, error: { retryable: chunk.retryable }, shown: shownNow() });
            break;
          }
        }
      } catch {
        if (my === gen) set({ streaming: false, error: { retryable: true }, shown: shownNow() });
      }
      if (my === gen) {
        iterator = null;
        abort = null;
        // Close the source (for readSse this cancels the response body). Harmless when it already ended.
        void Promise.resolve()
          .then(() => it.return?.())
          .catch(() => {});
      }
      return state;
    },
    cancel() {
      if (!state.streaming) return null;
      const shown = shownNow();
      detach();
      set({ streaming: false, cancelled: true, shown });
      return shown;
    },
    reset() {
      if (state.streaming) detach();
      raw = '';
      set(IDLE);
    },
    hold(on) {
      held = on;
      if (!on) wake();
    }
  };
  return store;
}
