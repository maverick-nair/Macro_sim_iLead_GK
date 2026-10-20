import * as Dialog from '@radix-ui/react-dialog';
import { useId, useLayoutEffect } from 'react';
import { useI18n } from '../../i18n';
import { ProfileHistory, ProfileSummary, type ProfilePanelProps } from './ProfilePanel';

const CLOSE_GLYPH = '✕';
const focus = 'focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accent-secondary';

/**
 * A member's profile over the style setting screen (D240): who they are, the four stats, the result trend, the facts
 * and your interactions with them, so a style is chosen on what the person needs, not guessed. No actions: none can
 * be taken before the styles are set. A Radix modal sheet from the right, as the tablet drawer: Escape or Close shuts
 * it and focus goes back to the button that opened it.
 */
export function ProfileDialog(props: Omit<ProfilePanelProps, 'actions'>) {
  const { t } = useI18n();
  const historyId = useId();
  // The board closes the dialog by unmounting it, so focus goes back to the opener here rather than through Radix.
  useLayoutEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    return () => {
      const back = () => { if (opener?.isConnected && (document.activeElement === document.body || !document.activeElement)) opener.focus({ preventScroll: true }); };
      back();
      requestAnimationFrame(back);
    };
  }, []);
  return (
    <Dialog.Root open onOpenChange={o => { if (!o) props.onClose(); }}>
      <Dialog.Overlay className="fixed inset-0 z-45 flex justify-end bg-surface-scrim">
        <Dialog.Content aria-describedby={undefined} aria-modal="true"
          className="flex h-full w-120 max-w-full animate-(--il-tablet-sheet-enter) flex-col gap-4 overflow-auto border-y-0 border-e-0 border-l border-solid border-line-strong bg-surface-solid px-6 pt-5.5 pb-6 text-fg-primary shadow-(--il-tablet-sheet-shadow) outline-0">
          <div className="flex items-center justify-between gap-3">
            <Dialog.Title className="m-0 text-13 font-600 uppercase tracking-(--il-tracking-eyebrow-wide) text-fg-secondary">{t('profile.aria', { name: props.name })}</Dialog.Title>
            <Dialog.Close asChild>
              <button type="button" aria-label={t('profile.close')}
                className={`flex size-11 flex-none cursor-pointer items-center justify-center rounded-4 border border-solid border-line-default bg-surface-raised p-0 text-fg-primary ${focus}`}>{CLOSE_GLYPH}</button>
            </Dialog.Close>
          </div>
          <div className="flex flex-col gap-3">
            <ProfileSummary {...props} actions={[]} compact />
            <ProfileHistory {...props} actions={[]} headingId={historyId} />
          </div>
        </Dialog.Content>
      </Dialog.Overlay>
    </Dialog.Root>
  );
}
