import { useId, type ReactNode } from 'react';
import { NoWrapButton } from '../../ds/Button';
import { useI18n } from '../../i18n';
import { ClientLogo } from '../../theme/brand';
import { ScoreDisclosure } from './ScoreDisclosure';
import { ILeadLogo } from '../shell/Logo';

export type PeriodUnit = 'year' | 'month' | 'week' | 'day';
export type SubPeriodUnit = 'quarter' | 'month' | 'week' | 'day' | 'hour';

export interface HudNavItem {
  key: string;
  /** Rendered only when present; an item with no label keeps its slot but is not a button. */
  label?: string;
}

export interface HudClock {
  /** Current period, 1 based ("Week 2"). */
  period: number;
  periodUnit: PeriodUnit;
  /** Current sub period within the period, 1 based ("Day 3"). */
  subPeriod: number;
  /** Periods in the run: screen readers hear "Week 2 of 8, Day 3" (D12, D84). */
  periods?: number;
  subPeriodUnit: SubPeriodUnit;
  /** Capacity per period, in sub periods: one bolt each. */
  capacity: number;
  /** Capacity left, in sub periods, in steps of 0.5. */
  capacityLeft: number;
}

export interface HudScore {
  total: number;
  /** The three pillars. The bars run from 0 to `pillarScale`. */
  business: number;
  people: number;
  leadership: number;
}

export interface HudProps {
  /** The game menu (D89): Objectives, Tutorial and video, History and the rest. Left out on the design frames. */
  menu?: ReactNode;
  nav: HudNavItem[];
  onNav: (key: string) => void;
  clock: HudClock;
  /** Session clock text ("38:12"), or null when the participant hides it. */
  sessionClock: ReactNode | null;
  /**
   * Keep the Pause button when the clock is hidden, labelled "Pause" (the engine board: pausing is
   * not tied to showing the clock). The prototype frames hide the button with the clock.
   */
  alwaysPause?: boolean;
  onPause: () => void;
  /**
   * Save progress now (D213): beside Pause, in the session group. Left out where there is nothing to save
   * (the design frames, the demo).
   */
  onSave?: () => void;
  /** A save is waiting for the server: the button says so and does nothing more. */
  saving?: boolean;
  /** The Leadership Score with its breakdown. Left out where the score shows elsewhere (the desk's status band, D211). */
  score?: HudScore;
  /** Denominator of the simple breakdown's bars. Defaults to 100, the engine's pillar scale (scoring-and-report.md 6). */
  pillarScale?: number;
  /**
   * The full breakdown (ScoreBreakdown): pillars with weights and what feeds them, the streak bonus,
   * the tiers and the badge shelf. Replaces the simple three bars when given. It holds controls, so
   * the popover stays open while focus is inside it.
   */
  breakdown?: ReactNode;
  /**
   * Open score breakdown. Controlled when passed; otherwise the HUD keeps its own. Hover opens it,
   * and the score button toggles it (Enter, Space or a tap). Escape closes it.
   */
  scoreOpen?: boolean;
  onScoreOpenChange?: (open: boolean) => void;
  /** Consecutive periods on target. Left out with the score. */
  streak?: number;
  /** The streak in words, with the next bonus ("2 weeks in a row. 1 more week for a +25 bonus."). Defaults to "3 week streak". */
  streakLabel?: string;
  onPalette: () => void;
  onSettings: () => void;
  /** Left out where the period cannot be ended from the HUD (the demo, D92). */
  onEndPeriod?: () => void;
  /** Secondary while an action drawer is open, so the drawer's own button leads. */
  endEmphasis: 'primary' | 'secondary';
}

/** Private use character that marks where a formatted value sits inside a message. */
const MARK = '';

/** Renders a message with one argument wrapped (bolded, or split into its own element), wherever the locale puts it. */
function around(message: string, wrap: (node: ReactNode) => ReactNode, value: ReactNode): ReactNode {
  const [before, after = ''] = message.split(MARK);
  return <>{before || null}{wrap(value)}{after || null}</>;
}

const focus = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-secondary';

const Bolt = ({ left }: { left: number }) => {
  const fill = left >= 1 ? 'fill-hud-capacity-full' : left > 0 ? 'fill-hud-capacity-half' : 'fill-transparent';
  const stroke = left > 0 ? 'stroke-hud-capacity-full' : 'stroke-hud-capacity-empty';
  return (
    <svg className="h-5 w-4" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" className={`${fill} ${stroke}`} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
};

const Pause = () => (
  <svg className="size-3" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="5" y="4" width="5" height="16" rx="1" /><rect x="14" y="4" width="5" height="16" rx="1" /></svg>
);

const Star = () => {
  // useId returns characters that need escaping inside url(#...); keep only the safe ones.
  const id = 'il-score-' + useId().replace(/[^\w-]/g, '');
  return (
    <svg className="size-4.5" viewBox="0 0 24 24" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style={{ stopColor: 'var(--il-color-brand-electric-blue)' }} />
          <stop offset="1" style={{ stopColor: 'var(--il-color-brand-mint-green)' }} />
        </linearGradient>
      </defs>
      <polygon points="12 2 15.1 8.3 22 9.3 17 14.1 18.2 21 12 17.8 5.8 21 7 14.1 2 9.3 8.9 8.3" fill={`url(#${id})`} />
    </svg>
  );
};

const Flame = () => (
  <svg className="size-4 fill-hud-streak stroke-hud-streak" viewBox="0 0 24 24" strokeWidth="1.5" strokeLinejoin="round" aria-hidden="true">
    <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
  </svg>
);

const Sliders = () => (
  <svg className="size-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true">
    <path d="M20 7h-9" /><path d="M14 17H5" /><circle cx="17" cy="17" r="3" /><circle cx="7" cy="7" r="3" />
  </svg>
);

const PILLARS = ['business', 'people', 'leadership'] as const;

const SaveIcon = () => (
  <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true"><path d="M5 3h11l3 3v15H5z" /><path d="M8 3v5h7V3M8 21v-7h8v7" /></svg>
);

const SESSION_BUTTON = `flex min-h-8 cursor-pointer items-center gap-1.5 rounded-4 border border-line-default bg-surface-raised px-2.5 py-0 text-13 font-600 text-fg-primary tablet-portrait:min-h-11 tablet-portrait:rounded-4 tablet-portrait:px-3.5 ${focus}`;

/**
 * The top bar of the board: brand, game menu, where the run is ("Week 2 · Day 3"), capacity left, the
 * session group (clock, Pause, Save), Leadership Score with its breakdown and streak (where the board does
 * not show them in its status band), Cmd K, settings and End period. Every unit comes from the storyline,
 * so a month based run reads "Month 2", "3 weeks left".
 */
export function Hud(p: HudProps) {
  const { t, number } = useI18n();
  const { clock, score } = p;
  const pillarScale = p.pillarScale ?? 100;

  const left = clock.capacityLeft;
  const whole = Math.floor(left);
  const amount = t('time.amountHalves', { unit: clock.subPeriodUnit, whole, half: left % 1 ? 'yes' : 'no' });
  const capAria = t('time.capacityAria', { left, total: clock.capacity, unit: clock.subPeriodUnit, period: clock.periodUnit });
  const pulse = left > 0 && left <= 1;
  const slots = Array.from({ length: Math.ceil(clock.capacity) }, (_, i) => Math.max(0, Math.min(1, left - i)));

  const periodText = t('time.period', { unit: clock.periodUnit, n: clock.period });
  const where = t('hud.clock', { period: MARK, subPeriod: t('time.subPeriod', { unit: clock.subPeriodUnit, n: clock.subPeriod }) });
  const streak = p.streakLabel ?? t('hud.streak', { n: number(p.streak ?? 0), unit: clock.periodUnit });
  const rich = p.breakdown !== undefined;
  const pause = p.sessionClock !== null || p.alwaysPause;

  return (
    <header className="flex min-w-0 items-center gap-3.5 px-6 py-3.5 whitespace-nowrap short:py-2 text-large:flex-wrap text-large:gap-y-2 tablet:flex-wrap tablet:gap-y-2 tablet-portrait:min-h-18 tablet-portrait:flex-wrap tablet-portrait:gap-2.5 tablet-portrait:gap-y-2 tablet-portrait:border-b tablet-portrait:border-line-default">
      <div className="flex items-center gap-2.5 tablet-portrait:-order-3">
        <ClientLogo />
        <ILeadLogo size="md" />
      </div>
      {p.menu && <div className="flex-none tablet-portrait:-order-3">{p.menu}</div>}
      {p.nav.length > 0 && <nav aria-label={t('hud.nav.aria')} aria-hidden={p.nav.every(n => !n.label) || undefined} className="flex min-w-0 flex-initial gap-0 overflow-hidden tablet-portrait:hidden">
        {p.nav.map(n => (n.label ? (
          <button key={n.key} type="button" onClick={() => p.onNav(n.key)}
            className={`min-h-8 flex-none cursor-pointer rounded-4 border-0 bg-transparent px-2 py-0 text-13 font-600 text-fg-secondary hover:bg-surface-raised hover:text-fg-primary ${focus}`}>
            {n.label}
          </button>
        ) : (
          // No label: keep the slot, but not as a nameless button.
          <span key={n.key} aria-hidden="true" className="h-8 flex-none px-2" />
        )))}
      </nav>}
      <div className="min-w-0 flex-1 tablet-portrait:-order-1" />
      {/* D12, D84: the design's "Week 2 · Day 3" on screen; the spec's "Week 2 of 8" for screen readers, until the canvas (D80) settles the label. */}
      <span data-tour="clock" data-trace="time" className="flex-none text-13 text-fg-secondary tablet-portrait:-order-2 tablet-portrait:text-14">
        <span aria-hidden={clock.periods ? true : undefined}>{around(where, v => <b className="text-fg-primary">{v}</b>, periodText)}</span>
        {clock.periods ? <span className="sr-only">{t('hud.clock.aria', { period: t('time.periodOf', { unit: clock.periodUnit, n: clock.period, total: clock.periods }), subPeriod: t('time.subPeriod', { unit: clock.subPeriodUnit, n: clock.subPeriod }) })}</span> : null}
      </span>
      <div role="group" aria-label={capAria} data-tour="days" className="flex items-center gap-2 tablet-portrait:-order-2">
        <div className={`flex gap-0.25 tablet-portrait:hidden ${pulse ? 'animate-(--il-hud-capacity-pulse)' : ''}`}>
          {slots.map((v, i) => <Bolt key={i} left={v} />)}
        </div>
        <span className="text-13 text-fg-secondary">{around(t('time.left', { amount: MARK }), v => <b className="text-fg-primary">{v}</b>, amount)}</span>
      </div>
      {/* The session group (D213): the clock in Pause, and Save. One tour stop. */}
      {(pause || p.onSave) && (
        <div role="group" aria-label={t('hud.session.aria')} data-tour="session" className="flex flex-none items-center gap-1.5">
          {pause && (
            <button type="button" onClick={p.onPause} aria-label={p.sessionClock !== null ? t('hud.pause.aria') : undefined} className={SESSION_BUTTON}>
              <Pause />{p.sessionClock ?? t('hud.pause.label')}
            </button>
          )}
          {p.onSave && (
            <button type="button" onClick={() => { if (!p.saving) p.onSave?.(); }} aria-label={t('hud.save.aria')} aria-disabled={p.saving || undefined} className={`${SESSION_BUTTON} tablet-portrait:min-w-11 tablet-portrait:justify-center tablet-portrait:px-0`}>
              <SaveIcon /><span className="tablet-portrait:sr-only">{p.saving ? t('hud.save.saving') : t('hud.save.label')}</span>
            </button>
          )}
        </div>
      )}
      {score && (
        <ScoreDisclosure className="tablet-portrait:-order-1" label={t('hud.score.aria', { total: number(score.total) })} rich={rich}
          open={p.scoreOpen} onOpenChange={p.onScoreOpenChange}
          buttonClassName={`flex min-h-8 cursor-pointer items-center gap-1.5 rounded-4 border-0 bg-transparent px-2.5 py-0 text-15 font-600 text-fg-primary tablet-portrait:min-h-11 tablet-portrait:rounded-4 tablet-portrait:border tablet-portrait:border-line-strong tablet-portrait:px-3.5 ${focus}`}
          content={rich ? p.breakdown : <>
            <b>{t('hud.score.title')}</b>
            <span className="text-12 text-fg-secondary">{t('hud.score.body')}</span>
            {PILLARS.map(k => (
              <div key={k} className="grid grid-cols-(--il-hud-score-columns) items-center gap-2 text-12">
                <span>{t('hud.score.pillar', { pillar: k })}</span>
                <div className="h-1.5 rounded-3 bg-track">
                  <div className="h-full rounded-3 bg-(image:--il-fill-brand)" style={{ width: `${Math.max(0, Math.min(100, score[k] / pillarScale * 100))}%` }} />
                </div>
                <b className="text-end">{number(score[k])}</b>
              </div>
            ))}
          </>}>
          <Star />{number(score.total)}
        </ScoreDisclosure>
      )}
      {score && p.streak !== undefined && <span role="img" aria-label={streak} title={streak} className="flex items-center gap-1 text-15 font-600 tablet-portrait:-order-1"><Flame />{number(p.streak)}</span>}
      <button type="button" onClick={p.onPalette} aria-label={t('hud.palette.aria')}
        className={`min-h-8 cursor-pointer rounded-4 border border-line-default bg-surface-raised px-2.5 py-0 text-12 font-600 text-fg-secondary tablet-portrait:hidden ${focus}`}>
        {t('hud.palette.key')}
      </button>
      <button type="button" onClick={p.onSettings} aria-label={t('hud.settings.aria')}
        className={`flex size-8 cursor-pointer items-center justify-center rounded-round border-0 bg-transparent p-0 text-fg-secondary hover:bg-surface-raised tablet-portrait:-order-1 tablet-portrait:size-11 tablet-portrait:rounded-4 tablet-portrait:border tablet-portrait:border-line-default ${focus}`}>
        <Sliders />
      </button>
      {/* The number is its own flex item, 8px from the words, as the design renders it. */}
      {p.onEndPeriod && (
        <span data-tour="end" className="inline-flex flex-none">
          <NoWrapButton variant={p.endEmphasis} size="md" onClick={p.onEndPeriod}>
            {around(t('time.endPeriodNumber', { unit: clock.periodUnit, n: MARK }), v => <span>{v}</span>, number(clock.period))}
          </NoWrapButton>
        </span>
      )}
    </header>
  );
}
