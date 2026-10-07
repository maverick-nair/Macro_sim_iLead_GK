import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import type { StyleKey } from '../../data/types';
import { NoWrapButton } from '../../ds/Button';
import { Heading } from '../Heading';
import { useI18n } from '../../i18n';
import { useLens } from '../style/lens';
import { mark, rich } from './rich';
import { StyleSettingCard } from './StyleSettingCard';
import { StyleSettingList } from './StyleSettingList';
import { StyleSummary } from './StyleSummary';
import { initials, type PeriodUnit, type StyleSettingMember } from './types';

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
  /**
   * Standalone (the default) the view is the page's `main` and its "Week 2 of 8" line is the `h1`.
   * Inside a page that has its own `main` and `h1` (the engine board), it renders a plain region and an `h2`.
   */
  embedded?: boolean;
}

const LAYOUTS: readonly StyleSettingLayout[] = ['cards', 'list'];
export const focus = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-secondary';

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

/**
 * Grid for the intro. Four styles sit beside the sponsor's prompt as designed; any other count puts the
 * prompt on its own row and the styles under it, all in one row from 1280 wide, in rows of three below.
 */
const WIDE: Record<number, string> = { 2: 'grid-cols-2', 3: 'grid-cols-3', 5: 'grid-cols-3 wide:grid-cols-5', 6: 'grid-cols-3 wide:grid-cols-6' };
const introGrid = (n: number) => (n === 4
  ? { className: 'grid-cols-(--il-stylesetting-intro-columns) tablet-portrait:grid-cols-4', prompt: 'tablet-portrait:col-span-full' }
  : { className: WIDE[n] ?? 'grid-cols-3', prompt: 'col-span-full' });

/** The sponsor's prompt, then the lens's style definitions. */
function Intro({ sponsorName, sponsorLine }: { sponsorName: string; sponsorLine: string }) {
  const { t } = useI18n();
  const lens = useLens();
  const defsId = useId();
  const grid = introGrid(lens.styles.length);
  return (
    <div id={defsId} data-tour="style-definitions" className={`grid ${grid.className} gap-3`}>
      <div className={`flex items-center gap-3 rounded-18 border border-line-default bg-surface-card px-3.5 py-3 ${grid.prompt}`}>
        <span aria-hidden="true" className="flex size-11 flex-none items-center justify-center rounded-round bg-(image:--il-fill-brand) font-700 text-brand-deep-space">{initials(sponsorName)}</span>
        <span className="text-14 text-pretty">
          <span className="sr-only">{t('stylesetting.sponsor.says', { name: sponsorName })}</span>
          {t('common.quote', { text: sponsorLine })}
        </span>
        <a href={`#${defsId}`} className={`sr-only text-13 font-700 focus:not-sr-only ${focus}`}>{t('stylesetting.sponsor.definitions', { count: lens.styles.length })}</a>
      </div>
      <div role="list" aria-label={t('stylesetting.definitions.aria')} className="contents">
        {lens.styles.map(s => (
          <div key={s.key} role="listitem" className="flex items-start gap-2.5 rounded-18 border border-line-default bg-surface-card px-3.5 py-3">
            <span aria-hidden="true" className={`flex size-7.5 flex-none items-center justify-center rounded-round bg-(image:--il-fill-brand) font-700 text-brand-deep-space ${s.letter.length > 1 ? 'text-12' : ''}`}>{s.letter}</span>
            <span className="flex flex-col">
              <b className="text-14">{s.name}</b>
              <span className="text-12 leading-(--il-stylesetting-intro-leading) text-fg-secondary">{s.description}</span>
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
 * The screen is the page's main landmark, headed by its visible "Week 2 of 8 · Style setting" line.
 */
export function StyleSettingView(p: StyleSettingViewProps) {
  const { t, number } = useI18n();
  const { members, periodUnit, view } = p;
  const layout: StyleSettingLayout = view === 'summary' ? p.summaryOver ?? 'cards' : view;
  const set = members.filter(m => m.style !== null).length;
  const complete = set === members.length;
  const confirmDisabled = p.confirmDisabled ?? !complete;

  // Focus moves into the summary when it opens, but not when the screen starts on it.
  const [sawOther, setSawOther] = useState(view !== 'summary');
  if (view !== 'summary' && !sawOther) setSawOther(true);
  const focusSummary = sawOther;

  const where = t('stylesetting.where', { period: mark(0), total: number(p.periodCount) });
  const tipFor = (id: string) => (p.tooltip === undefined ? undefined : p.tooltip?.id === id ? p.tooltip.style : null);

  const Root = p.embedded ? 'div' : 'main';
  return (
    <Root className="flex flex-1 flex-col gap-4.5 px-8 pt-5 pb-8 tablet-portrait:px-6 tablet-portrait:pb-30" style={{ minHeight: p.minHeight }}>
      <header className="flex items-center gap-4">
        <span className="bg-(image:--il-fill-brand) bg-clip-text text-22 font-700 tracking-(--il-stylesetting-logo-tracking) text-transparent">{t('hud.logo')}</span>
        {/* The screen's heading is the visible "Week 2 of 8 · Style setting", styled as designed. */}
        <Heading level={p.embedded ? 2 : 1} className="m-0 text-13 font-400 whitespace-nowrap text-fg-secondary">
          {rich(where, [<b key="p" className="text-fg-primary">{t('time.period', { unit: periodUnit, n: p.period })}</b>])}
        </Heading>
        <span className="flex-1" />
        <span role="status" className={complete ? 'sr-only' : 'text-13 whitespace-nowrap text-fg-secondary'}>
          {t('stylesetting.progress', { set: number(set), total: number(members.length) })}
        </span>
        <LayoutToggle value={layout} onChange={p.onViewChange} />
        <span data-tour="style-confirm" className="inline-flex flex-none tablet-portrait:hidden"><NoWrapButton variant="primary" size="md" onClick={() => p.onViewChange('summary')}>{t('stylesetting.review')}</NoWrapButton></span>
      </header>
      {/* A portrait tablet confirms from a bar at the bottom, in reach of a thumb (D73). */}
      <div className="hidden tablet-portrait:fixed tablet-portrait:inset-x-6 tablet-portrait:bottom-6 tablet-portrait:z-30 tablet-portrait:flex items-center gap-3 rounded-20 border border-line-default bg-surface-material py-2.5 pe-2.5 ps-5 backdrop-blur-20">
        <span className="flex-1 text-14 text-fg-secondary">{t('stylesetting.bar')}</span>
        <NoWrapButton variant="primary" size="lg" onClick={() => p.onViewChange('summary')}>{t('stylesetting.review')}</NoWrapButton>
      </div>

      <Intro sponsorName={p.sponsorName} sponsorLine={p.sponsorLine} />

      {layout === 'cards' && (
        <div className="grid grid-cols-5 gap-3.5 tablet-portrait:grid-cols-3">
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
    </Root>
  );
}

