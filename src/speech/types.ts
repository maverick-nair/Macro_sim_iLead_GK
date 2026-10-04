/**
 * Speech input contract. Every voice feature in the live screens talks to a `SpeechProvider`, never
 * to MediaRecorder or getUserMedia directly, so the real microphone, the mock and any future vendor
 * SDK are interchangeable. See docs/SPEECH.md.
 *
 * Fairness rules (Simulation Design, "Input rules that keep scoring fair"):
 *  - Only the transcript is scored. Audio is never scored and no provider exposes pitch, pace or
 *    accent features.
 *  - No facial or voice emotion inference, anywhere.
 *  - The level and voice activity events exist for the waveform, turn taking and interrupts only.
 */

/** Microphone permission as far as the app knows. `unsupported`: no microphone API in this browser. */
export type PermissionState = 'unknown' | 'granted' | 'denied' | 'unsupported';

/** Push to talk is the spec default; open mic uses voice activity detection to find turn ends. */
export type SpeechMode = 'pushToTalk' | 'openMic';

export type SpeechErrorCode = 'denied' | 'noDevice' | 'network' | 'unsupported' | 'aborted';

export interface SpeechError {
  code: SpeechErrorCode;
  /** True when trying again can work (a dropped connection), false when it cannot (permission denied). */
  recoverable: boolean;
  message?: string;
}

export interface PermissionResult {
  state: PermissionState;
  /** Why the request failed, when it did. `noDevice` leaves `state` as it was. */
  error?: SpeechError;
}

/** Events a session emits, by name. */
export interface SpeechEvents {
  /** Input level 0..1 for the waveform, about 20 times a second. Not an analytic and never stored. */
  level: number;
  /** Interim transcript of the segment being spoken. Replaces the previous partial. */
  partial: string;
  /** A committed transcript segment. Segments are appended in order; the partial resets. */
  final: string;
  /** The participant started speaking: in open mic from voice activity, in push to talk on press. */
  speechStart: { at: number };
  /** The participant stopped speaking (open mic: after the hang time; push to talk: on release). */
  speechEnd: { at: number };
  error: SpeechError;
  /** The session is over. `transcript` is every final segment joined. Always the last event. */
  end: { transcript: string; cancelled: boolean };
}

export type SpeechEventName = keyof SpeechEvents;

export interface SpeechSession {
  readonly mode: SpeechMode;
  /** Subscribes to an event. Returns an unsubscribe function. */
  on<K extends SpeechEventName>(type: K, fn: (event: SpeechEvents[K]) => void): () => void;
  /**
   * Finishes capture (push to talk release) and waits for the last final segment.
   * Resolves with the full transcript. Calling it twice returns the same promise.
   */
  stop(): Promise<string>;
  /** Drops the capture and any pending transcription. Emits `end` with `cancelled: true`. */
  cancel(): void;
}

export interface StartOptions {
  mode: SpeechMode;
  /** Aborting it cancels the session and emits an `aborted` error. */
  signal?: AbortSignal;
}

export interface SpeechProvider {
  readonly permission: PermissionState;
  /** Asks for the microphone (may show the browser prompt). Call only after consent. */
  requestPermission(): Promise<PermissionResult>;
  /**
   * Starts capture. Returns at once; problems arrive as `error` then `end` events, so attach
   * listeners right after the call (events are never emitted synchronously).
   */
  start(options: StartOptions): SpeechSession;
}
