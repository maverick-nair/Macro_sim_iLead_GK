import * as Dialog from '@radix-ui/react-dialog';
import { useRef, type ReactNode } from 'react';
import { useI18n } from '../../i18n';

export interface BottomSheetProps {
  /** The sheet's name, shown in its header and read as the dialog's name. */
  title: string;
  /** Escape, a tap on the scrim and the close button call it. */
  onClose: () => void;
  /** The close button's name ("Close actions"). Defaults to "Close". */
  closeLabel?: string;
  children: ReactNode;
}

/** Icon glyph, not copy: the button is named from the catalog. */
const CLOSE_GLYPH = '✕';
const focus = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-secondary';

/**
 * A sheet that rises from the bottom of a phone screen: the action drawer, the inbox, a profile, the
 * score. A modal Radix dialog rendered in place (inside the themed app root, so its tokens apply):
 * focus moves in, Tab stays inside, Escape, the close button or a tap on the scrim closes it, and
 * focus goes back to what opened it. Focus lands on the content's own focusable heading when it has
 * one (the action drawer's name), else on the sheet's title.
 */
export function BottomSheet({ title, onClose, closeLabel, children }: BottomSheetProps) {
  const { t } = useI18n();
  const heading = useRef<HTMLHeadingElement>(null);
  const body = useRef<HTMLDivElement>(null);
  return (
    <Dialog.Root open onOpenChange={o => { if (!o) onClose(); }}>
      <Dialog.Overlay className="fixed inset-0 z-46 bg-surface-scrim backdrop-blur-12" />
      <Dialog.Content
        aria-describedby={undefined} aria-modal="true"
        onOpenAutoFocus={e => {
          e.preventDefault();
          const own = body.current?.querySelector<HTMLElement>('h2[tabindex="-1"], h3[tabindex="-1"]');
          (own ?? heading.current)?.focus({ preventScroll: true });
        }}
        className="fixed inset-x-0 bottom-0 z-47 flex max-h-(--il-phone-sheet-max-height) animate-(--il-phone-sheet-enter) flex-col overflow-hidden rounded-t-26 border border-b-0 border-line-strong bg-surface-solid shadow-(--il-phone-sheet-shadow) outline-0">
        <div aria-hidden="true" className="flex flex-none justify-center pt-2"><span className="h-1 w-10 rounded-pill bg-line-strong" /></div>
        <div className="flex flex-none items-center gap-3 border-b border-line-default py-1.5 pr-2 pl-(--il-phone-gutter-x)">
          <Dialog.Title ref={heading} tabIndex={-1} className="m-0 min-w-0 flex-1 text-18 font-700 text-pretty outline-0">{title}</Dialog.Title>
          <Dialog.Close aria-label={closeLabel ?? t('phone.sheet.close')}
            className={`flex size-11 flex-none cursor-pointer items-center justify-center rounded-round border-0 bg-surface-raised p-0 text-16 text-fg-primary ${focus}`}>
            <span aria-hidden="true">{CLOSE_GLYPH}</span>
          </Dialog.Close>
        </div>
        <div ref={body} className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain pb-(--il-phone-gutter-bottom)">
          {children}
        </div>
      </Dialog.Content>
    </Dialog.Root>
  );
}
