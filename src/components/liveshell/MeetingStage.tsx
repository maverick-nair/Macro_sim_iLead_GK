import { useI18n } from '../../i18n';
import { LineAnnouncer } from '../live/LiveAnnouncer';
import { LiveCaption } from '../live/LiveCaption';
import { FOCUS, shortNameOf, type LiveCaptionLine, type LivePerson } from './types';

export interface MeetingAttendee extends LivePerson {
  /** The active speaker: ringed, glowing and tagged "Speaking". */
  speaking: boolean;
  /** Waiting to speak: the tile offers "Call on". */
  raisedHand: boolean;
}

export interface MeetingStageProps {
  /** Everyone in the room, in seating order. The design seats 10. */
  attendees: MeetingAttendee[];
  /** The current speaker's line, under the grid. Null hides it. */
  caption: LiveCaptionLine | null;
  /**
   * The current NPC line while captions are off (`caption` null). Nothing shows; screen readers hear
   * the line once it has finished. Ignored while a caption shows, since the caption announces it.
   */
  spokenLine?: LiveCaptionLine | null;
  /** Calls on someone by name (their raised hand). */
  onCallOn: (id: string) => void;
}

/**
 * Team meeting workspace: the attendee grid with the active speaker and raised hands, then the
 * caption of whoever is speaking. Renders two siblings of the stage column.
 */
export function MeetingStage({ attendees, caption, spokenLine, onCallOn }: MeetingStageProps) {
  const { t } = useI18n();
  return (
    <>
      <div role="list" aria-label={t('liveshell.meeting.aria')} className="grid flex-1 content-start grid-cols-5 gap-2.5 stage-narrow:grid-cols-3">
        {attendees.map(a => {
          const name = shortNameOf(a);
          return (
            <div key={a.id} role="listitem"
              className={`relative aspect-4/3 overflow-hidden rounded-18 border-3 border-solid bg-(image:--il-fill-portrait-calm) [transition:var(--il-liveshell-meeting-tile-transition)] ${a.speaking ? 'border-liveshell-speaking shadow-(--il-liveshell-meeting-tile-glow)' : 'border-transparent'}`}>
              {a.img && <img src={a.img} alt="" className="size-full object-cover object-(--il-liveshell-meeting-tile-position) mix-blend-multiply" />}
              <div className="absolute inset-0 bg-(image:--il-liveshell-meeting-tile-overlay)" />
              <span className="absolute bottom-2 left-2.5 text-13 font-700 text-liveshell-on-tile">{name}</span>
              {a.raisedHand && (
                <button type="button" onClick={() => onCallOn(a.id)} aria-label={t('liveshell.meeting.handAria', { name })}
                  className={`absolute top-2 right-2 h-7 cursor-pointer rounded-pill border-0 bg-liveshell-hand px-2.5 py-0 text-12 font-700 text-liveshell-on-signal ${FOCUS}`}>
                  {t('liveshell.meeting.hand')}
                </button>
              )}
              {a.speaking && <span className="absolute top-2 left-2 flex h-6 items-center rounded-pill bg-liveshell-speaking px-2.5 text-12 font-700 text-liveshell-on-signal">{t('liveshell.meeting.speaking')}</span>}
            </div>
          );
        })}
      </div>
      {caption && <LiveCaption variant="panel" name={caption.name} text={caption.text} streaming={caption.streaming} ai={caption.aiGenerated} />}
      {!caption && spokenLine !== undefined && <LineAnnouncer line={spokenLine} />}
    </>
  );
}
