import { describe, expect, it } from 'vitest';
import { createManualClock, every, type Clock } from '../lib/clock';
import { MediaRecorderSpeechProvider, type MediaDeps } from './mediaRecorder';
import { createMockTranscriptionClient } from './transcription';
import type { SpeechEvents, SpeechSession } from './types';

/**
 * Fake browser audio stack: a track, a MediaRecorder that emits a chunk every timeslice on the
 * manual clock, and an AnalyserNode whose amplitude the test sets.
 */
function fakeBrowser(clock: Clock, opts: { deny?: string; supported?: string[] } = {}) {
  const audio = { amplitude: 0 };
  const calls = { getUserMedia: 0, trackStops: 0, closed: 0, recorderOptions: [] as Array<MediaRecorderOptions | undefined> };
  class Track extends EventTarget {
    kind = 'audio';
    stop() {
      calls.trackStops++;
    }
  }
  const track = new Track();
  const stream = { getTracks: () => [track], getAudioTracks: () => [track] } as unknown as MediaStream;
  class FakeRecorder extends EventTarget {
    static isTypeSupported = (t: string) => (opts.supported ?? ['audio/webm;codecs=opus']).includes(t);
    state: RecordingState = 'inactive';
    mimeType: string;
    private stopTicks = () => {};
    constructor(_s: MediaStream, o?: MediaRecorderOptions) {
      super();
      calls.recorderOptions.push(o);
      this.mimeType = o?.mimeType ?? 'audio/browser-default';
    }
    private emitChunk() {
      const e = new Event('dataavailable') as Event & { data: Blob };
      e.data = new Blob([new Uint8Array(100)], { type: this.mimeType });
      this.dispatchEvent(e);
    }
    start(timeslice: number) {
      this.state = 'recording';
      this.stopTicks = every(clock, timeslice, () => this.emitChunk());
    }
    stop() {
      if (this.state === 'inactive') return;
      this.state = 'inactive';
      this.stopTicks();
      queueMicrotask(() => {
        this.emitChunk();
        this.dispatchEvent(new Event('stop'));
      });
    }
  }
  class FakeAudioContext {
    createAnalyser() {
      return {
        fftSize: 0,
        getFloatTimeDomainData(buf: Float32Array) {
          for (let i = 0; i < buf.length; i++) buf[i] = audio.amplitude * (i % 2 ? 1 : -1);
        }
      };
    }
    createMediaStreamSource() {
      return { connect() {} };
    }
    resume() {
      return Promise.resolve();
    }
    close() {
      calls.closed++;
      return Promise.resolve();
    }
  }
  const deps: MediaDeps = {
    mediaDevices: {
      getUserMedia: async () => {
        calls.getUserMedia++;
        if (opts.deny) throw Object.assign(new Error(opts.deny), { name: opts.deny });
        return stream;
      }
    },
    MediaRecorder: FakeRecorder as unknown as MediaDeps['MediaRecorder'],
    AudioContext: FakeAudioContext as unknown as MediaDeps['AudioContext']
  };
  return { deps, audio, calls, track };
}

function record(session: SpeechSession, now: () => number) {
  const log: Array<{ t: number; type: keyof SpeechEvents; value: unknown }> = [];
  for (const type of ['partial', 'final', 'speechStart', 'speechEnd', 'error', 'end'] as const) session.on(type, value => log.push({ t: now(), type, value }));
  const levels: number[] = [];
  session.on('level', l => levels.push(l));
  return { log, levels };
}

// A full scale square wave of amplitude a has RMS a, so the level is (20 log10 a + 60) / 60.
const LOUD = 0.1; // −20 dBFS, level 0.67
const QUIET = 0.003; // about −50 dBFS, level 0.16

describe('MediaRecorderSpeechProvider', () => {
  it('streams chunks to the transcription client and emits levels, partials and finals (push to talk)', async () => {
    const clock = createManualClock();
    const b = fakeBrowser(clock);
    const transcription = createMockTranscriptionClient(['Let us review the numbers.', 'What do you need from me?']);
    const provider = new MediaRecorderSpeechProvider({ transcription, clock, deps: b.deps, chunkMs: 250, levelIntervalMs: 50 });
    const session = provider.start({ mode: 'pushToTalk' });
    const { log, levels } = record(session, clock.now);
    b.audio.amplitude = LOUD;
    await clock.advance(1000);
    expect(provider.permission).toBe('granted');
    expect(b.calls.recorderOptions).toEqual([{ mimeType: 'audio/webm;codecs=opus' }]);
    expect(transcription.received).toMatchObject({ streams: 1, chunks: 4, bytes: 400, mimeTypes: ['audio/webm;codecs=opus'] });
    expect(levels).toHaveLength(20);
    expect(levels[0]).toBeCloseTo(2 / 3, 5);
    expect(log[0]).toEqual({ t: 0, type: 'speechStart', value: { at: 0 } });
    expect(log.filter(e => e.type === 'final').map(e => e.value)).toEqual(['Let us review the numbers.']);
    expect(log.filter(e => e.type === 'partial').map(e => e.value)).toEqual(['Let us', 'Let us review the', 'What', 'What do you']);

    const transcript = await session.stop();
    expect(transcript).toBe('Let us review the numbers. What do you need from me?');
    // Release: speechEnd, then the last chunk's partial, the flushed final and the end.
    expect(log.map(e => e.type).slice(-4)).toEqual(['speechEnd', 'partial', 'final', 'end']);
    expect(transcription.received.finished).toBe(1);
    expect(transcription.received.chunks).toBe(5);
    expect(b.calls.trackStops).toBe(1);
    expect(b.calls.closed).toBe(1);
    expect(clock.pending()).toBe(0);
  });

  it('detects turns in open mic from the analyser levels', async () => {
    const clock = createManualClock();
    const b = fakeBrowser(clock);
    const provider = new MediaRecorderSpeechProvider({
      transcription: createMockTranscriptionClient('hello'),
      clock,
      deps: b.deps,
      vad: { minSpeechMs: 100, hangMs: 500 }
    });
    const session = provider.start({ mode: 'openMic' });
    const { log } = record(session, clock.now);
    b.audio.amplitude = QUIET;
    await clock.advance(500);
    expect(log.filter(e => e.type.startsWith('speech'))).toEqual([]);
    b.audio.amplitude = LOUD;
    await clock.advance(1000);
    b.audio.amplitude = QUIET;
    await clock.advance(1000);
    // Loud from the 550ms sample, confirmed 100ms later; quiet from 1550ms, ended 500ms later.
    expect(log.filter(e => e.type.startsWith('speech'))).toEqual([
      { t: 650, type: 'speechStart', value: { at: 550 } },
      { t: 2050, type: 'speechEnd', value: { at: 1550 } }
    ]);
    session.cancel();
    expect(log.at(-1)).toMatchObject({ type: 'end', value: { cancelled: true } });
  });

  it('reports a denied permission without capturing', async () => {
    const clock = createManualClock();
    const b = fakeBrowser(clock, { deny: 'NotAllowedError' });
    const transcription = createMockTranscriptionClient('x');
    const provider = new MediaRecorderSpeechProvider({ transcription, clock, deps: b.deps });
    expect(provider.permission).toBe('unknown');
    const result = await provider.requestPermission();
    expect(result).toMatchObject({ state: 'denied', error: { code: 'denied', recoverable: false } });
    const session = provider.start({ mode: 'pushToTalk' });
    const { log } = record(session, clock.now);
    await clock.advance(100);
    expect(log.map(e => e.type)).toEqual(['error', 'end']);
    expect(transcription.received.streams).toBe(0);
  });

  it('maps a missing microphone to noDevice and keeps the permission state', async () => {
    const clock = createManualClock();
    const provider = new MediaRecorderSpeechProvider({ transcription: createMockTranscriptionClient('x'), clock, deps: fakeBrowser(clock, { deny: 'NotFoundError' }).deps });
    expect(await provider.requestPermission()).toMatchObject({ state: 'unknown', error: { code: 'noDevice', recoverable: true } });
  });

  it('is unsupported without getUserMedia or MediaRecorder', async () => {
    const provider = new MediaRecorderSpeechProvider({ transcription: createMockTranscriptionClient('x'), deps: { mediaDevices: undefined, MediaRecorder: undefined } });
    expect(provider.permission).toBe('unsupported');
    expect(await provider.requestPermission()).toMatchObject({ state: 'unsupported' });
  });

  it('lets the browser pick the container when no preferred type is supported', async () => {
    const clock = createManualClock();
    const b = fakeBrowser(clock, { supported: [] });
    const transcription = createMockTranscriptionClient('x');
    const provider = new MediaRecorderSpeechProvider({ transcription, clock, deps: b.deps });
    const session = provider.start({ mode: 'pushToTalk' });
    await clock.advance(300);
    expect(b.calls.recorderOptions).toEqual([undefined]);
    expect(transcription.received.mimeTypes).toEqual(['audio/browser-default']);
    session.cancel();
  });

  it('fails with noDevice when the microphone is unplugged, and with network on a transcription failure', async () => {
    const clock = createManualClock();
    const b = fakeBrowser(clock);
    const provider = new MediaRecorderSpeechProvider({ transcription: createMockTranscriptionClient('a b c d e f', { failAfterChunks: 2 }), clock, deps: b.deps });
    const s1 = provider.start({ mode: 'pushToTalk' });
    const r1 = record(s1, clock.now);
    await clock.advance(100);
    b.track.dispatchEvent(new Event('ended'));
    expect(r1.log.slice(-2).map(e => e.value)).toEqual([{ code: 'noDevice', recoverable: true, message: 'microphone disconnected' }, { transcript: '', cancelled: true }]);

    const s2 = provider.start({ mode: 'pushToTalk' });
    const r2 = record(s2, clock.now);
    await clock.advance(1000);
    expect(r2.log.filter(e => e.type === 'error').map(e => e.value)).toEqual([{ code: 'network', recoverable: true, message: 'mock transcription failure' }]);
    expect(r2.log.at(-1)?.type).toBe('end');
    expect(clock.pending()).toBe(0);
  });

  it('cancels through the abort signal and aborts the transcription', async () => {
    const clock = createManualClock();
    const b = fakeBrowser(clock);
    const transcription = createMockTranscriptionClient('x');
    const provider = new MediaRecorderSpeechProvider({ transcription, clock, deps: b.deps });
    const ac = new AbortController();
    const session = provider.start({ mode: 'openMic', signal: ac.signal });
    const { log } = record(session, clock.now);
    await clock.advance(300);
    ac.abort();
    expect(log.map(e => e.type).slice(-2)).toEqual(['error', 'end']);
    expect(transcription.received.aborted).toBe(1);
    expect(b.calls.trackStops).toBe(1);
  });
});
