import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../../i18n';
import { ConsentStep, HowToPlayStep, LanguageStep, OnboardingHeader, SponsorStep, VoiceStep } from './OnboardingSteps';
import { TeamStep } from './TeamStep';
import { ONBOARDING_STEPS, type OnboardingLanguage, type OnboardingMember, type OnboardingSponsor, type OnboardingStep, type PeriodUnit, type SponsorTab, type SubPeriodUnit, type VoiceCheck } from './types';

export interface OnboardingFlowProps {
  /** Where to open, for the gallery and stories. Normal play starts at `lang`. */
  initial?: { step?: OnboardingStep; voice?: VoiceCheck; open?: string; read?: string[] };
  minHeight?: string;
  /** The storyline: team size, run length and the time to spend each period. */
  teamSize: number;
  periods: { unit: PeriodUnit; count: number };
  subPeriodUnit: SubPeriodUnit;
  /** Sub-periods to spend each period (5 days a week). */
  capacity: number;
  languages: OnboardingLanguage[];
  sponsor: OnboardingSponsor;
  /** Who sees the report, in the consent step. */
  organisation: string | null;
  /** First name of the person whose voice the sample plays. */
  sampleName: string;
  members: OnboardingMember[];
  readsNeeded?: number;
  /** Consent given (true) or text only chosen (false). */
  onConsent: (voice: boolean) => void;
  /** A profile was opened for the first time. */
  onOpenProfile?: (id: string) => void;
  /** Shows a toast. */
  onSay: (text: string) => void;
  /** Start the first period. */
  onFinish: () => void;
}

const WAIT_SECONDS = 4;
const flatWave = () => Array<number>(28).fill(4);

/**
 * The one time onboarding: language, the sponsor's welcome, consent, voice check, how to play and
 * meeting the team. Holds only the flow's own state (step, tab, mic check); everything about the
 * storyline arrives as props, and choices leave as events. Focus moves to each new step's heading.
 */
export function OnboardingFlow(p: OnboardingFlowProps) {
  const { t } = useI18n();
  const readsNeeded = p.readsNeeded ?? 3;
  const [step, setStep] = useState<OnboardingStep>(p.initial?.step ?? 'lang');
  const [lang, setLang] = useState(0);
  const [tab, setTab] = useState<SponsorTab>('welcome');
  const [wait, setWait] = useState(WAIT_SECONDS);
  const words = t('onboarding.voice.phrase').split(' ');
  const [voice, setVoice] = useState<{ check: VoiceCheck; listening: boolean; heard: number; wave: number[] }>(() => ({
    check: p.initial?.voice ?? 'idle', listening: false, heard: p.initial?.voice === 'heard' ? words.length : 0, wave: flatWave()
  }));
  const [open, setOpen] = useState<string | null>(p.initial?.open ?? null);
  const [opened, setOpened] = useState<string[]>(p.initial?.read ?? []);
  const micTimer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const root = useRef<HTMLDivElement>(null);
  /** The step whose heading last took focus; the opening step does not take it. */
  const shown = useRef(step);

  // Next on the sponsor's welcome unlocks after a few seconds (or when the video ends).
  useEffect(() => {
    if (step !== 'sponsor') return;
    const id = setInterval(() => setWait(w => Math.max(0, w - 1)), 1000);
    return () => clearInterval(id);
  }, [step]);
  useEffect(() => () => clearInterval(micTimer.current), []);
  useEffect(() => {
    if (shown.current === step) return;
    shown.current = step;
    root.current?.querySelector<HTMLElement>('h1')?.focus({ preventScroll: true });
  }, [step]);

  const index = ONBOARDING_STEPS.indexOf(step);
  const next = () => {
    if (step === 'consent') p.onConsent(true);
    if (index < ONBOARDING_STEPS.length - 1) setStep(ONBOARDING_STEPS[index + 1]);
  };
  const textOnly = () => {
    clearInterval(micTimer.current);
    p.onConsent(false);
    p.onSay(t('onboarding.textOnly.toast'));
    setStep('how');
  };
  const toggleMic = () => {
    if (voice.check === 'denied') return;
    clearInterval(micTimer.current);
    if (voice.listening) {
      setVoice(v => ({ ...v, listening: false, wave: flatWave() }));
      return;
    }
    setVoice(v => ({ ...v, listening: true, heard: 0 }));
    let n = 0;
    micTimer.current = setInterval(() => {
      n++;
      setVoice(v => ({ ...v, wave: v.wave.map(() => 6 + Math.round(Math.random() * 30)), heard: Math.min(words.length, Math.floor(n / 4)) }));
      if (n > 22) {
        clearInterval(micTimer.current);
        setVoice(v => ({ ...v, listening: false, check: 'heard', heard: words.length, wave: flatWave() }));
      }
    }, 100);
  };
  const openProfile = (id: string) => {
    setOpen(id);
    if (!opened.includes(id)) {
      setOpened([...opened, id]);
      p.onOpenProfile?.(id);
    }
  };
  const first = (name: string) => name.split(' ')[0];

  const read = [...new Set([...opened, ...p.members.filter(m => m.read).map(m => m.id)])];
  return (
    <div ref={root} className="flex flex-1 flex-col gap-5 px-8 pt-5 pb-8" style={{ minHeight: p.minHeight }}>
      <OnboardingHeader step={index} total={ONBOARDING_STEPS.length} />
      {step === 'lang' && (
        <LanguageStep languages={p.languages} lang={lang} onLang={setLang} onBegin={next}
          title={t('onboarding.lang.title', {
            size: t('onboarding.number', { n: p.teamSize }),
            length: t('onboarding.duration', { words: t('onboarding.number', { n: p.periods.count }), unit: p.periods.unit, n: p.periods.count })
          })} />
      )}
      {step === 'sponsor' && (
        <SponsorStep sponsor={p.sponsor} tab={tab} onTab={setTab} wait={wait} onNext={next}
          onPlay={() => p.onSay(t('onboarding.sponsor.playing', { name: first(p.sponsor.name) }))} />
      )}
      {step === 'consent' && <ConsentStep organisation={p.organisation} onAccept={next} onTextOnly={textOnly} />}
      {step === 'voice' && (
        <VoiceStep check={voice.check} listening={voice.listening} wave={voice.wave} words={words} heard={voice.heard} sampleName={p.sampleName}
          onMic={toggleMic} onNext={next} onSkip={textOnly}
          onSample={() => p.onSay(t('onboarding.voice.sampleToast', { name: p.sampleName }))} />
      )}
      {step === 'how' && (
        <HowToPlayStep periodUnit={p.periods.unit} onNext={next}
          amount={t('time.amount', { unit: p.subPeriodUnit, n: p.capacity })} />
      )}
      {step === 'team' && (
        <TeamStep members={p.members} read={read} open={open} readsNeeded={readsNeeded} onOpen={openProfile} onStart={p.onFinish}
          startLabel={t('onboarding.team.start', { unit: p.periods.unit, n: 1 })} />
      )}
    </div>
  );
}
