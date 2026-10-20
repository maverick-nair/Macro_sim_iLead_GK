import { useI18n } from '../../i18n';

const focus = 'focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accent-secondary';

export const MailIcon = () => (
  <svg className="size-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg>
);

/** The envelope in the top bar (D242), with the unread count as a badge. */
export function MailButton({ unread, open, onOpen }: { unread: number; open: boolean; onOpen: () => void }) {
  const { t, number } = useI18n();
  return (
    <button type="button" onClick={onOpen} aria-haspopup="dialog" aria-expanded={open} aria-label={t('inbox.open', { count: unread })} data-tour="inbox" data-mail-button=""
      className={`relative flex size-11 flex-none cursor-pointer items-center justify-center rounded-4 border border-line-strong bg-transparent p-0 text-fg-primary hover:bg-surface-raised ${focus}`}>
      <MailIcon />
      {unread > 0 && (
        // Keyed by the count, so the badge pulses again each time a message arrives.
        <span key={unread} aria-hidden="true" data-mail-badge=""
          className="absolute -top-1.5 -end-1.5 flex h-5 min-w-5 animate-(--il-mail-badge-enter) text-large:h-auto items-center justify-center rounded-round bg-status-attention px-1 font-mono text-11 font-600 text-fg-on-accent">
          {number(unread)}
        </span>
      )}
    </button>
  );
}
