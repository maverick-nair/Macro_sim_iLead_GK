import * as ToggleGroup from '@radix-ui/react-toggle-group';
import { useId, useState, type KeyboardEvent, type MouseEvent } from 'react';
import type { StyleKey } from '../../data/types';
import { useI18n } from '../../i18n';

export const STYLE_KEYS: readonly StyleKey[] = ['D', 'G', 'P', 'E'];

/** Board cards use the compact control; the style setting screen uses the roomier one. */
const SIZES = {
  sm: { segment: 'min-h-6.5 text-12', tip: 'w-52.5 shadow-(--il-style-tooltip-shadow)' },
  md: { segment: 'min-h-7.5 text-13', tip: 'w-50' }
} as const;

export interface StyleTooltipProps {
  style: StyleKey;
  /** Which edge of the segment the tooltip lines up with, so it never hangs off the card. */
  align: 'start' | 'end';
  size?: 'sm' | 'md';
}

/** Full name and meaning of a style, shown above a segment on hover or focus. */
export function StyleTooltip({ style, align, size = 'sm' }: StyleTooltipProps) {
  const { t } = useI18n();
  const place = align === 'start' ? 'left-0' : 'left-full -translate-x-full';
  return (
    <div role="tooltip" className={`absolute bottom-full z-45 mb-2.5 flex flex-col gap-0.5 rounded-12 bg-(--il-style-tooltip-bg) px-3 py-2.5 text-(color:--il-style-tooltip-fg) pointer-events-none ${place} ${SIZES[size].tip}`}>
      <b className="text-13">{t('style.name', { style })}</b>
      <span className="text-12 leading-(--il-style-tooltip-leading)">{t('style.description', { style })}</span>
    </div>
  );
}

export interface StyleControlProps {
  /** Null before a style is chosen for this period. */
  value: StyleKey | null;
  onChange: (style: StyleKey) => void;
  /** Names the group for screen readers: "Leadership style for Kent Goldberg". */
  memberName: string;
  size?: 'sm' | 'md';
  /**
   * The style whose tooltip is open. Pass it (with onTooltipChange) to control the tooltip, for
   * example to raise the surrounding card while it shows; leave it out and the control keeps its own.
   */
  tooltip?: StyleKey | null;
  onTooltipChange?: (style: StyleKey | null) => void;
  /**
   * The style can no longer change (the period's styles are locked). The letters stay focusable and
   * keep their tooltips, so screen reader users find the control and hear why, but picking does
   * nothing. Marked with aria-disabled, dimmed, and described by `disabledReason`.
   */
  disabled?: boolean;
  /** Why the style cannot change ("Styles are set until the next week."), read as each letter's description. */
  disabledReason?: string;
  /** A letter was picked (click, Enter or Space) while disabled, so the page can say why, for example in a toast. */
  onDisabledPick?: () => void;
}

/**
 * The D, G, P, E segmented control. A Radix toggle group in single mode: a radiogroup with one tab
 * stop, arrow keys move between letters (showing each tooltip on focus), Enter or Space picks.
 * Picking never clears the choice, and clicks never reach a parent card.
 */
export function StyleControl({ value, onChange, memberName, size = 'sm', tooltip, onTooltipChange, disabled = false, disabledReason, onDisabledPick }: StyleControlProps) {
  const { t } = useI18n();
  const reasonId = useId();
  const described = disabled && disabledReason ? reasonId : undefined;
  const [own, setOwn] = useState<StyleKey | null>(null);
  const tip = tooltip === undefined ? own : tooltip;
  const setTip = (next: StyleKey | null) => {
    if (tooltip === undefined) setOwn(next);
    onTooltipChange?.(next);
  };
  const show = (k: StyleKey) => () => setTip(k);
  const hide = (k: StyleKey) => () => { if (tip === k) setTip(null); };
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && tip) setTip(null); };
  const stop = (e: MouseEvent) => e.stopPropagation();

  return (
    <ToggleGroup.Root
      type="single"
      value={value ?? ''}
      onValueChange={v => {
        if (disabled) onDisabledPick?.();
        else if (v && v !== value) onChange(v as StyleKey);
      }}
      aria-label={t('style.group.aria', { name: memberName })}
      aria-disabled={disabled || undefined}
      onClick={stop}
      className={`grid grid-cols-4 gap-0.5 rounded-pill border border-line-default bg-surface-raised p-0.5 ${disabled ? 'opacity-60' : ''}`}
    >
      {STYLE_KEYS.map((k, i) => {
        const on = value === k;
        return (
          <div key={k} className="relative">
            <ToggleGroup.Item
              value={k}
              aria-label={t('style.option.aria', { style: t('style.name', { style: k }), description: t('style.description', { style: k }) })}
              aria-disabled={disabled || undefined}
              aria-describedby={described}
              onMouseEnter={show(k)}
              onMouseLeave={hide(k)}
              onFocus={show(k)}
              onBlur={hide(k)}
              onKeyDown={onKey}
              className={`w-full ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'} rounded-pill border-0 p-0 font-700 [transition:var(--il-style-segment-transition)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent-secondary ${SIZES[size].segment} ${on ? 'bg-transparent bg-(image:--il-fill-brand) text-brand-deep-space' : 'bg-transparent text-fg-secondary'}`}
            >
              {t('style.letter', { style: k })}
            </ToggleGroup.Item>
            {tip === k && <StyleTooltip style={k} align={i < 2 ? 'start' : 'end'} size={size} />}
          </div>
        );
      })}
      {described && <span id={reasonId} className="sr-only">{disabledReason}</span>}
    </ToggleGroup.Root>
  );
}

export interface StyleRadioProps {
  style: StyleKey;
  memberName: string;
  /** Shared by the four radios of one member, so arrow keys move within that row. */
  name: string;
  checked: boolean;
  onSelect: (style: StyleKey) => void;
}

/** One cell of the style setting list view: a native radio, the fastest path for keyboards and screen readers. */
export function StyleRadio({ style, memberName, name, checked, onSelect }: StyleRadioProps) {
  const { t } = useI18n();
  return (
    <label className="flex cursor-pointer justify-center">
      <input
        type="radio"
        name={name}
        checked={checked}
        onChange={() => onSelect(style)}
        aria-label={t('style.option.for', { style: t('style.name', { style }), name: memberName })}
        className="size-5 cursor-pointer accent-brand-electric-blue"
      />
    </label>
  );
}
