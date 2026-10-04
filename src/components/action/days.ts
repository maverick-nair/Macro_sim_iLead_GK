import { createContext, useContext } from 'react';
import type { PERIOD_UNITS, SUB_PERIOD_UNITS } from '../../engine/config';
import { useI18n } from '../../i18n';

/** The storyline's period ("Week 2") and the unit actions are paid in ("3 days left"). docs/SIMULATION.md 1.2. */
export type PeriodUnit = (typeof PERIOD_UNITS)[number];
export type SubPeriodUnit = (typeof SUB_PERIOD_UNITS)[number];

/**
 * The sub-period unit for every cost below it. Defaults to days, so tiles and drawers rendered
 * outside a provider keep today's text. The Actions panel provides the storyline's unit.
 */
export const SubPeriodUnitContext = createContext<SubPeriodUnit>('day');
export const useSubPeriodUnit = () => useContext(SubPeriodUnitContext);

/** ICU arguments for `action.days`: whole units plus an optional half ("1½ days", "½ week"). */
export const dayArgs = (days: number, unit: SubPeriodUnit = 'day') => ({ whole: Math.floor(days), half: days % 1 ? 'yes' : 'no', unit });

/**
 * Formats a cost in the sub-period unit: "No days", "½ day", "1 day", "1½ days", "2 days", or
 * "½ week", "2 weeks" for a month based storyline. The unit comes from the argument, then the
 * nearest SubPeriodUnitContext, then days.
 */
export function useDays(unit?: SubPeriodUnit): (days: number) => string {
  const { t } = useI18n();
  const fromContext = useSubPeriodUnit();
  const u = unit ?? fromContext;
  // Days keep the original catalog entry; the other units share one unit aware message.
  return days => t(u === 'day' ? 'action.days' : 'actions.cost', dayArgs(days, u));
}
