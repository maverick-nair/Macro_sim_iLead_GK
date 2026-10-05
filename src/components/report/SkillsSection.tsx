import { useId } from 'react';
import { useI18n } from '../../i18n';
import { useReport } from './context';
import { levelSegments } from './display';
import type { ReportQuote, SkillRowData } from './types';
import './messages';

/** A verbatim quote in curly quotes, then where it was said, kept on one line. */
function Quote({ q }: { q: ReportQuote }) {
  const { t } = useI18n();
  return (
    <span className="text-13 text-fg-secondary text-pretty">
      {t('report.quote', { text: q.text })}{' '}<span className="whitespace-nowrap">{q.when}</span>
    </span>
  );
}

export interface SkillsSectionProps {
  rows: SkillRowData[];
  /** The rating scale's level names, lowest first: one bar segment per level. */
  levels: string[];
}

/**
 * "Your leadership skills": one row per skill with its level as a segmented bar and the evidence.
 * The bar is a meter, named in words; a skill without enough evidence says so instead of a level.
 */
export function SkillsSection({ rows, levels }: SkillsSectionProps) {
  const { t, number } = useI18n();
  const { layout } = useReport();
  const id = useId();
  return (
    <section aria-labelledby={`${id}h`} className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id={`${id}h`} className="m-0 text-20 font-700">{t('report.skills.title')}</h2>
        <span className="text-12 text-fg-secondary">{t('report.skills.note')}</span>
      </div>
      {rows.map(k => {
        const label = k.level ? k.level.name : t('report.skills.noEvidence');
        const aria = k.level
          ? t('report.skills.aria', { skill: k.name, level: k.level.name, n: k.level.index + 1, total: levels.length })
          : t('report.skills.ariaNone', { skill: k.name });
        return (
          <div key={k.key} className={`grid items-center gap-3.5 border-t border-line-default py-2.5 ${layout === 'phone' ? 'grid-cols-(--il-report-skills-columns-phone)' : 'grid-cols-(--il-report-skills-columns)'}`}>
            <b className="text-14">{k.name}</b>
            <div className="flex items-center gap-2">
              <div role="img" aria-label={aria} className="flex gap-0.75">
                {levelSegments(k.level?.index ?? null, levels.length).map((on, i) => (
                  <span key={i} className={`h-2 w-6.5 rounded-4 ${on ? 'bg-accent-default' : 'bg-track'}`}></span>
                ))}
              </div>
              <span aria-hidden="true" className={`text-12 font-700 ${k.level ? '' : 'text-fg-secondary'}`}>{label}</span>
            </div>
            {k.more ? (
              <div className="flex flex-col gap-1">
                {k.more.anchor && <span className="text-13 text-pretty">{k.more.anchor}</span>}
                {k.quote && <Quote q={k.quote} />}
                {k.more.quotes.map(q => <Quote key={q.text} q={q} />)}
                <span className="text-12 text-fg-secondary">
                  {t('report.skills.observations', { n: k.more.observations, count: number(k.more.observations) })}
                  {k.more.capped && ` ${t('report.skills.capped', { level: levels[1] ?? '' })}`}
                </span>
              </div>
            ) : k.quote ? <Quote q={k.quote} /> : <span></span>}
          </div>
        );
      })}
    </section>
  );
}
