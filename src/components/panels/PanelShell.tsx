import './messages';
import * as Dialog from '@radix-ui/react-dialog';
import { useId, useRef, type ReactNode } from 'react';
import { useI18n } from '../../i18n';
import { onRovingKey } from '../roving';

export interface PanelTab<K extends string = string> { key: K; label: string }

export interface PanelShellProps<K extends string = string> {
  title: string;
  /** One line under the title. */
  intro?: string;
  /** Tabs across the top; the body shows the chosen one. */
  tabs?: Array<PanelTab<K>>;
  tab?: K;
  onTab?: (tab: K) => void;
  /** Controls under the tabs that stay in view while the body scrolls (History's filters). */
  toolbar?: ReactNode;
  onClose: () => void;
  /** Where focus goes when the panel closes; Radix returns it to the opener by default. */
  returnFocus?: () => HTMLElement | null | undefined;
  /** A wider panel, for tables (the overviews). */
  wide?: boolean;
  children: ReactNode;
}

/** Icon glyph, not copy: the button is named from the catalog. */
const CLOSE_GLYPH = '✕';
export const PANEL_FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-secondary';
const BODY = `flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain px-6 py-5 short:px-5 short:py-4 ${PANEL_FOCUS} focus-visible:-outline-offset-2`;

/**
 * The in play panels (Objectives, Tutorial and video, History, the overviews, the leaderboard, every
 * action), as a sheet at the side of the board (D89). A Radix modal dialog: focus moves to its title, Tab
 * stays inside, Escape and Close shut it and focus goes back to what opened it; the board behind is inert
 * and the session clock holds while it is open. The header, tabs and toolbar stay put and the body
 * scrolls inside the sheet, so the sheet always fits the window (D101).
 */
export function PanelShell<K extends string>({ title, intro, tabs, tab, onTab, toolbar, onClose, returnFocus, wide, children }: PanelShellProps<K>) {
  const { t } = useI18n();
  const heading = useRef<HTMLHeadingElement>(null);
  const id = useId();
  const index = tabs && tab ? Math.max(0, tabs.findIndex(x => x.key === tab)) : 0;
  return (
    <Dialog.Root open onOpenChange={o => { if (!o) onClose(); }}>
      <Dialog.Overlay className="fixed inset-0 z-48 flex justify-end bg-surface-scrim p-3 backdrop-blur-12 short:p-2">
        <Dialog.Content
          aria-modal="true"
          {...(intro ? {} : { 'aria-describedby': undefined })}
          onOpenAutoFocus={e => { e.preventDefault(); heading.current?.focus({ preventScroll: true }); }}
          onCloseAutoFocus={e => { const el = returnFocus?.(); if (el) { e.preventDefault(); el.focus({ preventScroll: true }); } }}
          data-panel=""
          className={`flex h-full max-h-full w-full ${wide ? 'max-w-(--il-panel-wide-width)' : 'max-w-(--il-panel-width)'} animate-(--il-event-card-enter) flex-col overflow-hidden rounded-26 border border-line-strong bg-surface-solid shadow-(--il-event-card-shadow) outline-0`}>
          <div className="flex flex-none flex-col gap-3 border-b border-line-default px-6 pt-5 pb-4 short:gap-2 short:px-5 short:pt-4 short:pb-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-col gap-1">
                <Dialog.Title ref={heading} tabIndex={-1} className="m-0 text-22 font-700 tracking-(--il-tracking-title) outline-0 short:text-20">{title}</Dialog.Title>
                {intro && <Dialog.Description className="m-0 text-13 text-fg-secondary">{intro}</Dialog.Description>}
              </div>
              <Dialog.Close aria-label={t('panels.close')} className={`size-8 flex-none cursor-pointer rounded-round border-0 bg-surface-raised p-0 text-fg-primary ${PANEL_FOCUS}`}>
                <span aria-hidden="true">{CLOSE_GLYPH}</span>
              </Dialog.Close>
            </div>
            {tabs && tabs.length > 1 && onTab && (
              <div role="tablist" aria-label={t('panels.tabs', { title })} className="flex flex-wrap gap-0.5 self-start rounded-pill border border-line-default bg-surface-raised p-0.75">
                {tabs.map((x, j) => {
                  const on = j === index;
                  return (
                    <button key={x.key} type="button" role="tab" id={`${id}-${x.key}`} aria-selected={on} aria-controls={`${id}-panel`} tabIndex={on ? 0 : -1}
                      onClick={() => onTab(x.key)} onKeyDown={e => onRovingKey(e, j, tabs.length, i => onTab(tabs[i].key))}
                      className={`min-h-8 cursor-pointer rounded-pill border-0 px-3.5 py-0 text-13 font-700 whitespace-nowrap ${PANEL_FOCUS} ${on ? 'bg-(image:--il-fill-brand) text-brand-deep-space' : 'bg-transparent text-fg-secondary hover:text-fg-primary'}`}>
                      {x.label}
                    </button>
                  );
                })}
              </div>
            )}
            {toolbar}
          </div>
          {/* The body scrolls inside the sheet; it takes focus so the keyboard can scroll it (WCAG 2.1.1). */}
          {tabs && tabs.length > 1
            ? <div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-${tabs[index].key}`} tabIndex={0} className={BODY}>{children}</div>
            : <div id={`${id}-panel`} role="region" aria-label={title} tabIndex={0} className={BODY}>{children}</div>}
        </Dialog.Content>
      </Dialog.Overlay>
    </Dialog.Root>
  );
}

/** A section heading inside a panel. */
export function PanelHeading({ children, id }: { children: ReactNode; id?: string }) {
  return <h3 id={id} className="m-0 text-16 font-700">{children}</h3>;
}
