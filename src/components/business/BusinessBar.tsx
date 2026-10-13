import { useId, useState, type ReactNode } from 'react';
import { useI18n } from '../../i18n';

export interface BusinessItem {
  key: string;
  name: string;
  /** Formatted: "$60K", "70%", "62". */
  value: string;
  /** Since the start of the period, and whether that is good news for this variable. */
  dir: 'up' | 'down' | 'flat';
  better: boolean | null;
  about: string | null;
  /** The last causes of its moves, newest first, with the change formatted ("−$10K"). */
  causes: Array<{ text: string; change: string; dir: 'up' | 'down' }>;
}

export interface DecisionDue {
  id: string;
  title: string;
  /** "2 days left", "Due today". */
  due: string;
}

export interface BusinessBarProps {
  items: BusinessItem[];
  decisions: DecisionDue[];
  onDecide: (id: string) => void;
  /** More of the business in the same row: the stakeholders (D162). */
  aside?: ReactNode;
}

const FOCUS = 'focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accent-secondary';

/**
 * The business on the board (D136, D137): one slim row under the team metrics with each shown business variable,
 * its trend since the start of the period and, on tap, what it means and what moved it; then any decision still
 * waiting, with its deadline and Decide. Shown only when the storyline has variables or a decision is open, so
 * storylines without them keep the board as it was. It wraps instead of scrolling at the tablet widths.
 */
export function BusinessBar({ items, decisions, onDecide, aside }: BusinessBarProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState<string | null>(null);
  const id = useId();
  if (!items.length && !decisions.length && !aside) return null;
  const row = items.length > 0 || !!aside;
  return (
    <section aria-label={t('board.business.aria')} data-business-bar="" className="mx-8 mt-3 flex flex-col gap-2 short:mt-2 tablet:mx-5 tablet-portrait:mx-6">
      {row && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 border border-line-strong bg-surface-card px-3 py-1.5 text-13 short:py-1">
          {items.length > 0 && <span className="text-12 font-600 uppercase tracking-(--il-tracking-eyebrow) text-fg-body">{t('board.business.title')}</span>}
          {items.map(v => {
            const tone = v.better === null ? 'text-fg-secondary' : v.better ? 'text-status-gain' : 'text-status-decline';
            const popId = `${id}${v.key}`;
            return (
              <div key={v.key} className="relative">
                <button type="button" aria-expanded={open === v.key} aria-controls={open === v.key ? popId : undefined} onClick={() => setOpen(o => (o === v.key ? null : v.key))}
                  aria-label={t('board.business.itemAria', { name: v.name, value: v.value, dir: v.dir, better: String(v.better) })}
                  className={`flex min-h-7 cursor-pointer items-center gap-1.5 rounded-4 border border-line-strong bg-transparent px-2.5 text-13 text-fg-primary ${FOCUS}`}>
                  <span className="text-fg-body">{v.name}</span>
                  <b className="font-mono font-500">{v.value}</b>
                  {v.dir !== 'flat' && <span aria-hidden="true" className={`text-11 ${tone}`}>{v.dir === 'up' ? '▲' : '▼'}</span>}
                </button>
                {open === v.key && (
                  <div id={popId} className="absolute start-0 top-full z-40 mt-2 flex w-72 flex-col gap-2 rounded-4 border border-line-strong bg-surface-card p-3.5 text-13 shadow-(--il-metrics-popover-shadow)">
                    {v.about && <span>{v.about}</span>}
                    <b>{t('board.business.causes')}</b>
                    {v.causes.length === 0 && <span className="text-fg-secondary">{t('board.business.noCauses')}</span>}
                    {v.causes.map((c, i) => (
                      <span key={i}><b className={c.dir === 'up' ? 'text-status-gain' : 'text-status-decline'}>{c.change}</b> {c.text}</span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {aside}
        </div>
      )}
      {/* A decision still waiting: the canvas's navy strip, its deadline in words, Decide (D227). */}
      {decisions.map(d => (
        <div key={d.id} data-decision-due="" className="il-chrome flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1 border-b-0 px-3.5 py-1.5 text-14">
          <span className="text-12 font-600 uppercase tracking-[0.1em] whitespace-nowrap text-status-attention">{t('board.business.decision')} · {d.due}</span>
          <span className="min-w-0 flex-1 truncate text-15">{d.title}</span>
          <button type="button" onClick={() => onDecide(d.id)}
            className={`flex min-h-9 flex-none cursor-pointer items-center gap-2 rounded-4 border-0 bg-transparent px-2 text-13 text-fg-primary hover:bg-surface-raised ${FOCUS}`}>
            {t('board.business.decide')}<span className="sr-only"> {d.title}</span>
            <svg className="size-4 rtl:-scale-x-100" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
          </button>
        </div>
      ))}
    </section>
  );
}
