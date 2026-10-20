import * as Dialog from '@radix-ui/react-dialog';
import type { ReactNode } from 'react';
import { useI18n } from '../../i18n';

/**
 * How it landed, as a pop-up over the board right after a decision or an interaction (D242): the outcome panel in a
 * modal, so it takes no room on the board and nothing scrolls. Escape, the panel's close button or a click outside
 * dismisses it, and the board puts focus back (on its heading, as it did when the outcome was a band), so the board is
 * as the player left it.
 */
export function OutcomeDialog({ children, onDismiss, modal = true }: { children: ReactNode; onDismiss: () => void; modal?: boolean }) {
  const { t } = useI18n();
  const shell = 'fixed inset-0 z-46 flex items-center justify-center bg-surface-scrim p-6';
  // The board moves focus itself, to the headline on open and back to the board on close, so Radix leaves it alone.
  const content = (
    <Dialog.Content aria-describedby={undefined} aria-label={t('outcome.region')} aria-modal={modal ? 'true' : undefined} data-focus-handoff="" onOpenAutoFocus={e => e.preventDefault()} onCloseAutoFocus={e => e.preventDefault()}
      onInteractOutside={modal ? undefined : e => e.preventDefault()}
      className="pointer-events-auto flex max-h-full w-full max-w-(--il-outcome-dialog-max-width) flex-col overflow-auto shadow-(--il-outcome-band-shadow) outline-0">
      {/* Named for screen readers without a second heading: the panel's headline is the one to read. */}
      <Dialog.Title asChild><span className="sr-only">{t('outcome.region')}</span></Dialog.Title>
      {children}
    </Dialog.Content>
  );
  // In the demo it is not modal: the demo's own tip points at it and has to stay usable beside it.
  return (
    <Dialog.Root open modal={modal} onOpenChange={o => { if (!o) onDismiss(); }}>
      {modal
        ? <Dialog.Overlay data-outcome-dialog="" className={shell}>{content}</Dialog.Overlay>
        : <div data-outcome-dialog="" className={`pointer-events-none ${shell}`}>{content}</div>}
    </Dialog.Root>
  );
}
