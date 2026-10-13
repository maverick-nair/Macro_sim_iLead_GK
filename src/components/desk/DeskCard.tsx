import type { MoodKey } from '../../data/types';
import { useI18n } from '../../i18n';
import { backdrop, type MemberCardProps } from '../member/MemberCard';

/** What the desk card adds to a member card (D232): the period's style by name, a flag, and the time spent with them. */
export interface DeskCardInfo {
  /** The style set for this period, by the lens's name; null before one is set. */
  style: string | null;
  /** One line that needs attention: away, a message waiting, a promise, a tag. */
  flag: string | null;
  /** "This week: Coach member, Day 2", or null when there has been no time with them this period. */
  time: string | null;
}

/** Mood is a word with a shape, never colour alone, as the canvas draws it: a triangle up, a circle steady, a diamond under pressure. */
function MoodMark({ mood }: { mood: MoodKey }) {
  const up = mood === 'happy';
  const strained = mood === 'concerned' || mood === 'frustrated';
  return (
    <svg className={`size-2.5 flex-none ${up ? 'fill-status-gain' : strained ? 'fill-status-attention' : 'fill-fg-secondary'}`} viewBox="0 0 10 10" aria-hidden="true">
      <path d={up ? 'M5 1l4 8H1z' : strained ? 'M5 0l5 5-5 5-5-5z' : 'M5 1a4 4 0 1 1 0 8a4 4 0 1 1 0-8z'} />
    </svg>
  );
}

/**
 * A person on the desk, as the approved canvas draws them (D232): their face, name and this period's style, their mood
 * as a word and a shape, a flag when something needs you, and whether you have spent time with them this period. The
 * whole card is one button that selects them (pressed while selected or picked); their profile opens from the actions
 * panel. While an action is being planned, someone who cannot take part is dimmed and says why.
 */
export function DeskCard(props: MemberCardProps & { desk: DeskCardInfo }) {
  const { name, title, img, mood, away = false, skill, morale, result, trust, statsHidden = false, selected = false, unavailableReason, onSelect, memberId, desk } = props;
  const { t } = useI18n();
  const unavailable = unavailableReason !== undefined && unavailableReason !== '';
  const moodName = away ? t('member.mood.away') : t('member.mood', { mood });
  const aria = t('member.card.aria', { name, title, mood: moodName, skill, morale, result, trust, hidden: String(statsHidden), available: String(!unavailable), reason: unavailableReason ?? '' });
  return (
    <button type="button" onClick={onSelect} aria-pressed={selected} aria-label={aria} aria-disabled={unavailable || undefined} title={unavailable ? unavailableReason : undefined}
      data-tour="member" data-member-card="" data-member-id={memberId} data-trace={memberId ? `members.${memberId}` : undefined}
      className={`flex min-h-35 min-w-0 flex-col gap-1.25 bg-surface-card px-2.25 py-2 text-start text-fg-primary short:min-h-32 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accent-secondary ${selected ? 'border-3 border-accent-default px-1.75 py-1.5' : 'border border-line-strong hover:border-line-control'} ${unavailable ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'}`}>
      <span className="flex min-w-0 items-center gap-2">
        <span className={`size-9 flex-none overflow-hidden rounded-round short:size-8 ${backdrop(mood, away)}`}>
          <img src={img} alt="" className={`size-full object-cover object-top mix-blend-multiply ${away ? 'grayscale' : ''}`} />
        </span>
        <span className="flex min-w-0 flex-col">
          <b className="truncate text-14 font-600 text-large:overflow-visible text-large:whitespace-normal text-large:wrap-anywhere">{name}</b>
          <span className="truncate text-12 text-fg-body text-large:whitespace-normal">{desk.style ? t('desk.card.style', { style: desk.style }) : t('desk.card.noStyle')}</span>
        </span>
      </span>
      <span className="flex min-w-0 items-center gap-1.5 text-13 text-fg-body text-large:flex-wrap"><MoodMark mood={away ? 'neutral' : mood} /><span className="truncate text-large:overflow-visible text-large:whitespace-normal">{moodName}</span></span>
      {desk.flag && <span className="text-12 leading-(--il-canvas-leading-snug) text-status-attention">{desk.flag}</span>}
      <span className={`mt-auto truncate border-t border-line-default pt-1.25 text-12 text-fg-body text-large:overflow-visible text-large:whitespace-normal ${desk.time ? 'font-400' : 'font-600'}`}>{desk.time ?? t('desk.card.noTime')}</span>
    </button>
  );
}
