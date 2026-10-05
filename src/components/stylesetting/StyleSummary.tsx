import { useEffect, useRef, type KeyboardEvent } from 'react';
import { Button, NoWrapButton } from '../../ds/Button';
import { useI18n } from '../../i18n';
import { StyleAvatar } from './StyleSettingList';
import { shortName, styleChanged, type PeriodUnit, type StyleSettingMember } from './types';

export interface StyleSummaryProps {
  members: StyleSettingMember[];
  periodUnit: PeriodUnit;
  period: number;
  onBack: () => void;
  onConfirm: () => void;
  confirmDisabled: boolean;
  /**
   * Opened by the participant: focus moves into the dialog, stays there (the page behind is inert)
   * and returns to the opener when it closes. Off when the screen starts on the summary, as the
   * design frames do.
   */
  focusOnOpen?: boolean;
  /** `phone`: over the viewport (the page can be long), one person per line, scrolls inside, 48px buttons. */
  layout?: 'desktop' | 'phone';
}

const TABBABLE = 'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Makes everything outside `keep` inert (no focus, no pointer, hidden from assistive tech), the way
 * a modal dialog's background should be. Returns the undo.
 */
function inertOutside(keep: HTMLElement): () => void {
  const changed: HTMLElement[] = [];
  for (let el: HTMLElement | null = keep; el && el !== document.body; el = el.parentElement) {
    for (const sib of Array.from(el.parentElement?.children ?? [])) {
      // Live regions stay out of it, so a message about the dialog (a failed confirm) is still announced.
      if (sib === el || !(sib instanceof HTMLElement) || sib.inert || sib.tagName === 'SCRIPT' || sib.matches('[aria-live], [role="status"], [role="alert"]')) continue;
      sib.inert = true;
      changed.push(sib);
    }
  }
  return () => changed.forEach(el => { el.inert = false; });
}

/**
 * Summary and confirm: a table of every choice (two members per line, with "Changed" where the style
 * differs from last period's), when away members' styles apply, then Go back or Confirm.
 * A modal dialog: Tab stays inside, Escape goes back.
 */
export function StyleSummary({ members, periodUnit, period, onBack, onConfirm, confirmDisabled, focusOnOpen = true, layout = 'desktop' }: StyleSummaryProps) {
  const phone = layout === 'phone';
  const { t } = useI18n();
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = dialog.current;
    if (!focusOnOpen || !el) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    el.focus({ preventScroll: true });
    const undo = inertOutside(el.parentElement ?? el);
    return () => {
      undo();
      // Go back returns to "Review and confirm". After Confirm the screen is gone and the board takes over.
      const active = document.activeElement;
      if ((!active || active === document.body || el.contains(active)) && opener && opener !== document.body && opener.isConnected) opener.focus({ preventScroll: true });
    };
  }, [focusOnOpen]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') { e.stopPropagation(); onBack(); return; }
    if (e.key !== 'Tab' || !focusOnOpen) return;
    // Keep Tab inside the dialog: wrap from the last control to the first and back.
    const items = Array.from(dialog.current?.querySelectorAll<HTMLElement>(TABBABLE) ?? []);
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === first || active === dialog.current)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
  };

  const missing = members.filter(m => m.style === null).length;
  const notes = [
    t('stylesetting.summary.note'),
    ...members.filter(m => m.away).map(m => t('stylesetting.summary.away', { name: shortName(m), pronoun: m.pronoun ?? 'they', reason: m.awayReason ?? 'training' })),
    ...(missing > 0 ? [t('stylesetting.summary.missing', { count: missing })] : [])
  ];

  return (
    <div className={`${phone ? 'fixed px-(--il-phone-gutter-x) pt-(--il-phone-top) pb-(--il-phone-gutter-bottom)' : 'absolute p-6'} inset-0 z-40 flex items-center justify-center bg-surface-scrim backdrop-blur-(--il-stylesetting-summary-scrim-blur)`}>
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- Escape goes back, Tab stays inside */}
      <div ref={dialog} role="dialog" aria-modal="true" aria-label={t('stylesetting.summary.aria')} tabIndex={-1}
        onKeyDown={onKeyDown}
        className={`flex w-180 max-w-full animate-(--il-stylesetting-summary-enter) flex-col gap-4 rounded-26 border border-line-strong outline-none ${phone ? 'max-h-full overflow-y-auto bg-surface-solid p-5' : 'bg-surface-material p-6.5'}`}>
        <h2 className="m-0 text-24 font-700">{t('stylesetting.summary.title', { unit: periodUnit, n: period })}</h2>
        <div role="table" aria-label={t('stylesetting.summary.title', { unit: periodUnit, n: period })} className={`grid ${phone ? 'grid-cols-1' : 'grid-cols-2'} gap-x-6 gap-y-1.5`}>
          <div role="row" className="sr-only">
            <span role="columnheader">{t('stylesetting.list.member')}</span>
            <span role="columnheader">{t('stylesetting.summary.style')}</span>
            <span role="columnheader">{t('stylesetting.summary.change')}</span>
          </div>
          {members.map(m => (
            <div key={m.id} role="row" className="flex items-center gap-2.5 border-b border-line-default py-1.5">
              <StyleAvatar img={m.img} away={m.away} size="sm" />
              <b role="rowheader" className="flex-1 text-14">{m.name}</b>
              <span role="cell" className={`text-13 ${m.style === null ? 'text-fg-secondary' : ''}`}>{m.style === null ? t('stylesetting.summary.unset') : t('style.name', { style: m.style })}</span>
              {styleChanged(m)
                ? <span role="cell" className="text-12 font-700 text-accent-secondary">{t('stylesetting.summary.changed')}</span>
                : <span role="cell" className="sr-only">{m.style !== null && m.lastStyle !== null ? t('stylesetting.summary.same', { unit: periodUnit }) : null}</span>}
            </div>
          ))}
        </div>
        <span className="text-13 text-fg-secondary">{notes.join(' ')}</span>
        {phone ? (
          <div className="grid grid-cols-2 gap-2.5">
            <Button variant="secondary" size="lg" onClick={onBack}>{t('stylesetting.back')}</Button>
            <Button variant="primary" size="lg" onClick={onConfirm} disabled={confirmDisabled}>{t('stylesetting.confirm')}</Button>
          </div>
        ) : (
          <div className="flex justify-end gap-2.5">
            <NoWrapButton variant="secondary" size="lg" onClick={onBack}>{t('stylesetting.back')}</NoWrapButton>
            <NoWrapButton variant="primary" size="lg" onClick={onConfirm} disabled={confirmDisabled}>{t('stylesetting.confirm')}</NoWrapButton>
          </div>
        )}
      </div>
    </div>
  );
}
