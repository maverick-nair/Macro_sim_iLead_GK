import * as Dialog from '@radix-ui/react-dialog';
import { useRef } from 'react';
import type { EngineView, Intent } from '../../engine/contract';
import { Button } from '../../ds/Button';
import { useI18n } from '../../i18n';
import { StarMeter } from '../gamification/StarMeter';

export interface PeriodPanelProps {
  view: EngineView;
  busy: boolean;
  money: (n: number) => string;
  onIntent: (i: Intent) => void;
  /**
   * The run is over: closes the panel to the board, read only (the report comes in M6). Escape
   * does the same. Without it the ended panel has no way on.
   */
  onClose?: () => void;
  /** Where focus goes after the panel closes. Defaults to Radix's (the element focused before). */
  onCloseFocus?: () => void;
}

/**
 * The end of a period, or of the run, from engine values: stars, value earned, the sponsor's reward
 * offer and the way on. A plain stand in for the designed week end (M5) and end screen (M6).
 * A modal dialog (Radix): focus moves to its title, stays inside, and the board behind is inert.
 * Escape does nothing at a period end, where a choice is needed to go on.
 */
export function PeriodPanel({ view: v, busy, money, onIntent, onClose, onCloseFocus }: PeriodPanelProps) {
  const { t } = useI18n();
  const title = useRef<HTMLHeadingElement>(null);
  const last = v.periods[v.periods.length - 1];
  const unit = v.clock.periodUnit;
  const stars = last?.week.stars ?? 0;
  const ended = v.phase === 'ended';
  const close = ended ? onClose : undefined;
  return (
    <Dialog.Root open onOpenChange={o => { if (!o) close?.(); }}>
      <Dialog.Overlay className="fixed inset-0 z-48 flex items-center justify-center bg-surface-scrim p-6 backdrop-blur-12">
        <Dialog.Content
          aria-describedby={undefined} aria-modal="true"
          onOpenAutoFocus={e => { e.preventDefault(); title.current?.focus({ preventScroll: true }); }}
          onCloseAutoFocus={e => { if (onCloseFocus) { e.preventDefault(); onCloseFocus(); } }}
          onEscapeKeyDown={e => { if (!close) e.preventDefault(); }}
          onPointerDownOutside={e => e.preventDefault()}
          className="flex max-h-full w-full max-w-(--il-board-panel-max-width) flex-col gap-4 overflow-auto rounded-26 border border-line-strong bg-surface-solid p-6 outline-0">
          <Dialog.Title ref={title} tabIndex={-1} className="m-0 text-24 font-700 outline-0">{ended ? t('board.ended.title') : t('board.periodEnd.title', { unit, n: last?.period ?? v.clock.period })}</Dialog.Title>
          {last && (
            <div className="flex items-center gap-3">
              <StarMeter earned={stars} />
              <span className="text-14">{t('board.periodEnd.stars', { n: stars })}</span>
            </div>
          )}
          {last && <span className="text-14 text-fg-secondary">{t('board.periodEnd.value', { value: money(last.valueThisPeriod), unit })}</span>}
          {ended && (
            <div className="flex flex-col gap-1">
              <b className="text-18">{t('board.ended.score', { total: Math.round(v.score.total), max: Math.round(v.score.max) })}</b>
              {v.score.tier && <span className="text-14 text-fg-secondary">{t('board.ended.tier', { tier: v.score.tier.name })}</span>}
            </div>
          )}
          {v.pendingReward && (
            <div className="flex flex-col gap-2">
              <b className="text-14">{t('board.reward.title')}</b>
              {v.pendingReward.map(key => (
                <Button key={key} variant="secondary" size="md" disabled={busy} onClick={() => onIntent({ type: 'chooseReward', reward: key })}>{t('board.reward', { key })}</Button>
              ))}
            </div>
          )}
          {ended && close && (
            <div className="flex flex-col gap-3">
              <span className="text-14 text-fg-secondary">{t('board.ended.readOnly')}</span>
              <div className="flex justify-end">
                <Button variant="primary" size="md" onClick={close}>{t('board.ended.close')}</Button>
              </div>
            </div>
          )}
          {!ended && !v.pendingReward && (
            <div className="flex justify-end">
              <Button variant="primary" size="md" disabled={busy} onClick={() => onIntent({ type: 'startNextPeriod' })}>{t('board.periodEnd.next', { unit, n: v.clock.period + 1 })}</Button>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Overlay>
    </Dialog.Root>
  );
}
