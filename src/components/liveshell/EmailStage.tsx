import { NoWrapButton } from '../../ds/Button';
import { useI18n } from '../../i18n';
import type { SubPeriodUnit } from '../action/days';
import { Waveform } from '../live/Waveform';
import { FOCUS, initialsOf, type LivePerson } from './types';

/** The fields you can dictate into. */
export type EmailField = 'to' | 'cc' | 'subject' | 'body';

export interface EmailStageProps {
  to: LivePerson[];
  cc: LivePerson[];
  subject: string;
  body: string;
  onSubject: (value: string) => void;
  onBody: (value: string) => void;
  /** "Add from team" on the To or CC row. Leave it out when recipients are fixed (the action drawer picked them). */
  onAddRecipient?: (field: 'to' | 'cc') => void;
  /** Starts or stops dictation into one field. */
  onDictate: (field: EmailField) => void;
  /** The field being dictated into, or null. Shows the listening strip over the body. */
  dictating: EmailField | null;
  /** Mic levels for the dictation strip. */
  levels: number[];
  onSend: () => void;
  /** The storyline's sub period ("Replies arrive ... over the next sim day"). */
  subUnit?: SubPeriodUnit;
}

const MicIcon = () => (
  <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
  </svg>
);

function Chip({ person }: { person: LivePerson }) {
  return (
    <span className="flex h-7.5 items-center gap-1.5 rounded-pill border border-line-default bg-surface-raised py-0 pr-2.5 pl-0.75 text-13 font-600 whitespace-nowrap">
      <span className="flex size-6 items-center justify-center overflow-hidden rounded-round bg-liveshell-chip-avatar text-12 font-700 text-liveshell-on-signal">
        {person.img ? <img src={person.img} alt="" className="size-full object-cover object-top mix-blend-multiply" /> : <span aria-hidden="true">{initialsOf(person.name)}</span>}
      </span>
      <span>{person.name}</span>
    </span>
  );
}

/**
 * Email composer workspace: To and CC as recipient chips, the subject and the body, a dictate
 * button per field with a listening strip, then "Draft saved" and Send.
 */
export function EmailStage(p: EmailStageProps) {
  const { t } = useI18n();
  const rows: Array<'to' | 'cc' | 'subject'> = ['to', 'cc', 'subject'];
  return (
    <div className="flex flex-1 flex-col overflow-hidden rounded-22 border border-line-default bg-surface-card backdrop-blur-14">
      {rows.map(field => (
        <div key={field} className="flex min-h-13 items-center gap-2.5 border-b border-line-default px-4 py-2.5">
          <span className="w-14 text-13 text-fg-secondary">{t('liveshell.email.field', { field })}</span>
          {field !== 'subject' ? (
            <div className="flex flex-1 flex-wrap gap-1.5">
              {(field === 'to' ? p.to : p.cc).map(person => <Chip key={person.id} person={person} />)}
              {p.onAddRecipient && (
                <button type="button" onClick={() => p.onAddRecipient?.(field)} aria-label={t('liveshell.email.addAria', { field })}
                  className={`h-7.5 cursor-pointer rounded-pill border border-dashed border-line-control bg-transparent px-2.5 py-0 text-12 font-700 whitespace-nowrap text-fg-secondary ${FOCUS}`}>
                  {t('liveshell.email.add')}
                </button>
              )}
            </div>
          ) : (
            <input value={p.subject} onChange={e => p.onSubject(e.target.value)} aria-label={t('liveshell.email.subjectAria')}
              className="h-9 flex-1 rounded-4 border-0 bg-transparent px-0.5 py-0.25 text-15 font-600 text-fg-primary outline-0 focus-visible:outline-2 focus-visible:outline-accent-secondary" />
          )}
          <button type="button" onClick={() => p.onDictate(field)} aria-label={t('liveshell.email.dictate', { field })} aria-pressed={p.dictating === field}
            className={`flex size-8 flex-none cursor-pointer items-center justify-center rounded-round border border-solid border-line-default bg-surface-raised p-0 text-fg-secondary ${FOCUS}`}>
            <MicIcon />
          </button>
        </div>
      ))}
      <div className="relative flex flex-1">
        <textarea value={p.body} onChange={e => p.onBody(e.target.value)} aria-label={t('liveshell.email.bodyAria')}
          className="min-h-65 flex-1 resize-none border-0 bg-transparent p-4 text-15 leading-(--il-liveshell-email-leading) text-fg-primary outline-0 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent-secondary" />
        {p.dictating && (
          <div role="status" className="absolute right-4 bottom-3 left-4 flex items-center gap-2.5 rounded-14 border border-accent-default bg-surface-material px-3.5 py-2.5 text-13">
            <Waveform levels={p.levels} size="sm" />
            {t('liveshell.email.dictating', { field: p.dictating })}
          </div>
        )}
      </div>
      <div className="flex items-center gap-2.5 border-t border-line-default px-4 py-3">
        <span className="text-12 text-fg-secondary">{t('liveshell.email.footer', { unit: p.subUnit ?? 'day' })}</span>
        <span className="flex-1" />
        <NoWrapButton variant="primary" size="md" onClick={p.onSend}>{t('liveshell.email.send')}</NoWrapButton>
      </div>
    </div>
  );
}
