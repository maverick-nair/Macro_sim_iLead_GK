import { useId } from 'react';
import { useI18n } from '../../i18n';
import type { PeriodUnit } from '../action/days';
import { MemberCard, type MemberCardProps } from '../member/MemberCard';
import { STYLE_KEYS } from '../style/StyleControl';

/** The line beside the heading: nobody selected, one person selected, or picking people for an action. */
export type TeamBoardHint = { kind: 'idle' } | { kind: 'selected'; name: string } | { kind: 'picking' };

export interface StageColumn {
  key: string;
  /** Stage name from the storyline ("Qualification"). */
  name: string;
  /** People in the stage now. */
  count: number;
  /** Ideal headcount from the storyline. */
  ideal: number;
  /** The stage holding the funnel back: says so in the attention style instead of the ideal. */
  bottleneck: boolean;
  cards: Array<MemberCardProps & { id: string }>;
}

export interface TeamBoardProps {
  hint: TeamBoardHint;
  legendOpen: boolean;
  onToggleLegend: () => void;
  /** The storyline's period: "Bottleneck this week", "Each month you choose...". */
  periodUnit: PeriodUnit;
  /** One per funnel stage, in order (3 to 6). */
  columns: StageColumn[];
}

/** Tailwind needs whole class names in the source; storylines have 3 to 6 stages. */
const GRID_COLS: Record<number, string> = { 1: 'grid-cols-1', 2: 'grid-cols-2', 3: 'grid-cols-3', 4: 'grid-cols-4', 5: 'grid-cols-5', 6: 'grid-cols-6' };

const HelpIcon = () => (
  <svg className="size-3.75" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><path d="M12 17h.01" />
  </svg>
);

/** Explains the four leadership style letters on the cards, from more support to more freedom. */
function StyleLegend({ id, periodUnit }: { id: string; periodUnit: PeriodUnit }) {
  const { t } = useI18n();
  return (
    <div id={id} role="dialog" aria-label={t('team.legend.title')}
      className="absolute top-full right-0 z-40 mt-2 flex w-(--il-team-legend-width) animate-(--il-team-legend-enter) flex-col gap-3 rounded-18 border border-line-strong bg-surface-material p-4 shadow-(--il-team-legend-shadow)">
      <span className="text-13 text-fg-secondary">{t('team.legend.intro', { unit: periodUnit })}</span>
      {STYLE_KEYS.map(k => (
        <div key={k} className="grid grid-cols-(--il-team-legend-columns) items-start gap-3">
          <span className="flex size-8 items-center justify-center rounded-round bg-brand font-700 text-brand-deep-space">{t('style.letter', { style: k })}</span>
          <span className="flex flex-col"><b>{t('style.name', { style: k })}</b><span className="text-13 text-fg-secondary">{t('style.description', { style: k })}</span></span>
        </div>
      ))}
      <div className="flex justify-between border-t border-line-default pt-1 text-12 text-fg-secondary"><span>{t('team.legend.support')}</span><span>{t('team.legend.freedom')}</span></div>
    </div>
  );
}

/** A stage header: name, headcount, then the ideal or, on the bottleneck, a warning. */
function StageHeader({ name, count, ideal, bottleneck, periodUnit }: Omit<StageColumn, 'cards' | 'key'> & { periodUnit: PeriodUnit }) {
  const { t, number } = useI18n();
  return (
    <div className={`flex flex-col gap-0.5 rounded-12 border px-3 py-2 ${bottleneck ? 'border-status-attention bg-status-attention-soft' : 'border-line-default bg-surface-card'}`}>
      <div className="flex items-baseline justify-between gap-1.5"><b className="truncate text-13">{name}</b><b className="text-15">{number(count)}</b></div>
      <span className={`text-12 ${bottleneck ? 'font-700 text-status-attention' : 'font-400 text-fg-secondary'}`}>
        {bottleneck ? t('team.stage.bottleneck', { unit: periodUnit }) : t('team.stage.ideal', { ideal })}
      </span>
    </div>
  );
}

/**
 * "Your team": the heading with what a click does now, the style legend, and one column of member
 * cards per funnel stage. The grid has as many equal columns as the storyline has stages.
 */
export function TeamBoard({ hint, legendOpen, onToggleLegend, periodUnit, columns }: TeamBoardProps) {
  const { t } = useI18n();
  const legendId = useId();
  const hintText = t('team.hint', { kind: hint.kind, name: hint.kind === 'selected' ? hint.name : '' });
  return (
    <section aria-label={t('team.title')} className="flex min-w-0 flex-col gap-3 px-5 pt-1 pb-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <h2 className="m-0 text-20 font-700 tracking-(--il-team-title-tracking)">{t('team.title')}</h2>
          <span aria-live="polite" className="text-13 text-fg-secondary">{hintText}</span>
        </div>
        <div className="relative">
          <button type="button" onClick={onToggleLegend} aria-expanded={legendOpen} aria-controls={legendOpen ? legendId : undefined}
            className="flex h-7.5 cursor-pointer items-center gap-1.5 rounded-pill border border-solid border-line-default bg-surface-card px-3 py-0 text-13 font-600 whitespace-nowrap text-fg-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-secondary">
            <HelpIcon />{t('team.legend.button')}
          </button>
          {legendOpen && <StyleLegend id={legendId} periodUnit={periodUnit} />}
        </div>
      </div>
      <div className={`grid gap-3 ${GRID_COLS[columns.length] ?? 'grid-cols-6'}`}>
        {columns.map(({ key, cards, ...col }) => (
          <div key={key} className="flex min-w-0 flex-col gap-2.5">
            <StageHeader {...col} periodUnit={periodUnit} />
            {cards.map(({ id, ...card }) => <MemberCard key={id} {...card} />)}
          </div>
        ))}
      </div>
    </section>
  );
}
