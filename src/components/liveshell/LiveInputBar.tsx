import type { KeyboardEvent } from 'react';
import { NoWrapButton } from '../../ds/Button';
import { useI18n } from '../../i18n';
import { MicButton, RecordAgainButton, type MicState } from '../live/MicButton';
import { MicHint, MicStatus, type MicHintInput, type MicStatusKind } from '../live/MicStatus';
import { Waveform } from '../live/Waveform';
import { FOCUS, type LiveConversation, type LiveMode } from './types';

export interface LiveInputBarProps {
  mode: LiveMode;
  /** What the mic is doing. `denied` shows the blocked mic banner and keeps everything working in text. */
  mic: MicState;
  conversation: LiveConversation;
  /** The participant's voice preference: push to talk (default) or hands free. */
  voiceInput?: 'ptt' | 'open';
  /** Short name of the NPC speaking now, for "Kent is speaking. Talk to interrupt." */
  speakerName: string;
  /** Your reply: typed, or the live transcript while listening, editable in review. */
  draft: string;
  onDraft: (text: string) => void;
  onSend: () => void;
  /** Starts listening, or stops and goes to review while listening. */
  onMicPress: () => void;
  /** Discards the transcript in review and listens again. */
  onRecordAgain?: () => void;
  /** Called when the mic is pressed while the NPC is speaking, before `onMicPress`. */
  onInterrupt?: () => void;
  /** The mic banner's "Continue in text" calls this with `text`. */
  onModeChange: (mode: LiveMode) => void;
  /** Mic levels while listening, one bar each. */
  levels: number[];
  /** The last capture was poor audio: the transcript has gaps to fix. */
  partial?: boolean;
}

/** The state line above the reply, in the order the design checks it. */
export function micStatusFor(p: Pick<LiveInputBarProps, 'mic' | 'mode' | 'conversation' | 'voiceInput' | 'partial'>): MicStatusKind {
  if (p.mic === 'denied') return 'denied';
  if (p.mic === 'listening') return 'listening';
  if (p.mic === 'review') return p.partial ? 'partial' : 'review';
  if (p.conversation === 'npcSpeaking') return 'speaking';
  if (p.conversation === 'npcThinking') return 'thinking';
  if (p.conversation === 'closed') return 'done';
  if (p.mode === 'voice') return p.voiceInput === 'open' ? 'readyOpen' : 'readyPtt';
  return 'readyText';
}

/** The line under the reply: how to talk or type. */
export function micHintFor(p: Pick<LiveInputBarProps, 'mic' | 'mode' | 'voiceInput'>): MicHintInput {
  if (p.mic === 'denied') return 'denied';
  if (p.mode === 'voice') return p.voiceInput === 'open' ? 'open' : 'ptt';
  return 'text';
}

const SendIcon = () => (
  <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m5 12 14 0" />
    <path d="m13 6 6 6-6 6" />
  </svg>
);

/**
 * The reply bar under every spoken format: the state line, your words (typed, or the live transcript
 * with the waveform while listening, editable before sending), record again, the mic and send.
 * A blocked mic shows a banner that keeps the conversation going in text.
 */
export function LiveInputBar(p: LiveInputBarProps) {
  const { t } = useI18n();
  const { mode, mic, conversation, draft } = p;
  const listening = mic === 'listening';
  const denied = mic === 'denied';
  const closed = conversation === 'closed';
  const cantSend = listening || conversation === 'npcThinking' || closed;
  const canRedo = mic === 'review' && mode === 'voice' && !!p.onRecordAgain;
  const placeholder = t('liveshell.reply.placeholder', { kind: closed ? 'done' : mode === 'text' || denied ? 'text' : 'voice' });
  const pressMic = () => {
    if (conversation === 'npcSpeaking' && !listening) p.onInterrupt?.();
    p.onMicPress();
  };
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!cantSend) p.onSend();
    }
  };
  return (
    <div className="flex flex-col gap-2">
      {denied && (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-16 border border-status-attention bg-status-attention-soft px-3.5 py-3 text-13">
          <span className="min-w-50 flex-1"><b>{t('liveshell.micDenied.title')}</b> {t('liveshell.micDenied.body')}</span>
          <NoWrapButton variant="secondary" size="sm" onClick={() => p.onModeChange('text')}>{t('liveshell.micDenied.action')}</NoWrapButton>
        </div>
      )}
      {p.partial && (
        <div role="alert" className="rounded-16 border border-line-strong bg-surface-raised px-3.5 py-2.5 text-13">
          <b>{t('liveshell.partial.title')}</b> {t('liveshell.partial.body')}
        </div>
      )}
      <div className={`flex items-end gap-2.5 rounded-24 border border-solid bg-surface-material p-2.5 ${listening ? 'border-voice-listening shadow-(--il-liveshell-reply-listening-ring)' : 'border-line-control'}`}>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <MicStatus status={micStatusFor(p)} speaker={p.speakerName} />
          {listening ? (
            <div className="flex min-h-12 items-center gap-2.5 px-2 py-1">
              <Waveform levels={p.levels} />
              <span className="text-15">{draft}</span>
            </div>
          ) : (
            <textarea value={draft} onChange={e => p.onDraft(e.target.value)} onKeyDown={onKey} placeholder={placeholder} aria-label={t('liveshell.reply.aria')} rows={2}
              className="w-full resize-none rounded-12 border-0 bg-transparent p-2 text-15 leading-normal text-fg-primary outline-0 focus-visible:outline-2 focus-visible:outline-accent-secondary" />
          )}
        </div>
        {canRedo && <RecordAgainButton onPress={p.onRecordAgain!} />}
        <MicButton state={mic} mode={mode} onPress={pressMic} />
        <button type="button" onClick={p.onSend} disabled={cantSend} aria-label={t('liveshell.reply.send')}
          className={`flex size-12 flex-none cursor-pointer items-center justify-center rounded-round border-0 p-0 text-brand-deep-space ${listening || closed ? 'bg-track' : 'bg-transparent bg-(image:--il-fill-brand)'} ${FOCUS}`}>
          <SendIcon />
        </button>
      </div>
      <MicHint input={micHintFor(p)} />
    </div>
  );
}
