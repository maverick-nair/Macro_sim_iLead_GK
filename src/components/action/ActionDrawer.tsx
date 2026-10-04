import { useEffect, useRef, type KeyboardEvent } from 'react';
import { Button, NoWrapButton } from '../../ds/Button';
import { useI18n } from '../../i18n';
import { Heading, type HeadingLevel } from '../Heading';
import type { ActionKind } from './ActionTile';
import { useDays } from './days';

export interface ActionOption {
  name: string;
  detail: string;
  /** The engine refuses this choice (a full stage): shown, with its reason in `detail`, but not selectable. */
  disabled?: boolean;
}

export interface OptionCardsProps {
  options: ActionOption[];
  /** Index of the chosen option, or null before one is chosen. */
  value: number | null;
  onChange: (index: number) => void;
}

/**
 * Radio cards for a static action's options. One tab stop for the group; arrow keys, Home and End
 * move and select, as in a native radio group.
 */
export function OptionCards({ options, value, onChange }: OptionCardsProps) {
  const { t } = useI18n();
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const enabled = options.map((o, i) => (o.disabled ? -1 : i)).filter(i => i >= 0);
  const tabStop = value ?? enabled[0] ?? 0;
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    // Arrow keys skip options that cannot be chosen, as a native radio group skips disabled radios.
    const at = enabled.indexOf(i), n = enabled.length;
    if (!n) return;
    const pos = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? (at + 1) % n
      : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? (at - 1 + n) % n
      : e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : -1;
    if (pos < 0) return;
    e.preventDefault();
    const next = enabled[pos];
    onChange(next);
    refs.current[next]?.focus();
  };
  return (
    <div role="radiogroup" aria-label={t('action.drawer.options')} className="flex flex-col gap-2">
      {options.map((o, i) => {
        const on = value === i;
        const ring = on ? 'border-accent-secondary' : 'border-line-default';
        return (
          <button key={i} ref={el => { refs.current[i] = el; }} type="button" role="radio" aria-checked={on} tabIndex={i === tabStop ? 0 : -1}
            aria-disabled={o.disabled || undefined} onClick={() => { if (!o.disabled) onChange(i); }} onKeyDown={e => onKeyDown(e, i)}
            className={`flex items-start ${o.disabled ? 'cursor-not-allowed border-dashed' : 'cursor-pointer border-solid'} gap-2.5 rounded-14 border-(length:--il-action-option-border-width) p-3 text-left text-fg-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-secondary ${ring} ${on ? 'bg-accent-soft' : 'bg-surface-raised'}`}>
            <span aria-hidden="true" className={`mt-0.25 flex size-4.5 flex-none items-center justify-center rounded-round border-2 border-solid ${ring}`}>
              <span className={`size-2 rounded-round ${on ? 'bg-accent-secondary' : 'bg-transparent'}`} />
            </span>
            <span className="flex flex-col"><b className="text-13">{o.name}</b><span className="text-12 text-fg-secondary">{o.detail}</span></span>
          </button>
        );
      })}
    </div>
  );
}

export interface PickedPerson {
  id: string;
  name: string;
  img: string;
}

/**
 * Who the action applies to. `pick`: the participant clicks people on the board, up to `max`, and
 * `limit` states the rule ("Up to 3 people"). `with`: a member action, fixed to that person.
 * `who`: a team action with no selection.
 */
export type ActionPeople = { mode: 'pick'; max: number; limit: string } | { mode: 'with' } | { mode: 'who' };

/** Soft prerequisite warning ("Assess before Swap"). The participant may go ahead without it. */
export interface ActionNudge {
  name: string;
  area: string;
  days: number;
  onAssess: () => void;
  onContinue: () => void;
}

export interface ActionDrawerProps {
  name: string;
  kind: ActionKind;
  days: number;
  description: string;
  options?: ActionOption[];
  option?: number | null;
  onOption?: (index: number) => void;
  people: ActionPeople;
  picks: PickedPerson[];
  nudge?: ActionNudge;
  /** What will happen and the day cost, in one line. */
  summary: string;
  /** `start` for live and hybrid actions, `composer` for email. */
  cta: 'confirm' | 'start' | 'composer';
  canConfirm: boolean;
  onConfirm: () => void;
  /** Level of the action name heading, so the page sets the outline. Defaults to 2 (it replaces the Actions panel's own heading). */
  headingLevel?: HeadingLevel;
  onBack: () => void;
}

/** The action flow that replaces the actions list once an action is chosen. */
export function ActionDrawer(p: ActionDrawerProps) {
  const { t } = useI18n();
  const fmt = useDays();
  // Focus moves to the drawer's heading when it opens, so keyboard and screen reader users land in the flow.
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, []);
  const pill = 'flex h-5.5 items-center rounded-pill px-2 text-12 font-700';
  const who = p.people.mode === 'pick' ? t('action.drawer.people', { count: p.picks.length, max: p.people.max })
    : p.people.mode === 'with' ? t('action.drawer.with') : t('action.drawer.who');
  return (
    <div className="flex flex-1 animate-(--il-action-drawer-enter) flex-col gap-3.5 overflow-auto px-4.5 py-4">
      <button type="button" onClick={p.onBack} className="cursor-pointer self-start border-0 bg-transparent p-0 text-13 font-600 text-fg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-secondary">{t('action.drawer.back')}</button>
      <div className="flex flex-col gap-1.5">
        <div className="flex gap-1.5"><span className={`${pill} bg-accent-soft`}>{t('action.kind', { kind: p.kind })}</span><span className={`${pill} bg-surface-raised`}>{fmt(p.days)}</span></div>
        <Heading ref={heading} tabIndex={-1} level={p.headingLevel ?? 2} className="m-0 text-22 font-700 tracking-(--il-action-drawer-title-tracking) outline-0">{p.name}</Heading>
        <span className="text-13 text-pretty text-fg-secondary">{p.description}</span>
      </div>
      {p.options && <OptionCards options={p.options} value={p.option ?? null} onChange={i => p.onOption?.(i)} />}
      <div className="flex flex-col gap-2">
        <span className="text-12 font-700 tracking-(--il-action-section-tracking) text-fg-secondary uppercase">{who}</span>
        {p.people.mode === 'pick' && <span className="text-13 text-fg-secondary">{t('action.drawer.pickHint', { limit: p.people.limit })}</span>}
        <div className="flex flex-wrap gap-1.5">
          {p.picks.map(pk => (
            <span key={pk.id} className="flex h-7.5 items-center gap-1.5 rounded-pill border border-line-default bg-surface-raised py-0 pr-2.5 pl-0.75 text-13 font-600 whitespace-nowrap">
              <img src={pk.img} alt="" className="size-6 rounded-round bg-brand-pale-lavender object-cover object-top" />{pk.name}
            </span>
          ))}
        </div>
      </div>
      {p.nudge && (
        <div role="note" className="flex flex-col gap-2 rounded-14 border border-status-attention bg-status-attention-soft p-3 text-13">
          <span className="text-pretty">{t('action.drawer.nudge', { name: p.nudge.name, area: p.nudge.area, cost: fmt(p.nudge.days) })}</span>
          <div className="flex gap-2">
            <NoWrapButton variant="secondary" size="sm" onClick={p.nudge.onAssess}>{t('action.drawer.assessFirst')}</NoWrapButton>
            <NoWrapButton variant="ghost" size="sm" onClick={p.nudge.onContinue}>{t('action.drawer.continue')}</NoWrapButton>
          </div>
        </div>
      )}
      <div aria-live="polite" className="mt-auto rounded-14 bg-surface-raised p-3 text-13 text-pretty">{p.summary}</div>
      <div className="w-full"><Button variant="primary" size="lg" disabled={!p.canConfirm} onClick={p.onConfirm}>{t('action.drawer.cta', { cta: p.cta })}</Button></div>
    </div>
  );
}
