import { useEffect, useRef, type ReactNode } from 'react';
import { useI18n } from '../../i18n';
import { mark, rich } from '../stylesetting/rich';
import { LineAnnouncer } from '../live/LiveAnnouncer';
import { LiveCaption } from '../live/LiveCaption';
import { TranscriptBubble } from '../live/TranscriptBubble';
import { LivePacing, StanceCue } from './LiveRead';
import { FOCUS, shortNameOf, type LiveCaptionLine, type LiveConversation, type LiveMood, type LivePace, type LivePerson, type LiveStance, type LiveTurn } from './types';

export interface LiveTranscriptProps {
  turns: LiveTurn[];
  /**
   * Replays an NPC turn with captions. When set, every NPC turn offers Replay (spec); leave it out
   * and no turn shows the control.
   */
  onReplay?: (turnId: string) => void;
  /**
   * True while captions announce the NPC line. The transcript then stays quiet, so screen readers do
   * not hear every line twice; without captions it announces each finished NPC turn once.
   */
  captionsAnnounce?: boolean;
  /** Fills the height it is given (the tablet's 1:1, D73) instead of the desktop's maximum. */
  fill?: boolean;
  /**
   * `line`: the canvas's conversation (D232): no card, the person's lines set large in the serif,
   * yours right aligned, and `tail` (thinking, slow) as the next line.
   */
  look?: 'card' | 'line';
  tail?: ReactNode;
}

/**
 * The running transcript: NPC turns left with the AI persona label and Replay, yours right. Scrolls
 * and follows the newest turn. Shared by the 1:1 and, later, chat (D14).
 *
 * The log itself is not a live region: a streaming turn grows token by token, and a live log would
 * announce every token. A visually hidden polite region announces the newest NPC turn once it has
 * finished (not one you interrupted), and only while captions are not already announcing it.
 */
export function LiveTranscript({ turns, onReplay, captionsAnnounce = false, fill = false, look = 'card', tail }: LiveTranscriptProps) {
  const { t } = useI18n();
  const list = useRef<HTMLDivElement>(null);
  const last = turns[turns.length - 1];
  const said = !captionsAnnounce && last && last.speaker !== 'you' && !last.interrupted
    ? { name: shortNameOf(last.speaker), text: last.text, streaming: last.streaming, aiGenerated: last.aiGenerated }
    : null;
  const follow = `${turns.length}:${last?.text.length ?? 0}:${tail ? 1 : 0}`;
  useEffect(() => {
    const el = list.current;
    if (el && el.scrollHeight > el.clientHeight) el.scrollTop = el.scrollHeight;
  }, [follow]);
  if (look === 'line') {
    return (
      <div role="region" aria-label={t('liveshell.transcript.title')} className="flex min-h-0 flex-1 flex-col">
        <span className="sr-only">{t('liveshell.transcript.saved')}</span>
        <div ref={list} role="log" aria-live="off" tabIndex={0}
          className="-mx-2 flex flex-1 flex-col gap-5 overflow-auto px-2 py-1 focus-visible:outline-3 focus-visible:-outline-offset-2 focus-visible:outline-accent-secondary">
          {turns.map(turn => {
            const npc = turn.speaker !== 'you';
            return (
              <TranscriptBubble key={turn.id} look="line" speaker={npc ? 'npc' : 'you'} text={turn.text}
                name={turn.speaker === 'you' ? undefined : shortNameOf(turn.speaker)}
                streaming={turn.streaming} interrupted={turn.interrupted} ai={turn.aiGenerated}
                onReplay={npc && onReplay ? () => onReplay(turn.id) : undefined} />
            );
          })}
          {tail}
        </div>
        <LineAnnouncer line={said} />
      </div>
    );
  }
  return (
    <div role="region" aria-label={t('liveshell.transcript.title')} className={`flex ${fill ? 'flex-1' : 'max-h-(--il-liveshell-roleplay-transcript-max-height)'} min-h-0 flex-col overflow-hidden rounded-4 border border-line-default bg-surface-card `}>
      <div className="flex justify-between border-b border-line-default px-4 py-3 text-12 text-fg-secondary">
        <b>{t('liveshell.transcript.title')}</b>
        <span>{t('liveshell.transcript.saved')}</span>
      </div>
      <div ref={list} role="log" aria-live="off" tabIndex={0}
        className="flex flex-1 flex-col gap-2.5 overflow-auto p-3.5 focus-visible:outline-3 focus-visible:-outline-offset-2 focus-visible:outline-accent-secondary">
        {turns.map(turn => {
          const npc = turn.speaker !== 'you';
          return (
            <TranscriptBubble key={turn.id} speaker={npc ? 'npc' : 'you'} text={turn.text}
              name={turn.speaker === 'you' ? undefined : shortNameOf(turn.speaker)}
              streaming={turn.streaming} interrupted={turn.interrupted} ai={turn.aiGenerated}
              onReplay={npc && onReplay ? () => onReplay(turn.id) : undefined} />
          );
        })}
      </div>
      <LineAnnouncer line={said} />
    </div>
  );
}

export interface RolePlayStageProps {
  person: LivePerson;
  mood: LiveMood;
  conversation: LiveConversation;
  /** The NPC line under the portrait. Null hides it (captions off, or while the NPC is thinking). */
  caption: LiveCaptionLine | null;
  /** The AI reply is taking longer than usual: shows the notice and Retry instead of the thinking dots. */
  slow?: boolean;
  onRetry?: () => void;
  turns: LiveTurn[];
  onReplay?: (turnId: string) => void;
  /**
   * `tablet`: the portrait tablet's 1:1 (D73): the 200px portrait with the mood chip and `aside`
   * (the brief's goal) beside it, then the caption, then the conversation log filling the rest.
   */
  layout?: 'desk' | 'tablet' | 'split';
  aside?: ReactNode;
  /** The engine's live read of the person after their last line (D233). Leave it out for the mood pill alone. */
  stance?: LiveStance | null;
  /** Where the conversation is (D233): the track and "About 3 more exchanges". Leave it out to hide them. */
  pace?: LivePace;
  /** `split`: your goal, kept in view over the conversation while you type (D233). */
  goal?: string;
}

export interface RolePlayPortraitProps {
  person: LivePerson;
  mood: LiveMood;
  conversation: LiveConversation;
  /** The brief over the photo (LiveBriefCard `overlay`). */
  brief?: ReactNode;
  /** The engine's live read of the person (D233): replaces "Seems frustrated" once there is one. */
  stance?: LiveStance | null;
}

/**
 * The left column of the canvas's 1:1 (D232): the brief on top, then the person's photo in a
 * bounded 4:5 card (the art is 240px wide, so it stops at 480px rather than blur across the half
 * screen), their name in the display serif and how they seem under it. A mint mark beside the
 * name while they speak.
 */
export function RolePlayPortrait({ person, mood, conversation, brief, stance }: RolePlayPortraitProps) {
  const { t } = useI18n();
  return (
    <div className="absolute inset-0 overflow-y-auto bg-(image:--il-fill-portrait-calm) text-(--il-color-canvas-ink)">
      <div className="flex min-h-full flex-col items-center justify-center gap-4 p-4 short:gap-3 short:p-3">
        {brief && <div data-tour="live-brief" className="w-full max-w-120 short:max-w-100 shorter:max-w-80">{brief}</div>}
        <div className="relative aspect-4/5 w-full max-w-120 overflow-hidden rounded-4 bg-(image:--il-fill-portrait-calm) shadow-(--il-event-card-shadow) short:max-w-100 shorter:max-w-80">
          {person.img && <img src={person.img} alt={person.name} className="absolute inset-0 size-full object-cover object-top mix-blend-multiply" />}
        </div>
        <div className="flex w-full max-w-120 flex-col items-center gap-1 text-center short:max-w-100 shorter:max-w-80">
          <span className="flex items-center gap-2.5 font-display text-26 leading-tight">
            {person.name}
            {conversation === 'npcSpeaking' && <span aria-hidden="true" className="size-2.5 animate-(--il-liveshell-roleplay-speaking-ring) bg-(--il-color-canvas-mint)" />}
          </span>
          {stance
            ? <StanceCue name={shortNameOf(person)} stance={stance} />
            : <span className="text-13 text-(--il-color-canvas-ink)/70">{t('liveshell.roleplay.seems', { mood: t('liveshell.roleplay.moodWord', { mood }) })}</span>}
        </div>
      </div>
    </div>
  );
}

const MOOD = {
  frustrated: { halo: 'bg-(image:--il-liveshell-roleplay-halo-frustrated)', ring: 'border-liveshell-mood-frustrated', dot: 'bg-liveshell-mood-frustrated' },
  guarded: { halo: 'bg-(image:--il-liveshell-roleplay-halo-guarded)', ring: 'border-liveshell-mood-guarded', dot: 'bg-liveshell-mood-guarded' },
  open: { halo: 'bg-(image:--il-liveshell-roleplay-halo-open)', ring: 'border-liveshell-mood-open', dot: 'bg-liveshell-mood-open' }
} as const;

const DOTS = ['animate-(--il-liveshell-roleplay-dot-1)', 'animate-(--il-liveshell-roleplay-dot-2)', 'animate-(--il-liveshell-roleplay-dot-3)'];

/**
 * 1:1 RolePlay workspace: the portrait in its mood ring (pulsing while the NPC speaks), the mood
 * pill, captions or the thinking state, and the transcript beside it.
 */
export function RolePlayStage({ person, mood, conversation, caption, slow = false, onRetry, turns, onReplay, layout = 'desk', aside, stance, pace, goal }: RolePlayStageProps) {
  const { t } = useI18n();
  const m = MOOD[mood];
  const name = shortNameOf(person);
  const nameNode = <span>{name}</span>;
  if (layout === 'split') {
    // The conversation column beside RolePlayPortrait: the transcript is the caption here, so it
    // announces each finished line itself.
    const tail = slow ? (
      <div role="alert" className="flex flex-wrap items-center gap-2.5 text-14">
        <span className="text-fg-body">{t('liveshell.roleplay.slow', { name })}</span>
        {onRetry && <button type="button" onClick={onRetry} className={`min-h-11 cursor-pointer rounded-4 border border-solid border-line-strong bg-transparent px-3.5 py-0 font-500 text-fg-primary ${FOCUS}`}>{t('liveshell.roleplay.retry')}</button>}
      </div>
    ) : conversation === 'npcThinking' ? (
      <div role="status" className="flex items-center gap-2.5 font-serif text-21 text-fg-secondary">
        {rich(t('liveshell.roleplay.thinking', { name: mark(0) }), [nameNode])}
        <span aria-hidden="true" className="flex gap-1">{DOTS.map(d => <span key={d} className={`size-1.5 bg-fg-secondary ${d}`} />)}</span>
      </div>
    ) : null;
    return (
      <>
        {pace && <LivePacing pace={pace} goal={goal} />}
        <LiveTranscript turns={turns} onReplay={onReplay} look="line" tail={tail} />
      </>
    );
  }
  if (layout === 'tablet') {
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-4">
        <div className="flex items-center gap-6 pt-2">
          <div className="relative size-50 flex-none">
            <div aria-hidden="true" className={`absolute -inset-3.5 rounded-round opacity-75 [filter:var(--il-liveshell-roleplay-halo-filter)] [transition:var(--il-liveshell-roleplay-halo-transition)] ${m.halo}`} />
            {conversation === 'npcSpeaking' && <div aria-hidden="true" className={`absolute -inset-2 animate-(--il-liveshell-roleplay-speaking-ring) rounded-round border-2 border-solid ${m.ring}`} />}
            <div className={`relative size-full overflow-hidden rounded-round border-3 border-solid bg-(image:--il-fill-portrait-calm) ${m.ring}`}>
              {person.img && <img src={person.img} alt={person.name} className="size-full object-cover object-top mix-blend-multiply" />}
            </div>
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-2.5">
            {stance ? <span className="flex self-start"><StanceCue name={name} stance={stance} tone="card" /></span> : (
              <span className="flex min-h-7 items-center gap-1.5 self-start rounded-4 border border-line-default bg-surface-card px-3 text-13 font-600">
                <span className={`size-2 rounded-round ${m.dot}`} />
                {rich(t('liveshell.roleplay.mood', { name: mark(0), mood: mark(1) }), [nameNode, <span>{t('liveshell.roleplay.moodWord', { mood })}</span>])}
              </span>
            )}
            {aside}
          </div>
        </div>
        {pace && <LivePacing pace={pace} />}
        {caption && <LiveCaption name={caption.name} text={caption.text} streaming={caption.streaming} ai={caption.aiGenerated} />}
        {conversation === 'npcThinking' && !slow && (
          <div role="status" className="flex items-center gap-2 self-center rounded-4 border border-line-default bg-surface-card px-4 py-2.5 text-13 text-fg-secondary">
            {rich(t('liveshell.roleplay.thinking', { name: mark(0) }), [nameNode])}
          </div>
        )}
        {slow && (
          <div role="alert" className="flex items-center gap-2.5 self-center text-13">
            <span className="text-fg-secondary">{t('liveshell.roleplay.slow', { name })}</span>
            {onRetry && <button type="button" onClick={onRetry} className={`min-h-7.5 cursor-pointer rounded-4 border border-solid border-line-control bg-transparent px-3 py-0 font-600 text-fg-primary ${FOCUS}`}>{t('liveshell.roleplay.retry')}</button>}
          </div>
        )}
        <LiveTranscript turns={turns} onReplay={onReplay} captionsAnnounce={!!caption} fill />
      </div>
    );
  }
  return (
    <div className="grid min-h-0 flex-1 grid-cols-(--il-liveshell-roleplay-columns) gap-5 stage-narrow:grid-cols-1 stage-narrow:overflow-y-auto">
      <div className="flex flex-col items-center justify-center gap-4 p-3">
        <div className="relative size-57.5 stage-narrow:size-37.5">
          <div aria-hidden="true" className={`absolute -inset-3.5 rounded-round opacity-75 [filter:var(--il-liveshell-roleplay-halo-filter)] [transition:var(--il-liveshell-roleplay-halo-transition)] ${m.halo}`} />
          {conversation === 'npcSpeaking' && <div aria-hidden="true" className={`absolute -inset-2 animate-(--il-liveshell-roleplay-speaking-ring) rounded-round border-2 border-solid ${m.ring}`} />}
          <div className={`relative size-full overflow-hidden rounded-round border-3 border-solid bg-(image:--il-fill-portrait-calm) [transition:var(--il-liveshell-roleplay-portrait-transition)] ${m.ring}`}>
            {person.img && <img src={person.img} alt={person.name} className="size-full object-cover object-top mix-blend-multiply" />}
          </div>
        </div>
        {stance ? <StanceCue name={name} stance={stance} tone="card" /> : (
          <span className="flex h-6.5 items-center gap-1.5 rounded-4 border border-line-default bg-surface-card px-3 text-12 font-600">
            <span className={`size-2 rounded-round ${m.dot}`} />
            {rich(t('liveshell.roleplay.mood', { name: mark(0), mood: mark(1) }), [nameNode, <span>{t('liveshell.roleplay.moodWord', { mood })}</span>])}
          </span>
        )}
        {caption && <LiveCaption name={caption.name} text={caption.text} streaming={caption.streaming} ai={caption.aiGenerated} size="lg" />}
        {conversation === 'npcThinking' && !slow && (
          <div role="status" className="flex items-center gap-2 rounded-4 border border-line-default bg-surface-card px-4 py-2.5 text-13 text-fg-secondary">
            <span className="flex gap-1">
              {DOTS.map(d => <span key={d} className={`size-1.5 rounded-round bg-fg-secondary ${d}`} />)}
            </span>
            {rich(t('liveshell.roleplay.thinking', { name: mark(0) }), [nameNode])}
          </div>
        )}
        {slow && (
          <div role="alert" className="flex items-center gap-2.5 text-13">
            <span className="text-fg-secondary">{t('liveshell.roleplay.slow', { name })}</span>
            {onRetry && (
              <button type="button" onClick={onRetry} className={`h-7.5 cursor-pointer rounded-4 border border-solid border-line-control bg-transparent px-3 py-0 font-600 text-fg-primary ${FOCUS}`}>
                {t('liveshell.roleplay.retry')}
              </button>
            )}
          </div>
        )}
      </div>
      {pace ? (
        <div className="flex min-h-0 flex-col gap-3.5">
          <LivePacing pace={pace} />
          <LiveTranscript turns={turns} onReplay={onReplay} captionsAnnounce={!!caption} />
        </div>
      ) : <LiveTranscript turns={turns} onReplay={onReplay} captionsAnnounce={!!caption} />}
    </div>
  );
}
