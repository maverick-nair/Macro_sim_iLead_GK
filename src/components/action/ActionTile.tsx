import { useId } from 'react';
import { useI18n } from '../../i18n';
import { useDays } from './days';

/** Live opens a conversation, hybrid is a decision then a conversation, static is an instant decision. */
export type ActionKind = 'live' | 'hybrid' | 'static';

/**
 * Why an action cannot be taken right now. The engine owns these rules; the tile only explains them.
 * `text` reasons come from the scenario ("Unlocks in week 3", "Cooldown: 6 days left").
 */
export type ActionBlock =
  | { reason: 'locked'; text: string }
  | { reason: 'cooldown'; text: string }
  | { reason: 'planned' }
  | { reason: 'away'; untilDay: number }
  | { reason: 'days'; need: number; have: number };

export interface ActionTileProps {
  name: string;
  kind: ActionKind;
  /** Day cost in half day steps. */
  days: number;
  /** Live actions: "About 6 minutes". */
  duration?: string;
  /** Present when the action is unavailable. */
  block?: ActionBlock;
  /** A sponsor reward that applies to this action now ("No days, one seat past a full team"). Shown in place of the sub line, unless blocked. */
  perk?: string;
  onPick: () => void;
  /** `panel`: the Actions panel, with the live, instant or lock icon. `compact`: the profile's "Take an action" column. */
  layout?: 'panel' | 'compact';
  /** The engine's action key, on the tile as `data-action` for the demo's tips (D92). */
  actionKey?: string;
}

const MicIcon = () => (
  <svg className="size-3.75" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><path d="M12 19v3" />
  </svg>
);
const BoltIcon = () => (
  <svg className="size-3.75" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" /></svg>
);
const LockIcon = () => (
  <svg className="size-3.75" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <rect width="16" height="10" x="4" y="11" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </svg>
);

/**
 * One action in the Actions panel or a profile: icon, name, a sub line (format or the reason it is
 * unavailable) and the day cost. An unavailable tile stays focusable (aria-disabled, not disabled)
 * so keyboard and screen reader users reach it and hear the reason as its description; mouse users
 * also get it as a tooltip.
 */
/** A tile's sub line: why it is unavailable, the sponsor reward, or its format. Shared with the tablet drawer's rows (D72). */
export function actionSub(t: ReturnType<typeof useI18n>['t'], fmt: (n: number) => string, { kind, duration, block, perk }: Pick<ActionTileProps, 'kind' | 'duration' | 'block' | 'perk'>): string {
  if (block?.reason === 'locked' || block?.reason === 'cooldown') return block.text;
  if (block?.reason === 'planned') return t('action.blocked.planned');
  if (block?.reason === 'away') return t('action.blocked.away', { day: block.untilDay });
  if (block?.reason === 'days') return t('action.blocked.days', { need: fmt(block.need), have: fmt(block.have) });
  if (perk) return perk;
  if (kind === 'live' && duration) return t('action.sub.liveDuration', { duration: duration.toLowerCase() });
  return t('action.sub', { kind });
}

export function ActionTile({ name, kind, days, duration, block, perk, onPick, layout = 'panel', actionKey }: ActionTileProps) {
  const { t } = useI18n();
  const fmt = useDays();
  const reasonId = useId();
  const disabled = !!block;
  const sub = actionSub(t, fmt, { kind, duration, block, perk });
  // "Planned today" is its own explanation; the other reasons are repeated as a tooltip.
  const tooltip = block && block.reason !== 'planned' ? sub : undefined;

  // aria-disabled keeps the button focusable and clickable, so the click is ignored here.
  const pick = () => { if (!disabled) onPick(); };

  const tone = disabled ? 'text-fg-secondary cursor-default' : 'text-fg-primary cursor-pointer';
  const focus = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-secondary';
  const text = (
    <>
      <span className={`flex flex-col ${layout === 'panel' ? 'min-w-0' : ''}`}>
        <b className="text-13">{name}</b>
        <span id={reasonId} className={`text-12 ${perk && !block ? 'font-700 text-status-gain' : 'text-fg-secondary'}`}>{sub}</span>
      </span>
      <span data-tour="action-cost" className="text-12 font-700 text-fg-secondary">{fmt(days)}</span>
    </>
  );

  if (layout === 'compact') {
    return (
      <button type="button" onClick={pick} aria-disabled={disabled || undefined} aria-describedby={disabled ? reasonId : undefined} title={tooltip}
        className={`grid grid-cols-(--il-action-tile-compact-columns) items-center gap-2 rounded-14 border border-line-default bg-surface-raised p-3 text-start ${tone} ${focus}`}>
        {text}
      </button>
    );
  }

  const icon = block?.reason === 'locked' ? <LockIcon /> : kind === 'static' ? <BoltIcon /> : <MicIcon />;
  const iconFill = disabled ? 'bg-track text-fg-secondary'
    : kind === 'static' ? 'bg-(image:--il-action-icon-instant) text-brand-deep-space' : 'bg-(image:--il-action-icon-live) text-brand-deep-space';
  return (
    <button type="button" onClick={pick} aria-disabled={disabled || undefined} aria-describedby={disabled ? reasonId : undefined} title={tooltip} data-action={actionKey}
      className={`grid grid-cols-(--il-action-tile-columns) items-center gap-2.5 rounded-14 border border-line-default bg-surface-raised px-2.5 py-2.25 text-start ${tone} ${disabled ? '' : 'hover:border-line-strong'} ${focus}`}>
      <span className={`flex size-7.5 items-center justify-center rounded-10 ${iconFill}`}>{icon}</span>
      {text}
    </button>
  );
}
