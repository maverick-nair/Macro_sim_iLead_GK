import * as Dialog from '@radix-ui/react-dialog';
import { useRef, type ReactNode } from 'react';

export interface AppDialogProps {
  /** Escape and a click on the scrim call it. Null when the dialog cannot be dismissed (session timed out). */
  onDismiss: (() => void) | null;
  /** A static gallery frame: focus stays where it is and only the dialog's own buttons close it. */
  frozen?: boolean;
  /** Where focus returns on close. Defaults to whatever had focus when the dialog opened. */
  returnFocus?: () => HTMLElement | null;
  role?: 'dialog' | 'alertdialog';
  /** True when the content has a Dialog.Description. */
  described?: boolean;
  /** Size and layout of the dialog box. */
  className: string;
  children: ReactNode;
}

/**
 * The shell of the app's dialogs (settings, pause, resume, session timed out): a Radix Dialog over a
 * blurred scrim, rendered in place so it covers the app only. Focus moves in on open, Tab and
 * Shift Tab loop inside, Escape closes it, and focus returns to the opener. The app marks everything
 * behind it `inert`, so the dialog is modal for pointer, keyboard and screen readers alike.
 *
 * Radix runs non modal on purpose, as in the command palette (D23): its modal mode sets
 * pointer-events none on the body, which re-rasterizes the board behind the scrim.
 */
export function AppDialog({ onDismiss, frozen = false, returnFocus, role = 'dialog', described = false, className, children }: AppDialogProps) {
  const opener = useRef<HTMLElement | null>(null);
  const dismissable = !!onDismiss && !frozen;
  return (
    <Dialog.Root open modal={false} onOpenChange={o => { if (!o && dismissable) onDismiss(); }}>
      <div className="absolute inset-0 z-50 flex items-center justify-center bg-surface-scrim p-6 backdrop-blur-(--il-appdialog-scrim-blur)">
        <Dialog.Content
          role={role}
          aria-modal="true"
          {...(described ? {} : { 'aria-describedby': undefined })}
          onOpenAutoFocus={e => {
            opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
            if (frozen) e.preventDefault();
          }}
          onCloseAutoFocus={e => {
            e.preventDefault();
            (returnFocus?.() ?? opener.current)?.focus({ preventScroll: true });
          }}
          onEscapeKeyDown={e => { if (!dismissable) e.preventDefault(); }}
          onInteractOutside={e => { if (!dismissable) e.preventDefault(); }}
          className={`max-w-full animate-(--il-appdialog-enter) rounded-24 border border-line-strong bg-surface-material outline-none ${className}`}>
          {children}
        </Dialog.Content>
      </div>
    </Dialog.Root>
  );
}

export const DialogTitle = Dialog.Title;
export const DialogDescription = Dialog.Description;
