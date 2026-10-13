import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import type { StyleKey } from '../../data/types';
import { Heading } from '../Heading';
import { useI18n } from '../../i18n';
import { useLens } from '../style/lens';
import { mark, rich } from './rich';
import { StyleSettingCard } from './StyleSettingCard';
import { ScrollArea } from '../shell/ScrollArea';
import { StyleSettingList } from './StyleSettingList';
import { StyleSummary } from './StyleSummary';
import type { PeriodUnit, StyleSettingMember } from './types';
import { ILeadLogo } from '../shell/Logo';

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
  /** The storyline's organisation, in the header as on the desk; the iLead logo without one. */
  organisation?: string | null;
  /** Where the run stands, at the header's end (the money and the score, as on the desk). */
  status?: ReactNode;
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
export const focus = 'focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accent-secondary';

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
    <div role="radiogroup" aria-label={t('stylesetting.view.aria')} className="flex gap-0.5 rounded-4 border border-line-strong bg-surface-card p-0.5">
      {LAYOUTS.map((k, i) => {
        const on = value === k;
        return (
          <button key={k} ref={el => { refs.current[i] = el; }} type="button" role="radio" aria-checked={on} tabIndex={on ? 0 : -1}
            onClick={() => onChange(k)} onKeyDown={e => onKey(e, i)}
            className={`h-8 cursor-pointer rounded-3 border-0 px-3 py-0 text-13 font-500 ${focus} ${on ? 'bg-(image:--il-fill-brand) text-button-on-solid' : 'bg-transparent text-fg-secondary'}`}>
            {t('stylesetting.view', { view: k })}
          </button>
        );
      })}
    </div>
  );
}

/** The lens's styles, named in Newsreader with what each means, then the sponsor's word for the week (D227). */
function Definitions({ sponsorName, sponsorLine }: { sponsorName: string; sponsorLine: string }) {
  const { t } = useI18n();
  const lens = useLens();
  const id = useId();
  return (
    <section aria-labelledby={id} data-tour="style-definitions" className="flex flex-col gap-4 tablet-portrait:gap-2">
      <h2 id={id} className="m-0 text-13 font-600 uppercase tracking-(--il-tracking-eyebrow-wide) text-fg-secondary">{t('stylesetting.defs.title', { count: lens.styles.length })}</h2>
      <dl aria-label={t('stylesetting.definitions.aria')} className="m-0 flex flex-col gap-3 tablet-portrait:grid tablet-portrait:grid-cols-4 tablet-portrait:gap-3 short:gap-2">
        {lens.styles.map(s => (
          <div key={s.key}>
            <dt className="font-serif text-21 leading-snug short:text-18">{s.name}</dt>
            <dd className="m-0 mt-0.5 text-14 leading-normal text-fg-secondary short:text-13">{s.description}</dd>
          </div>
        ))}
      </dl>
      <figure className="m-0 border-s-2 border-accent-default py-1 ps-3 text-13 leading-normal tablet-portrait:hidden">
        <blockquote className="m-0 text-fg-primary">{t('common.quote', { text: sponsorLine })}</blockquote>
        <figcaption className="mt-1 text-fg-secondary">{sponsorName}</figcaption>
      </figure>
    </section>
  );
}

/**
 * The weekly (or monthly, or yearly) style setting screen, before any action in the period, as the approved canvas
 * draws it (D227): the navy header, the question in Newsreader with how many are chosen, every member as a column with
 * their photo and the styles by name (or the list), and beside them the styles' meanings, the sponsor's word, and
 * Review and confirm, which opens the summary to confirm. Data in, intents out: the engine owns the styles, the reasons
 * and the period. Standalone the screen is the page's main landmark, headed by its "Week 2 of 8 · Style setting" line.
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
  const review = (
    <button type="button" onClick={() => p.onViewChange('summary')}
      className={`inline-flex min-h-14 w-full cursor-pointer items-center justify-center rounded-4 border-0 px-5 text-16 font-600 whitespace-nowrap ${complete ? 'bg-(image:--il-fill-brand) text-button-on-solid' : 'bg-(--il-color-canvas-sand-400) text-(--il-color-canvas-ink) [color-scheme:light]'} ${focus}`}>
      {t('stylesetting.review')}
    </button>
  );

  const Root = p.embedded ? 'div' : 'main';
  return (
    <Root data-trace="lens.styles" className="flex min-h-0 flex-1 flex-col" style={{ minHeight: p.minHeight }}>
      <header className="il-chrome flex h-16 flex-none items-center gap-5.5 px-11 text-14 whitespace-nowrap tablet:gap-3 tablet:px-6">
        {p.organisation ? <span className="font-serif text-22 leading-none">{p.organisation}</span> : <ILeadLogo size="sm" />}
        {/* The screen's heading is the visible "Week 2 of 8 · Style setting". */}
        <Heading level={p.embedded ? 2 : 1} className="m-0 text-14 font-400 text-fg-secondary">
          {rich(where, [<b key="p" className="font-500 text-fg-primary">{t('time.period', { unit: periodUnit, n: p.period })}</b>])}
        </Heading>
        <span className="text-12 font-600 uppercase tracking-(--il-tracking-eyebrow-wide) text-accent-secondary tablet:hidden">{t('stylesetting.eyebrow')}</span>
        <span className="flex-1" />
        {p.status}
      </header>
      {/* A portrait tablet confirms from a bar at the bottom, in reach of a thumb (D73). */}
      <div className="hidden tablet-portrait:fixed tablet-portrait:inset-x-6 tablet-portrait:bottom-6 tablet-portrait:z-30 tablet-portrait:flex items-center gap-3 rounded-4 border border-line-strong bg-surface-material py-2.5 pe-2.5 ps-5">
        <span className="flex-1 text-14 text-fg-secondary">{t('stylesetting.bar')}</span>
        <span className="w-60">{review}</span>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-(--il-canvas-stylesetting-columns) gap-7 px-11 py-5.5 short:py-3.5 tablet:grid-cols-(--il-canvas-stylesetting-columns-tablet) tablet:gap-5 tablet:px-7 tablet-portrait:grid-cols-1 tablet-portrait:pb-30">
        <div className="flex min-h-0 min-w-0 flex-col gap-3.5 short:gap-2.5">
          <div className="flex items-end justify-between gap-4 border-b border-fg-primary pb-3 short:pb-2">
            <p className="m-0 font-display text-38 leading-(--il-canvas-leading-display) text-pretty short:text-30 tablet:text-30">{t('stylesetting.question', { unit: periodUnit })}</p>
            <span className="flex flex-none items-center gap-3">
              <span role="status" className="text-14 whitespace-nowrap text-fg-secondary">{t('stylesetting.progress', { set: number(set), total: number(members.length) })}</span>
              <LayoutToggle value={layout} onChange={p.onViewChange} />
            </span>
          </div>
          {/* The team scrolls inside the screen when it does not fit the window (D101); the header and Review stay put. */}
          <ScrollArea label={t('stylesetting.team.aria')} className="-mx-2 px-2 pb-1">
            {layout === 'cards' && (
              <div className="grid grid-cols-5 gap-x-3 gap-y-6 short:gap-y-4 tablet-portrait:grid-cols-3">
                {members.map(m => (
                  <StyleSettingCard key={m.id} member={m} periodUnit={periodUnit}
                    onStyle={k => p.onStyle(m.id, k)} onRationale={text => p.onRationale(m.id, text)}
                    tooltip={tipFor(m.id)} onTooltipChange={p.onTooltipChange && (k => p.onTooltipChange!(k ? { id: m.id, style: k } : null))}
                    rationaleAddon={p.rationaleAddon?.(m.id)} />
                ))}
              </div>
            )}
            {layout === 'list' && <StyleSettingList members={members} periodUnit={periodUnit} onStyle={p.onStyle} />}
          </ScrollArea>
        </div>
        <aside className="flex min-h-0 flex-col gap-4 overflow-y-auto border-s border-line-default ps-7 tablet:ps-5 tablet-portrait:-order-1 tablet-portrait:border-s-0 tablet-portrait:ps-0">
          <Definitions sponsorName={p.sponsorName} sponsorLine={p.sponsorLine} />
          <span className="flex-1" />
          <span data-tour="style-confirm" className="flex flex-col gap-2 tablet-portrait:hidden">
            {review}
            <span className="text-center text-13 text-fg-secondary">{complete ? t('stylesetting.summary.note') : t('stylesetting.summary.missing', { count: members.length - set })}</span>
          </span>
        </aside>
      </div>

      {view === 'summary' && (
        <StyleSummary members={members} periodUnit={periodUnit} period={p.period} onBack={p.onBack} onConfirm={p.onConfirm} confirmDisabled={confirmDisabled} focusOnOpen={focusSummary} />
      )}
    </Root>
  );
}
