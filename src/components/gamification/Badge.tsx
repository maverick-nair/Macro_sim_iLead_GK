import type { ReactNode } from 'react';
import { NoWrapButton } from '../../ds/Button';
import { useI18n } from '../../i18n';

/** `new` is earned this week (it gets the award popup); `locked` is not earned yet. */
export type BadgeStatus = 'earned' | 'new' | 'locked';

export interface BadgeChipProps {
  name: string;
  status: BadgeStatus;
  /** The rule for an earned badge, the hint for a locked one (never its rule). Shown on hover. */
  detail: string;
}

/** A badge on the shelf: medal dot and name. Locked badges are muted and only reveal their hint. */
export function BadgeChip({ name, status, detail }: BadgeChipProps) {
  const { t } = useI18n();
  const locked = status === 'locked';
  return (
    <span title={detail} className={`flex h-9 items-center gap-2 rounded-pill border border-line-default bg-surface-card py-0 pr-3.5 pl-1 text-13 font-700 ${locked ? 'text-fg-secondary' : 'text-fg-primary'}`}>
      <span aria-hidden="true" className={`size-7 rounded-round ${locked ? 'bg-track' : 'bg-(image:--il-fill-spectrum)'}`} />
      <span>{name}</span>
      <span className="sr-only">{t('gamification.badge.status', { status, detail })}</span>
    </span>
  );
}

export interface BadgeShelfProps {
  badges: BadgeChipProps[];
}

/** Every badge in the simulation, earned first as the engine orders them. */
export function BadgeShelf({ badges }: BadgeShelfProps) {
  return (
    <ul className="m-0 flex list-none flex-wrap gap-2.5 p-0">
      {badges.map(b => <li key={b.name} className="flex"><BadgeChip {...b} /></li>)}
    </ul>
  );
}

export interface BadgeAwardProps {
  name: string;
  /** What you did to earn it. Engine text. */
  reason: string;
  /** The badge artwork, drawn in the medal at 64 in the current color. */
  icon: ReactNode;
  /** This badge's place among the badges earned this week. */
  index: number;
  total: number;
  onSkip: () => void;
  onContinue: () => void;
}

/** The popup for a newly earned badge at week end. One at a time, skippable. */
export function BadgeAward({ name, reason, icon, index, total, onSkip, onContinue }: BadgeAwardProps) {
  const { t } = useI18n();
  return (
    <div role="dialog" aria-label={t('gamification.badge.awardAria')} className="flex w-115 max-w-full animate-(--il-gamification-badge-award-enter) flex-col items-center gap-3.5 rounded-30 border border-line-strong bg-surface-material p-8 text-center shadow-(--il-gamification-badge-award-shadow)">
      <div aria-hidden="true" className="flex size-35 items-center justify-center rounded-round bg-(image:--il-fill-spectrum) text-brand-deep-space shadow-(--il-gamification-badge-medal-ring)">{icon}</div>
      <span className="text-12 font-700 tracking-(--il-gamification-eyebrow-tracking) text-accent-secondary uppercase">{t('gamification.badge.awardCount', { index, total })}</span>
      <h2 className="m-0 text-30 font-700">{name}</h2>
      <p className="m-0 text-fg-secondary">{reason}</p>
      <div className="flex gap-2.5">
        <NoWrapButton variant="ghost" size="md" onClick={onSkip}>{t('gamification.badge.skip')}</NoWrapButton>
        <NoWrapButton variant="primary" size="md" onClick={onContinue}>{t('gamification.badge.continue')}</NoWrapButton>
      </div>
    </div>
  );
}
