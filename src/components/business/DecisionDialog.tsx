import * as Dialog from '@radix-ui/react-dialog';
import { useId, useRef, useState } from 'react';
import type { EngineView } from '../../engine/contract';
import { Button } from '../../ds/Button';
import { useI18n } from '../../i18n';
import { EVENT_ART } from '../board/EventCard';
import './messages';

type OpenChoice = EngineView['openChoices'][number];
type ChoiceView = EngineView['choices'][number];

export interface DecisionDialogProps {
  /** The choice to make. */
  choice: OpenChoice;
  /** After choosing: what happened (the engine's record of it). */
  result: ChoiceView | null;
  busy: boolean;
  /** Portrait of the person it is about, cut out on the art. */
  img?: string | null;
  /** "2 days left", in the storyline's units. */
  due: string;
  /** A change as a line: "Arjun morale −3", "Budget −$10K", "Revenue +$15K". */
  changes: (result: ChoiceView) => string[];
  onDecide: (option: string) => void;
  /** Decide later: the choice stays open on the board until its deadline. */
  onLater: () => void;
  /** Close after reading what happened. */
  onDone: () => void;
  onCloseFocus?: () => void;
}

const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-secondary';
const chip = 'relative flex min-h-6.5 items-center rounded-pill bg-event-tag px-3 text-12 font-700 tracking-(--il-event-card-tag-tracking) text-event-on-tag uppercase';

/**
 * A choice event (D137) as a decision over the board, in the event card's language: the art for its kind, the
 * title and what happened, what you know, then the options as a group of radio buttons with Decide, or Decide
 * later while the deadline allows. After deciding, the same dialog says what happened and what it changed. A
 * modal dialog (Radix): focus moves to its title and stays inside; Escape is Decide later, then Continue.
 * Loaded on demand, with its copy.
 */
export function DecisionDialog({ choice, result, busy, img, due, changes, onDecide, onLater, onDone, onCloseFocus }: DecisionDialogProps) {
  const { t } = useI18n();
  const [picked, setPicked] = useState<string | null>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const id = useId();
  const done = result !== null;
  const lines = result ? changes(result) : [];
  return (
    <Dialog.Root open onOpenChange={o => { if (o || busy) return; if (done) onDone(); else onLater(); }}>
      <Dialog.Overlay className="fixed inset-0 z-48 flex items-center justify-center bg-surface-scrim p-6 backdrop-blur-12">
        <Dialog.Content
          aria-describedby={`${id}body`} aria-modal="true" data-decision={choice.eventKey}
          onOpenAutoFocus={e => { e.preventDefault(); title.current?.focus({ preventScroll: true }); }}
          onCloseAutoFocus={e => { if (onCloseFocus) { e.preventDefault(); onCloseFocus(); } }}
          onPointerDownOutside={e => e.preventDefault()}
          className="flex max-h-full w-full max-w-(--il-board-panel-max-width) animate-(--il-event-card-enter) flex-col overflow-auto rounded-26 border border-line-strong bg-surface-solid shadow-(--il-event-card-shadow) outline-0">
          <div className={`relative flex h-(--il-event-card-art-height) flex-none items-end gap-2 px-5 py-4 ${EVENT_ART[choice.card]}`}>
            {img && <img src={img} alt="" className="absolute end-5 bottom-0 size-(--il-event-card-portrait) rounded-t-round object-cover object-top mix-blend-multiply" />}
            <span className={chip}>{t('decision.tag')}</span>
            {!done && <span className={chip}>{due}</span>}
          </div>
          <div className="flex flex-col gap-3 px-5.5 pt-5 pb-5.5">
            <Dialog.Title ref={title} tabIndex={-1} className="m-0 text-22 font-700 tracking-(--il-tracking-title) text-balance outline-0">{choice.title}</Dialog.Title>
            <p id={`${id}body`} className="m-0 text-14 text-pretty text-fg-secondary">{choice.body}</p>
            {!done && choice.known.length > 0 && (
              <div className="flex flex-col gap-1">
                <b className="text-13">{t('decision.known')}</b>
                <ul className="m-0 flex list-disc flex-col gap-0.5 ps-5 text-13">{choice.known.map((k, i) => <li key={i}>{k}</li>)}</ul>
              </div>
            )}
            {!done ? (
              <div className="flex flex-col gap-3">
                <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
                  <legend className="mb-1.5 p-0 text-13 font-700">{t('decision.legend')}</legend>
                  {choice.options.map(o => (
                    <label key={o.key} className={`flex cursor-pointer items-start gap-2.5 rounded-16 border px-3.5 py-2.5 text-14 ${picked === o.key ? 'border-accent-secondary bg-accent-soft' : 'border-line-default'}`}>
                      <input type="radio" name={`${id}option`} value={o.key} checked={picked === o.key} onChange={() => setPicked(o.key)} className={`mt-1 ${focusRing}`} />
                      <span className="flex flex-col gap-0.5"><b>{o.label}</b>{o.detail && <span className="text-13 text-fg-secondary">{o.detail}</span>}</span>
                    </label>
                  ))}
                </fieldset>
                <p className="m-0 text-12 text-fg-secondary">{t('decision.noRight')}</p>
                <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                  <button type="button" disabled={busy} onClick={onLater}
                    className={`min-h-9 cursor-pointer rounded-pill border border-solid border-line-strong bg-transparent px-4 py-0 text-13 font-700 text-fg-primary ${focusRing}`}>
                    {t('decision.later')}
                  </button>
                  <Button variant="primary" size="md" disabled={busy || !picked} onClick={() => { if (picked) onDecide(picked); }}>{t('decision.decide')}</Button>
                </div>
              </div>
            ) : (
              <div role="status" className="flex flex-col gap-2.5">
                <p className="m-0 text-14"><b>{t('decision.chose', { by: result.by })}</b> {result.label}</p>
                {result.outcome && <p className="m-0 text-14 text-pretty">{result.outcome}</p>}
                {lines.length > 0 && (
                  <div className="flex flex-col gap-1">
                    <b className="text-13">{t('decision.changed')}</b>
                    <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
                      {lines.map((l, i) => <li key={i} className="rounded-pill border border-line-default px-2.5 py-0.5 text-12 font-700">{l}</li>)}
                    </ul>
                  </div>
                )}
                <div className="flex justify-end pt-1">
                  <Button variant="primary" size="md" disabled={busy} onClick={onDone}>{t('decision.done')}</Button>
                </div>
              </div>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Overlay>
    </Dialog.Root>
  );
}

export default DecisionDialog;
