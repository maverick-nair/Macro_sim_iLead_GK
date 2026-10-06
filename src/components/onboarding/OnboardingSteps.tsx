import { useId, type ReactNode } from 'react';
import { NoWrapButton } from '../../ds/Button';
import { useI18n, type I18n } from '../../i18n';
import { WithClientLogo } from '../../theme/brand';
import { onRovingKey } from '../roving';
import { SPONSOR_TABS, type OnboardingLanguage, type OnboardingSponsor, type PeriodUnit, type SponsorTab, type VoiceCheck } from './types';

/** Icon glyph, not copy: the button is named from the catalog. */
const PLAY_GLYPH = '▶';
export const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-secondary';
const EYEBROW = 'text-12 font-700 tracking-(--il-onboarding-eyebrow-tracking) text-accent-secondary uppercase';
/** Step headings take focus when the step changes, so keyboard and screen reader users start at the top. */
export const HEADING = 'm-0 font-700 outline-none';
const ENTER = 'animate-(--il-onboarding-enter)';

/** The locale's quotation marks around a quoted line, split so the quote can be styled inside them. */
export function quoteMarks(t: I18n['t']): [string, string] {
  const s = t('common.quote', { text: '\u0001' });
  const i = s.indexOf('\u0001');
  return [s.slice(0, i), s.slice(i + 1)];
}

export interface OnboardingHeaderProps {
  /** Zero based. */
  step: number;
  total: number;
}

/** Logo, tagline, the step dots and a note that the clock has not started. */
export function OnboardingHeader({ step, total }: OnboardingHeaderProps) {
  const { t } = useI18n();
  return (
    <header className="flex items-center gap-5">
      <WithClientLogo>
        <span className="bg-(image:--il-fill-brand) bg-clip-text text-22 font-700 tracking-(--il-onboarding-logo-tracking) text-transparent">{t('hud.logo')}</span>
      </WithClientLogo>
      <span className="text-13 text-fg-secondary">{t('onboarding.tagline')}</span>
      <span className="flex-1" />
      {/* One image named "Step 2 of 6": the dots are its picture, so they carry no names of their own. */}
      <div role="img" aria-label={t('onboarding.progress', { n: step + 1, total })} className="flex gap-1.5">
        {Array.from({ length: total }, (_, j) => (
          <span key={j}
            className={`h-1.5 rounded-3 [transition:var(--il-onboarding-dot-transition)] ${j === step ? 'w-7' : 'w-2.5'} ${j <= step ? 'bg-(image:--il-fill-brand)' : 'bg-track'}`} />
        ))}
      </div>
      <span className="text-12 text-fg-secondary">{t('onboarding.clockNote')}</span>
    </header>
  );
}

export interface LanguageStepProps {
  /** "Lead a sales team of ten, for eight weeks." */
  title: string;
  /** The picker shows only when more than one language is configured (spec). */
  languages: OnboardingLanguage[];
  lang: number;
  onLang: (index: number) => void;
  onBegin: () => void;
}

/**
 * Step 1: what the simulation is, how long it takes, and the language. It is the first screen of a
 * launch and its heading is the largest paint, so it shows at once instead of rising in (D78).
 */
export function LanguageStep({ title, languages, lang, onLang, onBegin }: LanguageStepProps) {
  const { t } = useI18n();
  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="flex w-160 max-w-full flex-col gap-6">
        <span className={EYEBROW}>{t('onboarding.lang.eyebrow')}</span>
        <h1 tabIndex={-1} className={`${HEADING} text-48 leading-(--il-onboarding-display-leading) tracking-(--il-onboarding-display-tracking)`}>{title}</h1>
        <p className="m-0 text-17 text-pretty text-fg-secondary">{t('onboarding.lang.time')}</p>
        {languages.length > 1 && (
          <div role="radiogroup" aria-label={t('onboarding.lang.aria')} className="grid grid-cols-(--il-onboarding-choice-columns) gap-2.5">
            {languages.map((l, j) => {
              const on = lang === j;
              return (
                <button key={l.id} type="button" role="radio" aria-checked={on} tabIndex={on ? 0 : -1} lang={l.id}
                  onClick={() => onLang(j)} onKeyDown={e => onRovingKey(e, j, languages.length, onLang)}
                  className={`flex cursor-pointer flex-col gap-0.5 rounded-16 border-(length:--il-onboarding-choice-border) border-solid p-3.5 text-left text-fg-primary ${FOCUS} ${on ? 'border-accent-secondary bg-accent-soft' : 'border-line-default bg-surface-card'}`}>
                  <b>{l.name}</b>
                  <span className="text-12 text-fg-secondary">{l.note}</span>
                </button>
              );
            })}
          </div>
        )}
        <div>
          <NoWrapButton variant="primary" size="lg" onClick={onBegin}>{t('onboarding.lang.begin')}</NoWrapButton>
        </div>
      </div>
    </div>
  );
}

export interface SponsorStepProps {
  sponsor: OnboardingSponsor;
  tab: SponsorTab;
  onTab: (tab: SponsorTab) => void;
  /** Seconds until Next unlocks; 0 when it is open. */
  wait: number;
  onPlay: () => void;
  onNext: () => void;
}

/** Step 2: the sponsor's welcome, as a video with captions when there is one, and a three tab letter. */
export function SponsorStep({ sponsor, tab, onTab, wait, onPlay, onNext }: SponsorStepProps) {
  const { t } = useI18n();
  const id = useId();
  const [open, close] = quoteMarks(t);
  const { video } = sponsor;
  const index = SPONSOR_TABS.indexOf(tab);
  return (
    <div className={`grid flex-1 grid-cols-(--il-onboarding-sponsor-columns) items-center gap-10 ${ENTER}`}>
      <div className="relative flex aspect-4/5 max-h-160 items-center justify-center overflow-hidden rounded-28 bg-(image:--il-onboarding-sponsor-fill)">
        {sponsor.img
          ? <img src={sponsor.img} alt="" className="absolute inset-0 size-full object-cover object-top" />
          : <span aria-hidden="true" className="text-120 font-700 text-brand-deep-space opacity-85">{sponsor.initials}</span>}
        {video?.label && <span className="absolute top-4 left-4 text-12 font-700 text-brand-deep-space">{video.label}</span>}
        {video && (
          <div className="absolute right-4 bottom-4 left-4 flex items-center gap-3 rounded-16 bg-onboarding-caption-bar px-3.5 py-3 text-(color:--il-color-white)">
            <button type="button" onClick={onPlay} aria-label={t('onboarding.sponsor.play')}
              className={`size-10 flex-none cursor-pointer rounded-round border-0 bg-(color:--il-color-white) text-brand-deep-space ${FOCUS}`}>{PLAY_GLYPH}</button>
            <span className="text-13">{open}<span>{video.caption}</span>{close}</span>
          </div>
        )}
      </div>
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-1">
          <span className={EYEBROW}>{t('onboarding.sponsor.eyebrow')}</span>
          <h1 tabIndex={-1} className={`${HEADING} text-40 tracking-(--il-onboarding-display-tracking)`}>{sponsor.name}</h1>
          <span className="text-fg-secondary">{sponsor.role}</span>
        </div>
        <div role="tablist" aria-label={t('onboarding.sponsor.tabs.aria')} className="flex gap-0.5 self-start rounded-pill border border-line-default bg-surface-raised p-0.75">
          {SPONSOR_TABS.map((k, j) => {
            const on = tab === k;
            return (
              <button key={k} type="button" role="tab" id={`${id}-${k}`} aria-selected={on} aria-controls={`${id}-panel`} tabIndex={on ? 0 : -1}
                onClick={() => onTab(k)} onKeyDown={e => onRovingKey(e, j, SPONSOR_TABS.length, i => onTab(SPONSOR_TABS[i]))}
                className={`min-h-8.5 cursor-pointer rounded-pill border-0 px-4 py-0 text-13 font-700 whitespace-nowrap ${FOCUS} ${on ? 'bg-(image:--il-fill-brand) text-brand-deep-space' : 'bg-transparent text-fg-secondary'}`}>
                {t('onboarding.sponsor.tab', { tab: k })}
              </button>
            );
          })}
        </div>
        <div role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-${SPONSOR_TABS[index]}`} tabIndex={0} className={`flex min-h-50 flex-col gap-3 rounded-12 ${FOCUS}`}>
          {sponsor.letter[tab].map((p, j) => <p key={j} className="m-0 text-16 leading-(--il-onboarding-sponsor-leading) text-pretty">{p}</p>)}
        </div>
        <div className="flex items-center gap-3.5">
          <NoWrapButton variant="primary" size="lg" disabled={wait > 0} onClick={onNext}>{t('onboarding.sponsor.next')}</NoWrapButton>
          <span className="text-13 text-fg-secondary">{wait > 0 ? t('onboarding.sponsor.wait', { n: wait, video: video ? 'yes' : 'no' }) : ''}</span>
        </div>
      </div>
    </div>
  );
}

export interface ConsentStepProps {
  /** Who sees the report: "your program manager at {organisation}". */
  organisation: string | null;
  onAccept: () => void;
  onTextOnly: () => void;
}

const CONSENT_ITEMS = ['what', 'why', 'keep', 'who'] as const;

/** Step 3: what is recorded, why, for how long and who sees it. Text only stays open. */
export function ConsentStep({ organisation, onAccept, onTextOnly }: ConsentStepProps) {
  const { t } = useI18n();
  return (
    <div className="flex flex-1 items-center justify-center">
      <div className={`flex w-180 max-w-full flex-col gap-5 rounded-28 border border-line-default bg-surface-card p-8 backdrop-blur-14 ${ENTER}`}>
        <h1 tabIndex={-1} className={`${HEADING} text-32 tracking-(--il-onboarding-title-tracking)`}>{t('onboarding.consent.title')}</h1>
        <div className="grid grid-cols-(--il-onboarding-consent-columns) gap-3">
          {CONSENT_ITEMS.map(item => (
            <div key={item} className="flex flex-col gap-1 rounded-16 bg-surface-raised p-3.5">
              <b>{t('onboarding.consent.item', { item })}</b>
              <span className="text-13 text-pretty text-fg-secondary">{t('onboarding.consent.detail', { item, organisation: organisation ?? 'none' })}</span>
            </div>
          ))}
        </div>
        <span className="text-13 text-fg-secondary">{t('onboarding.consent.note')}</span>
        <div className="flex gap-2.5">
          <NoWrapButton variant="primary" size="lg" onClick={onAccept}>{t('onboarding.consent.accept')}</NoWrapButton>
          <NoWrapButton variant="secondary" size="lg" onClick={onTextOnly}>{t('onboarding.consent.textOnly')}</NoWrapButton>
        </div>
      </div>
    </div>
  );
}

export interface VoiceStepProps {
  check: VoiceCheck;
  listening: boolean;
  /** Waveform bar heights in px, from the input level. */
  wave: number[];
  /** The test phrase, word by word, and how many words have been heard. */
  words: string[];
  heard: number;
  /** Whose voice the sample plays, from the storyline. */
  sampleName: string;
  onMic: () => void;
  onSample: () => void;
  onNext: () => void;
  onSkip: () => void;
  /**
   * The real mic test (the playable app): what the speech layer heard so far, shown under the
   * phrase, or null before anything was heard. The design frames leave it out.
   */
  heardText?: string | null;
  /** A short line under the mic: the test is recording, or nothing was heard. */
  status?: string;
  /** Offers text mode inside the blocked or unavailable notice. */
  onText?: () => void;
  /** The sample NPC line, as captions, under the sample button while it plays. */
  sample?: ReactNode;
}

/** Step 4: mic check with a live transcript of the test phrase, a sample NPC voice, or skip to text. */
export function VoiceStep({ check, listening, wave, words, heard, sampleName, onMic, onSample, onNext, onSkip, heardText, status, onText, sample }: VoiceStepProps) {
  const { t } = useI18n();
  const [open, close] = quoteMarks(t);
  const denied = check === 'denied' || check === 'unavailable';
  const said = words.slice(0, heard).join(' ');
  const rest = (heard ? ' ' : '') + words.slice(heard).join(' ');
  return (
    <div className="flex flex-1 items-center justify-center">
      <div className={`flex w-180 max-w-full flex-col items-center gap-5 text-center ${ENTER}`}>
        <span className={EYEBROW}>{t('onboarding.voice.eyebrow')}</span>
        <h1 tabIndex={-1} className={`${HEADING} text-36 tracking-(--il-onboarding-title-tracking)`}>{t('onboarding.voice.title', { state: check })}</h1>
        {denied && (
          <div role="alert" className="flex w-full flex-col gap-1.5 rounded-18 border border-status-attention bg-status-attention-soft p-4 text-left">
            <b>{t(check === 'unavailable' ? 'onboarding.voice.unavailable.title' : 'onboarding.voice.denied.title')}</b>
            <span className="text-13">{t(check === 'unavailable' ? 'onboarding.voice.unavailable.body' : 'onboarding.voice.denied.body')}</span>
            {onText && <div className="pt-1.5"><NoWrapButton variant="primary" size="md" onClick={onText}>{t('onboarding.voice.useText')}</NoWrapButton></div>}
          </div>
        )}
        <button type="button" onClick={onMic} aria-label={t('onboarding.voice.mic', { listening: listening ? 'yes' : 'no' })} aria-pressed={listening} aria-disabled={denied || undefined}
          className={`relative flex size-30 cursor-pointer items-center justify-center rounded-round border-0 text-brand-deep-space ${FOCUS} ${denied ? 'bg-track' : 'bg-(image:--il-fill-brand)'} ${listening ? 'shadow-(--il-onboarding-mic-glow-listening)' : 'shadow-(--il-onboarding-mic-glow)'}`}>
          {listening && <span className="absolute -inset-2.5 animate-(--il-onboarding-mic-ring) rounded-round border-2 border-solid border-accent-secondary" />}
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <path d="M12 19v3" />
          </svg>
        </button>
        <div className="flex h-10 items-center gap-0.75" aria-hidden="true">
          {wave.map((h, j) => <span key={j} className="w-1 rounded-2 bg-accent-secondary [transition:var(--il-onboarding-wave-transition)]" style={{ height: h }} />)}
        </div>
        {status !== undefined && <span role="status" className="min-h-5 text-13 text-fg-secondary">{status}</span>}
        <div className="min-w-105 rounded-16 border border-line-default bg-surface-card px-4.5 py-3.5 text-18">
          <span className="text-fg-secondary">{t('onboarding.voice.say')}</span>{open}<b>{said}</b>
          <span className="text-fg-secondary">{rest}</span>{close}
          {heardText !== undefined && (
            <span className="mt-1.5 block text-14 text-fg-secondary">
              {heardText ? <>{t('onboarding.voice.heard')}{open}<span className="text-fg-primary">{heardText}</span>{close}</> : t('onboarding.voice.heardNothing')}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2.5">
          <NoWrapButton variant="secondary" size="md" onClick={onSample}>{t('onboarding.voice.sample')}</NoWrapButton>
          <span className="text-13 text-fg-secondary">{t('onboarding.voice.sampleWho', { name: sampleName })}</span>
        </div>
        {sample}
        <div className="flex gap-2.5">
          <NoWrapButton variant="primary" size="lg" disabled={check !== 'heard'} onClick={onNext}>{t('onboarding.voice.ok')}</NoWrapButton>
          <NoWrapButton variant="ghost" size="lg" onClick={onSkip}>{t('onboarding.voice.skip')}</NoWrapButton>
        </div>
      </div>
    </div>
  );
}

export interface HowToPlayStepProps {
  periodUnit: PeriodUnit;
  /** Time to spend each period, worded: "5 days". */
  amount: string;
  onNext: () => void;
}

const HOW_CARDS = [
  { key: 'loop', art: 'bg-(image:--il-gradient-brand)' },
  { key: 'kinds', art: 'bg-(image:--il-gradient-product)' },
  { key: 'clock', art: 'bg-(image:--il-onboarding-how-art-calm)' },
  { key: 'evaluated', art: 'bg-(image:--il-gradient-spectrum)' }
] as const;

/** Step 5: four cards, the weekly loop, quick or live actions, the clock, how you are evaluated. */
export function HowToPlayStep({ periodUnit, amount, onNext }: HowToPlayStepProps) {
  const { t, number } = useI18n();
  const text = {
    loop: t('onboarding.how.loop', { unit: periodUnit, amount }),
    kinds: t('onboarding.how.kinds'),
    clock: t('onboarding.how.clock'),
    evaluated: t('onboarding.how.evaluated')
  };
  return (
    <div className={`flex flex-1 flex-col justify-center gap-6 ${ENTER}`}>
      <h1 tabIndex={-1} className={`${HEADING} text-center text-36 tracking-(--il-onboarding-title-tracking)`}>{t('onboarding.how.title')}</h1>
      <div className="grid grid-cols-4 gap-4">
        {HOW_CARDS.map((c, j) => (
          <div key={c.key}
            className={`flex flex-col gap-3 rounded-24 border-(length:--il-onboarding-choice-border) border-solid bg-surface-card p-5 backdrop-blur-14 [transition:var(--il-onboarding-how-transition)] ${j === 0 ? 'border-accent-secondary [transform:var(--il-onboarding-how-lift)]' : 'border-line-default'}`}>
            <div className={`flex h-30 items-end rounded-16 p-3 ${c.art}`}>
              <span aria-hidden="true" className="text-44 leading-none font-700 text-brand-deep-space">{number(j + 1)}</span>
            </div>
            <b className="text-18">{t('onboarding.how.card', { card: c.key })}</b>
            <span className="text-14 text-pretty text-fg-secondary">{text[c.key]}</span>
          </div>
        ))}
      </div>
      <div className="flex justify-center">
        <NoWrapButton variant="primary" size="lg" onClick={onNext}>{t('onboarding.how.next')}</NoWrapButton>
      </div>
    </div>
  );
}
