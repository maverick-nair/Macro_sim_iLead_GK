import { useEffect, useRef, type ReactNode } from 'react';
import type { MoodKey } from '../../data/types';
import { useI18n } from '../../i18n';
import type { PeriodUnit, SubPeriodUnit } from '../action/days';
import { LineAnnouncer } from '../live/LiveAnnouncer';
import { TranscriptBubble } from '../live/TranscriptBubble';

/** `desktop` is the 1440 stage beside the brief, `phone` the 390 stage under the shell header. */
export type StageLayout = 'desktop' | 'phone';

/** A moment in sim time, in the storyline's units: period 2, sub period 3 reads "Week 2, Day 3". */
export interface SimTime {
  period: number;
  sub: number;
}

/** One turn of a live format, as the engine streams it. */
export interface StageTurn {
  id: string;
  speaker: 'you' | 'npc';
  /** What was said or written. Grows while `streaming`. Empty while the NPC is still composing. */
  text: string;
  /** The NPC is still composing or speaking this turn. */
  streaming?: boolean;
  /** Chat only: the turn was a voice note and `text` is its transcript. */
  voiceNote?: boolean;
  /** When it was sent, in sim time. Chat groups turns under a divider per sub period. */
  at?: SimTime;
}

/** The AI persona on the other side of a live format. */
export interface StageNpc {
  id: string;
  /** Full name for headings ("Kent Goldberg"). */
  name: string;
  /** First name for turns, captions and status lines ("Kent"). */
  firstName: string;
  img: string;
  mood: MoodKey;
}

export const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-secondary';
export const CARD = 'rounded-22 border border-line-default bg-surface-card backdrop-blur-12';
export const FIELD = 'rounded-12 border border-line-control bg-surface-raised text-fg-primary';

const MOOD_BORDER: Record<MoodKey, string> = {
  happy: 'border-member-mood-happy',
  neutral: 'border-member-mood-neutral',
  thinking: 'border-member-mood-thinking',
  concerned: 'border-member-mood-concerned',
  frustrated: 'border-member-mood-frustrated'
};
export const MOOD_DOT: Record<MoodKey, string> = {
  happy: 'bg-member-mood-happy',
  neutral: 'bg-member-mood-neutral',
  thinking: 'bg-member-mood-thinking',
  concerned: 'bg-member-mood-concerned',
  frustrated: 'bg-member-mood-frustrated'
};

/** "Week 2, Day 3" (or "Month 2, Week 1") from a sim time. */
export function useSimTime(periodUnit: PeriodUnit, subPeriodUnit: SubPeriodUnit): (at: SimTime) => string {
  const { t } = useI18n();
  return at => t('liveformats.when', { period: t('time.period', { unit: periodUnit, n: at.period }), sub: t('time.subPeriod', { unit: subPeriodUnit, n: at.sub }) });
}

export const sameTime = (a?: SimTime, b?: SimTime) => !!a && !!b && a.period === b.period && a.sub === b.sub;

const SIZE = { sm: 'size-10', md: 'size-18', lg: 'size-40' } as const;

/**
 * A round cut out portrait on the calm backdrop, as in the 1:1. With `mood` the ring takes the
 * mood colour; without it (interview candidates) the ring stays neutral, so nothing is read into a face.
 */
export function Portrait({ img, alt = '', size, mood }: { img: string; alt?: string; size: keyof typeof SIZE; mood?: MoodKey }) {
  const ring = mood ? MOOD_BORDER[mood] : 'border-line-strong';
  return (
    <span className={`block flex-none overflow-hidden rounded-round bg-portrait-calm ${size === 'lg' ? 'border-3' : 'border-2'} border-solid ${ring} ${SIZE[size]}`}>
      <img src={img} alt={alt} className="size-full object-cover object-top mix-blend-multiply" />
    </span>
  );
}

/** "Kent seems frustrated": the mood pill under the 1:1 portrait. */
export function MoodPill({ name, mood }: { name: string; mood: MoodKey }) {
  const { t } = useI18n();
  return (
    <span className="flex h-6.5 flex-none items-center gap-1.5 rounded-pill border border-line-default bg-surface-card px-3 text-12 font-700 whitespace-nowrap">
      <span aria-hidden="true" className={`size-2 rounded-round ${MOOD_DOT[mood]}`} />
      {t('liveformats.mood', { name, mood })}
    </span>
  );
}

/** Three dots and "Kent is typing", as the 1:1 thinking pill. A status, so it is announced once. */
export function TypingIndicator({ name, state }: { name: string; state: 'typing' | 'thinking' | 'reading' }) {
  const { t } = useI18n();
  const dot = 'size-1.5 rounded-round bg-fg-secondary animate-(--il-liveformats-typing-dot)';
  return (
    <div role="status" className="flex w-fit items-center gap-2 rounded-pill border border-line-default bg-surface-card px-4 py-2.5 text-13 text-fg-secondary">
      <span aria-hidden="true" className="flex gap-1">
        <span className={dot} />
        <span className={`${dot} [animation-delay:var(--il-liveformats-typing-delay-2)]`} />
        <span className={`${dot} [animation-delay:var(--il-liveformats-typing-delay-3)]`} />
      </span>
      {t('liveformats.typing', { state, name })}
    </div>
  );
}

export const MicGlyph = ({ className = 'size-3.5' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
  </svg>
);

/** The small round dictation mic of the email composer rows. Pressed and mint while listening. */
export function DictateButton({ on, label, onPress }: { on: boolean; label: string; onPress: () => void }) {
  return (
    <button type="button" onClick={onPress} aria-pressed={on} aria-label={label}
      className={`relative flex size-8 flex-none cursor-pointer items-center justify-center rounded-round border border-solid p-0 ${on ? 'border-transparent bg-voice-listening text-brand-deep-space' : 'border-line-default bg-surface-raised text-fg-secondary'} ${FOCUS}`}>
      {on && <span aria-hidden="true" className="absolute -inset-1 animate-(--il-live-mic-ring) rounded-round border-2 border-solid border-accent-secondary" />}
      <MicGlyph />
    </button>
  );
}

/**
 * Keeps a scrolling log pinned to its newest line as turns arrive or grow (streaming, late fonts),
 * unless the reader has scrolled up to read back.
 */
export function useStickToBottom<T extends HTMLElement>(dep: unknown) {
  const ref = useRef<T>(null);
  const pinned = useRef(true);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onScroll = () => { pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24; };
    const stick = () => { if (pinned.current) el.scrollTop = el.scrollHeight; };
    el.addEventListener('scroll', onScroll, { passive: true });
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(stick);
    for (const child of Array.from(el.children)) ro?.observe(child);
    ro?.observe(el);
    return () => { el.removeEventListener('scroll', onScroll); ro?.disconnect(); };
  }, []);
  useEffect(() => {
    const el = ref.current;
    if (el && pinned.current) el.scrollTop = el.scrollHeight;
  }, [dep]);
  return ref;
}

export interface TranscriptCardProps {
  turns: StageTurn[];
  npcName: string;
  /** Accessible name of the log ("Transcript"). */
  label: string;
  /** Header title; defaults to "Transcript" with "Saved to History", as in the 1:1. */
  header?: ReactNode;
  onReplay?: (id: string) => void;
  /** Shown under the log while the NPC composes (outside it, so the log only announces turns). */
  pending?: ReactNode;
  className?: string;
}

/** The newest turn when it is the NPC's, for the announcer: it speaks only once the turn has finished. */
export function lastNpcLine(turns: StageTurn[], name: string) {
  const last = turns.at(-1);
  return last?.speaker === 'npc' ? { name, text: last.text, streaming: last.streaming, aiGenerated: true } : null;
}

/**
 * The 1:1 transcript card: a header, then the turns in a log. Turns with no words yet are left out;
 * pass `pending` to show a typing or thinking line under the log. The log is not a live region, since
 * a streaming turn grows token by token; a visually hidden polite region announces each NPC turn
 * once it has finished.
 */
export function TranscriptCard({ turns, npcName, label, header, onReplay, pending, className = '' }: TranscriptCardProps) {
  const { t } = useI18n();
  const shown = turns.filter(x => x.text);
  const log = useStickToBottom<HTMLDivElement>(`${shown.length}:${shown.at(-1)?.text.length ?? 0}`);
  return (
    <section aria-label={label} className={`flex min-h-0 flex-col overflow-hidden ${CARD} ${className}`}>
      {header ?? (
        <div className="flex justify-between border-b border-line-default px-4 py-3 text-12 text-fg-secondary">
          <b>{t('liveformats.transcript.title')}</b>
          <span>{t('liveformats.transcript.saved')}</span>
        </div>
      )}
      <div ref={log} role="log" aria-label={label} aria-live="off" tabIndex={0} className={`min-h-0 flex-1 overflow-auto p-3.5 ${FOCUS} focus-visible:-outline-offset-2`}>
        <div className="flex flex-col gap-2.5">
          {shown.length === 0 && !pending && <p className="m-0 text-13 text-fg-secondary">{t('liveformats.transcript.empty')}</p>}
          {shown.map(x => (
            <TranscriptBubble key={x.id} speaker={x.speaker} text={x.text} name={npcName} streaming={x.streaming} onReplay={x.speaker === 'npc' && onReplay && !x.streaming ? () => onReplay(x.id) : undefined} />
          ))}
        </div>
      </div>
      {pending && <div className="px-3.5 pb-3.5">{pending}</div>}
      <LineAnnouncer line={lastNpcLine(turns, npcName)} />
    </section>
  );
}
