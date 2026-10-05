import { useI18n } from '../../i18n';

/**
 * What the mic is doing. `review` means a transcript is waiting to be edited and sent; the mic
 * looks ready again and pressing it records over. `denied` is a blocked mic: the button is
 * disabled and the conversation continues in text.
 */
export type MicState = 'idle' | 'listening' | 'review' | 'denied';

export interface MicButtonProps {
  state: MicState;
  /** Voice mode draws the large brand mic; text mode keeps a small neutral one for switching back. */
  mode: 'voice' | 'text';
  /** Starts listening, or stops and goes to review while listening. */
  onPress: () => void;
}

const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-secondary';

const MicIcon = () => (
  <svg className="size-5.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <path d="M12 19v3" />
  </svg>
);

const MicOffIcon = () => (
  <svg className="size-5.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <path d="m2 2 20 20" />
    <path d="M18.89 13.23A7 7 0 0 0 19 12v-2" />
    <path d="M5 10v2a7 7 0 0 0 12 5" />
    <path d="M15 9.34V5a3 3 0 0 0-5.68-1.33" />
    <path d="M9 9v3a3 3 0 0 0 5.12 2.12" />
  </svg>
);

/** The mic button of the live reply bar. Renders state only; the speech provider lives elsewhere. */
export function MicButton({ state, mode, onPress }: MicButtonProps) {
  const { t } = useI18n();
  const denied = state === 'denied';
  const listening = state === 'listening';
  const voice = mode === 'voice' && !denied;
  const box = voice ? 'size-15' : 'size-12';
  const look = denied
    ? 'bg-track text-fg-secondary'
    : listening
      ? 'bg-voice-listening text-brand-deep-space shadow-(--il-live-mic-glow-listening)'
      : voice
        ? 'bg-(image:--il-fill-brand) text-brand-deep-space shadow-(--il-live-mic-glow-ready)'
        : 'bg-surface-raised text-fg-primary';
  return (
    <button
      type="button"
      onClick={onPress}
      disabled={denied}
      aria-label={t('live.mic.aria', { state: denied ? 'denied' : listening ? 'listening' : 'idle' })}
      aria-pressed={listening}
      className={`relative flex flex-none cursor-pointer items-center justify-center rounded-round border-0 p-0 disabled:cursor-not-allowed ${box} ${look} ${FOCUS}`}
    >
      {listening && <span aria-hidden="true" className="absolute -inset-1.5 animate-(--il-live-mic-ring) rounded-round border-2 border-solid border-accent-secondary" />}
      {denied ? <MicOffIcon /> : <MicIcon />}
    </button>
  );
}

export interface RecordAgainButtonProps {
  onPress: () => void;
}

/** Shown next to the mic in review: discards the transcript and listens again. */
export function RecordAgainButton({ onPress }: RecordAgainButtonProps) {
  const { t } = useI18n();
  return (
    <button
      type="button"
      onClick={onPress}
      aria-label={t('live.mic.redo')}
      className={`size-11 flex-none cursor-pointer rounded-round border border-solid border-line-default bg-surface-raised p-0 text-fg-primary ${FOCUS}`}
    >
      <span aria-hidden="true">↺</span>
    </button>
  );
}
