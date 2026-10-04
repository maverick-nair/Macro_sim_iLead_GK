import { useId } from 'react';
import { useI18n } from '../../i18n';
import { LiveCaption } from '../live/LiveCaption';
import { CARD, FIELD, FOCUS, Portrait, TranscriptCard, TypingIndicator, type StageLayout, type StageTurn } from './shared';

/**
 * What the CV says, and nothing more. The stage never shows age, and the portrait carries no mood
 * or other read of the face, so the decision rests on these fields and the conversation.
 */
export interface CandidateCv {
  /** Previous company, as on the CV. Null when not given. */
  previous: string | null;
  /** Experience as the CV words it ("6 years in B2B sales"). */
  experience: string | null;
  skills: string[];
  /** Remarks from the recruiter or the CV. */
  remarks: string | null;
}

export interface Candidate {
  id: string;
  name: string;
  /** For turns and captions. */
  firstName: string;
  /** The role they apply for, or their current title. */
  title: string;
  img: string;
  cv: CandidateCv;
}

export type CvField = 'previous' | 'experience' | 'skills' | 'remarks';
export const CV_FIELDS: CvField[] = ['previous', 'experience', 'skills', 'remarks'];

/** One CV value: skills as chips, the rest as text, "Not given" when empty. */
export function CvValue({ cv, field }: { cv: CandidateCv; field: CvField }) {
  const { t } = useI18n();
  if (field === 'skills') {
    if (cv.skills.length === 0) return <span className="text-fg-secondary">{t('liveformats.cv.empty')}</span>;
    return (
      <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
        {cv.skills.map(s => <li key={s} className="rounded-pill border border-line-default bg-surface-raised px-2.5 py-0.5 text-12 font-600">{s}</li>)}
      </ul>
    );
  }
  const v = cv[field];
  return v ? <span className="text-pretty">{v}</span> : <span className="text-fg-secondary">{t('liveformats.cv.empty')}</span>;
}

/** The CV card: previous company, experience, skills and remarks as a definition list. */
export function CvCard({ cv, className = '' }: { cv: CandidateCv; className?: string }) {
  const { t } = useI18n();
  const id = useId();
  return (
    <section aria-labelledby={id} className={`flex flex-col gap-3 p-4.5 ${CARD} ${className}`}>
      <h3 id={id} className="m-0 text-12 font-700 tracking-(--il-liveformats-eyebrow-tracking) text-fg-secondary uppercase">{t('liveformats.cv.title')}</h3>
      <dl className="m-0 flex flex-col gap-2.5">
        {CV_FIELDS.map(f => (
          <div key={f} className="grid grid-cols-(--il-liveformats-fact-columns) gap-2.5 text-13">
            <dt className="text-fg-secondary">{t('liveformats.cv.field', { field: f })}</dt>
            <dd className="m-0"><CvValue cv={cv} field={f} /></dd>
          </div>
        ))}
      </dl>
      <span className="text-12 text-fg-secondary">{t('liveformats.cv.fair')}</span>
    </section>
  );
}

export interface InterviewStageProps {
  candidate: Candidate;
  /** "Candidate 1 of 2". Omitted: no counter. */
  position?: { n: number; total: number };
  /** The interview so far. A streaming NPC turn shows captions, or a thinking line before its first word. */
  turns: StageTurn[];
  /** Your question notes. They travel to the comparison. */
  notes: string;
  onNotes: (notes: string) => void;
  onReplay?: (turnId: string) => void;
  /** The participant's captions setting. */
  captions?: boolean;
  layout?: StageLayout;
}

/**
 * A hiring interview: the candidate's portrait and CV card on the left, the transcript and your
 * question notes on the right. On a phone everything stacks and the stage scrolls. Fills its parent.
 */
export function InterviewStage({ candidate, position, turns, notes, onNotes, onReplay, captions = true, layout = 'desktop' }: InterviewStageProps) {
  const { t } = useI18n();
  const notesId = useId();
  const hintId = useId();
  const nameId = useId();
  const mobile = layout === 'phone';
  const live = turns.at(-1);
  const speaking = live?.speaker === 'npc' && live.streaming ? live : null;

  const who = (
    <div className={`flex ${mobile ? 'items-center gap-3.5' : 'flex-col items-center gap-3 text-center'}`}>
      <Portrait img={candidate.img} size={mobile ? 'md' : 'lg'} />
      <div className={`flex min-w-0 flex-col gap-0.5 ${mobile ? '' : 'items-center'}`}>
        {position && <span className="text-12 font-700 text-fg-secondary">{t('liveformats.interview.position', position)}</span>}
        <h2 id={nameId} className={`m-0 font-700 ${mobile ? 'text-17' : 'text-20'}`}>{candidate.name}</h2>
        <span className="text-13 text-fg-secondary">{candidate.title}</span>
      </div>
    </div>
  );

  const caption = captions && speaking?.text ? <LiveCaption name={candidate.firstName} text={speaking.text} streaming size="md" /> : null;

  const notesCard = (
    <div className={`flex flex-col gap-2 p-4 ${CARD}`}>
      <label htmlFor={notesId} className="text-14 font-700">{t('liveformats.interview.notes.label')}</label>
      <span id={hintId} className="text-12 text-fg-secondary">{t('liveformats.interview.notes.hint')}</span>
      <textarea id={notesId} value={notes} onChange={e => onNotes(e.target.value)} rows={mobile ? 4 : 5} aria-describedby={hintId}
        placeholder={t('liveformats.interview.notes.placeholder')}
        className={`w-full resize-y px-3 py-2.5 text-14 leading-normal ${FIELD} ${FOCUS}`} />
    </div>
  );

  const transcript = (
    <TranscriptCard turns={turns} npcName={candidate.firstName} label={t('liveformats.transcript.title')} onReplay={onReplay}
      pending={speaking && !speaking.text ? <TypingIndicator name={candidate.firstName} state="thinking" /> : null}
      className={mobile ? 'h-90 flex-none' : 'flex-1'} />
  );

  return (
    <section aria-label={t('liveformats.interview.aria', { name: candidate.name })}
      className={mobile ? 'flex size-full min-h-0 flex-col gap-2.5 overflow-auto *:flex-none' : 'grid size-full min-h-0 grid-cols-(--il-liveformats-interview-columns) gap-5'}>
      {mobile ? (
        <>
          {who}
          {caption}
          <CvCard cv={candidate.cv} />
          {transcript}
          {notesCard}
        </>
      ) : (
        <>
          <div role="region" aria-labelledby={nameId} tabIndex={0} className={`flex min-h-0 flex-col gap-4 overflow-auto rounded-22 p-1 ${FOCUS}`}>
            {who}
            {caption}
            <CvCard cv={candidate.cv} />
          </div>
          <div className="flex min-h-0 flex-col gap-3.5">
            {transcript}
            {notesCard}
          </div>
        </>
      )}
    </section>
  );
}
