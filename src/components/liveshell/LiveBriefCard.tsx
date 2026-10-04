import { useId, type ReactNode } from 'react';
import { useI18n } from '../../i18n';
import { FOCUS, type LiveBrief, type LiveFormat } from './types';

export interface LiveBriefCardProps {
  format: LiveFormat;
  brief: LiveBrief;
  /** Pronoun of the person the brief is about ("Your style for him", "She cares about"). */
  pronoun?: 'he' | 'she' | 'they';
  /** The coaching tip, once the hint has been used. Shown at the bottom of the card. */
  tip: string | null;
  /** False shows the "Show brief" button in the card's place. */
  open: boolean;
  onToggle: () => void;
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <b className="text-12 text-fg-secondary">{label}</b>
      {children}
    </div>
  );
}

const value = 'text-13 text-pretty';

/**
 * The brief, left of the stage: your goal for this moment, what you know about the person, their
 * mood, open promises and your declared style, then the coaching tip once you have asked for it.
 * Collapses to a "Show brief" button.
 */
export function LiveBriefCard({ format, brief, pronoun = 'they', tip, open, onToggle }: LiveBriefCardProps) {
  const { t } = useI18n();
  const id = useId();
  if (!open) {
    return (
      <button type="button" onClick={onToggle} aria-expanded={false}
        className={`h-9 cursor-pointer self-start rounded-pill border border-solid border-line-default bg-surface-card px-3.5 py-0 text-13 font-700 text-fg-primary ${FOCUS}`}>
        {t('liveshell.brief.show')}
      </button>
    );
  }
  const mood = brief.mood && ('key' in brief.mood ? t('member.mood', { mood: brief.mood.key }) : brief.mood.text);
  return (
    <aside id={id} aria-label={t('liveshell.brief.title')}
      className="flex flex-col gap-3.5 self-start rounded-22 border border-line-default bg-surface-card p-4.5 backdrop-blur-14">
      <div className="flex items-center justify-between">
        <span className="text-12 font-700 tracking-(--il-liveshell-eyebrow-tracking) text-fg-secondary uppercase">{t('liveshell.brief.title')}</span>
        <button type="button" onClick={onToggle} aria-expanded aria-controls={id}
          className={`cursor-pointer rounded-4 border-0 bg-transparent px-1.5 py-0.25 text-12 font-700 text-accent-secondary ${FOCUS}`}>
          {t('liveshell.brief.hide')}
        </button>
      </div>
      <div className="flex flex-col gap-1">
        <b className="text-12 text-fg-secondary">{t('liveshell.brief.goal')}</b>
        <span className="text-14 font-600 text-pretty">{brief.goal}</span>
      </div>
      {brief.agenda && brief.agenda.length > 0 && (
        <Row label={t('liveshell.brief.agenda')}>
          <span className={value}>{brief.agenda.map((item, i) => t('liveshell.brief.agendaItem', { n: i + 1, item })).join(' ')}</span>
        </Row>
      )}
      {brief.known && brief.known.length > 0 && (
        <Row label={t('liveshell.brief.known', { format, pronoun })}><span className={value}>{brief.known.join(' ')}</span></Row>
      )}
      {mood && <Row label={t('liveshell.brief.mood', { format })}><span className={value}>{mood}</span></Row>}
      {brief.promises && (
        <Row label={t('liveshell.brief.promises')}>
          {brief.promises.length === 0
            ? <span className={value}>{t('liveshell.brief.noPromises')}</span>
            : brief.promises.map((p, i) => <span key={i} className={value}>{p}</span>)}
        </Row>
      )}
      {brief.declaredStyle !== undefined && (
        <Row label={t('liveshell.brief.style', { pronoun })}><span className={value}>{t('liveshell.brief.styleValue', { style: brief.declaredStyle ?? 'none' })}</span></Row>
      )}
      {brief.tone && <Row label={t('liveshell.brief.tone')}><span className={value}>{brief.tone}</span></Row>}
      {tip !== null && (
        <div role="note" className="flex animate-(--il-liveshell-tip-enter) flex-col gap-1 rounded-14 border border-accent-default bg-accent-soft p-3 text-13">
          <b>{t('liveshell.tip.title')}</b>
          <span>{tip}</span>
        </div>
      )}
    </aside>
  );
}
