import * as Dialog from '@radix-ui/react-dialog';
import { useId, useRef, useState } from 'react';
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
  /** Where focus goes after the card closes. Defaults to Radix's (the element focused before). */
  onCloseFocus?: () => void;
}

const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-secondary';

/**
 * An event over the board, with a reason chip for every change it made. M5 brings the designed art.
 * A modal dialog (Radix): focus moves to its title, stays inside, the board behind is inert, and
 * Escape is Got it.
 */
export function EventCard({ card, busy, nameOf, everyone, onDismiss, onCloseFocus }: EventCardProps) {
  const { t } = useI18n();
  const [numbers, setNumbers] = useState(false);
  const [why, setWhy] = useState(false);
  const whyId = useId();
  const title = useRef<HTMLHeadingElement>(null);
  // Every change shows its reason (rule 5): one detail per distinct reason.
  const reasons = [...new Map(card.changes.map(c => [`${c.reason.label}|${c.reason.cause}`, c.reason])).values()];
  const changes = teamChips(card.changes.filter((c): c is typeof c & { metric: MetricKey } => c.metric !== 'confidence'), everyone);
  return (
    <Dialog.Root open onOpenChange={o => { if (!o && !busy) onDismiss(); }}>
      <Dialog.Overlay className="fixed inset-0 z-48 flex items-center justify-center bg-surface-scrim p-6 backdrop-blur-12">
      <Dialog.Content
        aria-describedby={undefined} aria-modal="true"
        onOpenAutoFocus={e => { e.preventDefault(); title.current?.focus({ preventScroll: true }); }}
        onCloseAutoFocus={e => { if (onCloseFocus) { e.preventDefault(); onCloseFocus(); } }}
        // A stray click on the scrim does not count as Got it.
        onPointerDownOutside={e => e.preventDefault()}
        className="flex max-h-full w-full max-w-(--il-board-panel-max-width) flex-col gap-3 overflow-auto rounded-26 border border-line-strong bg-surface-solid p-6 outline-0">
        <span className="text-12 font-700 tracking-wide text-fg-secondary uppercase">{t('board.card.label', { card: card.card })}</span>
        <Dialog.Title ref={title} tabIndex={-1} className="m-0 text-22 font-700 outline-0">{card.title}</Dialog.Title>
        <p className="m-0 text-14 text-fg-secondary">{card.body}</p>
        {changes.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {changes.map((c, i) => (
              <ReasonChip key={i} name={nameOf(c)} metric={c.metric} delta={c.delta} showNumbers={numbers} onToggle={() => setNumbers(n => !n)} />
            ))}
          </div>
        )}
        {why && <div id={whyId} className="contents">{reasons.map((r, i) => <ReasonDetail key={i} cause={r.cause} rule={r.rule} evidence={r.evidence.map(e => e.quote).join(' ')} judgedByAI={r.evidence.some(e => e.judgedByAI)} layout="stack" />)}</div>}
        <div className="flex items-center justify-end gap-2">
          {reasons.length > 0 && (
            <button type="button" onClick={() => setWhy(w => !w)} aria-expanded={why} aria-controls={why ? whyId : undefined}
              className={`h-9 cursor-pointer rounded-pill border border-solid border-line-strong bg-transparent px-4 py-0 text-13 font-700 text-fg-primary ${focusRing}`}>
              {t('outcome.why', { open: String(why) })}
            </button>
          )}
          <Button variant="primary" size="md" disabled={busy} onClick={onDismiss}>{t('board.card.dismiss')}</Button>
        </div>
      </Dialog.Content>
      </Dialog.Overlay>
    </Dialog.Root>
  );
}
