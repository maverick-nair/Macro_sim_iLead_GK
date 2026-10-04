import * as Dialog from '@radix-ui/react-dialog';
import { useRef } from 'react';
import type { EngineView } from '../../engine/contract';
import { Button } from '../../ds/Button';
import { useI18n } from '../../i18n';
import { StarMeter } from '../gamification/StarMeter';

export interface PeriodPanelProps {
  view: EngineView;
  money: (n: number) => string;
  /** Closes the panel to the board, read only (the report comes in M6). Escape does the same. */
  onClose: () => void;
  /** Where focus goes after the panel closes. Defaults to Radix's (the element focused before). */
  onCloseFocus?: () => void;
}

/**
 * The end of the run, after the last week end: the last period's stars and value, the Leadership
 * Score and tier, and the way to the read only board. A plain stand in for the end screen (M6).
 * A modal dialog (Radix): focus moves to its title, stays inside, and the board behind is inert.
 */
export function PeriodPanel({ view: v, money, onClose, onCloseFocus }: PeriodPanelProps) {
  const { t } = useI18n();
  const title = useRef<HTMLHeadingElement>(null);
  const last = v.periods[v.periods.length - 1];
  const unit = v.clock.periodUnit;
  const stars = last?.week.stars ?? 0;
  return (
    <Dialog.Root open onOpenChange={o => { if (!o) onClose(); }}>
      <Dialog.Overlay className="fixed inset-0 z-48 flex items-center justify-center bg-surface-scrim p-6 backdrop-blur-12">
        <Dialog.Content
          aria-describedby={undefined} aria-modal="true"
          onOpenAutoFocus={e => { e.preventDefault(); title.current?.focus({ preventScroll: true }); }}
          onCloseAutoFocus={e => { if (onCloseFocus) { e.preventDefault(); onCloseFocus(); } }}
          onPointerDownOutside={e => e.preventDefault()}
          className="flex max-h-full w-full max-w-(--il-board-panel-max-width) flex-col gap-4 overflow-auto rounded-26 border border-line-strong bg-surface-solid p-6 outline-0">
          <Dialog.Title ref={title} tabIndex={-1} className="m-0 text-24 font-700 outline-0">{t('board.ended.title')}</Dialog.Title>
          {last && (
            <div className="flex items-center gap-3">
              <StarMeter earned={stars} />
              <span className="text-14">{t('board.ended.stars', { n: stars })}</span>
            </div>
          )}
          {last && <span className="text-14 text-fg-secondary">{t('board.ended.value', { value: money(last.valueThisPeriod), unit })}</span>}
          <div className="flex flex-col gap-1">
            <b className="text-18">{t('board.ended.score', { total: Math.round(v.score.total), max: Math.round(v.score.max) })}</b>
            {v.score.tier && <span className="text-14 text-fg-secondary">{t('board.ended.tier', { tier: v.score.tier.name })}</span>}
          </div>
          <div className="flex flex-col gap-3">
            <span className="text-14 text-fg-secondary">{t('board.ended.readOnly')}</span>
            <div className="flex justify-end">
              <Button variant="primary" size="md" onClick={onClose}>{t('board.ended.close')}</Button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Overlay>
    </Dialog.Root>
  );
}
