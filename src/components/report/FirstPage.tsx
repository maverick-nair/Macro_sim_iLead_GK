import { useId, type MouseEvent } from 'react';
import { useI18n } from '../../i18n';
import { usePurpose, useReport } from './context';
import { TONE_TEXT } from './display';
import { listNames } from './engine';
import type { BriefData } from './types';
import './messages';

/**
 * The report's first page (D235): it stands alone, so a manager reads it in five minutes and knows what to
 * do. Three findings, three things to do on Monday (in assessment, the development needs for the assessor),
 * the two moments that mattered most with what was said, then the way into the full report.
 */

const H2 = 'm-0 font-display text-36 leading-tight font-400';
const CARD = 'flex flex-col gap-1.5 border border-line-default px-3.5 py-3 text-14';
const NUMBER = 'flex min-h-7 min-w-7 self-start items-center justify-center rounded-round px-1 bg-(image:--il-fill-brand) text-13 text-button-on-solid';
const FOCUS = 'focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accent-secondary';

/** "Three findings": the most important things the run showed, each marked by whether it helped or held back. */
export function FindingsSection({ findings }: { findings: BriefData['findings'] }) {
  const { t, number } = useI18n();
  const purpose = usePurpose();
  const id = useId();
  return (
    <section aria-labelledby={`${id}h`} className="flex flex-col gap-2.5">
      <h2 id={`${id}h`} className={H2}>{t('report.brief.findings')}</h2>
      <p className="m-0 text-13 text-fg-secondary">{t('report.brief.findingsIntro', { purpose })}</p>
      <ol className="m-0 flex list-none flex-col gap-2.5 p-0">
        {findings.map((f, i) => (
          <li key={f.key} className={`${CARD} grid grid-cols-(--il-report-plan-columns) gap-2.5`}>
            <b className={NUMBER}>{number(i + 1)}</b>
            <span className="text-pretty">
              {f.tone !== 'neutral' && <><b className={TONE_TEXT[f.tone === 'positive' ? 'gain' : 'attention']}>{t('report.drivers.tone', { tone: f.tone })}</b>{t('report.separator')}</>}
              {f.text}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** "Three things to do on Monday", each with the skill it builds; in assessment, the development needs against the bar. */
export function MondaySection({ actions }: { actions: BriefData['actions'] }) {
  const { t, number } = useI18n();
  const purpose = usePurpose();
  const id = useId();
  return (
    <section aria-labelledby={`${id}h`} className="flex flex-col gap-2.5">
      <h2 id={`${id}h`} className={H2}>{t('report.brief.actions', { purpose })}</h2>
      <p className="m-0 text-13 text-fg-secondary">{t('report.brief.actionsIntro', { purpose })}</p>
      <ol className="m-0 flex list-none flex-col gap-2.5 p-0">
        {actions.map((a, i) => (
          <li key={a.key} className={`${CARD} grid grid-cols-(--il-report-plan-columns) gap-2.5`}>
            <b className={NUMBER}>{number(i + 1)}</b>
            <span className="flex flex-col gap-1">
              {purpose === 'assessment' && a.skill && <b>{a.skill}</b>}
              <span className="text-pretty">{a.text}</span>
              {purpose !== 'assessment' && a.skill && <span className="text-12 text-fg-secondary">{t('report.brief.builds', { skill: a.skill })}</span>}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** "The two moments that mattered most": what happened, a short replay of what was said, and what it changed. */
export function BriefMomentsSection({ moments }: { moments: BriefData['moments'] }) {
  const { t } = useI18n();
  const purpose = usePurpose();
  const id = useId();
  return (
    <section aria-labelledby={`${id}h`} className="flex flex-col gap-2.5">
      <h2 id={`${id}h`} className={H2}>{t('report.brief.moments', { n: moments.length })}</h2>
      <div className="grid grid-cols-(--il-report-halves-columns) gap-2.5">
        {moments.map(m => (
          <article key={m.key} aria-labelledby={`${id}${m.key}`} className={`${CARD} text-13`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className={`rounded-4 border px-2 py-0.5 text-12 font-600 ${m.kind === 'best' ? 'border-status-gain text-status-gain' : 'border-status-attention text-status-attention'}`}>
                {t('report.moments.kind', { kind: m.kind, purpose })}
              </span>
              <span className="text-12 text-fg-secondary">{m.when}</span>
            </div>
            <h3 id={`${id}${m.key}`} className="m-0 font-serif text-21 leading-snug font-400 text-pretty">{m.title}</h3>
            <p className="m-0 text-pretty">{m.situation}</p>
            {m.replay.length > 0 && (
              <figure className="m-0 flex flex-col gap-1 border-s-2 border-line-control ps-3">
                <figcaption className="text-12 font-600 text-fg-secondary">{t('report.brief.replay')}</figcaption>
                {m.replay.map(l => (
                  <p key={l.key} className="m-0 text-pretty">
                    <b className={l.you ? '' : 'text-fg-secondary'}>{t('report.brief.speaker', { who: l.who })}</b>{' '}
                    <span className="font-serif">{t('report.quote', { text: l.text })}</span>
                  </p>
                ))}
              </figure>
            )}
            <p className="m-0 text-pretty"><b>{t('report.moments.term', { term: 'impact' })}</b>{t('report.separator')}{m.impact}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export interface FullReportNavProps {
  open: boolean;
  onToggle: () => void;
  /** Every section of the full report, in order, with its anchor. */
  contents: Array<{ key: string; title: string }>;
  /** A link was followed: open the full report and go to that section. */
  onGo: (key: string) => void;
  /** The id of the full report's first section, controlled by the button while it is open. */
  controls?: string;
}

/** "See the full report": the disclosure and the contents of the full report, every section a link (D235). */
export function FullReportNav({ open, onToggle, contents, onGo, controls }: FullReportNavProps) {
  const { t } = useI18n();
  const { print } = useReport();
  const id = useId();
  if (print) return null;
  const go = (e: MouseEvent<HTMLAnchorElement>, key: string) => {
    if (open) return;
    e.preventDefault();
    onGo(key);
  };
  return (
    <nav aria-labelledby={`${id}h`} className="flex flex-col gap-3 border-t border-line-default pt-5 print:hidden">
      <h2 id={`${id}h`} className={H2}>{t('report.full.title')}</h2>
      <p className="m-0 text-14 text-fg-secondary">{t('report.full.intro', { n: contents.length })}</p>
      <div>
        <button type="button" aria-expanded={open} aria-controls={open ? controls : undefined} onClick={onToggle}
          className={`min-h-11 cursor-pointer rounded-4 border border-line-control bg-surface-card px-4 py-2 text-14 font-600 text-fg-primary ${FOCUS}`}>
          {t('report.full.toggle', { open: String(open) })}
        </button>
      </div>
      <ol aria-label={t('report.full.contents')} className="m-0 grid list-none gap-x-6 gap-y-1 p-0 text-14 grid-cols-(--il-report-halves-columns)">
        {contents.map(c => (
          <li key={c.key}>
            <a href={`#report-${c.key}`} onClick={e => go(e, c.key)} className={`text-fg-primary underline underline-offset-2 ${FOCUS}`}>{c.title}</a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** The full report's last line: what was left out for want of evidence, and why (D235). */
export function LeftOutNote({ names }: { names: string[] }) {
  const i18n = useI18n();
  return <p className="m-0 border-t border-line-default pt-3 text-13 text-fg-secondary text-pretty">{i18n.t('report.leftOut', { list: listNames(i18n, names) })}</p>;
}
