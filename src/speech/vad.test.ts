import { describe, expect, it } from 'vitest';
import { createVad, levelFromRms } from './vad';

/** Feeds a level series sampled every `step` ms and collects the events. */
function run(levels: number[], step = 50, options = {}) {
  const vad = createVad(options);
  return levels.flatMap((l, i) => {
    const e = vad.push(l, i * step);
    return e ? [{ ...e, i }] : [];
  });
}

describe('energy VAD', () => {
  it('starts after minSpeechMs above the start threshold and ends after the hang time', () => {
    const levels = [...Array(5).fill(0.1), ...Array(20).fill(0.7), ...Array(30).fill(0.1)];
    const events = run(levels, 50, { minSpeechMs: 150, hangMs: 800 });
    expect(events.map(e => e.type)).toEqual(['speechStart', 'speechEnd']);
    // Speech began at sample 5 (250ms) and is confirmed 150ms later.
    expect(events[0]).toMatchObject({ at: 250, i: 8 });
    // Silence began at sample 25 (1250ms); the turn ends 800ms later.
    expect(events[1]).toMatchObject({ at: 1250, i: 41 });
  });

  it('ignores a blip shorter than minSpeechMs', () => {
    expect(run([0.1, 0.8, 0.8, 0.1, 0.1, 0.1], 50, { minSpeechMs: 150 })).toEqual([]);
  });

  it('keeps one turn across short pauses and uses hysteresis', () => {
    // 0.4 is below start (0.45) but above end (0.35): it holds speech, it cannot start it.
    const levels = [...Array(6).fill(0.7), ...Array(10).fill(0.1), ...Array(6).fill(0.4), ...Array(6).fill(0.7), ...Array(30).fill(0.05)];
    const events = run(levels, 50, { hangMs: 800 });
    expect(events.map(e => e.type)).toEqual(['speechStart', 'speechEnd']);
    expect(run(Array(20).fill(0.4))).toEqual([]);
  });

  it('honours custom thresholds', () => {
    expect(run(Array(10).fill(0.3), 50, { startThreshold: 0.25, endThreshold: 0.2 }).map(e => e.type)).toEqual(['speechStart']);
    expect(() => createVad({ startThreshold: 0.2, endThreshold: 0.3 })).toThrow();
  });

  it('maps RMS to a decibel scaled level', () => {
    expect(levelFromRms(0)).toBe(0);
    expect(levelFromRms(1)).toBe(1);
    expect(levelFromRms(0.001)).toBeCloseTo(0, 5);
    expect(levelFromRms(Math.pow(10, -30 / 20))).toBeCloseTo(0.5, 5);
  });
});
