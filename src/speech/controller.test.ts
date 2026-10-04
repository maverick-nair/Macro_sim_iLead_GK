import { describe, expect, it, vi } from 'vitest';
import { createManualClock } from '../lib/clock';
import { createSpeechController, type SpeechStatus } from './controller';
import { MockSpeechProvider } from './mock';
import type { SpeechProvider } from './types';

const SCRIPT = { text: 'What would help you most this week?', delayMs: 100, wordsPerMinute: 300 };

function setup(options: Partial<Parameters<typeof createSpeechController>[1]> = {}, provider?: SpeechProvider) {
  const clock = createManualClock();
  const p = provider ?? new MockSpeechProvider({ script: SCRIPT, clock });
  const c = createSpeechController(p, { consented: true, ...options });
  const statuses: SpeechStatus[] = [c.getState().status];
  c.subscribe(() => {
    const s = c.getState().status;
    if (statuses.at(-1) !== s) statuses.push(s);
  });
  return { c, clock, p, statuses };
}

describe('speech controller', () => {
  it('refuses to start without consent and never touches the provider', async () => {
    const provider: SpeechProvider = { permission: 'unknown', requestPermission: vi.fn(), start: vi.fn() };
    const { c } = setup({ consented: false }, provider);
    expect(await c.start()).toBe('consentRequired');
    expect(provider.requestPermission).not.toHaveBeenCalled();
    expect(provider.start).not.toHaveBeenCalled();
    expect(c.getState().status).toBe('idle');
  });

  it('starts once consent is given, and withdrawing consent stops capture', async () => {
    const { c, clock } = setup({ consented: false });
    c.setConsented(true);
    expect(await c.start()).toBe('started');
    await clock.advance(500);
    expect(c.getState().status).toBe('listening');
    c.setConsented(false);
    expect(c.getState()).toMatchObject({ status: 'idle', transcript: '', partial: '' });
    expect(await c.start()).toBe('consentRequired');
  });

  it('push to talk: idle, requesting, listening, finishing, review, idle', async () => {
    const onSpeechStart = vi.fn();
    const onTranscript = vi.fn();
    const { c, clock, statuses } = setup({ onSpeechStart, onTranscript });
    expect(await c.start()).toBe('started');
    expect(onSpeechStart).toHaveBeenCalledTimes(1);
    await clock.advance(700);
    expect(c.getState()).toMatchObject({ status: 'listening', speaking: true, partial: 'What would help' });
    expect(c.getState().levels.length).toBeGreaterThan(5);
    expect(await c.start()).toBe('busy');
    await c.stop();
    expect(c.getState()).toMatchObject({ status: 'review', transcript: 'What would help you most this week?', partial: '', speaking: false });
    expect(statuses).toEqual(['idle', 'requesting', 'listening', 'finishing', 'review']);
    expect(c.accept()).toBe('What would help you most this week?');
    expect(onTranscript).toHaveBeenCalledWith('What would help you most this week?');
    expect(c.getState().status).toBe('idle');
  });

  it('lets the participant edit the transcript in review, and only in review', async () => {
    const onTranscript = vi.fn();
    const { c, clock } = setup({ onTranscript });
    await c.start();
    c.setTranscript('typed over while listening');
    await clock.advance(300);
    await c.stop();
    expect(c.getState().edited).toBe(false);
    c.setTranscript('What would help Kent most this week?');
    expect(c.getState()).toMatchObject({ status: 'review', transcript: 'What would help Kent most this week?', edited: true });
    expect(c.accept()).toBe('What would help Kent most this week?');
    expect(onTranscript).toHaveBeenCalledWith('What would help Kent most this week?');
  });

  it('cancel in review discards the transcript', async () => {
    const onTranscript = vi.fn();
    const { c } = setup({ onTranscript });
    await c.start();
    await c.stop();
    expect(c.getState().status).toBe('review');
    c.cancel();
    expect(c.getState()).toMatchObject({ status: 'idle', transcript: '' });
    expect(onTranscript).not.toHaveBeenCalled();
  });

  it('skips review when review is off', async () => {
    const onTranscript = vi.fn();
    const { c } = setup({ review: false, onTranscript });
    await c.start();
    await c.stop();
    expect(c.getState().status).toBe('idle');
    expect(onTranscript).toHaveBeenCalledWith('What would help you most this week?');
  });

  it('open mic: speechStart interrupts the NPC and speechEnd ends the turn', async () => {
    const onSpeechStart = vi.fn();
    const { c, clock } = setup({ mode: 'openMic', onSpeechStart });
    await c.start();
    await clock.advance(50);
    expect(onSpeechStart).not.toHaveBeenCalled();
    await clock.advance(100);
    expect(onSpeechStart).toHaveBeenCalledTimes(1);
    expect(c.getState().speaking).toBe(true);
    await clock.advance(3000);
    expect(c.getState()).toMatchObject({ status: 'review', transcript: 'What would help you most this week?', speaking: false });
  });

  it('switches mode now when idle, and for the next turn while listening', async () => {
    const { c } = setup();
    c.setMode('openMic');
    expect(c.getState().mode).toBe('openMic');
    await c.start();
    c.setMode('pushToTalk');
    expect(c.getState().mode).toBe('openMic');
    c.cancel();
    expect(c.getState().mode).toBe('pushToTalk');
  });

  it('goes to denied when the microphone is refused, with a non recoverable error', async () => {
    const onError = vi.fn();
    const { c, statuses } = setup({ onError }, new MockSpeechProvider({ script: 'x', grants: 'denied' }));
    expect(await c.start()).toBe('denied');
    expect(statuses).toEqual(['idle', 'requesting', 'denied']);
    expect(c.getState().error).toEqual({ code: 'denied', recoverable: false });
    expect(onError).toHaveBeenCalledWith({ code: 'denied', recoverable: false });
  });

  it('starts in unsupported when the provider has no microphone API', () => {
    const { c } = setup({}, new MockSpeechProvider({ script: 'x', permission: 'unsupported' }));
    expect(c.getState().status).toBe('unsupported');
  });

  it('keeps what was heard for review when the session fails mid turn', async () => {
    const clock = createManualClock();
    const provider = new MockSpeechProvider({ script: { text: 'First part. Second part', delayMs: 0, wordsPerMinute: 300 }, clock, fail: { code: 'network', recoverable: true, afterMs: 500 } });
    const { c } = setup({}, provider);
    await c.start();
    await clock.advance(600);
    expect(c.getState()).toMatchObject({ status: 'review', transcript: 'First part.', error: { code: 'network', recoverable: true } });
    c.clearError();
    expect(c.getState().error).toBeNull();
  });
});
