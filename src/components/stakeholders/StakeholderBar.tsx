import { NoWrapButton } from '../../ds/Button';
import { useI18n } from '../../i18n';

/** A stakeholder's relationship in one word (D160), as the engine sends it. */
export type RelationLevel = 'strained' | 'cool' | 'steady' | 'good' | 'strong';

export interface StakeholderChip {
  key: string;
  name: string;
  img: string | null;
  level: RelationLevel;
  /** What they asked for and by when, while it is open (D162). */
  request: { title: string; due: string } | null;
}

export interface StakeholderBarProps {
  items: StakeholderChip[];
  /** Opens the stakeholders panel, on one of them when a key is given. */
  onOpen: (key?: string) => void;
  /** Answers a stakeholder's open request. */
  onAnswer: (key: string) => void;
  disabled?: boolean;
}

const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-secondary';
/** The ring round a stakeholder's initials: how the relationship stands. */
export const LEVEL_RING: Record<RelationLevel, string> = {
  strained: 'border-status-decline', cool: 'border-status-attention', steady: 'border-line-strong', good: 'border-status-gain', strong: 'border-status-gain'
};
const initials = (name: string) => name.split(/\s+/).filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase();

/** A stakeholder's face: their portrait, or their initials, in a ring that shows the relationship. */
export function StakeholderFace({ name, img, level, size = 'sm' }: { name: string; img: string | null; level: RelationLevel; size?: 'sm' | 'lg' }) {
  const box = size === 'sm' ? 'size-6 text-11' : 'size-11 text-14';
  return (
    <span aria-hidden="true" className={`flex flex-none items-center justify-center overflow-hidden rounded-round border-2 bg-surface-raised font-700 text-fg-primary ${box} ${LEVEL_RING[level]}`}>
      {img ? <img src={img} alt="" className="size-full object-cover object-top" /> : initials(name)}
    </span>
  );
}

/**
 * Stakeholders on the board (D160 to D162): in the business row, one button with each stakeholder's face in a ring
 * that shows the relationship, which opens the stakeholders panel; then any request a stakeholder is waiting on,
 * with its deadline and Answer. Small and in the first load; the panel loads when opened.
 */
export function StakeholderBar({ items, onOpen, onAnswer, disabled }: StakeholderBarProps) {
  const { t } = useI18n();
  if (!items.length) return null;
  const names = items.map(s => t('board.stakeholders.person', { name: s.name, level: s.level })).join(t('board.stakeholders.separator'));
  return (
    <div data-stakeholder-bar="" className="flex flex-wrap items-center gap-1.5">
      <button type="button" onClick={() => onOpen()} aria-label={t('board.stakeholders.openAria', { names })} data-tour="stakeholders"
        className={`flex min-h-7 cursor-pointer items-center gap-1.5 rounded-pill border border-line-default bg-transparent ps-2.5 pe-1 text-13 text-fg-primary ${FOCUS}`}>
        <span className="text-12 font-700 text-fg-secondary">{t('board.stakeholders.title')}</span>
        <span className="flex -space-x-1.5">{items.map(s => <StakeholderFace key={s.key} name={s.name} img={s.img} level={s.level} />)}</span>
      </button>
      {items.filter(s => s.request).map(s => (
        <span key={s.key} data-stakeholder-request={s.key} className="flex items-center gap-2 rounded-pill bg-status-attention-soft py-0.5 ps-3 pe-1 text-13">
          <span><b>{t('board.stakeholders.asks', { name: s.name.split(' ')[0] })}</b> {s.request!.title} <span className="text-fg-secondary">{s.request!.due}</span></span>
          <NoWrapButton variant="secondary" size="sm" disabled={disabled} onClick={() => onAnswer(s.key)}>{t('board.stakeholders.answer')}<span className="sr-only"> {s.name}</span></NoWrapButton>
        </span>
      ))}
    </div>
  );
}
