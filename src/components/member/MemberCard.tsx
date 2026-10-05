import { lazy, Suspense, useState, type MouseEvent } from 'react';
import type { MoodKey, StyleKey } from '../../data/types';
import { useI18n } from '../../i18n';
import { LOW_BELOW, MetricBar } from '../metric/MetricBar';
import { StyleControl } from '../style/StyleControl';

export const MOOD_DOT: Record<MoodKey, string> = {
  happy: 'bg-member-mood-happy',
  neutral: 'bg-member-mood-neutral',
  thinking: 'bg-member-mood-thinking',
  concerned: 'bg-member-mood-concerned',
  frustrated: 'bg-member-mood-frustrated'
};

/** Away members read grey; strained moods warm the backdrop so trouble shows before any number. */
export function backdrop(mood: MoodKey, away: boolean): string {
  if (away) return 'bg-(image:--il-member-portrait-away)';
  return mood === 'frustrated' || mood === 'concerned' ? 'bg-(image:--il-member-portrait-strained)' : 'bg-(image:--il-member-portrait-calm)';
}

const RING_R = 16;
const RING_C = 2 * Math.PI * RING_R;

export interface TrustRingProps {
  value: number;
  /**
   * `corner` pins the ring to the bottom right of a positioned parent. `inline` is a flex item, as
   * on the member card, where it shares a row with the mood pill.
   */
  placement?: 'corner' | 'inline';
}

/** Trust on the portrait: a ring on the shared 0 to 100 scale, amber under 30. One image named "Trust 64". */
export function TrustRing({ value, placement = 'corner' }: TrustRingProps) {
  const { t, number } = useI18n();
  const label = t('member.trust', { value });
  const dash = `${(value / 100 * RING_C).toFixed(1)} ${RING_C.toFixed(1)}`;
  return (
    <div role="img" title={label} aria-label={label} className={`size-(--il-member-ring-size) ${placement === 'inline' ? 'relative ml-auto flex-none' : 'absolute right-1.5 bottom-1.5'}`}>
      <svg className="block size-full" viewBox="0 0 38 38" aria-hidden="true">
        <circle cx="19" cy="19" r={RING_R} className="fill-member-ring-fill stroke-member-ring-track" strokeWidth="3" />
        <circle cx="19" cy="19" r={RING_R} fill="none" className={value < LOW_BELOW ? 'stroke-member-ring-low' : 'stroke-member-ring-ok'} strokeWidth="3" strokeLinecap="round" strokeDasharray={dash} transform="rotate(-90 19 19)" />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-12 font-700 text-member-on-portrait">{number(value)}</span>
    </div>
  );
}

export const Check = () => (
  <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
);
export const Chat = () => (
  <svg className="size-3.25" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
);
export const Clock = () => (
  <svg className="size-3.25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
);
const External = () => (
  <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M15 3h6v6" /><path d="M10 14 21 3" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /></svg>
);

const signal = 'flex size-6 items-center justify-center rounded-round bg-member-signal text-member-signal-fg';

const MemberRow = lazy(() => import('./MemberRow').then(m => ({ default: m.MemberRow })));

export interface MemberCardProps {
  name: string;
  /** Job title, from scenario data. */
  title: string;
  img: string;
  mood: MoodKey;
  /** Away in training: grey portrait, "In training" pill. */
  away?: boolean;
  skill: number;
  morale: number;
  result: number;
  trust: number;
  /** Null while the participant has not chosen a style for this period. */
  style: StyleKey | null;
  /** Stats stay hidden until the participant first opens the profile (spec, member card). */
  statsHidden?: boolean;
  /** Status tags from the engine, such as "New hire". */
  tags?: readonly string[];
  /** Shows the unread message chip. */
  unread?: boolean;
  /** Text of an open promise ("Career talk due Friday"); shows the clock chip with it as a tooltip. */
  promise?: string;
  /** Selected on the board, or picked for the action being planned. */
  selected?: boolean;
  /** Set while picking people for an action and this member cannot take part: dims the card and says why. */
  unavailableReason?: string;
  onSelect: () => void;
  onOpenProfile: () => void;
  onStyleChange: (style: StyleKey) => void;
  /** Open style tooltip. Controlled when passed; the card rises above its neighbours while one shows. */
  styleTooltip?: StyleKey | null;
  onStyleTooltipChange?: (style: StyleKey | null) => void;
  /** The style can no longer change this period (locked): the control stays readable but picking does nothing. */
  styleDisabled?: boolean;
  /** Why, read as the style letters' description ("Styles are set until the next week."). */
  styleDisabledReason?: string;
  /** A letter was picked while the style is disabled (to say why, for example in a toast). */
  onStyleDisabledPick?: () => void;
  /**
   * `card`: the board's card (1440 and 1024). `row`: a phone's team list, one tappable row per person
   * (portrait, name and role that wrap, mood, style, signals and the trust ring). The row has no
   * profile button or style control of its own: on a phone, tapping it opens the person's actions and
   * profile in a sheet, and the style is set on the style setting screen.
   */
  layout?: 'card' | 'row';
  /**
   * Row only. `open`: the row opens the person's sheet (selected shows as current). `toggle`: picking
   * people for an action, the row is a toggle button (aria-pressed).
   */
  rowAction?: 'open' | 'toggle';
}

/**
 * A team member on the board: portrait with mood, signals and trust, then name, title, tags, the
 * three metric bars and the style control. The whole card is one button that selects the member.
 */
export function MemberCard(props: MemberCardProps) {
  const { name, title, img, mood, away = false, skill, morale, result, trust, style, statsHidden = false, tags = [], unread = false, promise, selected = false, unavailableReason, onSelect, onOpenProfile, onStyleChange, styleTooltip, onStyleTooltipChange, styleDisabled = false, styleDisabledReason, onStyleDisabledPick } = props;
  const { t } = useI18n();
  const [ownTip, setOwnTip] = useState<StyleKey | null>(null);
  const tip = styleTooltip === undefined ? ownTip : styleTooltip;
  const setTip = (k: StyleKey | null) => {
    if (styleTooltip === undefined) setOwnTip(k);
    onStyleTooltipChange?.(k);
  };

  const unavailable = unavailableReason !== undefined && unavailableReason !== '';
  const moodName = t('member.mood', { mood });
  const pill = away ? t('member.mood.away') : moodName;
  const aria = t('member.card.aria', { name, title, mood: moodName, skill, morale, result, trust, hidden: String(statsHidden), available: String(!unavailable), reason: unavailableReason ?? '' });
  const profile = (e: MouseEvent) => { e.stopPropagation(); onOpenProfile(); };

  // The phone's row loads with the phone board.
  if (props.layout === 'row') return <Suspense><MemberRow {...props} /></Suspense>;

  // The card is a plain container so the profile button and style control are not nested inside a
  // button (WCAG 4.1.2). A visually hidden toggle carries selection for keyboard and screen readers;
  // a click anywhere on the card selects too, and the card draws the toggle's focus ring.
  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- pointer convenience; keyboard selection is the hidden toggle below
    <div
      onClick={onSelect}
      title={unavailable ? unavailableReason : undefined}
      className={`relative flex flex-col rounded-18 border-2 bg-surface-card backdrop-blur-12 outline-offset-3 [transition:var(--il-member-card-transition)] hover:-translate-y-0.75 focus-within-select:outline-2 focus-within-select:outline-accent-secondary ${selected ? 'border-accent-secondary shadow-(--il-member-card-shadow-selected)' : 'border-line-default shadow-(--il-member-card-shadow)'} ${unavailable ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'} ${tip ? 'z-20' : 'z-1'}`}
    >
      <button type="button" aria-pressed={selected} aria-label={aria} aria-disabled={unavailable || undefined} onClick={e => { e.stopPropagation(); onSelect(); }} className="il-select sr-only" />
      <div className={`relative h-29.5 overflow-hidden rounded-t-16 ${backdrop(mood, away)}`}>
        <img src={img} alt="" className={`absolute inset-0 size-full object-cover object-(--il-member-portrait-position) mix-blend-multiply ${away ? 'grayscale' : ''}`} />
        <div className="absolute inset-0 bg-(image:--il-member-portrait-overlay)" />
        {selected && <span aria-hidden="true" className="absolute top-2 left-2 flex size-6 items-center justify-center rounded-round bg-(image:--il-fill-brand) text-brand-deep-space"><Check /></span>}
        <div className="absolute top-2 right-2 flex gap-1">
          {unread && <span title={t('member.unread')} className={signal}><Chat /></span>}
          {promise && <span title={promise} className={signal}><Clock /></span>}
        </div>
        {/*
          The mood pill and the trust ring share the bottom of the portrait (pill 8px in, ring 6px in).
          When both do not fit on one row (narrow cards, such as a 1024 wide board) the ring moves up
          above the pill instead of covering it, and a pill wider than the card truncates.
        */}
        <div className="absolute right-1.5 bottom-1.5 left-2 flex flex-wrap-reverse items-start gap-1">
          <span title={pill} className="mb-0.5 flex min-h-5.5 min-w-0 items-center gap-1.25 rounded-pill bg-member-pill px-2 text-12 font-700 text-member-on-portrait">
            <span className={`size-1.75 flex-none rounded-round ${MOOD_DOT[mood]}`} />
            <span className="truncate text-large:whitespace-normal text-large:break-words">{pill}</span>
          </span>
          {!statsHidden && <TrustRing value={trust} placement="inline" />}
        </div>
      </div>
      <div className="flex flex-col gap-2 px-3 pt-2.5 pb-3">
        {/*
          Name and title truncate beside the profile button. On cards too narrow to leave the name
          64px (a 1024 wide board), the button moves to its own row so the name gets the full width.
        */}
        <div className="flex flex-wrap items-start justify-between gap-1.5">
          <div className="flex min-w-16 flex-1 basis-0 flex-col">
            <b title={name} className="truncate text-14 text-large:whitespace-normal text-large:break-words">{name}</b>
            <span title={title} className="truncate text-12 text-fg-secondary text-large:whitespace-normal text-large:break-words">{title}</span>
          </div>
          <button
            type="button"
            onClick={profile}
            aria-label={t('member.profile.open', { name })}
            className="ml-auto flex size-7 flex-none cursor-pointer items-center justify-center rounded-round border border-line-default bg-surface-raised p-0 text-fg-secondary hover:text-fg-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-secondary"
          >
            <External />
          </button>
        </div>
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {tags.map((tag, i) => <span key={i} className="flex min-h-5 items-center rounded-pill border border-line-default bg-surface-raised px-2 text-12 font-600 whitespace-nowrap">{tag}</span>)}
          </div>
        )}
        {statsHidden ? (
          <p className="m-0 flex min-h-(--il-member-hidden-stats-height) items-center text-12 text-fg-secondary">{t('member.stats.hidden')}</p>
        ) : (
          <div className="flex flex-col gap-1.25">
            <MetricBar metric="skill" value={skill} />
            <MetricBar metric="morale" value={morale} />
            <MetricBar metric="result" value={result} />
          </div>
        )}
        <StyleControl value={style} onChange={onStyleChange} memberName={name} tooltip={tip} onTooltipChange={setTip} disabled={styleDisabled} disabledReason={styleDisabledReason} onDisabledPick={onStyleDisabledPick} />
      </div>
    </div>
  );
}
