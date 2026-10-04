import { useState } from 'react';
import type { EngineView, MetricKey } from '../../engine/contract';
import { Button } from '../../ds/Button';
import { useI18n } from '../../i18n';
import { ReasonChip } from '../reason/ReasonChip';

export interface EventCardProps {
  card: EngineView['cards'][number];
  busy: boolean;
  /** First name for a member id; team wide changes read as "Your team". */
  nameOf: (id: string) => string;
  onDismiss: () => void;
}

/** More than this many people moved on one metric reads as one team chip with the average move. */
const TEAM_WIDE = 3;

function chips(changes: Array<{ subject: string; metric: MetricKey; delta: number }>) {
  const out: Array<{ subject: string; metric: MetricKey; delta: number }> = [];
  for (const metric of [...new Set(changes.map(c => c.metric))]) {
    const group = changes.filter(c => c.metric === metric);
    if (group.length > TEAM_WIDE) out.push({ subject: 'team', metric, delta: Math.round(group.reduce((a, c) => a + c.delta, 0) / group.length) });
    else out.push(...group);
  }
  return out;
}

/** An event over the board, with a reason chip for every change it made. M5 brings the designed art. */
export function EventCard({ card, busy, nameOf, onDismiss }: EventCardProps) {
  const { t } = useI18n();
  const [numbers, setNumbers] = useState(false);
  const changes = chips(card.changes.filter((c): c is typeof c & { metric: MetricKey } => c.metric !== 'confidence'));
  return (
    <div className="fixed inset-0 z-48 flex items-center justify-center bg-surface-scrim p-6 backdrop-blur-12">
      <div role="dialog" aria-modal="true" aria-label={t('board.card.label', { card: card.card })} className="flex w-full max-w-(--il-board-panel-max-width) flex-col gap-3 rounded-26 border border-line-strong bg-surface-solid p-6">
        <span className="text-12 font-700 tracking-wide text-fg-secondary uppercase">{t('board.card.label', { card: card.card })}</span>
        <h2 className="m-0 text-22 font-700">{card.title}</h2>
        <p className="m-0 text-14 text-fg-secondary">{card.body}</p>
        {changes.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {changes.map((c, i) => (
              <ReasonChip key={i} name={c.subject === 'team' ? t('team.title') : nameOf(c.subject)} metric={c.metric} delta={c.delta} showNumbers={numbers} onToggle={() => setNumbers(n => !n)} />
            ))}
          </div>
        )}
        <div className="flex justify-end">
          <Button variant="primary" size="md" disabled={busy} onClick={onDismiss}>{t('board.card.dismiss')}</Button>
        </div>
      </div>
    </div>
  );
}
