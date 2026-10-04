import { useId, useRef, useState } from 'react';
import { Button } from '../../ds/Button';
import { useI18n } from '../../i18n';
import type { PeriodUnit, SubPeriodUnit } from '../action/days';
import { Waveform } from '../live/Waveform';
import { CARD, DictateButton, FIELD, FOCUS, Portrait, TranscriptCard, TypingIndicator, type StageLayout, type StageNpc, type StageTurn } from './shared';

/** Fields you write or dictate. */
export type PlanTextField = 'goals' | 'measures' | 'owner' | 'support';
export type PlanField = PlanTextField | 'due';

export interface PlanFields {
  goals: string;
  measures: string;
  owner: string;
  /** The sub period of this period it is due by (4 reads "Day 4"). Null until picked. */
  due: number | null;
  /** Optional. */
  support: string;
}

export const PLAN_REQUIRED: PlanField[] = ['goals', 'measures', 'owner', 'due'];

/** The required fields still empty, in form order. */
export function missingFields(f: PlanFields): PlanField[] {
  return PLAN_REQUIRED.filter(k => (k === 'due' ? f.due === null : !f[k].trim()));
}

export interface PlanFormProps {
  fields: PlanFields;
  onChange: <K extends PlanField>(field: K, value: PlanFields[K]) => void;
  /** Starts or stops dictation into one field. The speech provider writes the transcript through `onChange`. */
  onDictate: (field: PlanTextField) => void;
  /** The field being dictated into, if any. */
  dictating?: PlanTextField | null;
  /** Mic levels while dictating. */
  levels?: number[];
  /** The current period ("Week 2"), and the sub periods left in it that the plan can be due by. */
  period: number;
  dueOptions: number[];
  periodUnit: PeriodUnit;
  subPeriodUnit: SubPeriodUnit;
  /** Who checks in on the plan after you submit. */
  reviewer: StageNpc;
  /** Called only when every required field is filled. */
  onSubmit: () => void;
  submitted: boolean;
  /** The 2 minute check in after submitting. A streaming NPC turn with no words yet reads "Priya is reading your plan". */
  checkIn: StageTurn[];
  onReplay?: (turnId: string) => void;
  layout?: StageLayout;
}

const TEXT_ROWS: Record<PlanTextField, number> = { goals: 3, measures: 2, owner: 1, support: 2 };
const ORDER: PlanField[] = ['goals', 'measures', 'owner', 'due', 'support'];

/**
 * A written plan: goals, measures, owner, due (a sub period left in this period) and support
 * needed. Each text field can be dictated with its own mic, and the transcript lands in the field to
 * edit. Submitting checks the required fields; then the plan turns read only and the reviewer's
 * 2 minute check in runs beside it as a transcript. Fills its parent.
 */
export function PlanForm(props: PlanFormProps) {
  const { fields, onChange, onDictate, dictating = null, levels = [], period, dueOptions, periodUnit, subPeriodUnit, reviewer, onSubmit, submitted, checkIn, onReplay, layout = 'desktop' } = props;
  const { t } = useI18n();
  const uid = useId();
  const mobile = layout === 'phone';
  const [tried, setTried] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const missing = tried ? missingFields(fields) : [];
  const label = (f: PlanField) => t('liveformats.plan.field', { field: f });
  const periodName = t('time.period', { unit: periodUnit, n: period });
  const dueLabel = t('liveformats.plan.due', { unit: subPeriodUnit });
  const id = (f: PlanField, part = 'input') => `${uid}-${f}-${part}`;

  const submit = () => {
    const miss = missingFields(fields);
    if (miss.length) {
      setTried(true);
      const first = miss[0];
      const el = first === 'due' ? formRef.current?.querySelector<HTMLInputElement>(`input[name="${id('due')}"]`) : document.getElementById(id(first));
      el?.focus();
      return;
    }
    onSubmit();
  };

  const error = (f: PlanField) => missing.includes(f) && (
    <span id={id(f, 'error')} className="text-12 font-700 text-status-attention">{t('liveformats.plan.missing', { field: f === 'due' ? 'due' : 'text', label: label(f) })}</span>
  );

  const rowShell = (f: PlanField, labelEl: React.ReactNode, body: React.ReactNode) => (
    <div key={f} className={`border-b border-line-default ${mobile ? 'flex flex-col gap-1.5 px-3.5 py-3' : 'grid grid-cols-(--il-liveformats-plan-row-columns) items-start gap-3 px-4 py-3'}`}>
      {labelEl}
      {body}
    </div>
  );

  const textRow = (f: PlanTextField) => {
    const on = dictating === f;
    const describedBy = [missing.includes(f) ? id(f, 'error') : '', on ? id(f, 'live') : ''].filter(Boolean).join(' ') || undefined;
    const labelEl = (
      <label htmlFor={id(f)} className={`flex flex-col text-13 ${mobile ? 'font-700' : 'pt-2 text-fg-secondary'}`}>
        <span>{label(f)}</span>
        {f === 'support' && <span className="text-12 font-400 text-fg-secondary">{t('liveformats.plan.optional')}</span>}
      </label>
    );
    const mic = <DictateButton on={on} label={t('liveformats.plan.dictate', { state: on ? 'on' : 'off', field: label(f) })} onPress={() => onDictate(f)} />;
    const input = f === 'owner'
      ? <input id={id(f)} value={fields.owner} onChange={e => onChange('owner', e.target.value)} aria-invalid={missing.includes(f) || undefined} aria-describedby={describedBy}
          placeholder={t('liveformats.plan.placeholder', { field: f })} className={`h-10 w-full px-3 text-14 ${FIELD} ${FOCUS}`} />
      : <textarea id={id(f)} value={fields[f]} onChange={e => onChange(f, e.target.value)} rows={TEXT_ROWS[f]} aria-invalid={missing.includes(f) || undefined} aria-describedby={describedBy}
          placeholder={t('liveformats.plan.placeholder', { field: f })} className={`w-full resize-y px-3 py-2 text-14 leading-normal ${FIELD} ${FOCUS}`} />;
    const field = (
      <div className="flex min-w-0 flex-col gap-1.5">
        {mobile ? <div className="flex items-start gap-2"><div className="min-w-0 flex-1">{input}</div>{mic}</div> : input}
        {on && (
          <div id={id(f, 'live')} role="status" className="flex items-center gap-2.5 rounded-14 border border-accent-default bg-surface-material px-3.5 py-2.5 text-13">
            <Waveform levels={levels.slice(0, 12).map(w => Math.max(4, w / 2))} size="sm" />
            <span>{t('liveformats.plan.dictating', { field: label(f) })}</span>
          </div>
        )}
        {error(f)}
      </div>
    );
    return rowShell(f, labelEl, mobile ? field : <>{field}<span className="pt-1">{mic}</span></>);
  };

  const dueRow = () => {
    const hint = dueOptions.length ? t('liveformats.plan.dueHint', { period: periodName }) : t('liveformats.plan.dueNone', { period: periodName });
    const describedBy = [id('due', 'hint'), missing.includes('due') ? id('due', 'error') : ''].filter(Boolean).join(' ');
    return rowShell('due',
      <span id={id('due', 'label')} className={`text-13 ${mobile ? 'font-700' : 'pt-2 text-fg-secondary'}`}>{dueLabel}</span>,
      <div className="flex min-w-0 flex-col gap-1.5">
        <div role="radiogroup" aria-labelledby={id('due', 'label')} aria-describedby={describedBy} aria-invalid={missing.includes('due') || undefined} className="flex flex-wrap gap-2">
          {dueOptions.map(n => (
            <label key={n} className={`flex h-8.5 cursor-pointer items-center rounded-pill border border-solid border-line-strong px-3.5 text-13 font-700 has-checked:border-transparent has-checked:bg-(image:--il-fill-brand) has-checked:text-brand-deep-space has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent-secondary`}>
              <input type="radio" name={id('due')} value={n} checked={fields.due === n} onChange={() => onChange('due', n)} className="sr-only" />
              {t('time.subPeriod', { unit: subPeriodUnit, n })}
            </label>
          ))}
        </div>
        <span id={id('due', 'hint')} className="text-12 text-fg-secondary">{hint}</span>
        {error('due')}
      </div>
    );
  };

  if (!submitted) {
    return (
      <form ref={formRef} aria-label={t('liveformats.plan.aria')} noValidate onSubmit={e => { e.preventDefault(); submit(); }}
        className={`flex size-full min-h-0 flex-col overflow-hidden ${CARD}`}>
        <div className={`flex flex-col gap-1 border-b border-line-default ${mobile ? 'px-3.5 py-3' : 'px-4 py-3.5'}`}>
          <h2 className="m-0 text-17 font-700">{t('liveformats.plan.title')}</h2>
          <span className="text-13 text-fg-secondary">{t('liveformats.plan.intro', { name: reviewer.firstName })}</span>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          {ORDER.map(f => (f === 'due' ? dueRow() : textRow(f)))}
        </div>
        <div className={`flex items-center gap-2.5 ${mobile ? 'px-3.5 py-3' : 'px-4 py-3'}`}>
          <span className="flex-1 text-12 text-fg-secondary">{t('liveformats.plan.footer')}</span>
          <Button variant="primary" size="md" onClick={submit}>{t('liveformats.plan.submit')}</Button>
        </div>
      </form>
    );
  }

  const last = checkIn.at(-1);
  const reading = checkIn.length === 0 || (last?.speaker === 'npc' && last.streaming && !last.text);
  const summary = (
    <section aria-labelledby={`${uid}-summary`} className={`flex min-h-0 flex-col overflow-hidden ${CARD}`}>
      <div className="flex items-center justify-between gap-2 border-b border-line-default px-4 py-3">
        <h2 id={`${uid}-summary`} className="m-0 text-15 font-700">{t('liveformats.plan.title')}</h2>
        <span className="rounded-pill bg-status-gain-soft px-2.5 py-0.5 text-12 font-700">{t('liveformats.plan.submitted')}</span>
      </div>
      <dl className="m-0 flex flex-col gap-3 overflow-auto p-4">
        {ORDER.map(f => {
          const v = f === 'due' ? (fields.due === null ? '' : t('time.subPeriod', { unit: subPeriodUnit, n: fields.due })) : fields[f].trim();
          return (
            <div key={f} className="flex flex-col gap-0.5 text-13">
              <dt className="text-12 font-700 text-fg-secondary">{f === 'due' ? dueLabel : label(f)}</dt>
              <dd className={`m-0 whitespace-pre-line text-pretty ${v ? '' : 'text-fg-secondary'}`}>{v || t('liveformats.cv.empty')}</dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
  const checkInCard = (
    <TranscriptCard turns={checkIn} npcName={reviewer.firstName} label={t('liveformats.plan.checkIn.title', { name: reviewer.firstName })} onReplay={onReplay}
      pending={reading ? <TypingIndicator name={reviewer.firstName} state="reading" /> : null}
      className={mobile ? 'h-100 flex-none' : ''}
      header={
        <div className="flex items-center gap-3 border-b border-line-default px-4 py-3">
          <Portrait img={reviewer.img} size="sm" mood={reviewer.mood} />
          <div className="flex min-w-0 flex-1 flex-col">
            <h2 className="m-0 truncate text-15 font-700">{t('liveformats.plan.checkIn.title', { name: mobile ? reviewer.firstName : reviewer.name })}</h2>
            <span className="text-12 text-fg-secondary">{t('liveformats.plan.checkIn.sub')}</span>
          </div>
          <span className="text-12 text-fg-secondary">{t('liveformats.transcript.saved')}</span>
        </div>
      } />
  );
  return (
    <div className={mobile ? 'flex size-full min-h-0 flex-col gap-2.5 overflow-auto *:flex-none' : 'grid size-full min-h-0 grid-cols-(--il-liveformats-plan-columns) gap-5'}>
      {mobile ? <>{checkInCard}{summary}</> : <>{summary}{checkInCard}</>}
    </div>
  );
}
