import type { SpeechError, SpeechMode, SpeechProvider, SpeechSession } from './types';

/**
 * The voice input state machine behind `useSpeech`, free of React so it can be tested in node.
 *
 *   idle -> requesting -> listening -> finishing -> review -> idle
 *                 \-> denied | unsupported          (review is skipped when `review` is off
 *                                                    or nothing was heard)
 *
 * `requesting` covers the permission prompt. `finishing` is the short wait after release while the
 * server sends the last final segment. In `review` the transcript is editable before sending.
 */
export type SpeechStatus = 'idle' | 'requesting' | 'listening' | 'finishing' | 'review' | 'denied' | 'unsupported';

export interface SpeechState {
  status: SpeechStatus;
  mode: SpeechMode;
  /** Latest input level 0..1. */
  level: number;
  /** Recent levels, oldest first, for the waveform. */
  levels: number[];
  /** Interim text of the segment being spoken. */
  partial: string;
  /** Committed text while listening; the editable transcript in review. */
  transcript: string;
  /** True once the participant changed the transcript in review. */
  edited: boolean;
  /** True between speechStart and speechEnd. */
  speaking: boolean;
  /** The last problem. The UI shows the typed fallback banner while it is set. */
  error: SpeechError | null;
  consented: boolean;
}

export interface SpeechControllerOptions {
  /** Audio capture is refused until this is true (consent before any audio capture). */
  consented: boolean;
  mode?: SpeechMode;
  /** Go to review after stop so the transcript can be edited. Default true. */
  review?: boolean;
  /** Open mic: end the turn on speechEnd. Default true. */
  openMicEndsTurn?: boolean;
  /** Levels kept for the waveform. Default 32. */
  levelHistory?: number;
  /** The participant started speaking. Use it to stop the NPC (interrupt). */
  onSpeechStart?: () => void;
  onSpeechEnd?: () => void;
  /** Called with the transcript when a turn ends and `review` is off, or on `accept()`. */
  onTranscript?: (text: string) => void;
  onError?: (error: SpeechError) => void;
}

export type StartResult = 'started' | 'consentRequired' | 'busy' | 'denied' | 'unsupported' | 'error';

export interface SpeechController {
  getState(): SpeechState;
  subscribe(fn: () => void): () => void;
  start(): Promise<StartResult>;
  /** Push to talk release, or end the open mic turn now. */
  stop(): Promise<void>;
  /** Drops the capture or the transcript under review. */
  cancel(): void;
  /** Applies now when idle or in review; while listening it applies to the next turn. */
  setMode(mode: SpeechMode): void;
  /** Edits the transcript in review. Ignored in other states. */
  setTranscript(text: string): void;
  /** Sends the reviewed transcript: returns it, calls `onTranscript` and goes back to idle. */
  accept(): string;
  setConsented(consented: boolean): void;
  setOptions(options: Partial<SpeechControllerOptions>): void;
  clearError(): void;
  dispose(): void;
}

export function createSpeechController(provider: SpeechProvider, initial: SpeechControllerOptions): SpeechController {
  let options: SpeechControllerOptions = { ...initial };
  const history = () => options.levelHistory ?? 32;
  let state: SpeechState = {
    status: provider.permission === 'unsupported' ? 'unsupported' : provider.permission === 'denied' ? 'denied' : 'idle',
    mode: initial.mode ?? 'pushToTalk',
    level: 0,
    levels: [],
    partial: '',
    transcript: '',
    edited: false,
    speaking: false,
    error: null,
    consented: initial.consented
  };
  const listeners = new Set<() => void>();
  let session: SpeechSession | null = null;
  let abort: AbortController | null = null;
  let nextMode: SpeechMode | null = null;
  let gen = 0;

  const set = (patch: Partial<SpeechState>) => {
    state = { ...state, ...patch };
    listeners.forEach(l => l());
  };
  const join = (a: string, b: string) => (a && b ? `${a} ${b}` : a || b);
  const settleMode = () => {
    if (nextMode) set({ mode: nextMode });
    nextMode = null;
  };
  const drop = () => {
    gen++;
    const s = session;
    session = null;
    abort?.abort();
    abort = null;
    s?.cancel();
  };
  const finishTurn = (text: string) => {
    settleMode();
    const t = text.trim();
    if (!t) return set({ status: 'idle', partial: '', transcript: '', speaking: false, level: 0 });
    if (options.review ?? true) return set({ status: 'review', partial: '', transcript: t, edited: false, speaking: false, level: 0 });
    set({ status: 'idle', partial: '', transcript: '', speaking: false, level: 0 });
    options.onTranscript?.(t);
  };

  const controller: SpeechController = {
    getState: () => state,
    subscribe(fn) {
      listeners.add(fn);
      return () => void listeners.delete(fn);
    },

    async start() {
      if (!state.consented) return 'consentRequired';
      if (state.status === 'requesting' || state.status === 'listening' || state.status === 'finishing') return 'busy';
      const my = ++gen;
      set({ error: null, partial: '', transcript: '', edited: false, levels: [], level: 0 });
      if (provider.permission !== 'granted') {
        set({ status: 'requesting' });
        const result = await provider.requestPermission();
        if (my !== gen) return 'busy';
        if (result.state === 'denied' || result.state === 'unsupported') {
          set({ status: result.state, error: result.error ?? { code: result.state, recoverable: false } });
          if (result.error) options.onError?.(result.error);
          return result.state;
        }
        if (result.error) {
          set({ status: 'idle', error: result.error });
          options.onError?.(result.error);
          return 'error';
        }
        if (!state.consented) {
          set({ status: 'idle' });
          return 'consentRequired';
        }
      }
      abort = new AbortController();
      const s = provider.start({ mode: state.mode, signal: abort.signal });
      session = s;
      set({ status: 'listening' });
      let committed = '';
      s.on('level', level => my === gen && set({ level, levels: [...state.levels, level].slice(-history()) }));
      s.on('partial', partial => my === gen && set({ partial }));
      s.on('final', text => {
        if (my !== gen) return;
        committed = join(committed, text);
        set({ transcript: committed, partial: '' });
      });
      s.on('speechStart', () => {
        if (my !== gen) return;
        set({ speaking: true });
        options.onSpeechStart?.();
      });
      s.on('speechEnd', () => {
        if (my !== gen) return;
        set({ speaking: false });
        options.onSpeechEnd?.();
        if (s.mode === 'openMic' && (options.openMicEndsTurn ?? true) && state.status === 'listening') void controller.stop();
      });
      s.on('error', error => {
        if (my !== gen) return;
        set({ error });
        options.onError?.(error);
      });
      s.on('end', ({ transcript, cancelled }) => {
        if (my !== gen) return;
        session = null;
        abort = null;
        if (cancelled && !state.error) {
          settleMode();
          return set({ status: 'idle', partial: '', transcript: '', speaking: false, level: 0 });
        }
        // A failed session keeps what was heard, so the participant can edit it or type instead.
        if (state.error?.code === 'denied') return set({ status: 'denied', speaking: false, level: 0, partial: '' });
        if (state.error?.code === 'unsupported') return set({ status: 'unsupported', speaking: false, level: 0, partial: '' });
        finishTurn(transcript || committed);
      });
      return 'started';
    },

    async stop() {
      if (state.status !== 'listening' || !session) return;
      const s = session;
      const my = gen;
      set({ status: 'finishing' });
      await s.stop();
      // The `end` event moved the state on. This covers a provider that resolved without it.
      if (my === gen && (state.status as SpeechStatus) === 'finishing') {
        session = null;
        finishTurn(state.transcript);
      }
    },

    cancel() {
      if (state.status === 'listening' || state.status === 'finishing' || state.status === 'requesting') drop();
      settleMode();
      if (state.status === 'denied' || state.status === 'unsupported') return;
      set({ status: 'idle', partial: '', transcript: '', edited: false, speaking: false, level: 0 });
    },

    setMode(mode) {
      if (state.status === 'listening' || state.status === 'finishing' || state.status === 'requesting') nextMode = mode;
      else set({ mode });
    },

    setTranscript(text) {
      if (state.status !== 'review') return;
      set({ transcript: text, edited: true });
    },

    accept() {
      if (state.status !== 'review') return '';
      const text = state.transcript.trim();
      set({ status: 'idle', transcript: '', edited: false });
      if (text) options.onTranscript?.(text);
      return text;
    },

    setConsented(consented) {
      if (consented === state.consented) return;
      set({ consented });
      // Withdrawing consent stops capture at once.
      if (!consented && (state.status === 'listening' || state.status === 'finishing' || state.status === 'requesting')) controller.cancel();
    },

    setOptions(patch) {
      options = { ...options, ...patch };
      if (patch.consented !== undefined) controller.setConsented(patch.consented);
    },

    clearError: () => set({ error: null }),

    dispose() {
      drop();
      listeners.clear();
    }
  };
  return controller;
}
