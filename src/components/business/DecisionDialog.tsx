import * as Dialog from '@radix-ui/react-dialog';
import { useId, useRef, useState } from 'react';
import type { EngineView } from '../../engine/contract';
import { Button } from '../../ds/Button';
import { useI18n } from '../../i18n';
import { EVENT_TAG, EventPortrait } from '../board/EventCard';
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

const focusRing = 'focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accent-secondary';

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
      <Dialog.Overlay className="fixed inset-0 z-48 flex items-center justify-center bg-surface-scrim p-6 ">
        <Dialog.Content
          aria-describedby={`${id}body`} aria-modal="true" data-decision={choice.eventKey}
          onOpenAutoFocus={e => { e.preventDefault(); title.current?.focus({ preventScroll: true }); }}
          onCloseAutoFocus={e => { if (onCloseFocus) { e.preventDefault(); onCloseFocus(); } }}
          onPointerDownOutside={e => e.preventDefault()}
          className={`grid max-h-full w-full animate-(--il-event-card-enter) overflow-auto rounded-4 bg-surface-card shadow-(--il-event-card-shadow) outline-0 ${img ? 'max-w-(--il-event-card-width) grid-cols-(--il-canvas-event-columns) tablet:max-w-(--il-board-panel-max-width) tablet:grid-cols-1' : 'max-w-(--il-board-panel-max-width) grid-cols-1'}`}>
          {img && <EventPortrait img={img} />}
          <div className="flex min-w-0 flex-col gap-3.5 px-7.5 pt-7 pb-6">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className={EVENT_TAG}>{t('decision.tag')}</span>
              {!done && <span className="text-13 font-600 text-status-attention">{due}</span>}
            </div>
            <Dialog.Title ref={title} tabIndex={-1} className="m-0 font-display text-36 leading-(--il-canvas-leading-heading) font-400 text-balance outline-0">{choice.title}</Dialog.Title>
            <p id={`${id}body`} className="m-0 text-15 leading-normal text-pretty text-fg-body">{choice.body}</p>
            {!done && choice.known.length > 0 && (
              <div className="flex flex-col gap-1">
                <b className="text-12 font-600 uppercase tracking-(--il-tracking-eyebrow-wide) text-fg-body">{t('decision.known')}</b>
                <ul className="m-0 flex list-disc flex-col gap-1 ps-4 text-14 text-fg-body">{choice.known.map((k, i) => <li key={i}>{k}</li>)}</ul>
              </div>
            )}
            {!done ? (
              <div className="flex flex-col gap-3">
                <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
                  <legend className="mb-1.5 p-0 font-serif text-21">{t('decision.legend')}</legend>
                  {choice.options.map(o => (
                    <label key={o.key} className={`flex cursor-pointer items-start gap-3 px-4 py-3.5 text-15 ${picked === o.key ? 'border-2 border-accent-default bg-surface-card px-3.75 py-3.25' : 'border border-line-strong bg-surface-material'}`}>
                      <input type="radio" name={`${id}option`} value={o.key} checked={picked === o.key} onChange={() => setPicked(o.key)} className={`mt-1 size-4 accent-(--il-color-accent-default) ${focusRing}`} />
                      <span className="flex flex-col gap-1"><b className="font-600">{o.label}</b>{o.detail && <span className="text-14 text-fg-body">{o.detail}</span>}</span>
                    </label>
                  ))}
                </fieldset>
                <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line-default pt-3.5">
                  <p className="m-0 w-full text-13 text-fg-body">{t('decision.noRight')}</p>
                  <button type="button" disabled={busy} onClick={onLater}
                    className={`min-h-11 cursor-pointer rounded-4 border border-solid border-line-strong bg-surface-card px-4 py-0 text-14 font-500 text-fg-primary ${focusRing}`}>
                    {t('decision.later')}
                  </button>
                  <Button variant="primary" size="lg" disabled={busy || !picked} onClick={() => { if (picked) onDecide(picked); }}>{t('decision.decide')}</Button>
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
                      {lines.map((l, i) => <li key={i} className="bg-surface-raised px-2 py-0.5 text-13 font-500">{l}</li>)}
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
