import { useId, useState, type ReactNode } from 'react';
import { useI18n } from '../../i18n';
import type { PeriodUnit } from '../action/days';
import { Heading, type HeadingLevel } from '../Heading';
import { MemberCard, type MemberCardProps } from '../member/MemberCard';
import { DeskCard, type DeskCardInfo } from '../desk/DeskCard';
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
  /**
   * The stage's output this period against its ideal (D216, the engine's `throughput` and `idealThroughput`):
   * shown as words and a bar. Left out on the design frames, which show the headcount and its ideal.
   */
  output?: { n: number; ideal: number };
  /** On the desk (D232) each card also carries its style by name, a flag and the time spent this period. */
  cards: Array<MemberCardProps & { id: string; desk?: DeskCardInfo }>;
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
  /**
   * The desk as the approved canvas draws it (D232): a quiet heading with what the funnel shows, and the compact
   * desk cards. The design frames keep the member cards and the legend.
   */
  desk?: boolean;
  /** On the desk, the button that opens the funnel pop-up (D242), which holds what the stage headers used to. */
  funnel?: ReactNode;
  /**
   * Everyone sells end to end (D243): the team as one grid of people, not columns by stage. Each card carries what
   * they have closed against their own target; the stages live in the funnel pop-up.
   */
  people?: boolean;
}

/** The people grid's columns (D243): five to a row up to ten people, six beyond. */
const PEOPLE_COLS = (n: number) => (n > 10 ? 'grid-cols-6' : 'grid-cols-5');

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
      className={`absolute top-full end-0 z-40 mt-2 w-(--il-team-legend-width) shadow-(--il-team-legend-shadow) flex animate-(--il-team-legend-enter) flex-col gap-3 rounded-4 border border-line-strong bg-surface-material p-4`}>
      <span className="text-13 text-fg-secondary">{lens.id === 'readiness_based' ? t('team.legend.intro', { unit: periodUnit }) : t('team.legend.introLens', { unit: periodUnit, count: lens.styles.length })}</span>
      {lens.styles.map(s => (
        <div key={s.key} className="grid grid-cols-(--il-team-legend-columns) items-start gap-3">
          <span className={`flex size-8 items-center justify-center rounded-round bg-brand font-600 text-button-on-solid ${s.letter.length > 1 ? 'text-12' : ''}`}>{s.letter}</span>
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

/** The stage info button and its note (D97): what the stage does and which skills suit it. */
function StageInfo({ name, about, suits, alignEnd }: { name: string; about?: string | null; suits?: string | null; alignEnd: boolean }) {
  const { t } = useI18n();
  const [info, setInfo] = useState(false);
  const infoId = useId();
  if (!about && !suits) return null;
  return (
    <>
      <button type="button" aria-expanded={info} aria-controls={info ? infoId : undefined} aria-label={t('team.stage.info', { stage: name })} onClick={() => setInfo(v => !v)}
        onKeyDown={e => { if (e.key === 'Escape' && info) { e.stopPropagation(); setInfo(false); } }}
        data-tour="stage-info"
        className="flex size-6 flex-none cursor-pointer items-center justify-center self-center rounded-round border-0 bg-transparent p-0 text-fg-secondary hover:text-fg-primary focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accent-secondary">
        <InfoIcon />
      </button>
      {info && (
        <div id={infoId} role="note" className={`absolute top-full ${alignEnd ? 'end-0' : 'start-0'} z-40 mt-2 flex w-(--il-team-legend-width) max-w-(--il-panel-notice-width) flex-col gap-1.5 rounded-4 border border-line-strong bg-surface-material p-3.5 text-13 shadow-(--il-team-legend-shadow)`}>
          <b className="text-14">{name}</b>
          {about && <span>{about}</span>}
          {suits && <span className="text-fg-secondary"><b className="text-fg-primary">{t('team.stage.suits')}</b> {suits}</span>}
        </div>
      )}
    </>
  );
}

/**
 * The engine board's stage header (D216, the approved canvas): the stage's output this period against its
 * ideal, in words and as a bar, and how many people work in it. The bottleneck says so in words beside a
 * "!" mark and takes a heavier border, so it never rests on colour alone. Screen readers hear one line with
 * all of it.
 */
function FunnelHeader({ name, count, ideal, bottleneck, periodUnit, about, suits, output, alignEnd }: Omit<StageColumn, 'cards' | 'key' | 'output'> & { periodUnit: PeriodUnit; output: { n: number; ideal: number }; alignEnd: boolean }) {
  const { t, number } = useI18n();
  const n = Math.round(output.n), goal = Math.round(output.ideal);
  const share = goal > 0 ? Math.max(0, Math.min(1, output.n / output.ideal)) : 0;
  return (
    <div data-tour="stage" data-bottleneck={bottleneck ? '' : undefined}
      className={`relative flex flex-col gap-1 px-2.5 py-1.75 short:gap-0.5 short:py-1.5 ${bottleneck ? 'border-2 border-(--il-color-canvas-orange-700) bg-status-attention-soft' : 'border border-line-strong bg-surface-card'}`}>
      <span className="sr-only">{t('desk.stage.outputAria', { stage: name, n, ideal: goal, unit: periodUnit, bottleneck: bottleneck ? 'yes' : 'no', people: count, ideal2: ideal })}</span>
      <div className="flex min-h-6 items-start gap-1.5">
        <b aria-hidden="true" className={`min-w-0 flex-1 py-0.5 text-13 font-600 break-words whitespace-normal ${bottleneck ? 'text-status-attention' : ''}`}>{name}</b>
        <StageInfo name={name} about={about} suits={suits} alignEnd={alignEnd} />
      </div>
      {/* The flag has its own line, so a long stage name never splits around it. */}
      {bottleneck && <span aria-hidden="true" className="flex items-center gap-0.5 text-12 font-600 text-status-attention"><b>!</b>{t('desk.stage.bottleneck')}</span>}
      <span aria-hidden="true" className="flex min-w-0 flex-wrap items-baseline gap-x-2 text-12 text-fg-body">
        <span className="whitespace-nowrap font-mono text-16 text-fg-primary text-large:whitespace-normal">{number(n)} <span className="text-12 text-fg-body">{t('desk.stage.of', { ideal: number(goal) })}</span></span>
        <span className="whitespace-nowrap text-large:whitespace-normal text-large:break-words">{t('desk.stage.people', { n: count })}</span>
      </span>
      <span aria-hidden="true" className="block h-1.25 bg-track">
        <span className={`block h-full ${bottleneck ? 'bg-(--il-color-canvas-orange-700)' : 'bg-accent-default'}`} style={{ width: `${Math.round(share * 100)}%` }} />
      </span>
    </div>
  );
}

/** The column's label on the desk (D242): the stage's name and headcount, and "Bottleneck" in words on that stage. */
function StageLabel({ name, count, bottleneck }: { name: string; count: number; bottleneck: boolean }) {
  const { t } = useI18n();
  return (
    <div data-tour="stage" data-bottleneck={bottleneck ? '' : undefined}
      className={`flex min-h-8 items-center gap-2 border-b-2 px-1 text-13 ${bottleneck ? 'border-status-attention text-status-attention' : 'border-fg-primary'}`}>
      <h3 className="m-0 min-w-0 flex-1 truncate text-13 font-600 text-large:whitespace-normal">{name}</h3>
      {bottleneck && <b className="text-12 font-600 whitespace-nowrap">{t('desk.stage.bottleneck')}</b>}
      <span className={`text-12 whitespace-nowrap ${bottleneck ? '' : 'text-fg-body'}`}>{t('desk.stage.people', { n: count })}</span>
    </div>
  );
}

/**
 * A stage header: name, headcount, then the ideal or, on the bottleneck, a warning. With stage info from
 * the storyline (D97), an info button opens what the stage does and which skills suit it; Escape or the
 * button again closes it.
 */
export function StageHeader({ name, count, ideal, bottleneck, periodUnit, about, suits, output, alignEnd = false }: Omit<StageColumn, 'cards' | 'key'> & { periodUnit: PeriodUnit; alignEnd?: boolean }) {
  const { t, number } = useI18n();
  const [info, setInfo] = useState(false);
  const infoId = useId();
  const hasInfo = !!(about || suits);
  if (output) return <FunnelHeader {...{ name, count, ideal, bottleneck, periodUnit, about, suits, output, alignEnd }} />;
  return (
    <div data-tour="stage" className={`relative flex flex-col gap-0.5 rounded-4 border px-3 py-2 short:py-1.5 ${bottleneck ? 'border-status-attention bg-status-attention-soft' : 'border-line-default bg-surface-card'}`}>
      <div className="flex items-start justify-between gap-1.5">
        <b className="min-w-0 text-13 break-words whitespace-normal">{name}</b>
        <span className="flex flex-none items-center gap-1">
          {hasInfo && (
            <button type="button" aria-expanded={info} aria-controls={info ? infoId : undefined} aria-label={t('team.stage.info', { stage: name })} onClick={() => setInfo(v => !v)}
              onKeyDown={e => { if (e.key === 'Escape' && info) { e.stopPropagation(); setInfo(false); } }}
              data-tour="stage-info"
              className="flex size-6 cursor-pointer items-center justify-center self-center rounded-round border-0 bg-transparent p-0 text-fg-secondary hover:text-fg-primary focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accent-secondary">
              <InfoIcon />
            </button>
          )}
          <b className="text-15">{number(count)}</b>
        </span>
      </div>
      {info && (
        <div id={infoId} role="note" className={`absolute top-full ${alignEnd ? 'end-0' : 'start-0'} z-40 mt-2 flex w-(--il-team-legend-width) max-w-(--il-panel-notice-width) flex-col gap-1.5 rounded-4 border border-line-strong bg-surface-material p-3.5 text-13 shadow-(--il-team-legend-shadow)`}>
          <b className="text-14">{name}</b>
          {about && <span>{about}</span>}
          {suits && <span className="text-fg-secondary"><b className="text-fg-primary">{t('team.stage.suits')}</b> {suits}</span>}
        </div>
      )}
      <span className={`text-12 ${bottleneck ? 'font-600 text-status-attention' : 'font-400 text-fg-secondary'}`}>
        {bottleneck ? t('team.stage.bottleneck', { unit: periodUnit }) : t('team.stage.ideal', { ideal })}
      </span>
    </div>
  );
}

/**
 * "Your team": the heading with what a click does now, the style legend, and one column of member
 * cards per funnel stage. The grid has as many equal columns as the storyline has stages.
 */
export function TeamBoard({ hint, legendOpen, onToggleLegend, periodUnit, columns, headingLevel = 2, onOverview, desk = false, funnel, people = false }: TeamBoardProps) {
  const { t } = useI18n();
  const lens = useLens();
  const legendId = useId();
  // "D, G, P and E": the lens's letters.
  const ls = lens.styles.map(s => s.letter);
  const letters = ls.length < 2 ? ls.join('') : ls.slice(0, -1).join(t('team.legend.listSeparator')) + t('team.legend.listAnd') + ls[ls.length - 1];
  const hintText = t('team.hint', { kind: hint.kind, name: hint.kind === 'selected' ? hint.name : '' });

  if (desk) return (
    <section aria-label={t('team.title')} className="flex min-w-0 flex-1 flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3 text-large:flex-wrap">
        <Heading level={headingLevel} className="m-0 text-12 font-600 whitespace-nowrap uppercase tracking-(--il-desk-band-eyebrow-tracking) text-fg-body">{t('team.title')}</Heading>
        {funnel ?? <span className="text-end text-12 text-fg-body">{t('desk.funnel.note', { unit: periodUnit })}</span>}
        <span aria-live="polite" className="sr-only">{hintText}</span>
      </div>
      {people ? (
        // Five to a row (six with a larger team): rows share the height, up to a comfortable card.
        <ul aria-label={t('team.people')} className={`m-0 grid flex-1 list-none auto-rows-(--il-desk-people-rows) gap-2 p-0 text-large:auto-rows-auto text-large:grid-cols-3 ${PEOPLE_COLS(columns.reduce((n, c) => n + c.cards.length, 0))}`}>
          {columns.flatMap(c => c.cards).map(({ id, desk: info, ...card }) => (
            <li key={id} className="flex min-h-0 text-large:min-h-auto [&>[data-member-card]]:flex-1"><DeskCard memberId={id} {...card} grow desk={info ?? { style: null, flag: null, time: null }} /></li>
          ))}
        </ul>
      ) : (
      <div className={`grid flex-1 gap-2 ${GRID_COLS[columns.length] ?? 'grid-cols-6'}`}>
        {columns.map(({ key, cards, ...col }, i) => (
          // With the feed and the outcome off the board (D242) the cards share the height, up to a comfortable size.
          <div key={key} className={`flex min-w-0 flex-col gap-1.5 ${funnel ? '[&>[data-member-card]]:flex-1 [&>[data-member-card]]:max-h-(--il-desk-card-max-height) [&>[data-member-card]]:min-h-0' : ''}`}>
            {/* With the funnel in its pop-up (D242) the column keeps a one line label: the stage, and the bottleneck in words. */}
            {funnel ? <StageLabel name={col.name} count={col.count} bottleneck={col.bottleneck} /> : <StageHeader {...col} periodUnit={periodUnit} alignEnd={i >= columns.length / 2} />}
            {cards.map(({ id, desk: info, ...card }) => <DeskCard key={id} memberId={id} {...card} grow={!!funnel} desk={info ?? { style: null, flag: null, time: null }} />)}
          </div>
        ))}
      </div>
      )}
    </section>
  );
  return (
    <section aria-label={t('team.title')} className="flex min-w-0 flex-col gap-3 px-5 pt-1 pb-6 short:gap-2 short:pb-3">
      <div className="flex items-center justify-between gap-3 text-large:flex-wrap">
        <div className="flex items-baseline gap-3">
          <Heading level={headingLevel} className="m-0 text-20 font-600 tracking-(--il-team-title-tracking) short:text-17">{t('team.title')}</Heading>
          <span aria-live="polite" className="text-13 text-fg-secondary">{hintText}</span>
        </div>
        <div className="relative flex items-center gap-2 text-large:flex-wrap">
          {onOverview && (
            <button type="button" onClick={onOverview} data-tour="overview"
              className="flex min-h-7.5 cursor-pointer items-center gap-1.5 rounded-4 border border-solid border-line-default bg-surface-card px-3 py-0 text-13 font-600 whitespace-nowrap text-fg-primary focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accent-secondary">
              <ChartIcon />{t('team.overview')}
            </button>
          )}
          <button type="button" onClick={onToggleLegend} aria-expanded={legendOpen} aria-controls={legendOpen ? legendId : undefined}
            className="flex min-h-7.5 cursor-pointer items-center gap-1.5 rounded-4 border border-solid border-line-default bg-surface-card px-3 py-0 text-13 font-600 whitespace-nowrap text-fg-primary focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accent-secondary">
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
