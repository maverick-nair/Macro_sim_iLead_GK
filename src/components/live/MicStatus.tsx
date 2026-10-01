import { useI18n } from '../../i18n';

/**
 * The reply bar's state line. `readyPtt` and `readyOpen` are voice mode waiting for you in push to
 * talk or hands free; `readyText` is text mode; `partial` is review after poor audio.
 */
export type MicStatusKind = 'denied' | 'listening' | 'review' | 'partial' | 'speaking' | 'thinking' | 'done' | 'readyPtt' | 'readyOpen' | 'readyText';

export interface MicStatusProps {
  status: MicStatusKind;
  /** First name of the NPC, for `speaking`. */
  speaker?: string;
}

/** Above the reply: what the conversation is waiting for. Announced politely as it changes. */
export function MicStatus({ status, speaker = '' }: MicStatusProps) {
  const { t } = useI18n();
  return (
    <span aria-live="polite" className={`px-2 text-12 font-700 ${status === 'listening' ? 'text-status-gain' : 'text-fg-secondary'}`}>
      {t('live.mic.status', { status, name: speaker })}
    </span>
  );
}

/** How you answer: push to talk (the default), hands free, text, or text because the mic is blocked. */
export type MicHintInput = 'ptt' | 'open' | 'text' | 'denied';

export interface MicHintProps {
  input: MicHintInput;
}

/** Below the reply bar: how to talk or type, and that the transcript can be edited first. */
export function MicHint({ input }: MicHintProps) {
  const { t } = useI18n();
  return <span className="px-2 text-12 text-fg-secondary">{t('live.mic.hint', { input })}</span>;
}
