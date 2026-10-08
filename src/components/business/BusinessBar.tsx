import { useId, useState } from 'react';
import { NoWrapButton } from '../../ds/Button';
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
}

const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-secondary';

/**
 * The business on the board (D136, D137): one slim row under the team metrics with each shown business variable,
 * its trend since the start of the period and, on tap, what it means and what moved it; then any decision still
 * waiting, with its deadline and Decide. Shown only when the storyline has variables or a decision is open, so
 * storylines without them keep the board as it was. It wraps instead of scrolling at the tablet widths.
 */
export function BusinessBar({ items, decisions, onDecide }: BusinessBarProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState<string | null>(null);
  const id = useId();
  if (!items.length && !decisions.length) return null;
  return (
    <section aria-label={t('board.business.aria')} data-business-bar=""
      className="mx-6 mb-3 flex flex-wrap items-center gap-x-2 gap-y-1.5 rounded-16 border border-line-default bg-surface-card px-3 py-1.5 text-13 backdrop-blur-12 short:mb-2 short:py-1 tablet-portrait:mt-3 tablet-portrait:mb-0">
      {items.length > 0 && <span className="text-12 font-700 text-fg-secondary">{t('board.business.title')}</span>}
      {items.map(v => {
        const tone = v.better === null ? 'text-fg-secondary' : v.better ? 'text-status-gain' : 'text-status-decline';
        const popId = `${id}${v.key}`;
        return (
          <div key={v.key} className="relative">
            <button type="button" aria-expanded={open === v.key} aria-controls={open === v.key ? popId : undefined} onClick={() => setOpen(o => (o === v.key ? null : v.key))}
              aria-label={t('board.business.itemAria', { name: v.name, value: v.value, dir: v.dir, better: String(v.better) })}
              className={`flex min-h-7 cursor-pointer items-center gap-1.5 rounded-pill border border-line-default bg-transparent px-2.5 text-13 text-fg-primary ${FOCUS}`}>
              <span className="text-fg-secondary">{v.name}</span>
              <b className="tabular-nums">{v.value}</b>
              {v.dir !== 'flat' && <span aria-hidden="true" className={`text-11 ${tone}`}>{v.dir === 'up' ? '▲' : '▼'}</span>}
            </button>
            {open === v.key && (
              <div id={popId} className="absolute start-0 top-full z-40 mt-2 flex w-72 flex-col gap-2 rounded-16 border border-line-strong bg-surface-material p-3.5 text-13 shadow-(--il-metrics-popover-shadow)">
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
      {decisions.map(d => (
        <span key={d.id} data-decision-due="" className="ms-auto flex items-center gap-2 rounded-pill bg-status-attention-soft py-0.5 ps-3 pe-1 text-13">
          <span><b>{t('board.business.decision')}</b> {d.title} <span className="text-fg-secondary">{d.due}</span></span>
          <NoWrapButton variant="secondary" size="sm" onClick={() => onDecide(d.id)}>{t('board.business.decide')}<span className="sr-only"> {d.title}</span></NoWrapButton>
        </span>
      ))}
    </section>
  );
}
