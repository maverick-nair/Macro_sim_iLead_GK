import { useI18n } from '../../i18n';
import { SENDER_TONE, SenderFace, type InboxSender } from './sender';

export type { InboxSender } from './sender';

export interface InboxRailItem {
  id: string;
  /** Accessible name of the sender button: the item's title. */
  label: string;
  sender: InboxSender;
  /** Pinned items get the attention ring. */
  urgent: boolean;
}

export interface InboxRailProps {
  unread: number;
  /** Unread items, newest first; one round button each. */
  items: InboxRailItem[];
  onToggle: () => void;
  onOpen: (id: string) => void;
}

const InboxIcon = () => (
  <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" /><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
  </svg>
);

const focus = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-secondary';

/**
 * The rail left of the board: the inbox button with its unread count, then one round button per
 * unread item that opens it directly. Urgent items carry an amber ring.
 */
export function InboxRail({ unread, items, onToggle, onOpen }: InboxRailProps) {
  const { t, number } = useI18n();
  return (
    <aside aria-label={t('inbox.title')} className="flex flex-col items-center gap-2.5 pt-1 pe-0 pb-6 ps-4">
      <button type="button" onClick={onToggle} aria-label={t('inbox.open', { count: unread })}
        className={`relative flex size-11 cursor-pointer items-center justify-center rounded-14 border border-solid border-line-default bg-surface-card p-0 text-fg-primary ${focus}`}>
        <InboxIcon />
        {unread > 0 && (
          <span aria-hidden="true" className="absolute -top-1.5 -end-1.5 flex min-h-5 min-w-5 items-center justify-center rounded-10 bg-brand px-1.25 text-12 font-700 text-brand-deep-space">{number(unread)}</span>
        )}
      </button>
      {items.map(it => (
        <button key={it.id} type="button" onClick={() => onOpen(it.id)} aria-label={it.label}
          className={`relative flex size-10 cursor-pointer items-center justify-center overflow-hidden rounded-round border-2 border-solid p-0 text-12 font-700 text-brand-deep-space ${it.urgent ? 'border-(--il-inbox-rail-ring-urgent)' : 'border-line-default'} ${SENDER_TONE[it.sender.kind]} ${focus}`}>
          <SenderFace sender={it.sender} />
        </button>
      ))}
    </aside>
  );
}
