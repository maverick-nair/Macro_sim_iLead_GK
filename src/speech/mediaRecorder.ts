import { every, systemClock, type Clock } from '../lib/clock';
import { Emitter } from './emitter';
import type { TranscriptionClient, TranscriptionStream } from './transcription';
import type { PermissionResult, PermissionState, SpeechError, SpeechEvents, SpeechProvider, SpeechSession, StartOptions } from './types';
import { createVad, levelFromRms, type VadOptions } from './vad';

/**
 * Browser APIs the provider uses, injectable so tests run in node without a microphone.
 * Defaults come from `globalThis`.
 */
export interface MediaDeps {
  mediaDevices?: Pick<MediaDevices, 'getUserMedia'>;
  permissions?: Pick<Permissions, 'query'>;
  MediaRecorder?: {
    new (stream: MediaStream, options?: MediaRecorderOptions): MediaRecorder;
    isTypeSupported(type: string): boolean;
  };
  AudioContext?: new () => AudioContext;
}

export interface MediaRecorderProviderOptions {
  transcription: TranscriptionClient;
  /** Open mic thresholds and hang time. */
  vad?: VadOptions;
  /** MediaRecorder timeslice: one chunk is sent to the server this often. Default 250ms. */
  chunkMs?: number;
  /** How often the level is sampled. Default 50ms (20 Hz). */
  levelIntervalMs?: number;
  /** Preferred containers, first supported wins. When none is supported the browser picks. */
  mimeTypes?: string[];
  language?: string;
  clock?: Clock;
  deps?: MediaDeps;
}

export const PREFERRED_MIME_TYPES = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/webm', 'audio/mp4'];

/** Maps a getUserMedia failure to a speech error. */
export function mediaError(err: unknown): SpeechError {
  const name = (err as { name?: string } | null)?.name ?? '';
  const message = (err as { message?: string } | null)?.message;
  if (name === 'NotAllowedError' || name === 'SecurityError' || name === 'PermissionDeniedError') return { code: 'denied', recoverable: false, message };
  if (name === 'NotFoundError' || name === 'OverconstrainedError' || name === 'DevicesNotFoundError' || name === 'NotReadableError') return { code: 'noDevice', recoverable: true, message };
  if (name === 'AbortError') return { code: 'aborted', recoverable: true, message };
  if (name === 'TypeError' || name === 'NotSupportedError') return { code: 'unsupported', recoverable: false, message };
  return { code: 'noDevice', recoverable: true, message };
}

const AUDIO: MediaStreamConstraints = {
  // Echo cancellation keeps the NPC's voice out of the mic, so it cannot interrupt itself.
  audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 }
};

/**
 * Real microphone provider. getUserMedia plus MediaRecorder for audio chunks that stream to the
 * server's transcription service, and an AnalyserNode for the waveform level and the open mic
 * voice activity detector. It never transcribes locally and never analyses the voice itself.
 */
export class MediaRecorderSpeechProvider implements SpeechProvider {
  private state: PermissionState;
  private readonly deps: MediaDeps;
  private readonly clock: Clock;

  constructor(private readonly options: MediaRecorderProviderOptions) {
    const g = globalThis as unknown as { navigator?: Navigator; MediaRecorder?: MediaDeps['MediaRecorder']; AudioContext?: MediaDeps['AudioContext']; webkitAudioContext?: MediaDeps['AudioContext'] };
    this.deps = {
      mediaDevices: g.navigator?.mediaDevices,
      permissions: g.navigator?.permissions,
      MediaRecorder: g.MediaRecorder,
      AudioContext: g.AudioContext ?? g.webkitAudioContext,
      ...options.deps
    };
    this.clock = options.clock ?? systemClock;
    this.state = this.supported ? 'unknown' : 'unsupported';
  }

  private get supported(): boolean {
    return !!(this.deps.mediaDevices?.getUserMedia && this.deps.MediaRecorder);
  }

  get permission(): PermissionState {
    return this.state;
  }

  /** Reads the permission without prompting, where the Permissions API allows it. */
  async checkPermission(): Promise<PermissionState> {
    if (!this.supported) return (this.state = 'unsupported');
    try {
      const status = await this.deps.permissions?.query({ name: 'microphone' as PermissionName });
      if (status?.state === 'granted') this.state = 'granted';
      else if (status?.state === 'denied') this.state = 'denied';
    } catch {
      // Firefox and Safari may not know the 'microphone' name. The state stays as it was.
    }
    return this.state;
  }

  async requestPermission(): Promise<PermissionResult> {
    if (!this.supported) return { state: (this.state = 'unsupported'), error: { code: 'unsupported', recoverable: false } };
    try {
      const stream = await this.deps.mediaDevices!.getUserMedia(AUDIO);
      stream.getTracks().forEach(t => t.stop());
      return { state: (this.state = 'granted') };
    } catch (err) {
      const error = mediaError(err);
      if (error.code === 'denied') this.state = 'denied';
      if (error.code === 'unsupported') this.state = 'unsupported';
      return { state: this.state, error };
    }
  }

  start({ mode, signal }: StartOptions): SpeechSession {
    const events = new Emitter<SpeechEvents>();
    const o = this.options;
    const deps = this.deps;
    const clock = this.clock;
    const vad = createVad(o.vad);
    const finals: string[] = [];
    let ended = false;
    let stopping: Promise<string> | null = null;
    let stream: MediaStream | null = null;
    let recorder: MediaRecorder | null = null;
    let audio: AudioContext | null = null;
    let transcription: TranscriptionStream | null = null;
    let stopLevels = () => {};
    let recorderStopped: Promise<void> = Promise.resolve();

    const release = () => {
      stopLevels();
      if (recorder && recorder.state !== 'inactive') {
        try {
          recorder.stop();
        } catch {
          /* already stopped */
        }
      }
      stream?.getTracks().forEach(t => t.stop());
      void audio?.close().catch(() => {});
      signal?.removeEventListener('abort', onAbort);
    };
    const end = (cancelled: boolean) => {
      if (ended) return;
      ended = true;
      release();
      events.emit('end', { transcript: finals.join(' '), cancelled });
      events.clear();
    };
    const fail = (error: SpeechError) => {
      if (ended) return;
      transcription?.abort();
      events.emit('error', error);
      end(true);
    };
    const onAbort = () => fail({ code: 'aborted', recoverable: true });

    const session: SpeechSession = {
      mode,
      on: (type, fn) => events.on(type, fn),
      cancel() {
        if (ended) return;
        transcription?.abort();
        end(true);
      },
      stop() {
        if (stopping) return stopping;
        stopping = (async () => {
          if (ended) return finals.join(' ');
          if (mode === 'pushToTalk') events.emit('speechEnd', { at: clock.now() });
          stopLevels();
          if (recorder && recorder.state !== 'inactive') {
            recorder.stop();
            await recorderStopped;
          }
          if (transcription && !ended) await transcription.finish();
          const text = finals.join(' ');
          end(false);
          return text;
        })();
        return stopping;
      }
    };

    if (signal?.aborted) {
      queueMicrotask(onAbort);
      return session;
    }
    signal?.addEventListener('abort', onAbort, { once: true });

    void (async () => {
      await Promise.resolve();
      if (ended) return;
      if (!this.supported) return fail({ code: 'unsupported', recoverable: false });
      try {
        stream = await deps.mediaDevices!.getUserMedia(AUDIO);
      } catch (err) {
        const error = mediaError(err);
        if (error.code === 'denied') this.state = 'denied';
        return fail(error);
      }
      this.state = 'granted';
      if (ended) return void stream.getTracks().forEach(t => t.stop());
      for (const track of stream.getAudioTracks()) track.addEventListener('ended', () => fail({ code: 'noDevice', recoverable: true, message: 'microphone disconnected' }));

      const Recorder = deps.MediaRecorder!;
      const preferred = (o.mimeTypes ?? PREFERRED_MIME_TYPES).find(t => {
        try {
          return Recorder.isTypeSupported(t);
        } catch {
          return false;
        }
      });
      try {
        recorder = new Recorder(stream, preferred ? { mimeType: preferred } : undefined);
      } catch {
        // The browser refused the type after all; let it pick.
        recorder = new Recorder(stream);
      }
      const rec = recorder;
      transcription = o.transcription.open({
        mimeType: rec.mimeType || preferred || '',
        mode,
        language: o.language,
        onPartial: text => !ended && events.emit('partial', text),
        onFinal: text => {
          if (ended || !text.trim()) return;
          finals.push(text.trim());
          events.emit('final', text.trim());
        },
        onError: fail
      });
      rec.addEventListener('dataavailable', e => {
        const data = (e as BlobEvent).data;
        if (data && data.size > 0 && !ended) transcription!.send(data);
      });
      recorderStopped = new Promise(resolve => rec.addEventListener('stop', () => resolve(), { once: true }));
      rec.addEventListener('error', () => fail({ code: 'aborted', recoverable: true, message: 'recorder error' }));

      if (deps.AudioContext) {
        try {
          audio = new deps.AudioContext();
          void audio.resume?.().catch(() => {});
          const analyser = audio.createAnalyser();
          analyser.fftSize = 1024;
          audio.createMediaStreamSource(stream).connect(analyser);
          const buf = new Float32Array(analyser.fftSize);
          stopLevels = every(clock, o.levelIntervalMs ?? 50, () => {
            if (ended) return;
            analyser.getFloatTimeDomainData(buf);
            let sum = 0;
            for (const v of buf) sum += v * v;
            const level = levelFromRms(Math.sqrt(sum / buf.length));
            events.emit('level', level);
            if (mode === 'openMic') {
              const flip = vad.push(level, clock.now());
              if (flip) events.emit(flip.type, { at: flip.at });
            }
          });
        } catch {
          // No analyser: capture and transcription still work, the waveform stays flat.
          audio = null;
        }
      }

      rec.start(o.chunkMs ?? 250);
      if (mode === 'pushToTalk') events.emit('speechStart', { at: clock.now() });
    })();

    return session;
  }
}
