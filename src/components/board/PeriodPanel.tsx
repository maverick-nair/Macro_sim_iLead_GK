import type { EngineView, Intent } from '../../engine/contract';
import { Button } from '../../ds/Button';
import { useI18n } from '../../i18n';
import { StarMeter } from '../gamification/StarMeter';

export interface PeriodPanelProps {
  view: EngineView;
  busy: boolean;
  money: (n: number) => string;
  onIntent: (i: Intent) => void;
}

/**
 * The end of a period, or of the run, from engine values: stars, value earned, the sponsor's reward
 * offer and the way on. A plain stand in for the designed week end (M5) and end screen (M6).
 */
export function PeriodPanel({ view: v, busy, money, onIntent }: PeriodPanelProps) {
  const { t } = useI18n();
  const last = v.periods[v.periods.length - 1];
  const unit = v.clock.periodUnit;
  const stars = last ? Object.values(last.stars).filter(Boolean).length : 0;
  const ended = v.phase === 'ended';
  return (
    <div className="fixed inset-0 z-48 flex items-center justify-center bg-surface-scrim p-6 backdrop-blur-12">
      <div role="dialog" aria-modal="true" aria-labelledby="period-title" className="flex w-full max-w-(--il-board-panel-max-width) flex-col gap-4 rounded-26 border border-line-strong bg-surface-solid p-6">
        <h2 id="period-title" className="m-0 text-24 font-700">{ended ? t('board.ended.title') : t('board.periodEnd.title', { unit, n: last?.period ?? v.clock.period })}</h2>
        {last && (
          <div className="flex items-center gap-3">
            <StarMeter earned={stars} />
            <span className="text-14">{t('board.periodEnd.stars', { n: stars })}</span>
          </div>
        )}
        {last && <span className="text-14 text-fg-secondary">{t('board.periodEnd.value', { value: money(last.valueThisPeriod), unit })}</span>}
        {ended && (
          <div className="flex flex-col gap-1">
            <b className="text-18">{t('board.ended.score', { total: v.score.total, max: v.score.max })}</b>
            {v.score.tier && <span className="text-14 text-fg-secondary">{t('board.ended.tier', { tier: v.score.tier })}</span>}
          </div>
        )}
        {v.pendingReward ? (
          <div className="flex flex-col gap-2">
            <b className="text-14">{t('board.reward.title')}</b>
            {v.pendingReward.map(key => (
              <Button key={key} variant="secondary" size="md" disabled={busy} onClick={() => onIntent({ type: 'chooseReward', reward: key })}>{t('board.reward', { key })}</Button>
            ))}
          </div>
        ) : !ended && (
          <div className="flex justify-end">
            <Button variant="primary" size="md" disabled={busy} onClick={() => onIntent({ type: 'startNextPeriod' })}>{t('board.periodEnd.next', { unit, n: v.clock.period + 1 })}</Button>
          </div>
        )}
      </div>
    </div>
  );
}
