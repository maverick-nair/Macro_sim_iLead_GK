/**
 * Optional sound cues with Web Audio. Off by default; the mute toggle on the score bug turns them on.
 */
type Cue = "kickoff" | "whistle" | "reveal" | "tap";

let ctx: AudioContext | null = null;

const PATTERNS: Record<Cue, [number, number][]> = {
  kickoff: [
    [523, 0.12],
    [659, 0.12],
    [784, 0.25],
  ],
  whistle: [
    [1760, 0.18],
    [0, 0.06],
    [1760, 0.45],
  ],
  reveal: [
    [392, 0.1],
    [587, 0.1],
    [880, 0.3],
  ],
  tap: [[660, 0.05]],
};

export function cue(name: Cue, muted: boolean) {
  if (muted || typeof window === "undefined") return;
  try {
    ctx ??= new AudioContext();
    let t = ctx.currentTime;
    for (const [freq, dur] of PATTERNS[name]) {
      if (freq > 0) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = name === "whistle" ? "sine" : "triangle";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(0.15, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        osc.connect(gain).connect(ctx.destination);
        osc.start(t);
        osc.stop(t + dur + 0.02);
      }
      t += dur;
    }
  } catch {
    /* audio unavailable */
  }
}
