import { useEffect, useMemo, useRef, useState } from 'react';
import { mockStream } from '../../ai/mockStream';
import { useAiStream } from '../../ai/useAiStream';
import { useI18n } from '../../i18n';
import { createSpeech, useSpeech, type SpeechProvider } from '../../speech';
import { LiveCaption } from '../live/LiveCaption';
import { VoiceStep } from './OnboardingSteps';
import type { VoiceCheck } from './types';

export interface LiveVoiceStepProps {
  /** First name of the person whose voice the sample plays. */
  sampleName: string;
  onNext: () => void;
  /** Carry on in text only. */
  onSkip: () => void;
  /** Speech input; defaults to `createSpeech` (the mock voice, or the microphone with a transcription server). */
  provider?: SpeechProvider;
}

/** The longest the test records before it stops by itself. */
const MAX_MS = 6000;
const BARS = 28;
/** Bar heights for the input level: 4px at rest, up to 40px. */
const wave = (levels: number[]) => {
  const recent = levels.slice(-BARS);
  return Array.from({ length: BARS }, (_, i) => 4 + Math.round(36 * Math.min(1, recent[i - (BARS - recent.length)] ?? 0)));
};

/**
 * The onboarding mic test on the speech layer (`src/speech`): it records a few seconds (open mic, so
 * it stops when the participant stops speaking), shows the live input level and the transcript, and
 * says plainly when the microphone is blocked or missing, with text mode as the way on. The sample
 * voice streams a short NPC line with captions through the same AI stream and caption as the live
 * screen. Loaded only when the voice step opens.
 */
export default function LiveVoiceStep({ sampleName, onNext, onSkip, provider: given }: LiveVoiceStepProps) {
  const { t } = useI18n();
  const phrase = t('onboarding.voice.phrase');
  const provider = useMemo(() => given ?? createSpeech('onboarding', { mockScript: phrase }), [given, phrase]);
  // Consent was given on the step before; nothing records until the mic is pressed.
  const speech = useSpeech(provider, { consented: true, mode: 'openMic', review: true });
  const ai = useAiStream();
  const [check, setCheck] = useState<VoiceCheck>('idle');
  const [silent, setSilent] = useState(false);
  const limit = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(limit.current), []);

  // The browser's answer: blocked, or no microphone to record from.
  const code = speech.error?.code;
  const blocked: VoiceCheck | null = speech.status === 'denied' || code === 'denied' ? 'denied'
    : speech.status === 'unsupported' || code === 'unsupported' || code === 'noDevice' ? 'unavailable' : null;
  const listening = speech.status === 'listening' || speech.status === 'requesting';
  const said = speech.status === 'review' ? speech.transcript : [speech.transcript, speech.partial].filter(Boolean).join(' ');

  // A finished take: heard when anything was said, otherwise ask again.
  const take = speech.status === 'review' ? speech.transcript.trim() : null;
  useEffect(() => {
    if (take === null) return;
    clearTimeout(limit.current);
    // The speech controller is an external store: its result lands here (D78 keeps this finding).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSilent(!take);
    if (take) setCheck('heard');
  }, [take]);
  // A take that ended with nothing said (open mic heard silence) goes back to idle: ask again.
  const wasListening = useRef(false);
  useEffect(() => {
    if (speech.status === 'listening' || speech.status === 'finishing') { wasListening.current = true; return; }
    if (speech.status === 'review') { wasListening.current = false; return; }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- as above, the speech controller's status
    if (speech.status === 'idle' && wasListening.current) { wasListening.current = false; clearTimeout(limit.current); if (!speech.error) setSilent(true); }
  }, [speech.status, speech.error]);

  const toggleMic = async () => {
    if (blocked) return;
    clearTimeout(limit.current);
    if (listening) { void speech.stop(); return; }
    setSilent(false);
    speech.cancel();
    const r = await speech.start();
    if (r === 'started') limit.current = setTimeout(() => void speech.stop(), MAX_MS);
  };

  const words = phrase.split(' ');
  // How much of the phrase came through: the words heard, in order, up to its length.
  const heardWords = check === 'heard' ? words.length : Math.min(words.length, said.split(/\s+/).filter(Boolean).length);
  const status = listening ? t('onboarding.voice.status', { state: 'listening' })
    : speech.status === 'finishing' ? t('onboarding.voice.status', { state: 'finishing' })
    : silent ? t('onboarding.voice.status', { state: 'silent' }) : '';

  const playSample = () => {
    const line = t('onboarding.voice.sampleLine');
    void ai.start(signal => mockStream(line, { signal, tokensPerSecond: 6 }));
  };
  const sampleShown = ai.streaming || ai.done || ai.cancelled;

  return (
    <VoiceStep
      check={blocked ?? check} listening={listening} wave={wave(speech.levels)} words={words} heard={heardWords} sampleName={sampleName}
      onMic={() => void toggleMic()} onNext={onNext} onSkip={onSkip} onText={blocked ? onSkip : undefined}
      heardText={said || null} status={status}
      onSample={playSample}
      sample={sampleShown ? (
        <div className="flex w-full justify-center">
          <LiveCaption variant="panel" centered name={sampleName} text={ai.text} streaming={ai.streaming} />
        </div>
      ) : undefined}
    />
  );
}
