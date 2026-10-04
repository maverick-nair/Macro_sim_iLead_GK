/**
 * Energy based voice activity detector for open mic turn detection and NPC interrupts.
 * It looks at the input level only (loudness), never at what the voice sounds like.
 *
 * Hysteresis: speech starts once the level stays at or above `startThreshold` for `minSpeechMs`,
 * and ends once it stays below `endThreshold` for `hangMs`. Short pauses between words stay inside
 * one turn; a cough shorter than `minSpeechMs` never starts one.
 */
export interface VadOptions {
  /** Level (0..1) that counts as speech. Default 0.45 (about −33 dBFS with the default level scale). */
  startThreshold?: number;
  /** Level below which speech may end. Lower than `startThreshold`. Default 0.35. */
  endThreshold?: number;
  /** How long the level must stay high before speech starts. Default 150ms. */
  minSpeechMs?: number;
  /** Silence that ends a turn. Default 800ms. */
  hangMs?: number;
}

export type VadEvent = { type: 'speechStart'; at: number } | { type: 'speechEnd'; at: number };

export interface Vad {
  /** Feeds one level sample taken at time `t` (ms). Returns an event when the state flips. */
  push(level: number, t: number): VadEvent | null;
  readonly speaking: boolean;
  reset(): void;
}

export const VAD_DEFAULTS: Required<VadOptions> = { startThreshold: 0.45, endThreshold: 0.35, minSpeechMs: 150, hangMs: 800 };

export function createVad(options: VadOptions = {}): Vad {
  const o = { ...VAD_DEFAULTS, ...options };
  if (o.endThreshold > o.startThreshold) throw new Error('VAD endThreshold must not exceed startThreshold');
  let speaking = false;
  let aboveSince: number | null = null;
  let belowSince: number | null = null;
  return {
    get speaking() {
      return speaking;
    },
    reset() {
      speaking = false;
      aboveSince = belowSince = null;
    },
    push(level, t) {
      if (!speaking) {
        if (level >= o.startThreshold) {
          aboveSince ??= t;
          if (t - aboveSince >= o.minSpeechMs) {
            speaking = true;
            belowSince = null;
            return { type: 'speechStart', at: aboveSince };
          }
        } else aboveSince = null;
        return null;
      }
      if (level < o.endThreshold) {
        belowSince ??= t;
        if (t - belowSince >= o.hangMs) {
          speaking = false;
          aboveSince = null;
          return { type: 'speechEnd', at: belowSince };
        }
      } else belowSince = null;
      return null;
    }
  };
}

/**
 * Maps an RMS amplitude (0..1, full scale) to a 0..1 level on a decibel scale, so quiet speech
 * still moves the waveform. `floorDb` maps to 0, 0 dBFS maps to 1.
 */
export function levelFromRms(rms: number, floorDb = -60): number {
  if (!(rms > 0)) return 0;
  const db = 20 * Math.log10(rms);
  return Math.min(1, Math.max(0, (db - floorDb) / -floorDb));
}
