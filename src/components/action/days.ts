import { useI18n } from '../../i18n';

/** ICU arguments for `action.days`: whole days plus an optional half ("1½ days"). */
export const dayArgs = (days: number) => ({ whole: Math.floor(days), half: days % 1 ? 'yes' : 'no' });

/** Formats a day cost: "No days", "½ day", "1 day", "1½ days", "2 days". */
export function useDays(): (days: number) => string {
  const { t } = useI18n();
  return days => t('action.days', dayArgs(days));
}
