import { useId, type ReactNode } from 'react';
import { useI18n } from '../../i18n';
import type { SubPeriodUnit } from '../action/days';
import { SENDER_TONE, SenderFace, type InboxSender } from '../inbox/sender';

export interface FeedChange {
  /** "Skill", "Beth's morale", "The team's trust", "Priya's confidence". */
  label: string;
  dir: 'up' | 'down';
  /** The size of the move, formatted. */
  n: string;
}

export interface FeedFeedback {
  key: string;
  /** When it happened: "Day 2". */
  when: string;
  /** The engine's words for it: the outcome headline, the action, "Styles are set for week 1". */
  title: string;
  changes: FeedChange[];
  /** Moves that did not fit. */
  more: number;
  /** See why: the history on this entry. */
  onWhy?: () => void;
}

export interface FeedMilestone {
  key: string;
  text: string;
  onResults?: () => void;
  onLeaderboard?: () => void;
  onDismiss: () => void;
}

export interface FeedMessage {
  id: string;
  sender: InboxSender;
  /** The sender's name. */
  from: string;
  kind: 'chat' | 'email' | 'sponsor' | 'news';
  title: string;
  /** "Due in 2 days", "Due today", or null. */
  due: string | null;
  urgent: boolean;
  cta: 'reply' | 'read';
  onOpen: () => void;
  /** Set aside until the next sub-period; left out where that would pass the due point. */
  onLater?: () => void;
}

export interface DeskFeedProps {
  feedback: FeedFeedback | null;
  milestones: FeedMilestone[];
  messages: FeedMessage[];
  subPeriodUnit: SubPeriodUnit;
  /** Opens the inbox drawer with every message. */
  onAll: () => void;
}

const FOCUS = 'focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accent-secondary';
const EYEBROW = 'm-0 text-12 font-600 whitespace-nowrap uppercase tracking-(--il-desk-band-eyebrow-tracking) text-fg-body';
const CARD = 'flex h-full min-h-27 flex-col gap-1.25 border bg-surface-card px-3 py-2.5 text-14 short:min-h-24 short:gap-1 short:py-2';
const LINK = `inline-flex min-h-6 cursor-pointer items-center rounded-4 border-0 bg-transparent p-0 text-13 font-600 text-fg-link hover:text-fg-link-hover hover:underline ${FOCUS}`;
const QUIET = `inline-flex min-h-6 cursor-pointer items-center rounded-4 border-0 bg-transparent p-0 text-13 font-500 text-fg-body hover:text-fg-primary ${FOCUS}`;

const Flag = () => (
  <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 22V4" /><path d="M4 4h12l-2 4 2 4H4" /></svg>
);
const Spark = () => (
  <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6" /></svg>
);

function Card({ children, urgent = false, kind }: { children: ReactNode; urgent?: boolean; kind: string }) {
  // Four to a row as the canvas lays them out (D232); more scroll sideways. Wider with larger text.
  return <li data-feed={kind} className="flex w-(--il-canvas-feed-card-width) min-w-(--il-desk-feed-card-width) flex-none text-large:w-full text-large:min-w-0"><div className={`${CARD} w-full ${urgent ? 'border-status-attention' : 'border-line-strong'}`}>{children}</div></li>;
}

/**
 * Feedback and inbox, under the team on the desk (D212, the approved canvas): how the last thing the
 * participant did landed (the engine's headline, never a band name, and what moved, in words beside each
 * arrow), the milestones reached (D93) with Keep going, and each message waiting with its sender, due point,
 * Reply and Later. All messages opens the inbox drawer. A row of cards that scrolls sideways when it is full.
 */
export function DeskFeed({ feedback, milestones, messages, subPeriodUnit, onAll }: DeskFeedProps) {
  const { t } = useI18n();
  const id = useId();
  const empty = !feedback && !milestones.length && !messages.length;
  return (
    <section aria-labelledby={id} data-tour="feed" data-desk-feed="" className="flex min-w-0 flex-none flex-col gap-1.5">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
        <h2 id={id} className={EYEBROW}>{t('desk.feed.title')}</h2>
        <span className="min-w-48 flex-1 text-end text-12 text-fg-body text-large:text-start">{t('desk.feed.hint', { unit: subPeriodUnit })}</span>
        <button type="button" onClick={onAll} className={LINK}>{t('inbox.open', { count: messages.length })}</button>
      </div>
      {empty ? <p className="m-0 text-13 text-fg-secondary">{t('desk.feed.empty')}</p> : (
        <ul aria-label={t('desk.feed.aria')} className="m-0 flex min-w-0 list-none gap-2 overflow-x-auto overscroll-x-contain p-0 pb-0.5 text-large:flex-wrap">
          {feedback && (
            <Card kind="feedback">
              <span className="flex items-center gap-1.5 text-12 font-600 uppercase tracking-(--il-tracking-eyebrow) text-status-gain"><Spark />{t('desk.feed.feedback', { when: feedback.when })}</span>
              <span className="line-clamp-2 leading-(--il-canvas-leading-line)">{feedback.title}</span>
              <span className="flex flex-wrap gap-x-2 text-12 text-fg-body">
                {feedback.changes.length === 0 && <span>{t('desk.feed.noChange')}</span>}
                {feedback.changes.map((c, i) => (
                  <span key={i} className="whitespace-nowrap">
                    {c.label}{' '}
                    <b aria-hidden="true" className={`font-mono font-400 ${c.dir === 'up' ? 'text-status-gain' : 'text-status-decline'}`}>{c.dir === 'up' ? '↑' : '↓'}{c.n}</b>
                    <span className="sr-only">{t('desk.feed.changeSr', { dir: c.dir, n: c.n })}</span>
                  </span>
                ))}
                {feedback.more > 0 && <span>{t('desk.feed.more', { n: feedback.more })}</span>}
              </span>
              {feedback.onWhy && <span className="mt-auto"><button type="button" onClick={feedback.onWhy} className={LINK}>{t('desk.feed.why')}<span className="sr-only">: {feedback.title}</span></button></span>}
            </Card>
          )}
          {milestones.map(m => (
            <Card key={m.key} kind="milestone">
              <span className="flex items-center gap-1.5 text-12 font-600 uppercase tracking-(--il-tracking-eyebrow) text-accent-secondary"><Flag />{t('desk.feed.milestone')}</span>
              <span className="leading-(--il-canvas-leading-line)">{m.text}</span>
              <span className="mt-auto flex flex-wrap gap-x-3">
                {m.onResults && <button type="button" onClick={m.onResults} className={LINK}>{t('desk.feed.results')}</button>}
                {m.onLeaderboard && <button type="button" onClick={m.onLeaderboard} className={LINK}>{t('board.notice.leaderboard')}</button>}
                <button type="button" onClick={m.onDismiss} className={QUIET}>{t('board.notice.keepGoing')}</button>
              </span>
            </Card>
          ))}
          {messages.map(x => (
            <Card key={x.id} kind="message" urgent={x.urgent}>
              <span className="flex min-w-0 items-center gap-2">
                <span className={`flex size-6 flex-none items-center justify-center overflow-hidden rounded-round text-11 text-large:size-auto text-large:min-h-6 text-large:min-w-6 text-large:p-0.5 font-600 text-button-on-solid ${SENDER_TONE[x.sender.kind]}`}><SenderFace sender={x.sender} /></span>
                <b className="min-w-0 flex-1 truncate text-13 font-600 text-large:whitespace-normal text-large:break-words">{x.from || t('desk.feed.message', { kind: x.kind })}</b>
                {x.due && <span className={`text-12 whitespace-nowrap ${x.urgent ? 'font-600 text-status-attention' : 'text-fg-body'}`}>{x.due}</span>}
              </span>
              <span className="line-clamp-2 leading-(--il-canvas-leading-line) text-fg-body">{x.title}</span>
              <span className="mt-auto flex flex-wrap gap-x-3">
                <button type="button" onClick={x.onOpen} className={LINK}>{t('inbox.cta', { cta: x.cta })}<span className="sr-only">: {x.title}</span></button>
                {x.onLater && <button type="button" onClick={x.onLater} className={QUIET}>{t('inbox.later')}<span className="sr-only">: {x.title}</span></button>}
              </span>
            </Card>
          ))}
        </ul>
      )}
    </section>
  );
}
