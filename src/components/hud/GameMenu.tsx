import { useEffect, useId, useRef, useState } from 'react';
import { useI18n } from '../../i18n';

export type GameMenuKey = 'objectives' | 'tutorial' | 'history' | 'overview' | 'leaderboard' | 'actions' | 'tour' | 'settings' | 'fullscreen' | 'exitFullscreen' | 'exit';

export interface GameMenuItem {
  key: GameMenuKey;
  onSelect: () => void;
}

export interface GameMenuProps {
  items: GameMenuItem[];
  /** Starts open (stories). */
  defaultOpen?: boolean;
}

const focus = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-secondary';
const MenuIcon = () => (
  <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 6h16" /><path d="M4 12h16" /><path d="M4 18h16" /></svg>
);

/**
 * The game menu in the HUD (D89, lifting D38): Objectives, Tutorial and video, History, Results and
 * stages, the leaderboard when it is on, About these actions, the guided tour, Settings, full screen and
 * Exit. A disclosure: the button opens a list of buttons below it; Escape or a click elsewhere closes it
 * and focus goes back to the button. Choosing an item closes it too.
 */
export function GameMenu({ items, defaultOpen = false }: GameMenuProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', away);
    // Focus moves to the first item, so the list is read and the arrows work at once.
    wrap.current?.querySelector<HTMLButtonElement>('[data-menu-item]')?.focus({ preventScroll: true });
    return () => document.removeEventListener('pointerdown', away);
  }, [open]);
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open) return;
    if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); button.current?.focus(); return; }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Home' && e.key !== 'End') return;
    const list = Array.from(wrap.current?.querySelectorAll<HTMLButtonElement>('[data-menu-item]') ?? []);
    const i = list.indexOf(document.activeElement as HTMLButtonElement);
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? list.length - 1 : (i + (e.key === 'ArrowDown' ? 1 : -1) + list.length) % list.length;
    e.preventDefault();
    list[next]?.focus();
  };
  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions -- Escape and the arrows inside the open list; the button and items are the controls
    <div ref={wrap} className="relative" onKeyDown={onKeyDown} data-tour="menu">
      <button ref={button} type="button" aria-expanded={open} aria-controls={open ? id : undefined} onClick={() => setOpen(o => !o)}
        className={`flex min-h-8 cursor-pointer items-center gap-1.5 rounded-pill border border-line-default bg-surface-raised px-3 py-0 text-13 font-700 text-fg-primary hover:bg-surface-card tablet-portrait:min-h-11 tablet-portrait:rounded-12 narrow:min-w-11 narrow:justify-center narrow:px-0 ${focus}`}>
        {/* Under 800 wide the HUD keeps the icon; the word stays for screen readers (D101). */}
        <MenuIcon /><span className="narrow:sr-only">{t('hud.menu.button')}</span>
      </button>
      {open && (
        <ul id={id} aria-label={t('hud.menu.aria')} className="absolute top-full start-0 z-45 m-0 mt-2 flex w-max min-w-56 list-none flex-col gap-0.5 rounded-16 border border-line-strong bg-surface-solid p-1.5 whitespace-nowrap shadow-(--il-hud-score-shadow)">
          {items.map(item => (
            <li key={item.key} className={item.key === 'settings' || item.key === 'exit' ? 'mt-1 border-t border-line-default pt-1' : undefined}>
              <button type="button" data-menu-item="" onClick={() => { setOpen(false); item.onSelect(); }}
                className={`flex min-h-9 w-full cursor-pointer items-center rounded-10 border-0 bg-transparent px-3 text-start text-14 font-600 text-fg-primary hover:bg-surface-raised ${focus}`}>
                {t('hud.menu.item', { key: item.key })}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
