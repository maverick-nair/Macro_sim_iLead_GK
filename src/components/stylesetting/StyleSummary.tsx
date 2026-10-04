import { useEffect, useRef } from 'react';
import { NoWrapButton } from '../../ds/Button';
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
  /** Moves focus into the dialog when it opens. Off when the screen starts on the summary. */
  focusOnOpen?: boolean;
}

/**
 * Summary and confirm: a table of every choice (two members per line, with "Changed" where the style
 * differs from last period's), when away members' styles apply, then Go back or Confirm.
 * Escape goes back.
 */
export function StyleSummary({ members, periodUnit, period, onBack, onConfirm, confirmDisabled, focusOnOpen = true }: StyleSummaryProps) {
  const { t } = useI18n();
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => { if (focusOnOpen) dialog.current?.focus({ preventScroll: true }); }, [focusOnOpen]);

  const missing = members.filter(m => m.style === null).length;
  const notes = [
    t('stylesetting.summary.note'),
    ...members.filter(m => m.away).map(m => t('stylesetting.summary.away', { name: shortName(m), pronoun: m.pronoun ?? 'they', reason: m.awayReason ?? 'training' })),
    ...(missing > 0 ? [t('stylesetting.summary.missing', { count: missing })] : [])
  ];

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-surface-scrim p-6 backdrop-blur-(--il-stylesetting-summary-scrim-blur)">
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- Escape goes back */}
      <div ref={dialog} role="dialog" aria-modal="true" aria-label={t('stylesetting.summary.aria')} tabIndex={-1}
        onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); onBack(); } }}
        className="flex w-180 max-w-full animate-(--il-stylesetting-summary-enter) flex-col gap-4 rounded-26 border border-line-strong bg-surface-material p-6.5 outline-none">
        <h2 className="m-0 text-24 font-700">{t('stylesetting.summary.title', { unit: periodUnit, n: period })}</h2>
        <div role="table" aria-label={t('stylesetting.summary.title', { unit: periodUnit, n: period })} className="grid grid-cols-2 gap-x-6 gap-y-1.5">
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
        <div className="flex justify-end gap-2.5">
          <NoWrapButton variant="secondary" size="lg" onClick={onBack}>{t('stylesetting.back')}</NoWrapButton>
          <NoWrapButton variant="primary" size="lg" onClick={onConfirm} disabled={confirmDisabled}>{t('stylesetting.confirm')}</NoWrapButton>
        </div>
      </div>
    </div>
  );
}
