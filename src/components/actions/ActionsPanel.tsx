import type { ReactNode } from 'react';
import { useI18n } from '../../i18n';
import { Heading, type HeadingLevel } from '../Heading';
import { ActionTile, type ActionTileProps } from '../action/ActionTile';
import { SubPeriodUnitContext, useDays, type PeriodUnit, type SubPeriodUnit } from '../action/days';

export interface ActionsPanelMember {
  /** First name of the selected person: "For Kent". */
  firstName: string;
  /** Their full name and face, over their actions (D232). */
  name?: string;
  img?: string;
  /** Opens their profile, from the panel's header as the canvas has it. */
  onProfile?: () => void;
  tiles: ActionTileProps[];
}

export interface ActionsPanelProps {
  /** Capacity left this period, in sub-periods (half steps allowed). */
  capacityLeft: number;
  /** Capacity per period, in sub-periods. */
  capacity: number;
  /** The unit actions are paid in: "2½ days left", "Needs 1 week". Passed down to the tiles and the drawer. */
  subPeriodUnit: SubPeriodUnit;
  /** The storyline's period, for "locked until next week". Defaults to week. */
  periodUnit?: PeriodUnit;
  /** All capacity used: shows the notice. Tiles carry their own blocked state. */
  outOfCapacity: boolean;
  team: ActionTileProps[];
  /** The selected person and their actions, or null when nobody is selected. */
  member: ActionsPanelMember | null;
  /** The open action flow (ActionDrawer). Replaces the lists while present. */
  drawer?: ReactNode;
  /** Level of the "Actions" heading, so the page sets the outline. Defaults to 2. */
  headingLevel?: HeadingLevel;
  /**
   * Short lines under the capacity left about what changed it this period: a bonus day from the
   * sponsor (`gain`), a CEO check in that took one (`neutral`). The design frames pass none.
   */
  notes?: Array<{ text: string; tone: 'gain' | 'neutral' }>;
  /** Opens the list of every action (D97): an info button beside the heading. */
  onAbout?: () => void;
  /**
   * Makes the card collapsible (the board at 1024 wide, D58): a toggle in its header, and when
   * `collapsed` a slim rail with the number of actions open now, which expands on demand. Leave it
   * out for the fixed card (1440 and the design frames).
   */
  collapse?: ActionsPanelCollapse;
  /** Live conversations used this period against the cap (D232: the canvas shows it over the actions). */
  live?: { used: number; cap: number };
}

export interface ActionsPanelCollapse {
  collapsed: boolean;
  onToggle: () => void;
  /** Actions that can be taken now, for the rail. */
  open: number;
}


const Chevron = ({ to }: { to: 'left' | 'right' }) => (
  <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={to === 'left' ? 'm15 18-6-6 6-6' : 'm9 18 6-6-6-6'} />
  </svg>
);
const InfoIcon = () => (
  <svg className="size-3.75" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" />
  </svg>
);
const toggleClass = 'flex size-11 flex-none cursor-pointer items-center justify-center rounded-4 border border-line-strong bg-transparent p-0 text-fg-secondary hover:text-fg-primary focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accent-secondary';

const section = 'text-12 font-600 tracking-(--il-desk-band-eyebrow-tracking) text-fg-body uppercase';

/**
 * The Actions card beside the board: capacity left, team actions, actions for the selected person
 * and a key to the icons. While an action is being planned the card shows that flow instead.
 * Every cost inside, including the drawer's, reads in the storyline's sub-period unit.
 */
export function ActionsPanel({ capacityLeft, capacity, subPeriodUnit, periodUnit = 'week', outOfCapacity, team, member, drawer, headingLevel = 2, notes, collapse, onAbout, live }: ActionsPanelProps) {
  const { t, number } = useI18n();
  const fmt = useDays(subPeriodUnit);

  if (collapse?.collapsed) {
    // The rail: one button that brings the card back, with how many actions are open and the time left.
    return (
      <aside aria-label={t('actions.title')} className="flex min-h-0 flex-1 flex-col">
        <div className="flex flex-1 flex-col overflow-hidden border border-line-strong bg-surface-card">
          <button type="button" aria-expanded={false} onClick={collapse.onToggle}
            aria-label={t('actions.rail.aria', { n: collapse.open, left: t('time.left', { amount: fmt(capacityLeft) }) })}
            className="flex flex-1 cursor-pointer flex-col items-center gap-3 rounded-4 border-0 bg-transparent px-1 py-4 text-fg-primary hover:bg-surface-raised focus-visible:outline-3 focus-visible:-outline-offset-2 focus-visible:outline-accent-secondary">
            <span className="flex size-8 items-center justify-center rounded-round border border-line-default bg-surface-raised text-fg-secondary"><Chevron to="left" /></span>
            <b className="flex min-h-8 min-w-8 items-center justify-center rounded-4 bg-accent-soft px-1.5 text-15">{number(collapse.open)}</b>
            <span className="text-13 font-600 [writing-mode:vertical-rl]">{t('actions.rail.label', { n: collapse.open })}</span>
          </button>
        </div>
      </aside>
    );
  }
  const subRow = (a: ActionTileProps, i: number) => <li key={i}><ActionTile {...a} layout="row" /></li>;
  return (
    <aside aria-label={t('actions.title')} data-tour="actions" className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-1 flex-col overflow-hidden border border-line-strong bg-surface-card">
        <SubPeriodUnitContext.Provider value={subPeriodUnit}>
          {drawer ? drawer : (
            <>
              <div className="flex flex-none items-center gap-2.5 border-b border-line-default px-3.5 py-2">
                {member?.img && <img src={member.img} alt="" className="size-10 flex-none rounded-round bg-(image:--il-fill-portrait-calm) object-cover object-top" />}
                <Heading level={headingLevel} className="m-0 flex min-w-0 flex-1 flex-col font-400">
                  {member ? <>
                    <span className="text-12 text-fg-body">{t('actions.for')}</span>
                    <b className="truncate text-15 font-600">{member.name ?? member.firstName}</b>
                  </> : <b className="text-15 font-600">{t('actions.title')}</b>}
                </Heading>
                {onAbout && !member && (
                  <button type="button" onClick={onAbout} aria-label={t('actions.about')} title={t('actions.about')}
                    className="flex size-8 cursor-pointer items-center justify-center rounded-round border-0 bg-transparent p-0 text-fg-secondary hover:text-fg-primary focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accent-secondary">
                    <InfoIcon />
                  </button>
                )}
                {member?.onProfile && (
                  <button type="button" onClick={member.onProfile} aria-label={t('member.profile.open', { name: member.name ?? member.firstName })}
                    className="min-h-11 flex-none cursor-pointer rounded-4 border border-line-strong bg-transparent px-2.5 text-13 font-500 text-fg-primary hover:border-line-control focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accent-secondary">
                    {t('actions.profile')}
                  </button>
                )}
                {collapse && (
                  <button type="button" aria-expanded={true} onClick={collapse.onToggle} aria-label={t('actions.collapse')} title={t('actions.collapse')}
                    className={`self-center ${toggleClass}`}>
                    <Chevron to="right" />
                  </button>
                )}
              </div>
              <div className="flex flex-none flex-col gap-0.5 border-b border-line-default bg-surface-page px-3.5 py-1.5 text-12 text-fg-body">
                {live
                  ? <span className="flex justify-between gap-2"><span>{t('actions.live', { unit: periodUnit })}</span><b className="font-mono font-500 text-fg-primary">{t('actions.live.used', { used: number(live.used), cap: number(live.cap) })}</b></span>
                  : null}
                <span className="flex justify-between gap-2"><span>{t('actions.days', { unit: periodUnit })}</span><b className="font-mono font-500 text-fg-primary">{t('time.left', { amount: fmt(capacityLeft) })}</b></span>
                {notes && notes.map(n => <span key={n.text} className={n.tone === 'gain' ? 'font-600 text-status-gain' : ''}>{n.text}</span>)}
              </div>
              {outOfCapacity && (
                <div role="status" className="flex flex-none flex-col gap-1 border-b border-line-default bg-status-attention-soft px-3.5 py-2.5 text-13">
                  <b>{t('actions.out.title', { amount: fmt(capacity) })}</b>
                  <span className="text-fg-body">{t('actions.out.body', { period: periodUnit, unit: subPeriodUnit })}</span>
                </div>
              )}
              {member ? (
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                  <ul aria-label={t('actions.member', { name: member.firstName })} className="m-0 list-none p-0">{member.tiles.map(subRow)}</ul>
                </div>
              ) : (
                // Nothing to press here: when the outcome band leaves the panel short, the words scroll, and the
                // keyboard can scroll them (WCAG 2.1.1).
                <div role="region" aria-label={t('actions.title')} tabIndex={0}
                  className="min-h-0 flex-1 overflow-y-auto overscroll-contain focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-accent-secondary">
                  <p className="m-0 px-3.5 py-3 text-13 text-fg-body">{t('actions.member.empty')}</p>
                </div>
              )}
              <div className="flex-none border-t border-line-strong bg-surface-material pb-1">
                <span aria-hidden="true" className={`block px-3.5 pt-2 pb-0.5 ${section}`}>{t('actions.team')}</span>
                <ul aria-label={t('actions.team.aria')} className="m-0 list-none p-0">{team.map(subRow)}</ul>
              </div>
            </>
          )}
        </SubPeriodUnitContext.Provider>
      </div>
    </aside>
  );
}
