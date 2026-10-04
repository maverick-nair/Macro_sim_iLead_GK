import { useI18n } from '../../i18n';

export interface TranscriptBubbleProps {
  /** `npc` is an AI persona turn, `you` is the participant. */
  speaker: 'npc' | 'you';
  /** What was said. NPC lines come from the engine or the AI model, already sanitised. */
  text: string;
  /** First name of the NPC. Ignored for your own turns, which read "You". */
  name?: string;
  /** True while the NPC line is still streaming in word by word. */
  streaming?: boolean;
  /** The participant cut the NPC off: the line stops where it was and says so. */
  interrupted?: boolean;
  /** NPC lines written by the AI model carry the visible "AI persona" label (D27). Scripted lines can turn it off. */
  ai?: boolean;
  /** Replays the NPC line with captions. Only NPC turns offer it. */
  onReplay?: () => void;
}

const Sparkle = () => (
  <svg className="size-2.75" viewBox="0 0 24 24" fill="none" stroke="var(--il-color-accent-secondary)" strokeWidth="2.25" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" />
  </svg>
);

/**
 * One turn in a live conversation transcript. NPC turns sit on the left with the speaker's name,
 * the visible "AI persona" label and a replay control; your turns sit on the right on the brand fill.
 */
export function TranscriptBubble({ speaker, text, name = '', streaming = false, interrupted = false, ai = true, onReplay }: TranscriptBubbleProps) {
  const { t } = useI18n();
  const npc = speaker === 'npc';
  return (
    <div aria-busy={streaming || undefined} className={`flex max-w-(--il-live-bubble-max-width) flex-col gap-1 ${npc ? 'self-start' : 'self-end'}`}>
      <div className={`px-3.5 py-2.5 text-14 text-pretty ${npc ? 'rounded-18 rounded-bl-6 bg-surface-raised text-fg-primary' : 'rounded-18 rounded-br-6 bg-(image:--il-fill-brand) text-brand-deep-space'}`}>{text}</div>
      <span className={`flex items-center gap-1.5 text-12 text-fg-secondary ${npc ? 'justify-start' : 'justify-end'}`}>
        <span>{npc ? name : t('live.turn.you')}</span>
        {npc && (
          <>
            {ai && <span className="flex items-center gap-0.75"><Sparkle />{t('live.turn.ai')}</span>}
            {interrupted && <span className="italic">{t('live.turn.interrupted')}</span>}
            {onReplay && (
              <button
                type="button"
                onClick={onReplay}
                aria-label={t('live.turn.replayAria')}
                className="cursor-pointer rounded-4 border-0 bg-transparent p-0 text-12 font-700 text-accent-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-secondary"
              >
                {t('live.turn.replay')}
              </button>
            )}
          </>
        )}
      </span>
    </div>
  );
}
