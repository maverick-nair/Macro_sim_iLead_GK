import { useEffect, useRef } from 'react';
import { useI18n } from '../../i18n';
import type { SubPeriodUnit } from '../action/days';
import { SENDER_TONE, SenderFace, type InboxSender } from './sender';

export interface InboxDrawerItem {
  id: string;
  sender: InboxSender;
  /** "Chat from Kent", "Priya, sponsor note". */
  tag: string;
  /** When it arrived: "Day 2, 16:40". */
  meta: string;
  title: string;
  preview: string;
  /** Pinned: attention border and the pinned line. */
  urgent: boolean;
  /** Deadline: "Reply by Day 3". Pinned items show it with the pinned line, others on their own. */
  due: string | null;
  /** `reply` opens the conversation, `impact` opens the news event, `read` marks news that needs no answer as read. */
  cta: 'reply' | 'impact' | 'read';
  /** False hides Later: setting the item aside would carry it past its due point. Defaults to true. */
  later?: boolean;
}

export interface InboxDrawerProps {
  open: boolean;
  /** Replying is free: "costs no days" in the storyline's unit. */
  subPeriodUnit: SubPeriodUnit;
  /** Unread items; empty shows "All caught up". */
  items: InboxDrawerItem[];
  /** Sponsor's first name for the empty state ("your team and Priya"). Omitted: "your team" only. */
  sponsorName?: string;
  onClose: () => void;
  onOpen: (id: string) => void;
  onLater: (id: string) => void;
}

/** Icon glyph, not copy: the button is named from the catalog. */
const CLOSE_GLYPH = '✕';
const focus = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-secondary';
const pill = `h-7.5 cursor-pointer rounded-pill px-3 py-0 text-12 font-700 ${focus}`;

function Item({ it, onOpen, onLater }: { it: InboxDrawerItem; onOpen: () => void; onLater: () => void }) {
  const { t } = useI18n();
  return (
    <div className={`flex flex-col gap-2.5 rounded-16 border bg-surface-raised p-3 ${it.urgent ? 'border-status-attention' : 'border-line-default'}`}>
      <div className="flex gap-2.5">
        <span className={`flex size-10 flex-none items-center justify-center overflow-hidden rounded-round text-12 font-700 text-brand-deep-space ${SENDER_TONE[it.sender.kind]}`}>
          <SenderFace sender={it.sender} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="flex justify-between gap-1.5 text-12 text-fg-secondary"><b>{it.tag}</b><span>{it.meta}</span></span>
          <b className="text-14">{it.title}</b>
          <span className="text-13 text-fg-secondary">{it.preview}</span>
        </span>
      </div>
      <div className="flex items-center gap-2">
        {it.urgent && <span className="text-12 font-700 text-status-attention">{it.due ? t('inbox.pinnedDue', { due: it.due }) : t('inbox.pinned')}</span>}
        {!it.urgent && it.due && <span className="text-12 text-fg-secondary">{it.due}</span>}
        <span className="flex-1" />
        {it.later !== false && <button type="button" onClick={onLater} className={`${pill} border border-solid border-line-default bg-transparent text-fg-primary`}>{t('inbox.later')}</button>}
        <button type="button" onClick={onOpen} className={`${pill} border-0 bg-brand text-brand-deep-space`}>{t('inbox.cta', { cta: it.cta })}</button>
      </div>
    </div>
  );
}

/**
 * The inbox, opened from the rail beside the board: messages from the team, the sponsor and the
 * news feed, pinned ones first marked with their deadline. Each can be answered now or set aside.
 * A non modal dialog: focus moves in when it opens, Escape closes it, and focus goes back to the
 * opener (the rail) when it closes.
 */
export function InboxDrawer(props: InboxDrawerProps) {
  return props.open ? <OpenDrawer {...props} /> : null;
}

function OpenDrawer({ subPeriodUnit, items, sponsorName, onClose, onOpen, onLater }: InboxDrawerProps) {
  const { t } = useI18n();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    el?.focus({ preventScroll: true });
    return () => {
      // Back to the opener, unless focus already moved on (a conversation opened from the inbox).
      const active = document.activeElement;
      const lost = !active || active === document.body || !!el?.contains(active);
      if (lost && opener && opener !== document.body && opener.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);
  const onKeyDown = (e: { key: string; stopPropagation: () => void }) => {
    if (e.key !== 'Escape') return;
    e.stopPropagation();
    onClose();
  };
  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- Escape closes the dialog
    <div ref={ref} role="dialog" aria-label={t('inbox.title')} tabIndex={-1} onKeyDown={onKeyDown}
      className="absolute top-0 bottom-6 left-(--il-inbox-drawer-offset) z-30 flex w-(--il-inbox-drawer-width) animate-(--il-inbox-drawer-enter) flex-col overflow-hidden rounded-22 border border-line-strong bg-surface-material shadow-(--il-inbox-drawer-shadow) outline-0 backdrop-blur-20">
      <div className="flex items-center justify-between border-b border-line-default px-4.5 py-4">
        <h2 className="m-0 text-18 font-700">{t('inbox.title')}</h2>
        <button type="button" onClick={onClose} aria-label={t('inbox.close')}
          className={`size-8 cursor-pointer rounded-round border-0 bg-surface-raised p-0 text-fg-primary ${focus}`}>{CLOSE_GLYPH}</button>
      </div>
      {items.length === 0 && (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
          <b>{t('inbox.empty.title')}</b>
          <span className="text-13 text-fg-secondary">{sponsorName ? t('inbox.empty.bodySponsor', { sponsor: sponsorName }) : t('inbox.empty.body')}</span>
        </div>
      )}
      <div className="flex flex-1 flex-col gap-2 overflow-auto p-2.5">
        {items.map(it => <Item key={it.id} it={it} onOpen={() => onOpen(it.id)} onLater={() => onLater(it.id)} />)}
      </div>
      <span className="border-t border-line-default px-4.5 py-2.5 text-12 text-fg-secondary">{t('inbox.footer', { unit: subPeriodUnit })}</span>
    </div>
  );
}
