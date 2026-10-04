import * as Dialog from '@radix-ui/react-dialog';
import { useRef } from 'react';
import { Button } from '../../ds/Button';
import { useI18n } from '../../i18n';
import type { PeriodUnit } from '../action/days';
import { badgeIcon } from './badgeIcons';
import { shelfOrder, type ShelfBadge } from './display';

export interface BadgeListProps {
  /** Every badge in the storyline (`view.badges`). */
  badges: ShelfBadge[];
  periodUnit: PeriodUnit;
}

/**
 * The badges, earned first: the medal with its icon, the name, what earned it and when. A badge not
 * earned yet is dimmed and shows its description as the hint.
 */
export function BadgeList({ badges, periodUnit }: BadgeListProps) {
  const { t } = useI18n();
  return (
    <ul className="m-0 flex list-none flex-col gap-2 p-0">
      {shelfOrder(badges).map(b => (
        <li key={b.key} className={`flex items-start gap-3 rounded-16 border border-line-default p-2.5 ${b.earned ? 'bg-surface-raised' : 'bg-transparent'}`}>
          <span aria-hidden="true" className={`flex size-10 flex-none items-center justify-center rounded-round ${b.earned ? 'bg-(image:--il-fill-spectrum) text-brand-deep-space' : 'bg-track text-fg-secondary'}`}>
            <span className="size-5">{badgeIcon(b.rule)}</span>
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5 text-13">
            <span className="flex flex-wrap items-baseline justify-between gap-x-2">
              <b className={b.earned ? 'text-fg-primary' : 'text-fg-secondary'}>{b.name}</b>
              <span className="text-12 text-fg-secondary">{b.earned && b.period !== null ? t('badges.earnedIn', { unit: periodUnit, n: b.period }) : t('badges.notYet')}</span>
            </span>
            <span className="text-fg-secondary">{b.earned ? b.reason ?? b.description : b.description}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

export interface BadgeShelfDialogProps extends BadgeListProps {
  onClose: () => void;
  /** Where focus goes when the shelf closes; defaults to the element focused before it opened. */
  returnFocus?: () => HTMLElement | null | undefined;
}

/**
 * The badge shelf, opened from the score breakdown. A Radix modal dialog: focus moves to its
 * title, Tab stays inside, Escape and Close shut it, and focus goes back to the score.
 */
export function BadgeShelfDialog({ badges, periodUnit, onClose, returnFocus }: BadgeShelfDialogProps) {
  const { t } = useI18n();
  const title = useRef<HTMLHeadingElement>(null);
  const earned = badges.filter(b => b.earned).length;
  return (
    <Dialog.Root open onOpenChange={o => { if (!o) onClose(); }}>
      <Dialog.Overlay className="fixed inset-0 z-48 flex items-center justify-center bg-surface-scrim p-6 backdrop-blur-12">
        <Dialog.Content
          aria-modal="true"
          onOpenAutoFocus={e => { e.preventDefault(); title.current?.focus({ preventScroll: true }); }}
          onCloseAutoFocus={e => { const el = returnFocus?.(); if (el) { e.preventDefault(); el.focus({ preventScroll: true }); } }}
          className="flex max-h-full w-full max-w-(--il-board-panel-max-width) animate-(--il-event-card-enter) flex-col gap-3 overflow-hidden rounded-26 border border-line-strong bg-surface-solid p-6 shadow-(--il-event-card-shadow) outline-0">
          <div className="flex items-baseline justify-between gap-3">
            <Dialog.Title ref={title} tabIndex={-1} className="m-0 text-22 font-700 outline-0">{t('badges.title')}</Dialog.Title>
            <Dialog.Description className="m-0 text-13 text-fg-secondary">{t('badges.count', { earned, total: badges.length })}</Dialog.Description>
          </div>
          {earned === 0 && <p className="m-0 text-13 text-fg-secondary">{t('badges.none')}</p>}
          {/* The list scrolls inside the dialog on a short window; it is focusable so the keyboard can scroll it. */}
          <div role="region" aria-label={t('badges.title')} tabIndex={0} className="-mx-1 min-h-0 overflow-auto px-1 focus-visible:outline-2 focus-visible:outline-accent-secondary">
            <BadgeList badges={badges} periodUnit={periodUnit} />
          </div>
          <div className="flex justify-end">
            <Button variant="primary" size="md" onClick={onClose}>{t('badges.close')}</Button>
          </div>
        </Dialog.Content>
      </Dialog.Overlay>
    </Dialog.Root>
  );
}
