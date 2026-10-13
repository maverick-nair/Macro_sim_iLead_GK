import { useEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '../../i18n';
import { createSpeech, useSpeech } from '../../speech';
import { FOCUS, LINK, QUIET_BUTTON } from './IntroHeader';

export interface MicCheckProps {
  /** Something was heard: voice is on. */
  onHeard: () => void;
  /** Carry on in text. */
  onText: () => void;
}

/** The longest the test listens before it stops by itself. */
const MAX_MS = 6000;
const BARS = 6;

const MicIcon = () => (
  <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>
);

/**
 * The optional microphone test on the objectives (D219): on the speech layer, a few seconds of listening with a
 * level meter, and what was heard. Blocked or missing microphones say so, with text as the way on. Loaded only
 * when the objectives open.
 */
export default function MicCheck({ onHeard, onText }: MicCheckProps) {
  const { t } = useI18n();
  const provider = useMemo(() => createSpeech('onboarding', { mockScript: t('onboarding.voice.phrase') }), [t]);
  const speech = useSpeech(provider, { consented: true, mode: 'openMic', review: true });
  const [state, setState] = useState<'idle' | 'listening' | 'heard' | 'silent' | 'denied' | 'unavailable' | 'text'>('idle');
  const limit = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(limit.current), []);
  const code = speech.error?.code;
  const blocked = speech.status === 'denied' || code === 'denied' ? 'denied' : speech.status === 'unsupported' || code === 'unsupported' || code === 'noDevice' ? 'unavailable' : null;
  const listening = speech.status === 'listening' || speech.status === 'requesting' || speech.status === 'finishing';
  const take = speech.status === 'review' ? speech.transcript.trim() : null;
  // Each take is handled once, whatever re-renders the caller's handler causes.
  const handled = useRef<string | null>(null);
  const heard = useRef(onHeard);
  useEffect(() => { heard.current = onHeard; });
  useEffect(() => {
    if (take === null || handled.current === take) return;
    handled.current = take;
    clearTimeout(limit.current);
    // The speech controller is an external store: its result lands here (D78 keeps this finding).
    setState(take ? 'heard' : 'silent');
    if (take) heard.current();
  }, [take]);
  // A take that ended without a result (silence) reads as nothing heard yet.
  const shown = blocked ?? (listening ? 'listening' : state === 'listening' && speech.status !== 'review' ? 'silent' : state);
  const level = Math.min(1, speech.level ?? 0);
  const toggle = async () => {
    if (blocked) return;
    if (listening) { void speech.stop(); return; }
    speech.cancel();
    handled.current = null;
    setState('listening');
    const r = await speech.start();
    if (r === 'started') limit.current = setTimeout(() => void speech.stop(), MAX_MS);
  };
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => void toggle()} aria-pressed={listening} className={QUIET_BUTTON}><MicIcon />{listening ? t('intro.mic.stop') : t('intro.mic.start')}</button>
        <span role="meter" aria-label={t('intro.mic.level')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(level * 100)} className="flex h-6 items-end gap-0.75">
          {Array.from({ length: BARS }, (_, i) => (
            <span key={i} className={`w-1 ${listening && level * BARS > i ? 'bg-accent-secondary' : 'bg-track'}`} style={{ height: `${30 + i * 14}%` }} />
          ))}
        </span>
      </div>
      <p role="status" className={`m-0 min-h-5 text-14 leading-(--il-canvas-leading-line) ${shown === 'heard' ? 'text-accent-secondary' : 'text-fg-secondary'}`}>{shown === 'idle' ? '' : t('intro.mic.status', { state: shown })}</p>
      <span><button type="button" onClick={() => { setState('text'); onText(); }} className={`${LINK} text-14 ${FOCUS}`}>{t('intro.mic.text')}</button></span>
    </div>
  );
}
