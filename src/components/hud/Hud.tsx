import { useEffect, useId, useState, type ReactNode } from 'react';
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
  /** The storyline's organisation, beside the menu as the canvas puts it (D232); the iLead logo without one. */
  organisation?: string | null;
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
  /**
   * Team morale and how this period's play has moved it (D241), so every action's effect on the team shows at the
   * top: up or down this period, and a short "+3" or "−2" when it changes. Left out on the design frames.
   */
  morale?: { value: number; delta: number };
  /** The envelope that opens the inbox overlay, with its unread badge (D242). Left out where the inbox lives elsewhere. */
  mail?: ReactNode;
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

const focus = 'focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accent-secondary';

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
          <stop offset="0" style={{ stopColor: 'var(--il-color-accent-default)' }} />
          <stop offset="1" style={{ stopColor: 'var(--il-color-accent-default)' }} />
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

const Heart = () => (
  <svg className="size-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.7 4.5c2.1 0 3.6 1.1 4.3 2.4h2c.7-1.3 2.2-2.4 4.3-2.4 3.7 0 5.8 3.9 4.3 7.3C19.5 16.4 12 21 12 21z" /></svg>
);

/** How long the "+3" stays after morale moves; it floats up and fades (`il-morale-pop`), or simply shows where motion is off. */
const POP_MS = 2400;

/**
 * Team morale in the top bar (D241): the heart, the number, whether this period's play has it rising, falling or
 * holding, and a short "+3" or "−2" each time it moves. Read as one image with its words for screen readers.
 */
export function MoraleMeter({ value, delta, unit }: { value: number; delta: number; unit: PeriodUnit }) {
  const { t, number } = useI18n();
  const [seen, setSeen] = useState(value);
  const [pop, setPop] = useState<{ n: number; key: number } | null>(null);
  if (value !== seen) {
    setSeen(value);
    const n = Math.round(value - seen);
    if (n !== 0) setPop(p => ({ n, key: (p?.key ?? 0) + 1 }));
  }
  useEffect(() => {
    if (!pop) return;
    const id = window.setTimeout(() => setPop(null), POP_MS);
    return () => window.clearTimeout(id);
  }, [pop]);
  const dir = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';
  const tone = dir === 'up' ? 'text-status-gain' : dir === 'down' ? 'text-status-decline' : 'text-fg-secondary';
  const label = t('hud.morale.aria', { value: number(value), dir, n: number(Math.abs(delta)), unit });
  return (
    <span role="img" aria-label={label} title={label} data-tour="morale" data-morale={dir}
      className="relative flex flex-none items-center gap-2 rounded-4 border border-line-strong px-2.5 py-1 text-13">
      <span className={tone}><Heart /></span>
      {/* Under 1280 wide the words give way, so End week stays on screen; the heart, number and arrow remain. */}
      <span className="hidden text-fg-secondary wide:inline">{t('hud.morale.label')}</span>
      <b className="font-mono text-15 font-500 text-fg-primary">{number(value)}</b>
      <span className={`font-600 whitespace-nowrap ${tone}`}>{t('hud.morale.trend', { dir, n: number(Math.abs(delta)) })}<span className="hidden wide:inline">{t('hud.morale.word', { dir })}</span></span>
      {pop && (
        <span key={pop.key} aria-hidden="true" data-morale-pop=""
          className={`il-morale-pop pointer-events-none absolute -top-1 end-1 font-mono text-13 font-600 ${pop.n > 0 ? 'text-status-gain' : 'text-status-decline'}`}>
          {t('hud.morale.pop', { dir: pop.n > 0 ? 'up' : 'down', n: number(Math.abs(pop.n)) })}
        </span>
      )}
    </span>
  );
}

const PILLARS = ['business', 'people', 'leadership'] as const;

const SaveIcon = () => (
  <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true"><path d="M5 3h11l3 3v15H5z" /><path d="M8 3v5h7V3M8 21v-7h8v7" /></svg>
);

const SESSION_BUTTON = `flex min-h-11 cursor-pointer items-center gap-1.5 rounded-4 border border-line-strong bg-transparent px-3 py-0 text-14 font-500 text-fg-primary hover:bg-surface-raised ${focus}`;

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
  // One bar a sub period, as the canvas draws the days (D232): spent ones first, then what is left. Under 1280 wide
  // the words alone say it, so the team morale meter fits beside them (D241).
  const slots = Array.from({ length: Math.ceil(clock.capacity) }, (_, i) => Math.max(0, Math.min(1, left - (Math.ceil(clock.capacity) - 1 - i))));

  const periodText = t('time.period', { unit: clock.periodUnit, n: clock.period });
  const where = t('hud.clock', { period: MARK, subPeriod: t('time.subPeriod', { unit: clock.subPeriodUnit, n: clock.subPeriod }) });
  const streak = p.streakLabel ?? t('hud.streak', { n: number(p.streak ?? 0), unit: clock.periodUnit });
  const rich = p.breakdown !== undefined;
  const pause = p.sessionClock !== null || p.alwaysPause;

  return (
    <header className="il-chrome flex min-h-16 min-w-0 flex-none items-center gap-4.5 px-8 whitespace-nowrap text-large:flex-wrap text-large:gap-y-2 text-large:py-2 tablet:flex-wrap tablet:gap-3 tablet:gap-y-2 tablet:px-5 tablet:py-2 tablet-portrait:min-h-18 tablet-portrait:gap-2.5">
      {p.menu && <div className="flex-none tablet-portrait:-order-3">{p.menu}</div>}
      <div className="flex items-center gap-2.5 tablet-portrait:-order-3">
        <ClientLogo />
        {/* An upright tablet keeps the bar to one row: the organisation gives way (D232). */}
        {p.organisation ? <span className="font-serif text-22 leading-none tablet-portrait:hidden">{p.organisation}</span> : <ILeadLogo size="sm" />}
      </div>
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
      {/* D12, D84: "Week 2 · Day 3" on screen; "Week 2 of 8" for screen readers. */}
      <span data-tour="clock" data-trace="time" className="flex-none text-14 text-fg-secondary tablet-portrait:-order-2">
        <span aria-hidden={clock.periods ? true : undefined}>{around(where, v => <b className="font-500 text-fg-primary">{v}</b>, periodText)}</span>
        {clock.periods ? <span className="sr-only">{t('hud.clock.aria', { period: t('time.periodOf', { unit: clock.periodUnit, n: clock.period, total: clock.periods }), subPeriod: t('time.subPeriod', { unit: clock.subPeriodUnit, n: clock.subPeriod }) })}</span> : null}
      </span>
      <div role="group" aria-label={capAria} data-tour="days" className="flex items-center gap-2 tablet-portrait:-order-2">
        <div aria-hidden="true" className={`hidden gap-1 wide:flex tablet-portrait:hidden ${pulse ? 'animate-(--il-hud-capacity-pulse)' : ''}`}>
          {slots.map((v, i) => (
            <span key={i} className="relative block h-1.5 w-4 bg-(--il-color-canvas-steel)">
              {v > 0 && <span className="absolute inset-y-0 end-0 block bg-hud-capacity-full" style={{ width: `${v * 100}%` }} />}
            </span>
          ))}
        </div>
        <span className="text-13 text-fg-secondary">{around(t('time.left', { amount: MARK }), v => <span>{v}</span>, amount)}</span>
      </div>
      {p.morale && <span className="flex-none tablet-portrait:-order-2"><MoraleMeter value={p.morale.value} delta={p.morale.delta} unit={clock.periodUnit} /></span>}
      <div className="min-w-0 flex-1 tablet-portrait:-order-1" />
      {p.mail && <span className="flex flex-none tablet-portrait:-order-1">{p.mail}</span>}
      {/* The session group (D213): the session clock, Pause and Save. One tour stop. */}
      {(pause || p.onSave) && (
        <div role="group" aria-label={t('hud.session.aria')} data-tour="session" className="flex flex-none items-center gap-2 text-13 text-fg-secondary">
          {p.sessionClock !== null && <span data-session-clock="" className="font-mono tablet-portrait:hidden">{p.sessionClock}</span>}
          {pause && (
            <button type="button" onClick={p.onPause} aria-label={p.sessionClock !== null ? t('hud.pause.aria') : undefined} className={SESSION_BUTTON}>
              <Pause />{t('hud.pause.label')}
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
          buttonClassName={`flex min-h-11 cursor-pointer items-center gap-1.5 rounded-4 border border-line-strong bg-transparent px-3 py-0 font-mono text-15 font-500 text-fg-primary ${focus}`}
          content={rich ? p.breakdown : <>
            <b>{t('hud.score.title')}</b>
            <span className="text-12 text-fg-secondary">{t('hud.score.body')}</span>
            {PILLARS.map(k => (
              <div key={k} className="grid grid-cols-(--il-hud-score-columns) items-center gap-2 text-12">
                <span>{t('hud.score.pillar', { pillar: k })}</span>
                <div className="h-1.5 bg-track">
                  <div className="h-full bg-accent-default" style={{ width: `${Math.max(0, Math.min(100, score[k] / pillarScale * 100))}%` }} />
                </div>
                <b className="text-end font-mono font-500">{number(score[k])}</b>
              </div>
            ))}
          </>}>
          <Star />{number(score.total)}
        </ScoreDisclosure>
      )}
      {score && p.streak !== undefined && <span role="img" aria-label={streak} title={streak} className="flex items-center gap-1 font-mono text-15 font-500 tablet-portrait:-order-1"><Flame />{number(p.streak)}</span>}
      {/* The canvas leaves search and settings to the keyboard and the menu (D232); the upright tablet keeps them here (D73). */}
      <button type="button" onClick={p.onPalette} aria-label={t('hud.palette.aria')}
        className={`hidden min-h-11 cursor-pointer rounded-4 border border-line-strong bg-transparent px-2.5 py-0 text-12 font-600 text-fg-secondary ${focus}`}>
        {t('hud.palette.key')}
      </button>
      <button type="button" onClick={p.onSettings} aria-label={t('hud.settings.aria')}
        className={`hidden size-11 cursor-pointer items-center justify-center rounded-4 border border-line-strong bg-transparent p-0 text-fg-secondary hover:bg-surface-raised tablet-portrait:-order-1 tablet-portrait:flex ${focus}`}>
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
