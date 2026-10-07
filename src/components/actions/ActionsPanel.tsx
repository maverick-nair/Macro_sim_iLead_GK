import type { ReactNode } from 'react';
import { useI18n } from '../../i18n';
import { Heading, type HeadingLevel } from '../Heading';
import { ActionTile, type ActionTileProps } from '../action/ActionTile';
import { SubPeriodUnitContext, useDays, type PeriodUnit, type SubPeriodUnit } from '../action/days';

export interface ActionsPanelMember {
  /** First name of the selected person: "For Kent". */
  firstName: string;
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
  /**
   * Makes the card collapsible (the board at 1024 wide, D58): a toggle in its header, and when
   * `collapsed` a slim rail with the number of actions open now, which expands on demand. Leave it
   * out for the fixed card (1440 and the design frames).
   */
  collapse?: ActionsPanelCollapse;
}

export interface ActionsPanelCollapse {
  collapsed: boolean;
  onToggle: () => void;
  /** Actions that can be taken now, for the rail. */
  open: number;
}

const MicIcon = () => (
  <svg className="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" aria-hidden="true">
    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" />
  </svg>
);
const BoltIcon = () => (
  <svg className="size-3" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" /></svg>
);

const Chevron = ({ to }: { to: 'left' | 'right' }) => (
  <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={to === 'left' ? 'm15 18-6-6 6-6' : 'm9 18 6-6-6-6'} />
  </svg>
);
const toggleClass = 'flex size-8 flex-none cursor-pointer items-center justify-center rounded-round border border-line-default bg-surface-raised p-0 text-fg-secondary hover:text-fg-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-secondary';

const section = 'text-12 font-700 tracking-(--il-action-section-tracking) text-fg-secondary uppercase';

/**
 * The Actions card beside the board: capacity left, team actions, actions for the selected person
 * and a key to the icons. While an action is being planned the card shows that flow instead.
 * Every cost inside, including the drawer's, reads in the storyline's sub-period unit.
 */
export function ActionsPanel({ capacityLeft, capacity, subPeriodUnit, periodUnit = 'week', outOfCapacity, team, member, drawer, headingLevel = 2, notes, collapse }: ActionsPanelProps) {
  const { t, number } = useI18n();
  const fmt = useDays(subPeriodUnit);

  if (collapse?.collapsed) {
    // The rail: one button that brings the card back, with how many actions are open and the time left.
    return (
      <aside aria-label={t('actions.title')} className="flex min-h-0 flex-col pt-1 pe-6 pb-6 ps-0">
        <div className="flex flex-1 flex-col overflow-hidden rounded-22 border border-line-default bg-surface-card backdrop-blur-14">
          <button type="button" aria-expanded={false} onClick={collapse.onToggle}
            aria-label={t('actions.rail.aria', { n: collapse.open, left: t('time.left', { amount: fmt(capacityLeft) }) })}
            className="flex flex-1 cursor-pointer flex-col items-center gap-3 rounded-22 border-0 bg-transparent px-1 py-4 text-fg-primary hover:bg-surface-raised focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent-secondary">
            <span className="flex size-8 items-center justify-center rounded-round border border-line-default bg-surface-raised text-fg-secondary"><Chevron to="left" /></span>
            <b className="flex min-h-8 min-w-8 items-center justify-center rounded-pill bg-accent-soft px-1.5 text-15">{number(collapse.open)}</b>
            <span className="text-13 font-700 [writing-mode:vertical-rl]">{t('actions.rail.label', { n: collapse.open })}</span>
          </button>
        </div>
      </aside>
    );
  }
  return (
    <aside aria-label={t('actions.title')} className="flex min-h-0 flex-col pt-1 pe-6 pb-6 ps-0">
      <div className="flex flex-1 flex-col overflow-hidden rounded-22 border border-line-default bg-surface-card backdrop-blur-14">
        <SubPeriodUnitContext.Provider value={subPeriodUnit}>
          {drawer ? drawer : (
            <div className="flex flex-1 flex-col gap-3.5 px-4.5 py-4">
              <div className="flex items-baseline justify-between">
                <Heading level={headingLevel} className="m-0 text-18 font-700">{t('actions.title')}</Heading>
                <span className={`text-12 text-fg-secondary ${collapse ? 'ms-auto' : ''}`}>{t('time.left', { amount: fmt(capacityLeft) })}</span>
                {collapse && (
                  <button type="button" aria-expanded={true} onClick={collapse.onToggle} aria-label={t('actions.collapse')} title={t('actions.collapse')}
                    className={`ms-2 self-center ${toggleClass}`}>
                    <Chevron to="right" />
                  </button>
                )}
              </div>
              {notes && notes.length > 0 && (
                <div className="-mt-2 flex flex-col items-end text-12">
                  {notes.map(n => <span key={n.text} className={n.tone === 'gain' ? 'font-700 text-status-gain' : 'text-fg-secondary'}>{n.text}</span>)}
                </div>
              )}
              {outOfCapacity && (
                <div role="status" className="flex flex-col gap-1 rounded-14 bg-surface-raised p-3 text-13">
                  <b>{t('actions.out.title', { amount: fmt(capacity) })}</b>
                  <span className="text-fg-secondary">{t('actions.out.body', { period: periodUnit, unit: subPeriodUnit })}</span>
                </div>
              )}
              <span className={section}>{t('actions.team')}</span>
              <div className="flex flex-col gap-1.5">
                {team.map((a, i) => <ActionTile key={i} {...a} />)}
              </div>
              <span className={`${section} pt-1`}>{member ? t('actions.member', { name: member.firstName }) : t('actions.member.none')}</span>
              {!member && <p className="m-0 text-13 text-fg-secondary">{t('actions.member.empty')}</p>}
              {member && (
                <div className="flex flex-col gap-1.5">
                  {member.tiles.map((a, i) => <ActionTile key={i} {...a} />)}
                </div>
              )}
              <div className="mt-auto flex flex-wrap gap-3 pt-1.5 text-12 text-fg-secondary">
                <span className="flex items-center gap-1"><MicIcon />{t('actions.legend.live')}</span>
                <span className="flex items-center gap-1"><BoltIcon />{t('actions.legend.instant')}</span>
              </div>
            </div>
          )}
        </SubPeriodUnitContext.Provider>
      </div>
    </aside>
  );
}
