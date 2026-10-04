import { useI18n } from '../../i18n';

/** Who an inbox item is from: a team member (portrait), the sponsor (initials) or the news feed. */
export type InboxSender = { kind: 'member'; img: string } | { kind: 'sponsor'; initials: string } | { kind: 'news' };

/** Round backdrop behind a sender: the portrait backdrop, the brand fill for the sponsor, the product fill for news. */
export const SENDER_TONE: Record<InboxSender['kind'], string> = {
  member: 'bg-portrait-calm',
  sponsor: 'bg-brand',
  news: 'bg-product'
};

/** What sits inside the round sender face: the cut out portrait, the sponsor's initials or the News chip. */
export function SenderFace({ sender }: { sender: InboxSender }) {
  const { t } = useI18n();
  if (sender.kind === 'member') return <img src={sender.img} alt="" className="size-full object-cover object-top mix-blend-multiply" />;
  return <>{sender.kind === 'sponsor' ? sender.initials : t('inbox.sender.news')}</>;
}
