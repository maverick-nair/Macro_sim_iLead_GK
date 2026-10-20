import * as Dialog from '@radix-ui/react-dialog';
import { useLayoutEffect, type ReactNode } from 'react';
import { useI18n } from '../../i18n';

/**
 * How it landed, as a pop-up over the board right after a decision or an interaction (D242): the outcome panel in a
 * modal, so it takes no room on the board and nothing scrolls. Escape, the panel's close button or a click outside
 * dismisses it, and focus goes back where it was, so the board is as the player left it.
 */
export function OutcomeDialog({ children, onDismiss }: { children: ReactNode; onDismiss: () => void }) {
  const { t } = useI18n();
  // The engine clears the outcome and the board unmounts the dialog: focus goes back to where it was before.
  useLayoutEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    return () => {
      const back = () => { if (opener?.isConnected && (document.activeElement === document.body || !document.activeElement)) opener.focus({ preventScroll: true }); };
      back();
      requestAnimationFrame(back);
    };
  }, []);
  return (
    <Dialog.Root open onOpenChange={o => { if (!o) onDismiss(); }}>
      <Dialog.Overlay data-outcome-dialog="" className="fixed inset-0 z-46 flex items-center justify-center bg-surface-scrim p-6">
        {/* The board focuses the headline itself (useOutcomeFocus), so Radix leaves focus alone on open. */}
        <Dialog.Content aria-describedby={undefined} aria-label={t('outcome.region')} aria-modal="true" onOpenAutoFocus={e => e.preventDefault()}
          className="flex max-h-full w-full max-w-(--il-outcome-dialog-max-width) flex-col overflow-auto shadow-(--il-outcome-band-shadow) outline-0">
          <Dialog.Title className="sr-only">{t('outcome.region')}</Dialog.Title>
          {children}
        </Dialog.Content>
      </Dialog.Overlay>
    </Dialog.Root>
  );
}
