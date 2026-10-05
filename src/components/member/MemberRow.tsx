import { useI18n } from '../../i18n';
import { backdrop, Chat, Check, Clock, MOOD_DOT, TrustRing, type MemberCardProps } from './MemberCard';

/** MemberCard's `row` layout: one person on a phone's team list. */
export function MemberRow(props: MemberCardProps) {
  const { name, title, img, mood, away = false, trust, style, statsHidden = false, tags = [], unread = false, promise, selected = false, unavailableReason, onSelect } = props;
  const { t } = useI18n();
  const unavailable = unavailableReason !== undefined && unavailableReason !== '';
  const moodName = t('member.mood', { mood });
  const pill = away ? t('member.mood.away') : moodName;
  const aria = t('member.card.aria', { name, title, mood: moodName, skill: props.skill, morale: props.morale, result: props.result, trust, hidden: String(statsHidden), available: String(!unavailable), reason: unavailableReason ?? '' });
  const toggle = props.rowAction === 'toggle';
  const label = t('phone.row.aria', { card: aria, style: style ? t('style.name', { style }) : 'none', unread: String(unread), promise: promise || 'none' });
  return (
    <button type="button" onClick={onSelect} aria-label={label}
      aria-pressed={toggle ? selected : undefined} aria-current={!toggle && selected ? 'true' : undefined} aria-haspopup={toggle ? undefined : 'dialog'}
      aria-disabled={unavailable || undefined}
      className={`flex min-h-16 w-full items-center gap-3 rounded-16 border-2 border-solid bg-surface-card px-3 py-2.5 text-left text-fg-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-secondary ${selected ? 'border-accent-secondary' : 'border-line-default'} ${unavailable ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
      <span className={`relative size-11 flex-none overflow-hidden rounded-round ${backdrop(mood, away)} ${unavailable ? 'opacity-40' : ''}`}>
        <img src={img} alt="" className={`size-full object-cover object-top mix-blend-multiply ${away ? 'grayscale' : ''}`} />
        {selected && <span className="absolute inset-0 flex items-center justify-center bg-(image:--il-fill-brand) text-brand-deep-space"><Check /></span>}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <b className="text-14 text-pretty break-words">{name}</b>
        <span className="text-12 text-pretty break-words text-fg-secondary">{title}</span>
        <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-12 font-700">
          <span className="flex items-center gap-1.25"><span className={`size-2 flex-none rounded-round ${MOOD_DOT[mood]}`} />{pill}</span>
          {style && <span className="flex min-h-5 items-center rounded-pill border border-line-default bg-surface-raised px-2 font-700">{t('style.name', { style })}</span>}
          {unread && <span className="flex items-center gap-1 text-fg-secondary"><Chat />{t('phone.row.unread')}</span>}
          {promise && <span className="flex items-center gap-1 text-fg-secondary"><Clock />{t('phone.row.promise')}</span>}
          {tags.map((tag, i) => <span key={i} className="flex min-h-5 items-center rounded-pill border border-line-default bg-surface-raised px-2 font-600">{tag}</span>)}
        </span>
        {unavailable && <span className="text-12 text-pretty text-status-attention">{unavailableReason}</span>}
      </span>
      {!statsHidden && <TrustRing value={trust} placement="inline" />}
    </button>
  );
}
