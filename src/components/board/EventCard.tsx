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
  /** `phone`: a 390 screen, with 16px around the card and 44px buttons that share the row. */
  layout?: 'desktop' | 'phone';
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

const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-secondary';
const chip = 'relative flex h-6.5 items-center rounded-pill bg-event-tag px-3 text-12 font-700 tracking-(--il-event-card-tag-tracking) text-event-on-tag uppercase';

/**
 * An event over the board: the art band for its type with the type tag (and the storyline's label,
 * when it shows one), the title and text, and a reason chip for every change it made. A modal
 * dialog (Radix): focus moves to its title, stays inside, the board behind is inert, and Escape is
 * Got it.
 */
export function EventCard({ card, busy, nameOf, everyone, img, onDismiss, onCloseFocus, layout = 'desktop' }: EventCardProps) {
  const phone = layout === 'phone';
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
      <Dialog.Overlay className={`fixed inset-0 z-48 flex items-center justify-center bg-surface-scrim ${phone ? 'px-(--il-phone-gutter-x) pt-(--il-phone-top) pb-(--il-phone-gutter-bottom)' : 'p-6'} backdrop-blur-12`}>
      <Dialog.Content
        aria-describedby={undefined} aria-modal="true"
        onOpenAutoFocus={e => { e.preventDefault(); title.current?.focus({ preventScroll: true }); }}
        onCloseAutoFocus={e => { if (onCloseFocus) { e.preventDefault(); onCloseFocus(); } }}
        // A stray click on the scrim does not count as Got it.
        onPointerDownOutside={e => e.preventDefault()}
        data-card={card.card}
        className="flex max-h-full w-full max-w-(--il-board-panel-max-width) animate-(--il-event-card-enter) flex-col overflow-auto rounded-26 border border-line-strong bg-surface-solid shadow-(--il-event-card-shadow) outline-0">
        <div className={`relative flex h-(--il-event-card-art-height) flex-none items-end gap-2 px-5 py-4 ${EVENT_ART[card.card]}`}>
          {img && <img src={img} alt="" className="absolute right-5 bottom-0 size-(--il-event-card-portrait) rounded-t-round object-cover object-top mix-blend-multiply" />}
          <span className={chip}>{t('board.card.label', { card: card.card })}</span>
          {card.label && <span className={chip}>{card.label}</span>}
        </div>
        <div className="flex flex-col gap-3 px-5.5 pt-5 pb-5.5">
          <Dialog.Title ref={title} tabIndex={-1} className="m-0 text-22 font-700 tracking-(--il-tracking-title) text-balance outline-0">{card.title}</Dialog.Title>
          <p className="m-0 text-14 text-pretty text-fg-secondary">{card.body}</p>
          {changes.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {changes.map((c, i) => (
                <ReasonChip key={i} name={nameOf(c)} metric={c.metric} delta={c.delta} showNumbers={numbers} onToggle={() => setNumbers(n => !n)} />
              ))}
            </div>
          )}
          {why && <div id={whyId} className="contents">{reasons.map((r, i) => <ReasonDetail key={i} cause={r.cause} rule={r.rule} evidence={r.evidence.map(e => e.quote).join(' ')} judgedByAI={r.evidence.some(e => e.judgedByAI)} layout="stack" />)}</div>}
          <div className={`flex items-center justify-end gap-2 pt-1.5 ${phone ? 'flex-wrap' : ''}`}>
            {reasons.length > 0 && (
              <button type="button" onClick={() => setWhy(w => !w)} aria-expanded={why} aria-controls={why ? whyId : undefined}
                className={`${phone ? 'min-h-12 px-5 text-15' : 'h-9 px-4 text-13'} cursor-pointer rounded-pill border border-solid border-line-strong bg-transparent py-0 font-700 text-fg-primary ${focusRing}`}>
                {t('outcome.why', { open: String(why) })}
              </button>
            )}
            <Button variant="primary" size={phone ? 'lg' : 'md'} disabled={busy} onClick={onDismiss}>{t('board.card.dismiss')}</Button>
          </div>
        </div>
      </Dialog.Content>
      </Dialog.Overlay>
    </Dialog.Root>
  );
}
