import * as Dialog from '@radix-ui/react-dialog';
import { useId, useState, type ReactNode } from 'react';
import { useI18n } from '../../i18n';
import type { PeriodUnit } from '../action/days';

export type GameMenuKey = 'objectives' | 'tutorial' | 'history' | 'overview' | 'leaderboard' | 'actions' | 'tour' | 'settings' | 'fullscreen' | 'exitFullscreen' | 'exit';

export interface GameMenuItem {
  key: GameMenuKey;
  onSelect: () => void;
}

/** The session group at the top of the menu (D213, D214): Pause, Save progress and Sign out. */
export interface GameMenuSession {
  /** When the server last confirmed the run (epoch ms), or null when not known on this load. */
  savedAt: number | null;
  saving: boolean;
  /** What the last Save said, or null. */
  note: string | null;
  onPause: () => void;
  onSave: () => void;
  onSignOut: () => void;
}

export interface GameMenuProps {
  items: GameMenuItem[];
  /** Where the run is: "Week 1 of 8 · Day 3 · 3 days left". */
  where?: string;
  /** The storyline's period, for the items' descriptions. */
  periodUnit?: PeriodUnit;
  /** Who the leaderboard ranks, for its description. */
  scope?: 'cohort' | 'unit' | 'global';
  session?: GameMenuSession;
  /** Starts open (stories). */
  defaultOpen?: boolean;
}

const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-secondary';
const INSET = 'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent-secondary';
const EYEBROW = 'm-0 text-12 font-700 uppercase tracking-(--il-desk-band-eyebrow-tracking) text-fg-secondary';
/** Icon glyph, not copy: the button is named from the catalog. */
const CLOSE_GLYPH = '✕';

const Svg = ({ children, fill = false }: { children: ReactNode; fill?: boolean }) => (
  <svg className="size-4.5" viewBox="0 0 24 24" fill={fill ? 'currentColor' : 'none'} stroke={fill ? 'none' : 'currentColor'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
);
const MenuIcon = () => (
  <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 6h16" /><path d="M4 12h16" /><path d="M4 18h16" /></svg>
);
const ICONS: Record<GameMenuKey | 'pause' | 'save' | 'signOut', ReactNode> = {
  pause: <Svg fill><path d="M6 4h4v16H6zM14 4h4v16h-4z" /></Svg>,
  save: <Svg><path d="M5 3h11l3 3v15H5z" /><path d="M8 3v5h7V3M8 21v-7h8v7" /></Svg>,
  signOut: <Svg><path d="M14 4h5v16h-5" /><path d="M10 8l-4 4 4 4M6 12h10" /></Svg>,
  objectives: <Svg><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.2" /></Svg>,
  tutorial: <Svg><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v4h4" /><path d="M10 9l5 3-5 3z" /></Svg>,
  tour: <Svg><path d="M12 3v3M12 18v3M3 12h3M18 12h3" /><circle cx="12" cy="12" r="4" /></Svg>,
  history: <Svg><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Svg>,
  overview: <Svg><path d="M4 20h16" /><path d="M7 16v-5M12 16V6M17 16v-8" /></Svg>,
  leaderboard: <Svg><path d="M5 20V12M12 20V5M19 20v-5" /></Svg>,
  actions: <Svg><circle cx="12" cy="12" r="9" /><path d="M12 11v6" /><path d="M12 7.5h.01" /></Svg>,
  settings: <Svg><path d="M4 7h9M17 7h3M4 17h3M11 17h9" /><circle cx="15" cy="7" r="2" /><circle cx="9" cy="17" r="2" /></Svg>,
  fullscreen: <Svg><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></Svg>,
  exitFullscreen: <Svg><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" /></Svg>,
  exit: <Svg><path d="M14 4h5v16h-5" /><path d="M10 8l-4 4 4 4M6 12h10" /></Svg>
};

/** One row: the icon tile, the name (the button's name), a line saying what it is (its description), a chevron. */
function Row({ icon, name, sub, extra, onSelect, pressed, tight = false }: { icon: ReactNode; name: string; sub?: string; extra?: ReactNode; onSelect: () => void; pressed?: boolean; tight?: boolean }) {
  const id = useId();
  return (
    <button type="button" data-menu-item="" onClick={onSelect} aria-labelledby={`${id}n`} aria-describedby={sub ? `${id}s` : undefined} aria-pressed={pressed}
      className={`grid min-h-13 w-full cursor-pointer grid-cols-(--il-desk-menu-row-columns) items-center gap-3.5 border-0 bg-transparent px-6 py-1.5 short:min-h-11 short:py-1 text-start text-fg-primary hover:bg-surface-raised ${INSET}`}>
      <span className="flex size-10 items-center justify-center rounded-10 bg-accent-soft short:size-8 text-fg-primary">{icon}</span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <b id={`${id}n`} className="text-15 font-700">{name}</b>
        {sub && <span id={`${id}s`} className={`text-13 text-fg-secondary ${tight ? 'shorter:hidden' : ''}`}>{sub}</span>}
      </span>
      {extra ?? <svg className="size-4.5 text-fg-secondary rtl:-scale-x-100" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>}
    </button>
  );
}

/**
 * The game menu (D89, D214 after the approved canvas): a side sheet over the board. At the top the
 * session, Pause, Save progress with the time the run was last saved, and Sign out (which saves first);
 * then Objectives, Tutorial and video, the guided tour, History, Results and stages, the leaderboard when it
 * is on, About these actions, Settings and full screen, each with a line saying what it holds. A Radix
 * modal dialog: focus moves in, Tab stays inside, Escape or Close shuts it and focus returns to Menu. The
 * arrow keys move between the items too. Choosing an item closes the menu first.
 */
export function GameMenu({ items, where, periodUnit = 'week', scope = 'cohort', session, defaultOpen = false }: GameMenuProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(defaultOpen);
  const sessionId = useId();
  const choose = (fn: () => void) => { setOpen(false); fn(); };
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Home' && e.key !== 'End') return;
    const list = Array.from((e.currentTarget as HTMLElement).querySelectorAll<HTMLButtonElement>('[data-menu-item]'));
    const i = list.indexOf(document.activeElement as HTMLButtonElement);
    if (i < 0) return;
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? list.length - 1 : (i + (e.key === 'ArrowDown' ? 1 : -1) + list.length) % list.length;
    e.preventDefault();
    list[next]?.focus();
  };
  return (
    <div data-tour="menu">
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Trigger className={`flex min-h-8 cursor-pointer items-center gap-1.5 rounded-pill border border-line-default bg-surface-raised px-3 py-0 text-13 font-700 text-fg-primary hover:bg-surface-card tablet-portrait:min-h-11 tablet-portrait:rounded-12 tablet-portrait:min-w-11 tablet-portrait:justify-center tablet-portrait:px-0 ${FOCUS}`}>
          {/* On an upright tablet the HUD keeps the icon; the word stays for screen readers (D101). */}
          <MenuIcon /><span className="tablet-portrait:sr-only">{t('hud.menu.button')}</span>
        </Dialog.Trigger>
          <Dialog.Overlay className="fixed inset-0 z-48 bg-surface-scrim backdrop-blur-12" />
          <Dialog.Content aria-describedby={undefined} data-game-menu="" onKeyDown={onKeyDown}
            className="fixed inset-y-0 end-0 z-49 flex w-(--il-desk-menu-width) max-w-full animate-(--il-event-card-enter) flex-col border-s border-line-strong bg-surface-solid text-14 text-fg-primary shadow-(--il-event-card-shadow) outline-0">
            <div className="flex flex-none items-center gap-3 border-b border-line-strong px-6 pt-4 pb-3.5 short:pt-2.5 short:pb-2">
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <Dialog.Title className="m-0 text-26 font-700 tracking-(--il-tracking-title)">{t('menu.title')}</Dialog.Title>
                {where && <span className="text-13 text-fg-secondary">{where}</span>}
              </div>
              <Dialog.Close aria-label={t('menu.close')} className={`flex size-11 flex-none cursor-pointer items-center justify-center rounded-round border border-line-default bg-surface-raised p-0 text-fg-primary ${FOCUS}`}>
                <span aria-hidden="true">{CLOSE_GLYPH}</span>
              </Dialog.Close>
            </div>
            {session && (
              <div role="group" aria-labelledby={sessionId} className="flex flex-none flex-col gap-1 border-b border-line-strong py-2">
                <div className="flex min-h-6 items-center justify-between gap-3 px-6">
                  <h2 id={sessionId} className={EYEBROW}>{t('session.title')}</h2>
                  <p role="status" className="m-0 text-13 text-fg-secondary">{session.note ?? ''}</p>
                </div>
                <Row icon={ICONS.pause} name={t('session.pause', { paused: 'no' })} onSelect={() => choose(session.onPause)} />
                <Row icon={ICONS.save} name={session.saving ? t('session.saving') : t('session.save')} onSelect={() => { if (!session.saving) session.onSave(); }}
                  sub={t('session.saved', { known: session.savedAt !== null ? 'yes' : 'no', at: session.savedAt ?? 0 })} extra={<span />} />
                <Row icon={ICONS.signOut} name={t('session.signOut')} sub={t('session.signOut.note')} onSelect={() => choose(session.onSignOut)} />
              </div>
            )}
            <ul aria-label={t('hud.menu.aria')} className="m-0 flex min-h-0 flex-1 list-none flex-col overflow-y-auto overscroll-contain p-0">
              {items.map(item => (
                <li key={item.key} className="border-b border-line-default">
                  <Row icon={ICONS[item.key]} name={t('hud.menu.item', { key: item.key })} tight sub={t('menu.sub', { key: item.key, unit: periodUnit, scope }) || undefined} onSelect={() => choose(item.onSelect)} />
                </li>
              ))}
            </ul>
          </Dialog.Content>
      </Dialog.Root>
    </div>
  );
}
