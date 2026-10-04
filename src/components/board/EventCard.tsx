import { useState } from 'react';
import type { EngineView, MetricKey } from '../../engine/contract';
import { Button } from '../../ds/Button';
import { useI18n } from '../../i18n';
import { ReasonChip } from '../reason/ReasonChip';
import { ReasonDetail } from '../reason/ReasonDetail';
import { teamChips, type Chip } from './chips';

export interface EventCardProps {
  card: EngineView['cards'][number];
  busy: boolean;
  /** Words a chip's subject: a first name, "6 people" or "The team". */
  nameOf: (chip: Chip) => string;
  /** Team size, so a change to everyone reads as the team. */
  everyone: number;
  onDismiss: () => void;
}

/** An event over the board, with a reason chip for every change it made. M5 brings the designed art. */
export function EventCard({ card, busy, nameOf, everyone, onDismiss }: EventCardProps) {
  const { t } = useI18n();
  const [numbers, setNumbers] = useState(false);
  const [why, setWhy] = useState(false);
  // Every change shows its reason (rule 5): one detail per distinct reason.
  const reasons = [...new Map(card.changes.map(c => [`${c.reason.label}|${c.reason.cause}`, c.reason])).values()];
  const changes = teamChips(card.changes.filter((c): c is typeof c & { metric: MetricKey } => c.metric !== 'confidence'), everyone);
  return (
    <div className="fixed inset-0 z-48 flex items-center justify-center bg-surface-scrim p-6 backdrop-blur-12">
      <div role="dialog" aria-modal="true" aria-label={t('board.card.label', { card: card.card })} className="flex w-full max-w-(--il-board-panel-max-width) flex-col gap-3 rounded-26 border border-line-strong bg-surface-solid p-6">
        <span className="text-12 font-700 tracking-wide text-fg-secondary uppercase">{t('board.card.label', { card: card.card })}</span>
        <h2 className="m-0 text-22 font-700">{card.title}</h2>
        <p className="m-0 text-14 text-fg-secondary">{card.body}</p>
        {changes.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {changes.map((c, i) => (
              <ReasonChip key={i} name={nameOf(c)} metric={c.metric} delta={c.delta} showNumbers={numbers} onToggle={() => setNumbers(n => !n)} />
            ))}
          </div>
        )}
        {why && reasons.map((r, i) => <ReasonDetail key={i} cause={r.cause} rule={r.rule} evidence={r.evidence.map(e => e.quote).join(' ')} judgedByAI={r.evidence.some(e => e.judgedByAI)} layout="stack" />)}
        <div className="flex items-center justify-end gap-2">
          {reasons.length > 0 && <Button variant="secondary" size="md" onClick={() => setWhy(w => !w)} aria-expanded={why}>{t('outcome.why', { open: String(why) })}</Button>}
          <Button variant="primary" size="md" disabled={busy} onClick={onDismiss}>{t('board.card.dismiss')}</Button>
        </div>
      </div>
    </div>
  );
}
