import { systemClock, type Clock } from '../lib/clock';
import { Emitter } from './emitter';
import type { PermissionResult, PermissionState, SpeechError, SpeechEvents, SpeechProvider, SpeechSession, StartOptions } from './types';

/** One scripted utterance. */
export interface MockUtterance {
  /** What the participant "says". Sentences ending in . ? or ! become separate final segments. */
  text: string;
  /** Silence before speech begins. Default 300ms. */
  delayMs?: number;
  /** Speaking rate. Default 150 words per minute (400ms a word). */
  wordsPerMinute?: number;
}

export interface MockSpeechOptions {
  /** Played in order, one per session, then from the start again. */
  script: string | MockUtterance | Array<string | MockUtterance>;
  clock?: Clock;
  /** Starting permission. `denied` and `unsupported` make `requestPermission` and `start` fail. Default `unknown`. */
  permission?: PermissionState;
  /** What a `requestPermission` call grants. Default `granted`. */
  grants?: 'granted' | 'denied';
  /** Fails every session with this error after `failAfterMs`. */
  fail?: SpeechError & { afterMs?: number };
  /**
   * Push to talk release before the script ends: `all` commits the whole utterance (friendly for
   * demos), `heard` commits only the words already spoken (realistic). Default `all`.
   */
  onEarlyStop?: 'all' | 'heard';
  /** Silence after the last word before open mic reports `speechEnd`. Default 800ms. */
  hangMs?: number;
  levelIntervalMs?: number;
}

/**
 * Microphone free provider for tests, Storybook and the mock engine. It plays a scripted utterance
 * as timed partials and finals with synthetic levels. Timing runs on the injected clock, and the
 * level pattern is a fixed function of time, so two runs on a manual clock are identical.
 */
export class MockSpeechProvider implements SpeechProvider {
  private state: PermissionState;
  private turn = 0;
  private readonly clock: Clock;
  private readonly script: MockUtterance[];

  constructor(private readonly options: MockSpeechOptions) {
    this.clock = options.clock ?? systemClock;
    this.state = options.permission ?? 'unknown';
    const s = options.script;
    this.script = (Array.isArray(s) ? s : [s]).map(u => (typeof u === 'string' ? { text: u } : u));
    if (!this.script.length) throw new Error('MockSpeechProvider needs at least one utterance');
  }

  get permission(): PermissionState {
    return this.state;
  }

  async requestPermission(): Promise<PermissionResult> {
    if (this.state === 'unsupported') return { state: 'unsupported', error: { code: 'unsupported', recoverable: false } };
    if (this.state === 'denied') return { state: 'denied', error: { code: 'denied', recoverable: false } };
    this.state = this.options.grants ?? 'granted';
    return this.state === 'denied' ? { state: 'denied', error: { code: 'denied', recoverable: false } } : { state: 'granted' };
  }

  start({ mode, signal }: StartOptions): SpeechSession {
    const clock = this.clock;
    const o = this.options;
    const utterance = this.script[this.turn++ % this.script.length]!;
    const segments = splitSegments(utterance.text);
    const wordMs = 60_000 / (utterance.wordsPerMinute ?? 150);
    const levelMs = o.levelIntervalMs ?? 50;
    const events = new Emitter<SpeechEvents>();
    const timers = new Set<() => void>();
    const at = (ms: number, fn: () => void) => {
      const cancel = clock.setTimeout(() => {
        timers.delete(cancel);
        fn();
      }, ms);
      timers.add(cancel);
    };
    const t0 = clock.now();
    const speakFrom = utterance.delayMs ?? 300;
    const totalWords = segments.reduce((n, s) => n + s.length, 0);
    const speakTo = speakFrom + totalWords * wordMs;
    const finals: string[] = [];
    let seg = 0;
    let word = 0;
    let ended = false;
    let stopping: Promise<string> | null = null;

    const end = (cancelled: boolean) => {
      if (ended) return;
      ended = true;
      timers.forEach(c => c());
      signal?.removeEventListener('abort', onAbort);
      events.emit('level', 0);
      events.emit('end', { transcript: finals.join(' '), cancelled });
      events.clear();
    };
    const fail = (error: SpeechError) => {
      if (ended) return;
      events.emit('error', error);
      end(true);
    };
    const onAbort = () => fail({ code: 'aborted', recoverable: true });
    const commit = (words: string[]) => {
      if (!words.length) return;
      const text = words.join(' ');
      finals.push(text);
      events.emit('final', text);
    };

    const session: SpeechSession = {
      mode,
      on: (type, fn) => events.on(type, fn),
      cancel: () => end(true),
      stop() {
        if (stopping) return stopping;
        stopping = (async () => {
          await Promise.resolve();
          if (ended) return finals.join(' ');
          if (mode === 'pushToTalk') events.emit('speechEnd', { at: clock.now() });
          if (seg < segments.length) {
            if ((o.onEarlyStop ?? 'all') === 'all') {
              commit(segments[seg]!);
              for (let i = seg + 1; i < segments.length; i++) commit(segments[i]!);
            } else commit(segments[seg]!.slice(0, word));
            seg = segments.length;
          }
          const text = finals.join(' ');
          end(false);
          return text;
        })();
        return stopping;
      }
    };

    queueMicrotask(() => {
      if (ended) return;
      if (signal?.aborted) return onAbort();
      signal?.addEventListener('abort', onAbort, { once: true });
      if (this.state === 'unsupported') return fail({ code: 'unsupported', recoverable: false });
      if (this.state === 'denied') return fail({ code: 'denied', recoverable: false });
      this.state = 'granted';
      if (mode === 'pushToTalk') events.emit('speechStart', { at: t0 });
      if (o.fail) at(o.fail.afterMs ?? 0, () => fail({ code: o.fail!.code, recoverable: o.fail!.recoverable, message: o.fail!.message }));

      // Words: one partial per word, a final at each segment end.
      let k = 0;
      for (let s = 0; s < segments.length; s++) {
        for (let w = 0; w < segments[s]!.length; w++) {
          const last = w === segments[s]!.length - 1;
          at(speakFrom + ++k * wordMs, () => {
            seg = s;
            word = w + 1;
            if (last) {
              commit(segments[s]!);
              seg = s + 1;
              word = 0;
            } else events.emit('partial', segments[s]!.slice(0, w + 1).join(' '));
          });
        }
      }
      if (mode === 'openMic') {
        at(speakFrom, () => events.emit('speechStart', { at: t0 + speakFrom }));
        at(speakTo + (o.hangMs ?? 800), () => events.emit('speechEnd', { at: t0 + speakTo }));
      }
      // Levels: a fixed pattern, loud while speaking, near zero otherwise.
      const tick = (n: number) => {
        at(levelMs, () => {
          const t = n * levelMs;
          events.emit('level', syntheticLevel(t, t >= speakFrom && t < speakTo));
          tick(n + 1);
        });
      };
      tick(1);
    });
    return session;
  }
}

/** Deterministic waveform: a speech like envelope while speaking, a low floor otherwise. */
export function syntheticLevel(t: number, speaking: boolean): number {
  if (!speaking) return 0.05 + 0.03 * Math.abs(Math.sin(t / 170));
  const v = 0.55 + 0.25 * Math.sin(t / 90) * Math.sin(t / 37) + 0.1 * Math.sin(t / 13);
  return Math.round(Math.min(1, Math.max(0, v)) * 1000) / 1000;
}

function splitSegments(text: string): string[][] {
  return (text.match(/[^.?!]+[.?!]*/g) ?? [])
    .map(s => s.trim().split(/\s+/).filter(Boolean))
    .filter(s => s.length > 0);
}
