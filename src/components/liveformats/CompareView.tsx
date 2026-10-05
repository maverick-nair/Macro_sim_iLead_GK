import { useId, useState, type ReactNode } from 'react';
import { Button } from '../../ds/Button';
import { useI18n } from '../../i18n';
import { CV_FIELDS, CvValue, type Candidate } from './InterviewStage';
import { CARD, FOCUS } from './shared';

export type HireMark = 'hire' | 'pass';
export type HireMarks = Record<string, HireMark>;
/** The outcome of a comparison: exactly one hire, or a pass on both. */
export type CompareDecision = { kind: 'hire'; id: string } | { kind: 'passBoth' };

/** Marking one candidate Hire marks every other Pass, so there is never more than one hire. */
export function applyMark(marks: HireMarks, id: string, mark: HireMark, ids: string[]): HireMarks {
  if (mark === 'pass') return { ...marks, [id]: 'pass' };
  return Object.fromEntries(ids.map(x => [x, x === id ? 'hire' : 'pass'])) as HireMarks;
}

/** The decision the marks add up to, or null until every candidate is marked. */
export function decisionOf(marks: HireMarks, ids: string[]): CompareDecision | null {
  if (!ids.every(id => marks[id])) return null;
  const hires = ids.filter(id => marks[id] === 'hire');
  if (hires.length === 1) return { kind: 'hire', id: hires[0] };
  return hires.length === 0 ? { kind: 'passBoth' } : null;
}

export interface CompareViewProps {
  /** The two candidates you interviewed, in interview order. */
  candidates: [Candidate, Candidate];
  /** Your question notes for each, by candidate id. */
  notes: Record<string, string>;
  onHire: (id: string) => void;
  onPassBoth: () => void;
  /** Once confirmed, the view shows the decision and can no longer change it. */
  decided?: CompareDecision | null;
}

const FOCUS_WITHIN = 'has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent-secondary';
const MARK_ON: Record<HireMark, string> = {
  hire: 'has-checked:border-transparent has-checked:bg-(image:--il-fill-brand) has-checked:text-brand-deep-space',
  pass: 'has-checked:border-transparent has-checked:bg-fg-primary has-checked:text-surface-solid'
};

/**
 * The two interviewed candidates side by side, as a table: their CV fields and your notes in rows,
 * one column each, then Hire or Pass for each. Exactly one hire or a pass on both, confirmed with
 * one button. No portraits: the comparison rests on the CV and what you noted. Fills its parent.
 */
export function CompareView({ candidates, notes, onHire, onPassBoth, decided = null }: CompareViewProps) {
  const { t } = useI18n();
  const uid = useId();
  const ids = candidates.map(c => c.id);
  const [marks, setMarks] = useState<HireMarks>({});
  const shownMarks: HireMarks = decided ? Object.fromEntries(ids.map(id => [id, decided.kind === 'hire' && decided.id === id ? 'hire' : 'pass'])) : marks;
  const decision = decided ?? decisionOf(marks, ids);
  const nameOf = (id: string) => candidates.find(c => c.id === id)?.name ?? '';
  const otherOf = (id: string) => candidates.find(c => c.id !== id)?.name ?? '';
  const col = (i: number) => `${uid}-c${i}`;
  const titleId = `${uid}-title`;

  const confirm = () => {
    if (!decision) return;
    if (decision.kind === 'hire') onHire(decision.id);
    else onPassBoth();
  };

  const cell = 'border-t border-line-default px-3.5 py-3 text-left align-top text-13';
  const rowHead = (rid: string, label: string) => <th id={rid} scope="row" className={`${cell} w-(--il-liveformats-compare-label-width) font-400 text-fg-secondary`}>{label}</th>;
  const row = (key: string, label: string, render: (c: Candidate, i: number) => ReactNode) => {
    const rid = `${uid}-r-${key}`;
    const tds = candidates.map((c, i) => <td key={c.id} headers={`${col(i)} ${rid}`} className={cell}>{render(c, i)}</td>);
    return <tr key={key}>{rowHead(rid, label)}{tds}</tr>;
  };

  const decisionCell = (c: Candidate) => {
    if (decided) {
      const hired = shownMarks[c.id] === 'hire';
      return <b className={`inline-flex h-7.5 items-center rounded-pill px-3 text-13 ${hired ? 'bg-status-gain-soft text-fg-primary' : 'bg-surface-raised text-fg-secondary'}`}>{t('liveformats.compare.result', { mark: shownMarks[c.id] })}</b>;
    }
    return (
      <fieldset className="m-0 flex flex-wrap gap-2 border-0 p-0">
        <legend className="sr-only">{t('liveformats.compare.decisionFor', { name: c.name })}</legend>
        {(['hire', 'pass'] as HireMark[]).map(m => (
          <label key={m} className={`flex h-8.5 cursor-pointer items-center rounded-pill border border-solid border-line-control px-4 text-13 font-700 ${MARK_ON[m]} ${FOCUS_WITHIN}`}>
            <input type="radio" name={`${uid}-${c.id}`} value={m} checked={marks[c.id] === m} onChange={() => setMarks(x => applyMark(x, c.id, m, ids))} className="sr-only" />
            {t('liveformats.compare.mark', { mark: m })}
          </label>
        ))}
      </fieldset>
    );
  };

  const status = decided
    ? t('liveformats.compare.done', { kind: decided.kind, name: decided.kind === 'hire' ? nameOf(decided.id) : '' })
    : t('liveformats.compare.status', { kind: decision?.kind ?? 'none', name: decision?.kind === 'hire' ? nameOf(decision.id) : '', other: decision?.kind === 'hire' ? otherOf(decision.id) : '' });

  return (
    <section aria-labelledby={titleId} className={`flex size-full min-h-0 flex-col overflow-hidden ${CARD}`}>
      <div className="flex flex-col gap-1 border-b border-line-default px-5 py-4">
        <h2 id={titleId} className="m-0 text-18 font-700">{t('liveformats.compare.title')}</h2>
        <span className="text-13 text-fg-secondary">{t('liveformats.compare.intro')}</span>
      </div>
      <div role="region" aria-labelledby={titleId} tabIndex={0} className={`min-h-0 flex-1 overflow-auto ${FOCUS} focus-visible:-outline-offset-2`}>
        <table className="w-full table-fixed border-collapse">
          <caption className="sr-only">{t('liveformats.compare.caption', { a: candidates[0].name, b: candidates[1].name })}</caption>
          <thead>
            <tr>
              <th scope="col" className="w-(--il-liveformats-compare-label-width)"><span className="sr-only">{t('liveformats.compare.field')}</span></th>
              {candidates.map((c, i) => (
                <th key={c.id} id={col(i)} scope="col" className="px-3.5 py-3 text-left align-bottom">
                  <span className="block font-700 text-17">{c.name}</span>
                  <span className="block text-12 font-400 text-fg-secondary">{c.title}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {CV_FIELDS.map(f => row(f, t('liveformats.cv.field', { field: f }), c => <CvValue cv={c.cv} field={f} />))}
            {row('notes', t('liveformats.compare.notes'), c => notes[c.id]?.trim()
              ? <span className="whitespace-pre-line text-pretty">{notes[c.id]}</span>
              : <span className="text-fg-secondary">{t('liveformats.compare.notesEmpty')}</span>)}
            {row('decision', t('liveformats.compare.decision'), c => decisionCell(c))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-3 border-t border-line-default px-5 py-3.5">
        <span aria-live="polite" className={`flex-1 text-13 ${decided ? 'font-700' : 'text-fg-secondary'}`}>{status}</span>
        {!decided && (
          <Button variant="primary" size="md" disabled={!decision} onClick={confirm}>
            {t('liveformats.compare.confirm', { kind: decision?.kind ?? 'none', name: decision?.kind === 'hire' ? nameOf(decision.id) : '' })}
          </Button>
        )}
      </div>
    </section>
  );
}
