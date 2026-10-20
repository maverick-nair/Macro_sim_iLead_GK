import { useState } from 'react';
import type { EngineView } from '../../../engine/contract';
import type { I18n } from '../../../i18n';
import { initials } from '../../gamification/display';
import type { InboxSender } from '../../inbox/sender';

type Message = EngineView['inbox'][number];

/** The clock point a message is set aside at. */
export const stampOf = (clock: Pick<EngineView['clock'], 'period' | 'subPeriod'>) => `${clock.period}:${clock.subPeriod}`;
/** Later sets a message aside until the next sub-period, never past the point it is due. */
export const canLater = (x: Pick<Message, 'dueInSubPeriods'>) => x.dueInSubPeriods === null || x.dueInSubPeriods >= 1;
/** The messages still showing: not read here, and not set aside at this clock point. */
export function visibleInbox<M extends Pick<Message, 'id' | 'dueInSubPeriods'>>(inbox: M[], readIds: string[], snoozed: Record<string, string>, stamp: string): M[] {
  return inbox.filter(x => !readIds.includes(x.id) && !(snoozed[x.id] === stamp && canLater(x)));
}

interface Input {
  view: EngineView;
  t: I18n['t'];
  amount: (n: number) => string;
  say: (msg: string) => void;
  /** Someone's portrait, or the placeholder. */
  img: (m: { img: string | null } | undefined) => string;
}

/** The inbox as the board shows it: what was read here, what Later set aside, and each message's sender and due point. */
export function useInbox({ view: v, t, amount, say, img }: Input) {
  /** News items read here. Messages that need an answer stay with the engine. */
  const [readIds, setReadIds] = useState<string[]>([]);
  /** Set aside with Later: hidden until the next sub-period (id to the clock it was set aside at). */
  const [snoozed, setSnoozed] = useState<Record<string, string>>({});
  const unit = v.clock.subPeriodUnit;
  const stamp = stampOf(v.clock);
  const inbox = visibleInbox(v.inbox, readIds, snoozed, stamp);
  const member = (id: string) => v.members.find(m => m.id === id);
  const stakeholder = (id: string) => v.stakeholders.find(s => s.key === id);
  const sender = (from: string): InboxSender => {
    const sh = stakeholder(from);
    // A stakeholder (D162): their portrait, else their initials as the sponsor's are shown.
    if (sh) return sh.img ? { kind: 'member', img: sh.img } : { kind: 'sponsor', initials: initials(sh.name) };
    return from === 'sponsor' ? { kind: 'sponsor', initials: v.sponsor.name.split(' ').map(w => w[0]).join('').slice(0, 2) } : from === 'news' ? { kind: 'news' } : { kind: 'member', img: img(member(from)) };
  };
  const senderName = (from: string) => (from === 'sponsor' ? v.sponsor.name : from === 'news' ? '' : member(from)?.name ?? stakeholder(from)?.name ?? '');
  const dueText = (x: Message) => (x.dueInSubPeriods === null ? null : x.dueInSubPeriods === 0 ? t('inbox.dueNow', { unit }) : t('board.due', { amount: amount(x.dueInSubPeriods) }));
  const markRead = (id: string) => setReadIds(r => [...r, id]);
  const later = (id: string) => {
    const msg = v.inbox.find(x => x.id === id);
    if (!msg || !canLater(msg)) return;
    setSnoozed(s => ({ ...s, [id]: stamp }));
    say(t('board.snoozed', { unit }));
  };
  return { inbox, stakeholder, sender, senderName, dueText, markRead, later, canLater };
}
