import type { ReactNode } from 'react';
import { useI18n } from '../../i18n';
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
}

const MicIcon = () => (
  <svg className="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" aria-hidden="true">
    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" />
  </svg>
);
const BoltIcon = () => (
  <svg className="size-3" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" /></svg>
);

const section = 'text-12 font-700 tracking-(--il-action-section-tracking) text-fg-secondary uppercase';

/**
 * The Actions card beside the board: capacity left, team actions, actions for the selected person
 * and a key to the icons. While an action is being planned the card shows that flow instead.
 * Every cost inside, including the drawer's, reads in the storyline's sub-period unit.
 */
export function ActionsPanel({ capacityLeft, capacity, subPeriodUnit, periodUnit = 'week', outOfCapacity, team, member, drawer }: ActionsPanelProps) {
  const { t } = useI18n();
  const fmt = useDays(subPeriodUnit);
  return (
    <aside aria-label={t('actions.title')} className="flex min-h-0 flex-col pt-1 pr-6 pb-6 pl-0">
      <div className="flex flex-1 flex-col overflow-hidden rounded-22 border border-line-default bg-surface-card backdrop-blur-14">
        <SubPeriodUnitContext.Provider value={subPeriodUnit}>
          {drawer ? drawer : (
            <div className="flex flex-1 flex-col gap-3.5 px-4.5 py-4">
              <div className="flex items-baseline justify-between">
                <h2 className="m-0 text-18 font-700">{t('actions.title')}</h2>
                <span className="text-12 text-fg-secondary">{t('time.left', { amount: fmt(capacityLeft) })}</span>
              </div>
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
