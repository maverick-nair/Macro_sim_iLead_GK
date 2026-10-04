import { useId } from 'react';
import { Switch } from '../../ds/Switch';
import { useI18n } from '../../i18n';
import { onRovingKey } from '../roving';
import { AppDialog, DialogDescription, DialogTitle } from './AppDialog';

export type InputMode = 'text' | 'ptt' | 'open';

export interface SettingsValues {
  /** Text size in percent: 100, 125, 150 or 200. */
  text: number;
  input: InputMode;
  captions: boolean;
  reduced: boolean;
  clock: boolean;
  /** Consent to capture voice: null until asked, false keeps play text only. */
  voiceConsent: boolean | null;
}

export interface SettingsDialogProps {
  values: SettingsValues;
  onChange: (patch: Partial<SettingsValues>) => void;
  onClose: () => void;
  /** Offer the voice consent switch. The playable app does; the design frame (x1) has none. */
  voiceConsent?: boolean;
  frozen?: boolean;
  returnFocus?: () => HTMLElement | null;
}

/** Icon glyph, not copy: the button is named from the catalog. */
const CLOSE_GLYPH = '✕';
const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-secondary';
export const TEXT_SIZES = [100, 125, 150, 200];
const INPUTS: InputMode[] = ['text', 'ptt', 'open'];

interface ChoiceRowProps<V extends string | number> {
  label: string;
  hint: string;
  options: Array<{ value: V; name: string }>;
  value: V;
  onPick: (value: V) => void;
}

/** A labelled segmented radio group; the arrow keys move and pick. */
function ChoiceRow<V extends string | number>({ label, hint, options, value, onPick }: ChoiceRowProps<V>) {
  const id = useId();
  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between gap-3">
        <span id={id} className="font-700">{label}</span>
        <span className="text-12 text-fg-secondary">{hint}</span>
      </div>
      <div role="radiogroup" aria-labelledby={id} className="flex gap-0.5 rounded-pill border border-line-default bg-surface-raised p-0.75">
        {options.map((o, j) => {
          const on = o.value === value;
          return (
            <button key={String(o.value)} type="button" role="radio" aria-checked={on} tabIndex={on || (j === 0 && !options.some(x => x.value === value)) ? 0 : -1}
              onClick={() => onPick(o.value)} onKeyDown={e => onRovingKey(e, j, options.length, i => onPick(options[i].value))}
              className={`min-h-8.5 flex-1 cursor-pointer rounded-pill border-0 text-13 font-700 ${FOCUS} ${on ? 'bg-(image:--il-fill-brand) text-brand-deep-space' : 'bg-transparent text-fg-secondary'}`}>
              {o.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Settings and accessibility: text size, how you respond, voice consent, captions, reduced motion and
 * the session clock. Every change applies and saves at once.
 */
export function SettingsDialog({ values, onChange, onClose, voiceConsent = false, frozen, returnFocus }: SettingsDialogProps) {
  const { t } = useI18n();
  return (
    <AppDialog onDismiss={onClose} frozen={frozen} returnFocus={returnFocus} described
      className="flex max-h-full w-140 flex-col gap-5.5 overflow-x-hidden overflow-y-auto p-7">
      <div className="flex items-center justify-between">
        <DialogTitle className="m-0 text-22 font-700">{t('settings.title')}</DialogTitle>
        <button type="button" onClick={onClose} aria-label={t('settings.close')}
          className={`size-9 cursor-pointer rounded-round border-0 bg-surface-raised leading-none text-fg-primary ${FOCUS}`}>{CLOSE_GLYPH}</button>
      </div>
      <ChoiceRow label={t('settings.text.label')} hint={t('settings.text.hint')} value={values.text} onPick={text => onChange({ text })}
        options={TEXT_SIZES.map(n => ({ value: n, name: t('settings.text.option', { n }) }))} />
      <ChoiceRow label={t('settings.input.label')} hint={t('settings.input.hint')} value={values.input} onPick={input => onChange({ input })}
        options={INPUTS.map(mode => ({ value: mode, name: t('settings.input.option', { mode }) }))} />
      <div className="flex flex-col gap-3.5 pt-1">
        {voiceConsent && <Switch label={t('settings.voiceConsent')} checked={values.voiceConsent === true} onChange={v => onChange({ voiceConsent: v })} />}
        <Switch label={t('settings.captions')} checked={values.captions} onChange={v => onChange({ captions: v })} />
        <Switch label={t('settings.reduced')} checked={values.reduced} onChange={v => onChange({ reduced: v })} />
        <Switch label={t('settings.clock')} checked={values.clock} onChange={v => onChange({ clock: v })} />
      </div>
      <DialogDescription className="m-0 text-12 text-fg-secondary">{t('settings.note')}</DialogDescription>
    </AppDialog>
  );
}
