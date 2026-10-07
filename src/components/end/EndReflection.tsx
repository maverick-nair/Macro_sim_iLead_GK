import { useId, type ReactNode } from 'react';
import { NoWrapButton } from '../../ds/Button';
import { useI18n } from '../../i18n';
import { onRovingKey } from '../roving';
import type { EndReflection as Reflection } from './types';
import './messages';

const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-secondary';
const RATINGS = [1, 2, 3, 4, 5];

export interface EndReflectionProps extends Reflection {
  /** The report buttons, under the reflection. */
  /** Buttons under the questions. The end screen keeps its report actions in a bar of its own (D101). */
  actions?: ReactNode;
}

/**
 * The reflection panel: the authored questions (0 to 3), each answered by text or dictated by voice
 * into the box for editing, the 1 to 5 experience rating (a radio group: arrows choose), an optional
 * save row, then the report buttons.
 */
export function EndReflection({ questions, answers, rating, onAnswer, onRate, dictating = null, onMic, save, actions }: EndReflectionProps) {
  const { t } = useI18n();
  const base = useId();
  const count = questions.length;
  return (
    <div className="flex flex-col gap-3.5 rounded-24 border border-line-strong bg-surface-material p-5">
      <h2 className="m-0 text-20 font-700">{t('end.reflect.title', { count })}</h2>
      <span className="text-13 text-fg-secondary">{t('end.reflect.lead', { count })}</span>
      {questions.map((q, i) => {
        const listening = dictating === i;
        return (
          <div key={i} className="flex flex-col gap-1.5">
            <label htmlFor={`${base}-q${i}`} className="text-14 font-700">{q}</label>
            <div className="flex items-start gap-2">
              <textarea
                id={`${base}-q${i}`}
                value={answers[i] ?? ''}
                onChange={e => onAnswer(i, e.target.value)}
                rows={3}
                maxLength={2000}
                placeholder={t('end.reflect.placeholder')}
                className={`flex-1 resize-none rounded-14 border border-line-strong bg-surface-raised px-3 py-2.5 text-14 text-fg-primary ${FOCUS}`}
              ></textarea>
              <button type="button" onClick={() => onMic(i)} aria-label={t('end.reflect.mic', { listening: String(listening) })} aria-pressed={listening}
                className={`flex size-11 flex-none cursor-pointer items-center justify-center rounded-round border-0 bg-(image:--il-fill-brand) text-brand-deep-space ${FOCUS} ${listening ? 'outline-2 outline-offset-2 outline-accent-secondary' : ''}`}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path>
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                </svg>
              </button>
            </div>
          </div>
        );
      })}
      {/* Dictation is announced here; the words appear in the box as they are heard. */}
      <span role="status" className="sr-only">{dictating !== null ? t('end.reflect.listening') : ''}</span>
      <div className="flex flex-col gap-1.5 border-t border-line-default pt-1">
        <b className="pt-2.5 text-14">{t('end.rating.title')}</b>
        <div role="radiogroup" aria-label={t('end.rating.aria')} className="flex gap-1.5">
          {RATINGS.map((n, i) => {
            const on = rating === n;
            const inTab = on || (rating === null && i === 0);
            return (
              <button key={n} type="button" role="radio" aria-checked={on} aria-label={t('end.rating.option', { n })} tabIndex={inTab ? 0 : -1}
                onClick={() => onRate(n)} onKeyDown={e => onRovingKey(e, i, RATINGS.length, j => onRate(RATINGS[j]))}
                className={`size-11 cursor-pointer rounded-round border-(length:--il-end-rating-border) border-solid font-700 ${FOCUS} ${on ? 'border-transparent bg-(image:--il-fill-brand) text-brand-deep-space' : 'border-line-strong bg-transparent text-fg-primary'}`}>
                {n}
              </button>
            );
          })}
        </div>
      </div>
      {save && (
        <div className="flex flex-wrap items-center gap-3">
          <NoWrapButton variant="secondary" size="md" disabled={save.busy} onClick={save.onSave}>{t('end.save')}</NoWrapButton>
          <span role="status" className="text-13 text-fg-secondary">{t('end.save.state', { state: save.state })}</span>
        </div>
      )}
      {actions && <div className="flex flex-wrap gap-2.5 pt-1.5">{actions}</div>}
    </div>
  );
}
