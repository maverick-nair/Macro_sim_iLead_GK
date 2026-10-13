import { useId, useState } from 'react';
import { useI18n } from '../../i18n';
import { useStyleName } from '../style/lens';
import type { EndMoment, PeriodUnit } from './types';
import './messages';
import { EYEBROW } from './display';

const FOCUS = 'focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accent-secondary';

export interface EndMomentsProps {
  moments: EndMoment[];
  periods: number;
  periodUnit: PeriodUnit;
}

/**
 * "Moments from your eight weeks": the key moments with portrait, title, when and a Best or Revisit
 * tag. Each row is a disclosure: it opens the moment in SBI form (situation, what you did, your words,
 * impact, and the style you had set). Rendered as the heading and the list, inside the caller's column.
 */
export function EndMoments({ moments, periods, periodUnit }: EndMomentsProps) {
  const { t } = useI18n();
  const styleName = useStyleName();
  const [open, setOpen] = useState<string[]>([]);
  const base = useId();
  const toggle = (id: string) => setOpen(o => (o.includes(id) ? o.filter(x => x !== id) : [...o, id]));
  return (
    <>
      <h2 className={EYEBROW}>{t('end.moments.title', { periods, unit: periodUnit })}</h2>
      {moments.length === 0 && <p className="m-0 text-13 text-fg-secondary">{t('end.moments.none')}</p>}
      {moments.length > 0 && (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {moments.map((m, i) => {
            const expanded = open.includes(m.id);
            const panel = `${base}-${i}`;
            return (
              <li key={m.id} className={`flex flex-col border border-s-2 border-line-default bg-surface-card ${m.kind === 'revisit' ? 'border-s-status-attention' : 'border-s-status-gain'}`}>
                <button type="button" aria-expanded={expanded} aria-controls={panel} onClick={() => toggle(m.id)}
                  className={`grid w-full cursor-pointer grid-cols-(--il-end-moment-columns) items-center gap-3.5 rounded-0 border-0 bg-transparent px-3.5 py-3 text-start text-fg-primary ${FOCUS}`}>
                  <span className="size-13 overflow-hidden bg-(image:--il-fill-portrait-calm)">
                    <img src={m.img} alt="" className="size-full object-cover object-top mix-blend-multiply" />
                  </span>
                  <span className="flex flex-col">
                    <b className="font-serif text-19 font-400">{m.title}</b>
                    <span className="text-13 text-fg-body">{t('end.moments.when', { unit: periodUnit, n: m.period, kind: m.kind })}</span>
                  </span>
                  <span className={`flex min-h-6 items-center px-2 py-0 text-12 font-600 uppercase tracking-(--il-tracking-eyebrow) ${m.kind === 'best' ? 'bg-status-gain-soft text-status-gain' : 'bg-status-attention-soft text-status-attention'}`}>{t('end.moments.tag', { kind: m.kind })}</span>
                </button>
                <dl id={panel} hidden={!expanded} className={`m-0 ${expanded ? 'flex' : 'hidden'} flex-col gap-2 border-t border-line-default px-3.5 pt-3 pb-3.5 text-13`}>
                  <div><dt className="text-12 font-600 uppercase tracking-(--il-tracking-eyebrow) text-fg-body">{t('end.moments.situation')}</dt><dd className="m-0">{m.situation}</dd></div>
                  <div><dt className="text-12 font-600 uppercase tracking-(--il-tracking-eyebrow) text-fg-body">{t('end.moments.behaviour')}</dt><dd className="m-0">{m.behaviour}</dd></div>
                  {m.quote && <div><dt className="text-12 font-600 uppercase tracking-(--il-tracking-eyebrow) text-fg-body">{t('end.moments.quote')}</dt><dd className="m-0"><q>{m.quote}</q></dd></div>}
                  <div><dt className="text-12 font-600 uppercase tracking-(--il-tracking-eyebrow) text-fg-body">{t('end.moments.impact')}</dt><dd className="m-0">{m.impact}</dd></div>
                  {m.intent && <div><dt className="text-12 font-600 uppercase tracking-(--il-tracking-eyebrow) text-fg-body">{t('end.moments.intent')}</dt><dd className="m-0">{styleName(m.intent)}</dd></div>}
                </dl>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
