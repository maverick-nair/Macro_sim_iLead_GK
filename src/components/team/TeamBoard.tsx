import { useId, useState } from 'react';
import { useI18n } from '../../i18n';
import type { PeriodUnit } from '../action/days';
import { Heading, type HeadingLevel } from '../Heading';
import { MemberCard, type MemberCardProps } from '../member/MemberCard';
import { useLens } from '../style/lens';

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
  /** What the stage does and which skills suit it (D97): an info button on the header opens them. */
  about?: string | null;
  suits?: string | null;
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
  /** Level of the "Your team" heading, so the page sets the outline. Defaults to 2. */
  headingLevel?: HeadingLevel;
  /** Opens the result and stage overviews (D96, 1.0's two buttons on the board). Left out on the design frames. */
  onOverview?: () => void;
}

/** Tailwind needs whole class names in the source; storylines have 3 to 6 stages. */
const GRID_COLS: Record<number, string> = { 1: 'grid-cols-1', 2: 'grid-cols-2', 3: 'grid-cols-3', 4: 'grid-cols-4', 5: 'grid-cols-5', 6: 'grid-cols-6' };

const ChartIcon = () => (
  <svg className="size-3.75" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true">
    <path d="M3 3v18h18" /><path d="M7 15v2" /><path d="M11 11v6" /><path d="M15 7v10" /><path d="M19 12v5" />
  </svg>
);
const HelpIcon = () => (
  <svg className="size-3.75" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><path d="M12 17h.01" />
  </svg>
);

/** Explains the lens's style letters on the cards, from more support to more freedom. */
function StyleLegend({ id, periodUnit }: { id: string; periodUnit: PeriodUnit }) {
  const { t } = useI18n();
  const lens = useLens();
  return (
    <div id={id} role="dialog" aria-label={t('team.legend.title')}
      className={`absolute top-full end-0 z-40 mt-2 w-(--il-team-legend-width) shadow-(--il-team-legend-shadow) flex animate-(--il-team-legend-enter) flex-col gap-3 rounded-18 border border-line-strong bg-surface-material p-4`}>
      <span className="text-13 text-fg-secondary">{lens.id === 'readiness_based' ? t('team.legend.intro', { unit: periodUnit }) : t('team.legend.introLens', { unit: periodUnit, count: lens.styles.length })}</span>
      {lens.styles.map(s => (
        <div key={s.key} className="grid grid-cols-(--il-team-legend-columns) items-start gap-3">
          <span className={`flex size-8 items-center justify-center rounded-round bg-brand font-700 text-brand-deep-space ${s.letter.length > 1 ? 'text-12' : ''}`}>{s.letter}</span>
          <span className="flex flex-col"><b>{s.name}</b><span className="text-13 text-fg-secondary">{s.description}</span></span>
        </div>
      ))}
      {/* Readiness Based styles run from more support to more freedom; other lenses have no such order. */}
      {lens.id === 'readiness_based' && <div className="flex justify-between border-t border-line-default pt-1 text-12 text-fg-secondary"><span>{t('team.legend.support')}</span><span>{t('team.legend.freedom')}</span></div>}
    </div>
  );
}

const InfoIcon = () => (
  <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" />
  </svg>
);

/**
 * A stage header: name, headcount, then the ideal or, on the bottleneck, a warning. With stage info from
 * the storyline (D97), an info button opens what the stage does and which skills suit it; Escape or the
 * button again closes it.
 */
export function StageHeader({ name, count, ideal, bottleneck, periodUnit, about, suits, alignEnd = false }: Omit<StageColumn, 'cards' | 'key'> & { periodUnit: PeriodUnit; alignEnd?: boolean }) {
  const { t, number } = useI18n();
  const [info, setInfo] = useState(false);
  const infoId = useId();
  const hasInfo = !!(about || suits);
  return (
    <div data-tour="stage" className={`relative flex flex-col gap-0.5 rounded-12 border px-3 py-2 short:py-1.5 ${bottleneck ? 'border-status-attention bg-status-attention-soft' : 'border-line-default bg-surface-card'}`}>
      <div className="flex items-baseline justify-between gap-1.5">
        <b title={name} className="min-w-0 truncate text-13 text-large:whitespace-normal text-large:break-words">{name}</b>
        <span className="flex flex-none items-center gap-1">
          {hasInfo && (
            <button type="button" aria-expanded={info} aria-controls={info ? infoId : undefined} aria-label={t('team.stage.info', { stage: name })} onClick={() => setInfo(v => !v)}
              onKeyDown={e => { if (e.key === 'Escape' && info) { e.stopPropagation(); setInfo(false); } }}
              data-tour="stage-info"
              className="flex size-6 cursor-pointer items-center justify-center self-center rounded-round border-0 bg-transparent p-0 text-fg-secondary hover:text-fg-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-secondary">
              <InfoIcon />
            </button>
          )}
          <b className="text-15">{number(count)}</b>
        </span>
      </div>
      {info && (
        <div id={infoId} role="note" className={`absolute top-full ${alignEnd ? 'end-0' : 'start-0'} z-40 mt-2 flex w-(--il-team-legend-width) max-w-(--il-panel-notice-width) flex-col gap-1.5 rounded-16 border border-line-strong bg-surface-material p-3.5 text-13 shadow-(--il-team-legend-shadow)`}>
          <b className="text-14">{name}</b>
          {about && <span>{about}</span>}
          {suits && <span className="text-fg-secondary"><b className="text-fg-primary">{t('team.stage.suits')}</b> {suits}</span>}
        </div>
      )}
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
export function TeamBoard({ hint, legendOpen, onToggleLegend, periodUnit, columns, headingLevel = 2, onOverview }: TeamBoardProps) {
  const { t } = useI18n();
  const lens = useLens();
  const legendId = useId();
  // "D, G, P and E": the lens's letters.
  const ls = lens.styles.map(s => s.letter);
  const letters = ls.length < 2 ? ls.join('') : ls.slice(0, -1).join(t('team.legend.listSeparator')) + t('team.legend.listAnd') + ls[ls.length - 1];
  const hintText = t('team.hint', { kind: hint.kind, name: hint.kind === 'selected' ? hint.name : '' });

  return (
    <section aria-label={t('team.title')} className="flex min-w-0 flex-col gap-3 px-5 pt-1 pb-6 short:gap-2 short:pb-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <Heading level={headingLevel} className="m-0 text-20 font-700 tracking-(--il-team-title-tracking) short:text-17">{t('team.title')}</Heading>
          <span aria-live="polite" className="text-13 text-fg-secondary">{hintText}</span>
        </div>
        <div className="relative flex items-center gap-2">
          {onOverview && (
            <button type="button" onClick={onOverview} data-tour="overview"
              className="flex min-h-7.5 cursor-pointer items-center gap-1.5 rounded-pill border border-solid border-line-default bg-surface-card px-3 py-0 text-13 font-600 whitespace-nowrap text-fg-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-secondary">
              <ChartIcon />{t('team.overview')}
            </button>
          )}
          <button type="button" onClick={onToggleLegend} aria-expanded={legendOpen} aria-controls={legendOpen ? legendId : undefined}
            className="flex min-h-7.5 cursor-pointer items-center gap-1.5 rounded-pill border border-solid border-line-default bg-surface-card px-3 py-0 text-13 font-600 whitespace-nowrap text-fg-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-secondary">
            <HelpIcon />{t('team.legend.button', { letters })}
          </button>
          {legendOpen && <StyleLegend id={legendId} periodUnit={periodUnit} />}
        </div>
      </div>
      <div className={`grid gap-3 short:gap-2 ${GRID_COLS[columns.length] ?? 'grid-cols-6'}`}>
        {columns.map(({ key, cards, ...col }, i) => (
          <div key={key} className="flex min-w-0 flex-col gap-2.5 short:gap-2">
            <StageHeader {...col} periodUnit={periodUnit} alignEnd={i >= columns.length / 2} />
            {cards.map(({ id, ...card }) => <MemberCard key={id} memberId={id} {...card} />)}
          </div>
        ))}
      </div>
    </section>
  );
}
