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
  /** `tablet`: the tablet's voice composer, 56px mic and send (D72). */
  layout?: 'desk' | 'tablet';
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
  const tablet = p.layout === 'tablet';
  // The canvas's reply area (D232): the state line with the mode switch, the field, then the hint,
  // the mic and Send.
  return (
    <div className="flex flex-col gap-2.5">
      {denied && (
        <div role="alert" className="flex flex-wrap items-center gap-3 border border-status-attention bg-status-attention-soft px-3.5 py-3 text-13">
          <span className="min-w-50 flex-1"><b>{t('liveshell.micDenied.title')}</b> {t('liveshell.micDenied.body')}</span>
          <NoWrapButton variant="secondary" size="md" onClick={() => p.onModeChange('text')}>{t('liveshell.micDenied.action')}</NoWrapButton>
        </div>
      )}
      {p.partial && (
        <div role="alert" className="border border-line-strong bg-surface-raised px-3.5 py-2.5 text-13">
          <b>{t('liveshell.partial.title')}</b> {t('liveshell.partial.body')}
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <span className="flex min-h-6 items-center gap-2.5">
          {listening && <span aria-hidden="true" className="size-2 rounded-round bg-voice-listening" />}
          <MicStatus status={micStatusFor(p)} speaker={p.speakerName} />
          {listening && <Waveform levels={p.levels} size="sm" />}
        </span>
        {!denied && (
          <button type="button" onClick={() => p.onModeChange(mode === 'voice' ? 'text' : 'voice')}
            className={`min-h-11 cursor-pointer rounded-4 border-0 bg-transparent px-2 py-0 text-14 text-fg-body hover:text-fg-primary ${FOCUS}`}>
            {t('liveshell.mode.switch', { mode })}
          </button>
        )}
      </div>
      <div className={`flex ${tablet ? 'min-h-16' : 'min-h-14'} items-center border border-solid bg-(--il-color-canvas-navy-850) ${listening ? 'border-voice-listening' : 'border-(--il-color-canvas-navy-750)'}`}>
        {listening ? (
          <span className="px-4 py-3 text-16 leading-normal">{draft}</span>
        ) : (
          <textarea value={draft} onChange={e => p.onDraft(e.target.value)} onKeyDown={onKey} placeholder={placeholder} aria-label={t('liveshell.reply.aria')} rows={2}
            className="w-full resize-none border-0 bg-transparent px-4 py-3 text-16 leading-normal text-fg-primary outline-0 placeholder:text-fg-secondary focus-visible:outline-3 focus-visible:outline-accent-secondary" />
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="me-auto min-w-0 flex-1"><MicHint input={micHintFor(p)} /></span>
        {canRedo && <RecordAgainButton onPress={p.onRecordAgain!} />}
        <MicButton state={mic} mode={mode} onPress={pressMic} layout={p.layout} />
        <NoWrapButton variant="primary" size={tablet ? 'lg' : 'md'} disabled={cantSend} onClick={p.onSend}>{t('liveshell.reply.send')}</NoWrapButton>
      </div>
    </div>
  );
}
