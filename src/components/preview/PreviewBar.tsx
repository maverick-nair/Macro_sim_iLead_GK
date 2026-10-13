import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { useEngineView } from '../../engine/react';
import { appLocale, useI18n } from '../../i18n';
import './messages';
import { AUTHOR_WINDOW, PREVIEW_DRAFT_KEY, PREVIEW_META_KEY, previewKey, readMeta, type PreviewMeta } from './mode';
import { restartPreview, updatePreview } from './server';
import { TraceOverlay } from './TraceOverlay';

export interface PreviewBarProps {
  /** The draft this page started with (GenieKreator's meta when it opened or reloaded the preview). */
  meta: PreviewMeta | null;
  /** Where this page was opened (`board:3`, `report`). */
  jump: string | null;
  /** The server's preview storyline (D195); null on the mock engine. */
  previewId: string | null;
  theme: 'dark' | 'light';
}

type Jump = 'onboarding' | 'styles' | 'board' | 'weekend' | 'report';
const JUMPS: Jump[] = ['onboarding', 'styles', 'board', 'weekend', 'report'];
const TRACE_KEY = previewKey('trace');
const focus = 'focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accent-secondary';
const control = `flex min-h-8 cursor-pointer items-center gap-1.5 rounded-4 border border-line-default bg-surface-raised px-3 py-0 text-13 font-600 text-fg-primary hover:bg-surface-card disabled:cursor-wait disabled:opacity-60 ${focus}`;

const readTrace = () => { try { return localStorage.getItem(TRACE_KEY) === '1'; } catch { return false; } };
const writeTrace = (on: boolean) => { try { if (on) localStorage.setItem(TRACE_KEY, '1'); else localStorage.removeItem(TRACE_KEY); } catch { /* storage blocked: on for this page only */ } };

/** Back to GenieKreator: the tab that opened the preview, else the named GenieKreator tab, else a new one (D198). */
export function backToAuthor() {
  try {
    const o = window.opener as Window | null;
    if (o && !o.closed && o.location.pathname.startsWith('/author')) { o.focus(); return; }
  } catch { /* another origin opened this tab */ }
  const w = window.open('', AUTHOR_WINDOW);
  if (!w) { location.assign('/author'); return; }
  try { if (w.location.href === 'about:blank') w.location.replace('/author'); } catch { /* not ours */ }
  w.focus();
}

/**
 * The preview bar (D191): on every screen of a preview from GenieKreator, never anywhere else. It says
 * plainly that this is a test that saves nothing to reports, which draft it plays and when it was saved,
 * and offers Jump to, Restart, Back to GenieKreator and "Show where this comes from". When GenieKreator
 * saves again it says so and offers Reload, which plays the new save from the same point.
 *
 * It sits above the app; the play screens fit the rest of the window (`--il-preview-bar-height`, global.css).
 */
export default function PreviewBar({ meta, jump, previewId, theme }: PreviewBarProps) {
  const { t } = useI18n();
  const view = useEngineView().data;
  const bar = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const weekId = useId();
  const [open, setOpen] = useState(false);
  const [week, setWeek] = useState<number | null>(null);
  const [trace, setTrace] = useState(readTrace);
  const [traced, setTraced] = useState(0);
  const [latest, setLatest] = useState<PreviewMeta | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  // The play screens fit the window less the bar.
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.dataset.preview = '';
    const el = bar.current;
    const size = () => root.style.setProperty('--il-preview-bar-height', `${el?.offsetHeight ?? 0}px`);
    size();
    const ro = typeof ResizeObserver === 'undefined' || !el ? null : new ResizeObserver(size);
    if (el) ro?.observe(el);
    return () => { ro?.disconnect(); delete root.dataset.preview; root.style.removeProperty('--il-preview-bar-height'); };
  }, []);

  // GenieKreator saved again: its meta changes after the draft is in storage (D194).
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== PREVIEW_META_KEY) return;
      const m = readMeta();
      if (m && m.rev !== meta?.rev) setLatest(m);
    };
    addEventListener('storage', onStorage);
    return () => removeEventListener('storage', onStorage);
  }, [meta?.rev]);

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => { if (!menu.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', away);
    menu.current?.querySelector<HTMLElement>('select, [data-menu-item]')?.focus({ preventScroll: true });
    return () => document.removeEventListener('pointerdown', away);
  }, [open]);

  /** Opens the preview again at a point: a fresh run on the server first, then this page at that point. */
  const go = useCallback(async (target: string, opts: { reload?: boolean } = {}) => {
    setBusy(true);
    setFailed(false);
    try {
      if (previewId) {
        if (opts.reload) {
          const raw = localStorage.getItem(PREVIEW_DRAFT_KEY);
          const m = readMeta();
          if (raw) await updatePreview(previewId, JSON.parse(raw), { draftVersion: m?.version, savedAt: m ? new Date(m.savedAt).toISOString() : undefined });
        }
        await restartPreview(previewId, target === 'onboarding' ? null : target);
      }
      const u = new URL(location.href);
      u.searchParams.set('jump', target);
      if (u.href === location.href) location.reload();
      else location.assign(u.href);
    } catch {
      setBusy(false);
      setFailed(true);
    }
  }, [previewId]);

  const unit = view?.clock.periodUnit ?? 'week';
  const periods = view?.clock.periods ?? 1;
  const w = Math.min(week ?? view?.clock.period ?? 1, periods);
  const shown = latest ?? meta;
  const saved = shown ? new Intl.DateTimeFormat(appLocale(), { dateStyle: 'medium', timeStyle: 'short' }).format(shown.savedAt) : null;
  const onTrace = (on: boolean) => { setTrace(on); writeTrace(on); };
  const onMenuKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && open) { e.stopPropagation(); setOpen(false); menuButton.current?.focus(); }
  };

  return (
    <>
      <div ref={bar} role="region" aria-label={t('preview.bar.aria')} data-preview-bar="" style={{ colorScheme: theme }}
        className="il-theme sticky top-0 z-60 flex flex-wrap items-center gap-x-3 gap-y-2 border-b-2 border-status-attention bg-surface-solid px-4 py-2 font-sans text-13 text-fg-primary">
        <strong className="rounded-4 bg-status-attention-soft px-3 py-1 text-13 font-700 text-fg-primary">{t('preview.bar.notice')}</strong>
        <span className="text-fg-secondary">{shown && saved ? t('preview.bar.draft', { version: shown.version, at: saved }) : t('preview.bar.draftLocal')}</span>
        <span className="flex-1" />
        <div role="status" className={latest ? 'flex items-center gap-2 rounded-4 bg-status-attention-soft px-3 py-1' : 'sr-only'}>
          {latest && <><b>{t('preview.updated')}</b><span className="text-fg-secondary">{t('preview.updated.detail')}</span>
            <button type="button" className={control} disabled={busy} onClick={() => void go(jump ?? 'onboarding', { reload: true })}>{t('preview.reload')}</button></>}
        </div>
        <span role="status" className={busy || failed ? 'text-fg-secondary' : 'sr-only'}>{failed ? t('preview.failed') : busy ? t('preview.working') : ''}</span>
        {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions -- Escape closes the open list; the button and items are the controls */}
        <div ref={menu} className="relative" onKeyDown={onMenuKey}>
          <button ref={menuButton} type="button" className={control} aria-expanded={open} aria-controls={open ? menuId : undefined} disabled={busy} onClick={() => setOpen(o => !o)}>
            {t('preview.jump.button')}
          </button>
          {open && (
            <div id={menuId} role="group" aria-label={t('preview.jump.aria')} className="absolute end-0 top-full z-60 mt-2 flex w-max min-w-60 flex-col gap-1 rounded-6 border border-line-strong bg-surface-solid p-2 shadow-(--il-hud-score-shadow)">
              <label htmlFor={weekId} className="flex items-center justify-between gap-3 px-2 py-1 text-13 font-600">
                {t('preview.jump.week', { unit })}
                <select id={weekId} value={w} onChange={e => setWeek(Number(e.target.value))} className={`min-h-8 rounded-4 border border-line-control bg-surface-raised px-2 text-13 text-fg-primary ${focus}`}>
                  {Array.from({ length: periods }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}
                </select>
              </label>
              <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
                {JUMPS.map(k => (
                  <li key={k}>
                    <button type="button" data-menu-item="" onClick={() => { setOpen(false); void go(k === 'onboarding' || k === 'report' ? k : `${k}:${w}`); }}
                      className={`flex min-h-9 w-full cursor-pointer items-center rounded-4 border-0 bg-transparent px-3 text-start text-14 font-600 text-fg-primary hover:bg-surface-raised ${focus}`}>
                      {t('preview.jump.item', { key: k, unit, n: w })}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <button type="button" className={control} disabled={busy} onClick={() => void go('onboarding')}>{t('preview.restart')}</button>
        <button type="button" className={control} aria-pressed={trace} onClick={() => onTrace(!trace)}>{t('preview.trace.show')}</button>
        <button type="button" className={control} onClick={backToAuthor}>{t('preview.back')}</button>
        <span role="status" className="sr-only">{trace ? t('preview.trace.count', { count: traced }) : ''}</span>
      </div>
      {trace && <TraceOverlay onCount={setTraced} theme={theme} />}
    </>
  );
}
