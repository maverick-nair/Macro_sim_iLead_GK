import * as Dialog from '@radix-ui/react-dialog';
import { useId, useState, type ReactNode } from 'react';
import { useI18n } from '../../i18n';
import type { SubPeriodUnit } from '../action/days';
import { MailIcon } from './MailButton';
import { SENDER_TONE, SenderFace, type InboxSender } from './sender';

/** One message in the mailbox, read or not. */
export interface MailMessage {
  id: string;
  sender: InboxSender;
  /** The sender's name; empty for news. */
  from: string;
  /** "Chat from Kent", "Paul, sponsor note", "News". */
  tag: string;
  /** When it arrived: "Week 1, Day 2", or null in a run saved before the date was kept. */
  when: string | null;
  title: string;
  body: string;
  /** Not read or answered yet: bold in the list, with a dot. */
  unread: boolean;
  /** Pinned: the attention mark and line. */
  urgent: boolean;
  /** "Due in 2 days", "Due today", or null. */
  due: string | null;
  /** What became of it once it is not waiting: answered, expired (missed) or read. Null while open. */
  status: 'answered' | 'expired' | 'read' | null;
  /** Set aside with Later until the next sub-period. */
  snoozed: boolean;
  /** Reply opens the conversation; read marks news as read. Null once it is dealt with. */
  cta: 'reply' | 'read' | null;
  /** Later is offered: setting it aside would not carry it past its due point. */
  later: boolean;
}

export interface MailChange {
  /** "Skill", "Beth's morale", "The team's trust". */
  label: string;
  dir: 'up' | 'down';
  n: string;
}

/** Updates: how the last thing you did landed, and the milestones reached (D93), as the desk's feed had them. */
export interface MailFeedback {
  key: string;
  when: string;
  title: string;
  changes: MailChange[];
  more: number;
  onWhy?: () => void;
}

export interface MailMilestone {
  key: string;
  text: string;
  onResults?: () => void;
  onLeaderboard?: () => void;
  onDismiss: () => void;
}

export interface MailDialogProps {
  messages: MailMessage[];
  feedback: MailFeedback | null;
  milestones: MailMilestone[];
  /** The message to show first, when the inbox opens on one. */
  initial?: string | null;
  subPeriodUnit: SubPeriodUnit;
  sponsorName?: string;
  onClose: () => void;
  /** Reply now (the conversation) or Mark as read (news). */
  onOpen: (id: string) => void;
  onLater: (id: string) => void;
}

type Folder = 'inbox' | 'updates';

const CLOSE_GLYPH = '✕';
const focus = 'focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accent-secondary';
const pill = `inline-flex min-h-10 cursor-pointer items-center rounded-4 px-4 text-14 font-600 ${focus}`;
const link = `inline-flex min-h-6 cursor-pointer items-center rounded-4 border-0 bg-transparent p-0 text-13 font-600 text-fg-link hover:text-fg-link-hover hover:underline ${focus}`;

const SparkIcon = () => (
  <svg className="size-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6" /></svg>
);

function Face({ sender, size = 'md' }: { sender: InboxSender; size?: 'md' | 'lg' }) {
  return (
    <span className={`flex flex-none items-center justify-center overflow-hidden rounded-round font-600 text-button-on-solid ${size === 'lg' ? 'size-12 text-14' : 'size-9 text-11'} ${SENDER_TONE[sender.kind]}`}>
      <SenderFace sender={sender} />
    </span>
  );
}

/**
 * The inbox as an overlay on the board (D242), laid out like a familiar mail client: folders on the left (Inbox, and
 * Updates for how things landed and the milestones), the messages in the middle, newest first, unread in bold with a
 * dot, and the open message on the right in full, with Reply now, Mark as read and Later. A Radix modal: focus moves
 * in, Escape or Close shuts it, and the board underneath is left exactly as it was.
 */
export function MailDialog(p: MailDialogProps) {
  const { t, number } = useI18n();
  const unread = p.messages.filter(m => m.unread).length;
  const updates = (p.feedback ? 1 : 0) + p.milestones.length;
  const [folder, setFolder] = useState<Folder>('inbox');
  const [chosen, setChosen] = useState<string | null>(p.initial ?? p.messages.find(m => m.unread)?.id ?? p.messages[0]?.id ?? null);
  const open = p.messages.find(m => m.id === chosen) ?? null;
  const listId = useId();
  const folders: Array<{ key: Folder; icon: ReactNode; count: number }> = [
    { key: 'inbox', icon: <MailIcon />, count: unread },
    { key: 'updates', icon: <SparkIcon />, count: updates }
  ];
  return (
    <Dialog.Root open onOpenChange={o => { if (!o) p.onClose(); }}>
      <Dialog.Overlay className="fixed inset-0 z-46 flex items-center justify-center bg-surface-scrim p-6 short:p-3">
        <Dialog.Content aria-describedby={undefined} aria-modal="true" data-mail=""
          // Back to the envelope in the top bar, unless a conversation opened from the inbox has taken focus.
          onCloseAutoFocus={e => { e.preventDefault(); if (document.activeElement === document.body || !document.activeElement) document.querySelector<HTMLElement>('[data-mail-button]')?.focus({ preventScroll: true }); }}
          className="grid h-full max-h-(--il-mail-max-height) w-full max-w-(--il-mail-max-width) animate-(--il-mail-enter) grid-cols-(--il-mail-columns) grid-rows-(--il-mail-rows) overflow-hidden rounded-4 border border-line-strong bg-surface-page text-fg-primary shadow-(--il-mail-shadow) outline-0">
          <div className="col-span-3 flex items-center gap-3 border-b border-line-strong bg-surface-card px-5 py-3">
            <Dialog.Title className="m-0 flex-1 font-display text-28 leading-tight font-400">{t('inbox.title')}</Dialog.Title>
            <Dialog.Close asChild>
              <button type="button" aria-label={t('inbox.close')} className={`size-11 cursor-pointer rounded-4 border border-line-strong bg-surface-card p-0 text-fg-primary ${focus}`}>{CLOSE_GLYPH}</button>
            </Dialog.Close>
          </div>

          <nav aria-label={t('mail.folders')} className="flex flex-col gap-1 border-e border-line-default bg-surface-card p-3">
            {folders.map(f => (
              <button key={f.key} type="button" onClick={() => setFolder(f.key)} aria-current={folder === f.key ? 'page' : undefined}
                className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-round border-0 px-4 text-start text-14 ${focus} ${folder === f.key ? 'bg-accent-soft font-600 text-fg-primary' : 'bg-transparent font-500 text-fg-body hover:bg-surface-raised'}`}>
                {f.icon}<span className="flex-1">{t('mail.folder', { folder: f.key })}</span>
                {f.count > 0 && <span className="font-mono text-12 font-600">{number(f.count)}</span>}
              </button>
            ))}
          </nav>

          {folder === 'inbox' ? (
            <>
              <div className="flex min-h-0 flex-col border-e border-line-default">
                {p.messages.length === 0 ? (
                  <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
                    <b>{t('inbox.empty.title')}</b>
                    <span className="text-13 text-fg-secondary">{p.sponsorName ? t('inbox.empty.bodySponsor', { sponsor: p.sponsorName }) : t('inbox.empty.body')}</span>
                  </div>
                ) : (
                  <ul id={listId} aria-label={t('mail.list')} className="m-0 flex min-h-0 flex-1 list-none flex-col overflow-auto p-0">
                    {p.messages.map(m => (
                      <li key={m.id}>
                        <button type="button" onClick={() => setChosen(m.id)} aria-current={m.id === chosen ? 'true' : undefined} data-mail-item="" data-unread={m.unread || undefined}
                          aria-label={[t('mail.item.aria', { unread: String(m.unread), from: m.from || m.tag, title: m.title }), m.when, m.cta ? m.due : null].filter(Boolean).join('. ')}
                          className={`grid w-full cursor-pointer grid-cols-(--il-mail-row-columns) gap-3 border-0 border-b border-s-3 border-b-line-default px-4 py-3 text-start ${focus} ${m.id === chosen ? 'border-s-accent-default bg-accent-soft' : m.urgent && m.unread ? 'border-s-status-attention bg-surface-card' : 'border-s-transparent bg-surface-card hover:bg-surface-raised'}`}>
                          <span className="relative">
                            <Face sender={m.sender} />
                            {m.unread && <span aria-hidden="true" className="absolute -top-0.5 -start-0.5 size-2.5 rounded-round border-2 border-surface-card bg-accent-default" />}
                          </span>
                          <span className="flex min-w-0 flex-col gap-0.5">
                            <span className="flex items-baseline gap-2 text-13">
                              <span className={`min-w-0 flex-1 truncate ${m.unread ? 'font-700 text-fg-primary' : 'font-500 text-fg-body'}`}>{m.from || m.tag}</span>
                              {m.when && <span className={`flex-none text-12 ${m.unread ? 'font-600 text-fg-primary' : 'text-fg-secondary'}`}>{m.when}</span>}
                            </span>
                            <span className={`truncate text-14 ${m.unread ? 'font-600' : 'font-400 text-fg-body'}`}>{m.title}</span>
                            <span className="truncate text-12 text-fg-secondary">{m.body}</span>
                            <span className="flex flex-wrap gap-x-2 text-12">
                              {m.urgent && m.cta && <b className="font-600 text-status-attention">{t('inbox.pinned')}</b>}
                              {m.due && m.cta && <span className={m.urgent ? 'font-600 text-status-attention' : 'text-fg-body'}>{m.due}</span>}
                              {m.snoozed && <span className="text-fg-secondary">{t('mail.snoozed')}</span>}
                              {m.status && <span className="text-fg-secondary">{t('mail.status', { status: m.status })}</span>}
                            </span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <article aria-label={open ? open.title : t('mail.none')} className="flex min-h-0 flex-col overflow-auto bg-surface-card">
                {open ? (
                  <div className="flex flex-col gap-4 px-7 py-6">
                    <h3 className="m-0 font-display text-28 leading-tight font-400">{open.title}</h3>
                    <div className="flex items-center gap-3">
                      <Face sender={open.sender} size="lg" />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <b className="text-15">{open.from || open.tag}</b>
                        <span className="text-13 text-fg-secondary">{open.tag}</span>
                      </span>
                      {open.when && <span className="text-13 text-fg-secondary">{open.when}</span>}
                    </div>
                    {(open.urgent || open.due) && open.cta && (
                      <span className={`self-start rounded-4 px-2.5 py-1 text-13 font-600 ${open.urgent ? 'bg-status-attention-soft text-status-attention' : 'bg-surface-raised text-fg-body'}`}>
                        {open.urgent ? (open.due ? t('inbox.pinnedDue', { due: open.due }) : t('inbox.pinned')) : open.due}
                      </span>
                    )}
                    <p className="m-0 text-16 leading-relaxed whitespace-pre-line">{open.body}</p>
                    {open.status && <p className="m-0 text-13 text-fg-secondary">{t('mail.statusLine', { status: open.status })}</p>}
                    {open.cta && (
                      <div className="flex flex-wrap items-center gap-2 border-t border-line-default pt-4">
                        <button type="button" onClick={() => p.onOpen(open.id)} className={`${pill} border-0 bg-button-solid text-button-on-solid`}>{t('inbox.cta', { cta: open.cta })}</button>
                        {open.later && !open.snoozed && <button type="button" onClick={() => p.onLater(open.id)} className={`${pill} border border-solid border-line-strong bg-surface-card text-fg-primary`}>{t('inbox.later')}</button>}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-1 items-center justify-center p-8 text-13 text-fg-secondary">{t('mail.none')}</div>
                )}
              </article>
            </>
          ) : (
            <section aria-label={t('mail.folder', { folder: 'updates' })} className="col-span-2 flex min-h-0 flex-col gap-3 overflow-auto bg-surface-card px-7 py-6">
              {!p.feedback && p.milestones.length === 0 && <p className="m-0 text-13 text-fg-secondary">{t('desk.feed.empty')}</p>}
              {p.feedback && (
                <div data-feed="feedback" className="flex flex-col gap-1.5 rounded-4 border border-line-strong p-4">
                  <span className="text-12 font-600 uppercase tracking-(--il-tracking-eyebrow) text-status-gain">{t('desk.feed.feedback', { when: p.feedback.when })}</span>
                  <b className="text-16 font-600">{p.feedback.title}</b>
                  <span className="flex flex-wrap gap-x-3 text-13 text-fg-body">
                    {p.feedback.changes.length === 0 && <span>{t('desk.feed.noChange')}</span>}
                    {p.feedback.changes.map((c, i) => (
                      <span key={i} className="whitespace-nowrap">
                        {c.label}{' '}
                        <b aria-hidden="true" className={`font-mono font-400 ${c.dir === 'up' ? 'text-status-gain' : 'text-status-decline'}`}>{c.dir === 'up' ? '↑' : '↓'}{c.n}</b>
                        <span className="sr-only">{t('desk.feed.changeSr', { dir: c.dir, n: c.n })}</span>
                      </span>
                    ))}
                    {p.feedback.more > 0 && <span>{t('desk.feed.more', { n: p.feedback.more })}</span>}
                  </span>
                  {p.feedback.onWhy && <span><button type="button" onClick={p.feedback.onWhy} className={link}>{t('desk.feed.why')}<span className="sr-only">: {p.feedback.title}</span></button></span>}
                </div>
              )}
              {p.milestones.map(m => (
                <div key={m.key} data-feed="milestone" className="flex flex-col gap-1.5 rounded-4 border border-line-strong p-4">
                  <span className="text-12 font-600 uppercase tracking-(--il-tracking-eyebrow) text-accent-secondary">{t('desk.feed.milestone')}</span>
                  <span className="text-15">{m.text}</span>
                  <span className="flex flex-wrap gap-x-4">
                    {m.onResults && <button type="button" onClick={m.onResults} className={link}>{t('desk.feed.results')}</button>}
                    {m.onLeaderboard && <button type="button" onClick={m.onLeaderboard} className={link}>{t('board.notice.leaderboard')}</button>}
                    <button type="button" onClick={m.onDismiss} className={link}>{t('board.notice.keepGoing')}</button>
                  </span>
                </div>
              ))}
            </section>
          )}

          <span className="col-span-3 border-t border-line-default bg-surface-card px-5 py-2.5 text-13 text-fg-body">{t('inbox.footer', { unit: p.subPeriodUnit })}</span>
        </Dialog.Content>
      </Dialog.Overlay>
    </Dialog.Root>
  );
}
