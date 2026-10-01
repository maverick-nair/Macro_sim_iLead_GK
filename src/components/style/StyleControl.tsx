import * as ToggleGroup from '@radix-ui/react-toggle-group';
import { useState, type KeyboardEvent, type MouseEvent } from 'react';
import type { StyleKey } from '../../data/types';
import { useI18n } from '../../i18n';

export const STYLE_KEYS: readonly StyleKey[] = ['D', 'G', 'P', 'E'];

/** Board cards use the compact control; the style setting screen uses the roomier one. */
const SIZES = {
  sm: { segment: 'h-6.5 text-12', tip: 'w-52.5 shadow-(--il-style-tooltip-shadow)' },
  md: { segment: 'h-7.5 text-13', tip: 'w-50' }
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
  value: StyleKey;
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
}

/**
 * The D, G, P, E segmented control. A Radix toggle group in single mode: a radiogroup with one tab
 * stop, arrow keys move between letters (showing each tooltip on focus), Enter or Space picks.
 * Picking never clears the choice, and clicks never reach a parent card.
 */
export function StyleControl({ value, onChange, memberName, size = 'sm', tooltip, onTooltipChange }: StyleControlProps) {
  const { t } = useI18n();
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
      value={value}
      onValueChange={v => { if (v && v !== value) onChange(v as StyleKey); }}
      aria-label={t('style.group.aria', { name: memberName })}
      onClick={stop}
      className="grid grid-cols-4 gap-0.5 rounded-pill border border-line-default bg-surface-raised p-0.5"
    >
      {STYLE_KEYS.map((k, i) => {
        const on = value === k;
        return (
          <div key={k} className="relative">
            <ToggleGroup.Item
              value={k}
              aria-label={t('style.option.aria', { style: t('style.name', { style: k }), description: t('style.description', { style: k }) })}
              onMouseEnter={show(k)}
              onMouseLeave={hide(k)}
              onFocus={show(k)}
              onBlur={hide(k)}
              onKeyDown={onKey}
              className={`w-full cursor-pointer rounded-pill border-0 p-0 font-700 [transition:var(--il-style-segment-transition)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent-secondary ${SIZES[size].segment} ${on ? 'bg-transparent bg-(image:--il-fill-brand) text-brand-deep-space' : 'bg-transparent text-fg-secondary'}`}
            >
              {t('style.letter', { style: k })}
            </ToggleGroup.Item>
            {tip === k && <StyleTooltip style={k} align={i < 2 ? 'start' : 'end'} size={size} />}
          </div>
        );
      })}
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
