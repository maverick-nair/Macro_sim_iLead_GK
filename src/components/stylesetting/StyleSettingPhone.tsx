import { useId, useState } from 'react';
import type { StyleKey } from '../../data/types';
import { Button } from '../../ds/Button';
import { useI18n } from '../../i18n';
import { Heading } from '../Heading';
import { STYLE_KEYS } from '../style/StyleControl';
import { rich } from './rich';
import { StyleSettingCard } from './StyleSettingCard';
import { focus, type StyleSettingViewProps } from './StyleSettingView';
import { StyleSummary } from './StyleSummary';
import { initials } from './types';

export interface StyleSettingPhoneProps extends StyleSettingViewProps {
  Root: 'div' | 'main';
  where: string;
  complete: boolean;
  set: number;
  confirmDisabled: boolean;
  focusSummary: boolean;
  tipFor: (id: string) => StyleKey | null | undefined;
}

/** The style setting screen on a phone (390). */
export function StyleSettingPhone(p: StyleSettingPhoneProps) {
  const { t, number } = useI18n();
  const [defsOpen, setDefsOpen] = useState(false);
  const defsId = useId();
  const { Root, members, periodUnit } = p;
  return (
    <Root className="flex flex-1 flex-col gap-4 px-(--il-phone-gutter-x) pt-(--il-phone-top) pb-(--il-phone-dock-reserve)" style={{ minHeight: p.minHeight }}>
      <header className="flex flex-col gap-1">
        <div className="flex flex-wrap items-baseline gap-x-3">
          <span className="bg-(image:--il-fill-brand) bg-clip-text text-20 font-700 tracking-(--il-stylesetting-logo-tracking) text-transparent">{t('hud.logo')}</span>
          <Heading level={p.embedded ? 2 : 1} className="m-0 text-13 font-400 text-fg-secondary">
            {rich(p.where, [<b key="p" className="text-fg-primary">{t('time.period', { unit: periodUnit, n: p.period })}</b>])}
          </Heading>
        </div>
      </header>
      <div className="flex items-center gap-3 rounded-18 border border-line-default bg-surface-card px-3.5 py-3">
        <span aria-hidden="true" className="flex size-11 flex-none items-center justify-center rounded-round bg-(image:--il-fill-brand) font-700 text-brand-deep-space">{initials(p.sponsorName)}</span>
        <span className="text-14 text-pretty">
          <span className="sr-only">{t('stylesetting.sponsor.says', { name: p.sponsorName })}</span>
          {t('common.quote', { text: p.sponsorLine })}
        </span>
      </div>
      <div className="flex flex-col gap-2">
        <button type="button" onClick={() => setDefsOpen(o => !o)} aria-expanded={defsOpen} aria-controls={defsOpen ? defsId : undefined}
          className={`flex min-h-11 cursor-pointer items-center gap-2 self-start rounded-pill border border-solid border-line-default bg-surface-card px-4 py-0 text-13 font-700 text-fg-primary ${focus}`}>
          {t('phone.styles.definitions', { open: String(defsOpen) })}
        </button>
        {defsOpen && (
          <div id={defsId} role="list" aria-label={t('stylesetting.definitions.aria')} className="flex flex-col gap-2">
            {STYLE_KEYS.map(k => (
              <div key={k} role="listitem" className="flex items-start gap-2.5 rounded-18 border border-line-default bg-surface-card px-3.5 py-3">
                <span aria-hidden="true" className="flex size-7.5 flex-none items-center justify-center rounded-round bg-(image:--il-fill-brand) font-700 text-brand-deep-space">{t('style.letter', { style: k })}</span>
                <span className="flex flex-col">
                  <b className="text-14">{t('style.name', { style: k })}</b>
                  <span className="text-13 text-pretty text-fg-secondary">{t('style.description', { style: k })}</span>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="flex flex-col gap-3">
        {members.map(m => (
          <StyleSettingCard key={m.id} member={m} periodUnit={periodUnit} layout="row"
            onStyle={k => p.onStyle(m.id, k)} onRationale={text => p.onRationale(m.id, text)}
            tooltip={p.tipFor(m.id)} onTooltipChange={p.onTooltipChange && (k => p.onTooltipChange!(k ? { id: m.id, style: k } : null))}
            rationaleAddon={p.rationaleAddon?.(m.id)} />
        ))}
      </div>
      {/* Review and confirm stays in reach of a thumb, with the count beside it. */}
      <div className="fixed inset-x-0 bottom-0 z-30 flex items-center gap-3 border-t border-line-default bg-surface-solid px-(--il-phone-gutter-x) pt-3 pb-(--il-phone-gutter-bottom) shadow-(--il-phone-dock-shadow)">
        <span role="status" className={p.complete ? 'sr-only' : 'min-w-0 flex-1 text-13 text-fg-secondary'}>
          {t('stylesetting.progress', { set: number(p.set), total: number(members.length) })}
        </span>
        {p.complete && <span className="flex-1" />}
        <span className="inline-flex flex-none whitespace-nowrap"><Button variant="primary" size="lg" onClick={() => p.onViewChange('summary')}>{t('stylesetting.review')}</Button></span>
      </div>
      {p.view === 'summary' && (
        <StyleSummary members={members} periodUnit={periodUnit} period={p.period} onBack={p.onBack} onConfirm={p.onConfirm} confirmDisabled={p.confirmDisabled} focusOnOpen={p.focusSummary} layout="phone" />
      )}
    </Root>
  );
}
