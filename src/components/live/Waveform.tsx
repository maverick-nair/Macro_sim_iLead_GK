export interface WaveformProps {
  /** Bar heights in pixels, one per bar, from the mic level meter. */
  levels: number[];
  /** `md` is the reply bar (36 high, animated); `sm` is the inline dictation strip (20 high). */
  size?: 'md' | 'sm';
}

/** Live mic levels while listening or dictating. Decorative: the state label says "Listening". */
export function Waveform({ levels, size = 'md' }: WaveformProps) {
  const md = size === 'md';
  return (
    <span aria-hidden="true" className={`flex items-center gap-0.5 ${md ? 'h-9' : 'h-5'}`}>
      {levels.map((h, i) => (
        <span key={i} className={`w-0.75 rounded-2 bg-accent-secondary ${md ? '[transition:var(--il-live-waveform-transition)]' : ''}`} style={{ height: `${h}px` }} />
      ))}
    </span>
  );
}
