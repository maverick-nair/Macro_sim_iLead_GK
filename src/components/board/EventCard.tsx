import * as Dialog from '@radix-ui/react-dialog';
import { useId, useRef, useState } from 'react';
import type { EngineView, MetricKey } from '../../engine/contract';
import { Button } from '../../ds/Button';
import { useI18n } from '../../i18n';
import { ReasonChip } from '../reason/ReasonChip';
import { ReasonDetail } from '../reason/ReasonDetail';
import { teamChips, type Chip } from './chips';

export type EventCardKind = EngineView['cards'][number]['card'];

export interface EventCardProps {
  card: EngineView['cards'][number];
  busy: boolean;
  /** Words a chip's subject: a first name, "6 people" or "The team". */
  nameOf: (chip: Chip) => string;
  /** Team size, so a change to everyone reads as the team. */
  everyone: number;
  /** Portrait of the person the event is about (`card.memberId`), cut out on the art. */
  img?: string | null;
  onDismiss: () => void;
  /** Where focus goes after the card closes. Defaults to Radix's (the element focused before). */
  onCloseFocus?: () => void;
}

/**
 * The art band behind each card type. Impact, signal, capacity and diagnostic are the design's
 * (frame b9 and its siblings); opportunity and crisis follow them in the same language.
 */
export const EVENT_ART: Record<EventCardKind, string> = {
  impact: 'bg-event-impact',
  signal: 'bg-event-signal',
  capacity: 'bg-event-capacity',
  diagnostic: 'bg-event-diagnostic',
  opportunity: 'bg-event-opportunity',
  crisis: 'bg-event-crisis'
};

const focusRing = 'focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accent-secondary';
/** The card's type tag, as the canvas sets it (D232): small capitals on the selected tint. */
export const EVENT_TAG = 'relative flex min-h-6.5 items-center bg-accent-soft px-2 text-13 font-600 tracking-(--il-tracking-eyebrow) text-accent-default uppercase';
/** The card's portrait column when the event is about someone (D232): their photo in a 4:5 card, at most 480px wide (the art is 240px) so it does not blur. */
export function EventPortrait({ img }: { img: string }) {
  return (
    <div aria-hidden="true" className="flex min-h-60 items-center justify-center bg-(image:--il-fill-portrait-calm) p-6 tablet:hidden">
      <div className="relative aspect-4/5 w-full max-w-120 overflow-hidden rounded-4 bg-(image:--il-fill-portrait-calm)">
        <img src={img} alt="" className="absolute inset-0 size-full object-cover object-top mix-blend-multiply" />
      </div>
    </div>
  );
}

/**
 * An event over the board: the art band for its type with the type tag (and the storyline's label,
 * when it shows one), the title and text, and a reason chip for every change it made. A modal
 * dialog (Radix): focus moves to its title, stays inside, the board behind is inert, and Escape is
 * Got it.
 */
export function EventCard({ card, busy, nameOf, everyone, img, onDismiss, onCloseFocus }: EventCardProps) {
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
      <Dialog.Overlay className="fixed inset-0 z-48 flex items-center justify-center bg-surface-scrim p-6 ">
      <Dialog.Content
        aria-describedby={undefined} aria-modal="true"
        onOpenAutoFocus={e => { e.preventDefault(); title.current?.focus({ preventScroll: true }); }}
        onCloseAutoFocus={e => { if (onCloseFocus) { e.preventDefault(); onCloseFocus(); } }}
        // A stray click on the scrim does not count as Got it.
        onPointerDownOutside={e => e.preventDefault()}
        data-card={card.card} data-trace={`events.${card.key}`}
        className={`grid max-h-full w-full animate-(--il-event-card-enter) overflow-auto rounded-4 bg-surface-card shadow-(--il-event-card-shadow) outline-0 ${img ? 'max-w-(--il-event-card-width) grid-cols-(--il-canvas-event-columns) tablet:max-w-(--il-board-panel-max-width) tablet:grid-cols-1' : 'max-w-(--il-board-panel-max-width) grid-cols-1'}`}>
        {img && <EventPortrait img={img} />}
        <div className="flex min-w-0 flex-col gap-3.5 px-7.5 pt-7 pb-6">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className={EVENT_TAG}>{t('board.card.label', { card: card.card })}</span>
            {card.label && <span className="text-13 text-fg-body">{card.label}</span>}
          </div>
          <Dialog.Title ref={title} tabIndex={-1} className="m-0 font-display text-36 leading-(--il-canvas-leading-heading) font-400 text-balance outline-0">{card.title}</Dialog.Title>
          <p className="m-0 text-15 leading-normal text-pretty text-fg-body">{card.body}</p>
          {changes.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {changes.map((c, i) => (
                <ReasonChip key={i} name={nameOf(c)} metric={c.metric} delta={c.delta} showNumbers={numbers} onToggle={() => setNumbers(n => !n)} />
              ))}
            </div>
          )}
          {why && <div id={whyId} className="contents">{reasons.map((r, i) => <ReasonDetail key={i} cause={r.cause} rule={r.rule} evidence={r.evidence.map(e => e.quote).join(' ')} judgedByAI={r.evidence.some(e => e.judgedByAI)} layout="stack" />)}</div>}
          <div className="mt-1 flex items-center justify-end gap-2 border-t border-line-default pt-3.5">
            {reasons.length > 0 && (
              <button type="button" onClick={() => setWhy(w => !w)} aria-expanded={why} aria-controls={why ? whyId : undefined}
                className={`min-h-11 cursor-pointer rounded-4 border border-solid border-line-strong bg-surface-card px-4 py-0 text-14 font-500 text-fg-primary ${focusRing}`}>
                {t('outcome.why', { open: String(why) })}
              </button>
            )}
            <Button variant="primary" size="lg" disabled={busy} onClick={onDismiss}>{t('board.card.dismiss')}</Button>
          </div>
        </div>
      </Dialog.Content>
      </Dialog.Overlay>
    </Dialog.Root>
  );
}
