import { useId } from 'react';
import { useI18n } from '../../i18n';
import type { MomentData } from './types';

/**
 * "Key moments": five to seven incidents in situation, behaviour, impact form, each with the style the
 * participant had set for that person. Not in the design; built in its card language.
 */
export function MomentsSection({ moments }: { moments: MomentData[] }) {
  const { t } = useI18n();
  const id = useId();
  return (
    <section aria-labelledby={`${id}h`} className="flex flex-col gap-3">
      <h2 id={`${id}h`} className="m-0 text-20 font-700">{t('report.moments.title')}</h2>
      {moments.length === 0 && <p className="m-0 text-14 text-fg-secondary">{t('report.moments.none')}</p>}
      <div className="grid grid-cols-(--il-report-cards-columns) gap-2.5">
        {moments.map(m => (
          <article key={m.key} aria-labelledby={`${id}${m.key}`} className="flex flex-col gap-2 rounded-16 border border-line-default px-3.5 py-3 text-13">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className={`rounded-pill border px-2 py-0.5 text-12 font-700 ${m.kind === 'best' ? 'border-status-gain text-status-gain' : 'border-status-attention text-status-attention'}`}>
                {t('report.moments.kind', { kind: m.kind })}
              </span>
              <span className="text-12 text-fg-secondary">{m.when}</span>
            </div>
            <h3 id={`${id}${m.key}`} className="m-0 text-15 font-700 text-pretty">{m.title}</h3>
            <dl className="m-0 flex flex-col gap-1.5">
              <div><dt className="text-12 font-700 text-fg-secondary">{t('report.moments.term', { term: 'situation' })}</dt><dd className="m-0 text-pretty">{m.situation}</dd></div>
              <div>
                <dt className="text-12 font-700 text-fg-secondary">{t('report.moments.term', { term: 'behaviour' })}</dt>
                <dd className="m-0 text-pretty">{m.behaviour}{m.quote && <span className="mt-1 block text-fg-secondary">{t('report.quote', { text: m.quote })}</span>}</dd>
              </div>
              <div><dt className="text-12 font-700 text-fg-secondary">{t('report.moments.term', { term: 'impact' })}</dt><dd className="m-0 text-pretty">{m.impact}</dd></div>
              {m.intent && <div><dt className="text-12 font-700 text-fg-secondary">{t('report.moments.term', { term: 'intent' })}</dt><dd className="m-0">{t('report.moments.intent', { style: m.intent })}</dd></div>}
            </dl>
          </article>
        ))}
      </div>
    </section>
  );
}
