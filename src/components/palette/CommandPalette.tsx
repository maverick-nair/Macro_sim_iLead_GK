import * as Dialog from '@radix-ui/react-dialog';
import { useLayoutEffect, useRef, type KeyboardEvent } from 'react';
import { inertOutside } from '../../lib/inertOutside';
import { useI18n } from '../../i18n';

/** Backdrop behind a result's icon: a portrait backdrop by mood, or the brand fill for actions. */
export type PaletteTone = 'calm' | 'warm' | 'away' | 'brand';

export interface PaletteResult {
  id: string;
  name: string;
  /** Right aligned detail: a member's title, an action's day cost. */
  detail: string;
  /** Portrait for people; actions have none. */
  img?: string;
  tone: PaletteTone;
  onRun: () => void;
}

export interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  query: string;
  onQueryChange: (q: string) => void;
  /** Already filtered and ranked. Enter runs the first one. */
  results: PaletteResult[];
}

const TONE: Record<PaletteTone, string> = {
  calm: 'bg-portrait-calm',
  warm: 'bg-portrait-warm',
  away: 'bg-portrait-away',
  brand: 'bg-brand'
};

/**
 * Cmd K palette over the board: find a teammate or an action. A Radix Dialog rendered in place, so
 * it covers the board only: focus moves to the input, Tab and Shift Tab loop inside, Escape and a
 * click outside close it, and focus returns to whatever opened it.
 *
 * Radix runs non modal on purpose. Its modal mode sets pointer-events none on the body, which
 * re-rasterizes the board behind the scrim (gradient pills shift by up to 28/255). The scrim already
 * blocks pointer input and a click on it closes the palette, so the visible behavior is the same.
 * The page behind is `inert` while it is open (D23, D84): no focus, no clicks, hidden from screen
 * readers, as a modal's background should be, without the pixel change.
 */
export function CommandPalette({ open, onClose, query, onQueryChange, results }: CommandPaletteProps) {
  const { t } = useI18n();
  const opener = useRef<HTMLElement | null>(null);
  const searching = query.trim() !== '';
  const scrim = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => (open && scrim.current ? inertOutside(scrim.current) : undefined), [open]);
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && results[0]) { e.preventDefault(); results[0].onRun(); }
  };
  return (
    <Dialog.Root modal={false} open={open} onOpenChange={o => { if (!o) onClose(); }}>
      {/* Dialog.Overlay only renders in modal mode, so the scrim is a plain element. */}
      {open && (
        <div ref={scrim} className="absolute inset-0 z-49 flex items-start justify-center bg-surface-scrim pt-(--il-palette-offset)">
          <Dialog.Content
            // There is no Dialog.Trigger (the HUD button and Cmd K both open it), so remember the opener.
            onOpenAutoFocus={() => { opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; }}
            onCloseAutoFocus={e => { e.preventDefault(); opener.current?.focus(); }}
            aria-modal="true"
            className="w-(--il-palette-width) max-w-(--il-palette-max-width) overflow-hidden rounded-20 border border-line-strong bg-surface-material backdrop-blur-24 outline-0">
            <Dialog.Title className="sr-only">{t('palette.title')}</Dialog.Title>
            <Dialog.Description className="sr-only">{t('palette.hint')}</Dialog.Description>
            <input value={query} onChange={e => onQueryChange(e.target.value)} onKeyDown={onKeyDown}
              placeholder={t('palette.placeholder')} aria-label={t('palette.placeholder')}
              className="h-14 w-full border-0 border-b border-solid border-line-default bg-transparent px-4.5 py-0 text-15 text-fg-primary outline-0 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent-secondary" />
            <div className="flex max-h-(--il-palette-results-max-height) flex-col gap-0.5 overflow-auto p-2">
              {results.map((r, i) => (
                <button key={r.id} type="button" onClick={r.onRun}
                  className={`flex cursor-pointer items-center gap-3 rounded-12 border-0 px-3 py-2 text-start text-fg-primary hover:bg-surface-raised focus-visible:outline-2 focus-visible:outline-accent-secondary ${i === 0 && searching ? 'bg-surface-raised' : 'bg-transparent'}`}>
                  <span className={`size-7.5 flex-none overflow-hidden rounded-round ${TONE[r.tone]}`}>
                    {r.img && <img src={r.img} alt="" className="size-full object-cover object-top mix-blend-multiply" />}
                  </span>
                  <b className="flex-1 text-14">{r.name}</b>
                  <span className="text-12 text-fg-secondary">{r.detail}</span>
                </button>
              ))}
            </div>
            <span role="status" className="sr-only">{searching ? t('palette.results', { count: results.length }) : ''}</span>
          </Dialog.Content>
        </div>
      )}
    </Dialog.Root>
  );
}
