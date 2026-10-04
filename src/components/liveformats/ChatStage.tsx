import { Fragment, useId, type KeyboardEvent, type ReactNode } from 'react';
import { useI18n } from '../../i18n';
import type { PeriodUnit, SubPeriodUnit } from '../action/days';
import { TranscriptBubble } from '../live/TranscriptBubble';
import { Waveform } from '../live/Waveform';
import { CARD, DictateButton, FOCUS, MoodPill, Portrait, sameTime, TypingIndicator, useSimTime, useStickToBottom, type StageLayout, type StageNpc, type StageTurn } from './shared';

/** Who ended the thread: you closed it, or the NPC signed off. */
export type ChatEnded = 'you' | 'npc';

/**
 * The participant's message being written. The text is editable before it is sent, including a
 * voice note's transcript. Omit it when the shell's own input bar takes the reply.
 */
export interface ChatComposer {
  draft: string;
  onDraft: (text: string) => void;
  onSend: () => void;
  /** Recording a voice note: the transcript fills `draft` as you speak. */
  recording?: boolean;
  /** Mic levels while recording, from the speech provider. */
  levels?: number[];
  /** Starts or stops a voice note. Omitted: text only. */
  onRecord?: () => void;
  /** No sending while the NPC is composing or a send is in flight. */
  busy?: boolean;
}

export interface ChatStageProps {
  npc: StageNpc;
  /** The thread, oldest first. The NPC may open it. A streaming NPC turn shows the typing line. */
  turns: StageTurn[];
  /** Null while the thread is open. */
  ended: ChatEnded | null;
  /** The storyline's units for the sim time dividers ("Week 2, Day 3"). */
  periodUnit: PeriodUnit;
  subPeriodUnit: SubPeriodUnit;
  composer?: ChatComposer;
  /** Closes the thread from your side. Hidden once it has ended. */
  onClose?: () => void;
  /** Plays a voice note turn. The id of the one playing is `playingId`. */
  onPlay?: (turnId: string) => void;
  playingId?: string | null;
  layout?: StageLayout;
}

const SendGlyph = () => (
  <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m5 12 14 0" />
    <path d="m13 6 6 6-6 6" />
  </svg>
);

/** A quiet centred line across the thread: sim time dividers and the signed off line. */
function Divider({ children }: { children: ReactNode }) {
  return (
    <div className="flex animate-(--il-liveformats-enter) items-center gap-3 py-1 text-12 text-fg-secondary">
      <span aria-hidden="true" className="h-px flex-1 bg-line-default" />
      <span>{children}</span>
      <span aria-hidden="true" className="h-px flex-1 bg-line-default" />
    </div>
  );
}

function Composer({ c, npcName, mobile }: { c: ChatComposer; npcName: string; mobile: boolean }) {
  const { t } = useI18n();
  const id = useId();
  const hint = useId();
  const canSend = !c.busy && !c.recording && c.draft.trim().length > 0;
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (canSend) c.onSend();
    }
  };
  return (
    <div className="flex flex-col gap-2">
      <div className={`flex items-end gap-2.5 rounded-20 border bg-surface-material p-2 ${c.recording ? 'border-voice-listening shadow-(--il-liveformats-composer-listening)' : 'border-line-strong'}`}>
        <div className="flex min-w-0 flex-1 flex-col">
          <label htmlFor={id} className="sr-only">{t('liveformats.chat.draft.label', { name: npcName })}</label>
          {c.recording && (
            <span role="status" className="flex items-center gap-2.5 px-2 pt-1 text-12 font-700 text-status-gain">
              <Waveform levels={(c.levels ?? []).slice(0, 12).map(w => Math.max(4, w / 2))} size="sm" />
              <span className={mobile ? 'sr-only' : ''}>{t('liveformats.chat.recording')}</span>
            </span>
          )}
          <textarea id={id} value={c.draft} onChange={e => c.onDraft(e.target.value)} onKeyDown={onKey} rows={mobile ? 2 : 1}
            aria-describedby={hint} placeholder={t('liveformats.chat.draft.placeholder')}
            className="w-full resize-none rounded-12 border-0 bg-transparent p-2 text-15 text-fg-primary outline-0 focus-visible:outline-2 focus-visible:outline-accent-secondary" />
        </div>
        {c.onRecord && <DictateButton on={!!c.recording} label={t('liveformats.chat.record', { state: c.recording ? 'on' : 'off' })} onPress={c.onRecord} />}
        <button type="button" onClick={c.onSend} disabled={!canSend} aria-label={t('liveformats.chat.send')}
          className={`flex size-10 flex-none cursor-pointer items-center justify-center rounded-round border-0 p-0 text-brand-deep-space disabled:cursor-not-allowed ${canSend ? 'bg-(image:--il-fill-brand)' : 'bg-track'} ${FOCUS}`}>
          <SendGlyph />
        </button>
      </div>
      <span id={hint} className="px-2 text-12 text-fg-secondary">{t('liveformats.chat.draft.hint')}</span>
    </div>
  );
}

/**
 * A Teams or Slack like chat with one NPC: a thread header with the persona, the messages in a
 * polite log grouped under sim time dividers, a typing line while the NPC composes, voice notes as
 * transcripts with a play control, and the thread's own composer. It ends when you close it or the
 * NPC signs off, with a quiet line in the thread. Fills its parent.
 */
export function ChatStage({ npc, turns, ended, periodUnit, subPeriodUnit, composer, onClose, onPlay, playingId = null, layout = 'desktop' }: ChatStageProps) {
  const { t } = useI18n();
  const when = useSimTime(periodUnit, subPeriodUnit);
  const mobile = layout === 'phone';
  const shown = turns.filter(x => x.text);
  const composing = !ended && turns.some(x => x.speaker === 'npc' && x.streaming && !x.text);
  const log = useStickToBottom<HTMLDivElement>(`${shown.length}:${shown.at(-1)?.text.length ?? 0}:${ended}:${composing}`);
  const column = 'mx-auto w-full max-w-(--il-liveformats-thread-max-width)';
  const pad = mobile ? 'px-3' : 'px-4.5';
  return (
    <section aria-label={t('liveformats.chat.aria', { name: npc.name })} className={`flex size-full min-h-0 flex-col overflow-hidden ${CARD}`}>
      <header className={`flex items-center border-b border-line-default ${mobile ? 'gap-2.5 px-3 py-2.5' : 'gap-3 px-4.5 py-3'}`}>
        <Portrait img={npc.img} size="sm" mood={npc.mood} />
        <div className="flex min-w-0 flex-1 flex-col">
          <h2 className="m-0 truncate text-15 font-700">{npc.name}</h2>
          {mobile ? <span className="text-12 text-fg-secondary">{t('liveformats.mood', { name: npc.firstName, mood: npc.mood })}</span> : null}
        </div>
        {!mobile && <MoodPill name={npc.firstName} mood={npc.mood} />}
        {onClose && !ended && (
          <button type="button" onClick={onClose}
            className={`h-8.5 flex-none cursor-pointer rounded-pill border border-solid border-line-default bg-transparent px-3.5 py-0 text-13 font-700 text-fg-primary ${FOCUS}`}>
            {t('liveformats.chat.close')}
          </button>
        )}
      </header>

      <div ref={log} role="log" aria-label={t('liveformats.chat.log', { name: npc.firstName })} tabIndex={0}
        className={`min-h-0 flex-1 overflow-auto ${pad} ${mobile ? 'py-3' : 'py-4'} ${FOCUS} focus-visible:-outline-offset-2`}>
        <div className={`flex flex-col gap-2.5 ${column}`}>
          {shown.map((x, i) => (
            <Fragment key={x.id}>
              {x.at && !sameTime(x.at, shown[i - 1]?.at) && <Divider>{when(x.at)}</Divider>}
              <TranscriptBubble speaker={x.speaker} text={x.text} name={npc.firstName} streaming={x.streaming}
                voiceNote={x.voiceNote ? { playing: playingId === x.id, onPlay: onPlay && !x.streaming ? () => onPlay(x.id) : undefined } : undefined} />
            </Fragment>
          ))}
          {ended && (
            <Divider>{t('liveformats.chat.ended', { by: ended, name: npc.firstName })}</Divider>
          )}
        </div>
      </div>

      {composing && <div className={`${pad} pb-3`}><div className={column}><TypingIndicator name={npc.firstName} state="typing" /></div></div>}
      {composer && !ended && <div className={`border-t border-line-default ${pad} py-3`}><div className={column}><Composer c={composer} npcName={npc.firstName} mobile={mobile} /></div></div>}
    </section>
  );
}
