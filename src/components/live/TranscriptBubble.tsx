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
  /**
   * The turn was a voice note (chat): `text` is its transcript, and a small play control sits on top.
   * Omitted for spoken turns in the 1:1, meeting and sponsor screens.
   */
  voiceNote?: { playing?: boolean; onPlay?: () => void };
}

const Sparkle = () => (
  <svg className="size-2.75" viewBox="0 0 24 24" fill="none" stroke="var(--il-color-accent-secondary)" strokeWidth="2.25" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" />
  </svg>
);

const PlayGlyph = ({ playing }: { playing: boolean }) => (
  <svg className="size-3" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    {playing ? <><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></> : <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z" />}
  </svg>
);

/** The voice note header inside a bubble: play or pause, and the "Voice note" label. */
function VoiceNoteBar({ npc, playing = false, onPlay }: { npc: boolean; playing?: boolean; onPlay?: () => void }) {
  const { t } = useI18n();
  const tone = npc ? 'bg-(image:--il-fill-brand) text-brand-deep-space' : 'bg-brand-deep-space text-brand-pale-lavender';
  return (
    <span className="mb-1.5 flex items-center gap-2 text-12 font-700">
      {onPlay && (
        <button type="button" onClick={onPlay} aria-pressed={playing} aria-label={t('live.turn.play', { playing: String(playing) })}
          className={`flex size-7 flex-none cursor-pointer items-center justify-center rounded-round border-0 p-0 ${tone} focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-secondary`}>
          <PlayGlyph playing={playing} />
        </button>
      )}
      <span>{t('live.turn.voiceNote')}</span>
    </span>
  );
}

/**
 * One turn in a live conversation transcript. NPC turns sit on the left with the speaker's name,
 * the visible "AI persona" label and a replay control; your turns sit on the right on the brand fill.
 */
export function TranscriptBubble({ speaker, text, name = '', streaming = false, interrupted = false, ai = true, onReplay, voiceNote }: TranscriptBubbleProps) {
  const { t } = useI18n();
  const npc = speaker === 'npc';
  return (
    <div aria-busy={streaming || undefined} className={`flex max-w-(--il-live-bubble-max-width) flex-col gap-1 ${npc ? 'self-start' : 'self-end'}`}>
      <div className={`px-3.5 py-2.5 text-14 text-pretty ${npc ? 'rounded-18 rounded-bl-6 bg-surface-raised text-fg-primary' : 'rounded-18 rounded-br-6 bg-(image:--il-fill-brand) text-brand-deep-space'}`}>{voiceNote && <VoiceNoteBar npc={npc} {...voiceNote} />}{text}</div>
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
                className="cursor-pointer rounded-4 border-0 bg-transparent p-0 text-12 font-700 text-live-replay focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-secondary"
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
