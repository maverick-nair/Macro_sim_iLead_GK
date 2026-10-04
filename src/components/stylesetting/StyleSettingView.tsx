import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import type { StyleKey } from '../../data/types';
import { NoWrapButton } from '../../ds/Button';
import { useI18n } from '../../i18n';
import { STYLE_KEYS } from '../style/StyleControl';
import { mark, rich } from './rich';
import { StyleSettingCard } from './StyleSettingCard';
import { StyleSettingList } from './StyleSettingList';
import { StyleSummary } from './StyleSummary';
import type { PeriodUnit, StyleSettingMember } from './types';

export type StyleSettingLayout = 'cards' | 'list';
export type StyleSettingViewMode = StyleSettingLayout | 'summary';

/** The open style tooltip on the card view: whose control, which letter. */
export interface StyleSettingTooltip {
  id: string;
  style: StyleKey;
}

export interface StyleSettingViewProps {
  /** The storyline's period: "Week 2 of 8", "Last month", "Your styles for week 2". */
  periodUnit: PeriodUnit;
  /** Current period, 1 based. */
  period: number;
  /** Periods in the run, for "of 8". */
  periodCount: number;
  sponsorName: string;
  /** The sponsor's one line prompt, from the storyline, without quote marks. */
  sponsorLine: string;
  /** Cards, list, or the summary dialog over the `summaryOver` layout. */
  view: StyleSettingViewMode;
  /** The layout behind the summary dialog, so Go back returns to it. Defaults to cards. */
  summaryOver?: StyleSettingLayout;
  /** The view toggle picks cards or list; Review and confirm asks for the summary. */
  onViewChange: (view: StyleSettingViewMode) => void;
  members: StyleSettingMember[];
  onStyle: (id: string, style: StyleKey) => void;
  onRationale: (id: string, text: string) => void;
  onConfirm: () => void;
  /** Go back from the summary. */
  onBack: () => void;
  /** Defaults to true while any member has no style. */
  confirmDisabled?: boolean;
  /** Open style tooltip on the cards. Controlled when passed; otherwise each control keeps its own. */
  tooltip?: StyleSettingTooltip | null;
  onTooltipChange?: (tooltip: StyleSettingTooltip | null) => void;
  /** Voice note seam: a node per member beside the reason field (a mic button, later). */
  rationaleAddon?: (id: string) => ReactNode;
  /** The app shell's frame height, so the screen fills it. */
  minHeight?: string;
}

const LAYOUTS: readonly StyleSettingLayout[] = ['cards', 'list'];
const focus = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-secondary';

/** First letters of the first and last name, for the sponsor's avatar. */
const initials = (name: string) => {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return words.length === 0 ? '' : (words[0][0] + (words.length > 1 ? words[words.length - 1][0] : '')).toUpperCase();
};

/** Cards or List: a radio group with one tab stop; arrow keys move and pick. */
function LayoutToggle({ value, onChange }: { value: StyleSettingLayout; onChange: (v: StyleSettingLayout) => void }) {
  const { t } = useI18n();
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const onKey = (e: KeyboardEvent, i: number) => {
    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (i + step + LAYOUTS.length) % LAYOUTS.length;
    onChange(LAYOUTS[next]);
    refs.current[next]?.focus();
  };
  return (
    <div role="radiogroup" aria-label={t('stylesetting.view.aria')} className="flex gap-0.5 rounded-pill border border-line-default bg-surface-raised p-0.75">
      {LAYOUTS.map((k, i) => {
        const on = value === k;
        return (
          <button key={k} ref={el => { refs.current[i] = el; }} type="button" role="radio" aria-checked={on} tabIndex={on ? 0 : -1}
            onClick={() => onChange(k)} onKeyDown={e => onKey(e, i)}
            className={`h-8 cursor-pointer rounded-pill border-0 px-3.5 py-0 text-13 font-700 ${focus} ${on ? 'bg-transparent bg-(image:--il-fill-brand) text-brand-deep-space' : 'bg-transparent text-fg-secondary'}`}>
            {t('stylesetting.view', { view: k })}
          </button>
        );
      })}
    </div>
  );
}

/** The sponsor's prompt, then the four style definitions. */
function Intro({ sponsorName, sponsorLine }: { sponsorName: string; sponsorLine: string }) {
  const { t } = useI18n();
  const defsId = useId();
  return (
    <div id={defsId} className="grid grid-cols-(--il-stylesetting-intro-columns) gap-3">
      <div className="flex items-center gap-3 rounded-18 border border-line-default bg-surface-card px-3.5 py-3">
        <span aria-hidden="true" className="flex size-11 flex-none items-center justify-center rounded-round bg-(image:--il-fill-brand) font-700 text-brand-deep-space">{initials(sponsorName)}</span>
        <span className="text-14 text-pretty">
          <span className="sr-only">{t('stylesetting.sponsor.says', { name: sponsorName })}</span>
          {t('common.quote', { text: sponsorLine })}
        </span>
        <a href={`#${defsId}`} className={`sr-only text-13 font-700 focus:not-sr-only ${focus}`}>{t('stylesetting.sponsor.definitions')}</a>
      </div>
      <div role="list" aria-label={t('stylesetting.definitions.aria')} className="contents">
        {STYLE_KEYS.map(k => (
          <div key={k} role="listitem" className="flex items-start gap-2.5 rounded-18 border border-line-default bg-surface-card px-3.5 py-3">
            <span aria-hidden="true" className="flex size-7.5 flex-none items-center justify-center rounded-round bg-(image:--il-fill-brand) font-700 text-brand-deep-space">{t('style.letter', { style: k })}</span>
            <span className="flex flex-col">
              <b className="text-14">{t('style.name', { style: k })}</b>
              <span className="text-12 leading-(--il-stylesetting-intro-leading) text-fg-secondary">{t('style.description', { style: k })}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * The weekly (or monthly, or yearly) style setting screen, before any action in the period: the
 * sponsor's prompt and the style definitions, then every member as cards or as a list, and a summary
 * to confirm. Data in, intents out: the engine owns the styles, the reasons and the period.
 */
export function StyleSettingView(p: StyleSettingViewProps) {
  const { t, number } = useI18n();
  const { members, periodUnit, view } = p;
  const layout: StyleSettingLayout = view === 'summary' ? p.summaryOver ?? 'cards' : view;
  const set = members.filter(m => m.style !== null).length;
  const complete = set === members.length;
  const confirmDisabled = p.confirmDisabled ?? !complete;

  // Focus moves into the summary when it opens, but not when the screen starts on it.
  const sawOther = useRef(false);
  const focusSummary = sawOther.current;
  if (view !== 'summary') sawOther.current = true;

  const where = t('stylesetting.where', { period: mark(0), total: number(p.periodCount) });
  const tipFor = (id: string) => (p.tooltip === undefined ? undefined : p.tooltip?.id === id ? p.tooltip.style : null);

  return (
    <div className="flex flex-1 flex-col gap-4.5 px-8 pt-5 pb-8" style={{ minHeight: p.minHeight }}>
      <header className="flex items-center gap-4">
        <span className="bg-(image:--il-fill-brand) bg-clip-text text-22 font-700 tracking-(--il-stylesetting-logo-tracking) text-transparent">{t('hud.logo')}</span>
        <span className="text-13 whitespace-nowrap text-fg-secondary">
          {rich(where, [<b key="p" className="text-fg-primary">{t('time.period', { unit: periodUnit, n: p.period })}</b>])}
        </span>
        <span className="flex-1" />
        <span role="status" className={complete ? 'sr-only' : 'text-13 whitespace-nowrap text-fg-secondary'}>
          {t('stylesetting.progress', { set: number(set), total: number(members.length) })}
        </span>
        <LayoutToggle value={layout} onChange={p.onViewChange} />
        <NoWrapButton variant="primary" size="md" onClick={() => p.onViewChange('summary')}>{t('stylesetting.review')}</NoWrapButton>
      </header>

      <Intro sponsorName={p.sponsorName} sponsorLine={p.sponsorLine} />

      {layout === 'cards' && (
        <div className="grid grid-cols-5 gap-3.5">
          {members.map(m => (
            <StyleSettingCard key={m.id} member={m} periodUnit={periodUnit}
              onStyle={k => p.onStyle(m.id, k)} onRationale={text => p.onRationale(m.id, text)}
              tooltip={tipFor(m.id)} onTooltipChange={p.onTooltipChange && (k => p.onTooltipChange!(k ? { id: m.id, style: k } : null))}
              rationaleAddon={p.rationaleAddon?.(m.id)} />
          ))}
        </div>
      )}

      {layout === 'list' && <StyleSettingList members={members} periodUnit={periodUnit} onStyle={p.onStyle} />}

      {view === 'summary' && (
        <StyleSummary members={members} periodUnit={periodUnit} period={p.period} onBack={p.onBack} onConfirm={p.onConfirm} confirmDisabled={confirmDisabled} focusOnOpen={focusSummary} />
      )}
    </div>
  );
}
