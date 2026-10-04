import { describe, expect, it } from 'vitest';
import { createManualClock } from '../lib/clock';
import { MockSpeechProvider } from './mock';
import type { SpeechEvents, SpeechMode, SpeechSession } from './types';

type Logged = { t: number; type: keyof SpeechEvents; value: unknown };

function record(session: SpeechSession, now: () => number, withLevels = true): Logged[] {
  const log: Logged[] = [];
  for (const type of ['level', 'partial', 'final', 'speechStart', 'speechEnd', 'error', 'end'] as const) {
    if (type === 'level' && !withLevels) continue;
    session.on(type, value => log.push({ t: now(), type, value }));
  }
  return log;
}

async function play(mode: SpeechMode, ms: number) {
  const clock = createManualClock();
  const provider = new MockSpeechProvider({ script: { text: 'How is the pipeline. Any blockers?', delayMs: 200, wordsPerMinute: 300 }, clock });
  const session = provider.start({ mode });
  const log = record(session, clock.now);
  await clock.advance(ms);
  return { log, session, clock };
}

describe('MockSpeechProvider', () => {
  it('is deterministic: two runs on a manual clock produce identical events', async () => {
    const a = await play('openMic', 3000);
    const b = await play('openMic', 3000);
    expect(a.log.length).toBeGreaterThan(40);
    expect(a.log).toEqual(b.log);
  });

  it('plays timed partials and finals, with speech start and end in open mic', async () => {
    const { log } = await play('openMic', 3000);
    const words = log.filter(e => e.type !== 'level');
    // 300 wpm is 200ms a word, after a 200ms delay.
    expect(words).toEqual([
      { t: 200, type: 'speechStart', value: { at: 200 } },
      { t: 400, type: 'partial', value: 'How' },
      { t: 600, type: 'partial', value: 'How is' },
      { t: 800, type: 'partial', value: 'How is the' },
      { t: 1000, type: 'final', value: 'How is the pipeline.' },
      { t: 1200, type: 'partial', value: 'Any' },
      { t: 1400, type: 'final', value: 'Any blockers?' },
      { t: 2200, type: 'speechEnd', value: { at: 1400 } }
    ]);
    const levels = log.filter(e => e.type === 'level').map(e => e.value as number);
    expect(levels.every(l => l >= 0 && l <= 1)).toBe(true);
    expect(Math.max(...levels)).toBeGreaterThan(0.4);
    expect(levels[0]).toBeLessThan(0.15);
  });

  it('push to talk: speechStart on press, release commits the utterance', async () => {
    const { log, session, clock } = await play('pushToTalk', 700);
    expect(log.find(e => e.type === 'speechStart')).toMatchObject({ t: 0 });
    const transcript = await session.stop();
    expect(transcript).toBe('How is the pipeline. Any blockers?');
    expect(log.filter(e => e.type === 'speechEnd')).toHaveLength(1);
    expect(log.at(-1)).toMatchObject({ type: 'end', value: { transcript, cancelled: false } });
    expect(clock.pending()).toBe(0);
  });

  it('push to talk with onEarlyStop heard keeps only the words spoken', async () => {
    const clock = createManualClock();
    const provider = new MockSpeechProvider({ script: { text: 'How is the pipeline', delayMs: 0, wordsPerMinute: 300 }, clock, onEarlyStop: 'heard' });
    const session = provider.start({ mode: 'pushToTalk' });
    await clock.advance(450);
    expect(await session.stop()).toBe('How is');
  });

  it('plays the script in order across sessions', async () => {
    const clock = createManualClock();
    const provider = new MockSpeechProvider({ script: ['First one', 'Second one'], clock });
    expect(await provider.start({ mode: 'pushToTalk' }).stop()).toBe('First one');
    expect(await provider.start({ mode: 'pushToTalk' }).stop()).toBe('Second one');
    expect(await provider.start({ mode: 'pushToTalk' }).stop()).toBe('First one');
  });

  it('simulates a denied microphone', async () => {
    const provider = new MockSpeechProvider({ script: 'hi', grants: 'denied' });
    expect(await provider.requestPermission()).toEqual({ state: 'denied', error: { code: 'denied', recoverable: false } });
    const session = provider.start({ mode: 'pushToTalk' });
    const log = record(session, () => 0);
    await Promise.resolve();
    await Promise.resolve();
    expect(log.map(e => e.type)).toEqual(['error', 'level', 'end']);
  });

  it('aborts through the signal and cancels without a transcript', async () => {
    const clock = createManualClock();
    const provider = new MockSpeechProvider({ script: 'one two three', clock });
    const ac = new AbortController();
    const session = provider.start({ mode: 'openMic', signal: ac.signal });
    const log = record(session, clock.now, false);
    await clock.advance(800);
    ac.abort();
    expect(log.slice(-2)).toEqual([
      { t: 800, type: 'error', value: { code: 'aborted', recoverable: true } },
      { t: 800, type: 'end', value: { transcript: '', cancelled: true } }
    ]);
    expect(clock.pending()).toBe(0);
  });
});
