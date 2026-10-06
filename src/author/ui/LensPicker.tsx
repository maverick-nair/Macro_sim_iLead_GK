import { useId } from 'react';
import type { Recommendation } from '../../api/author';
import type { LensId } from '../../engine/lens';
import { LENS_BY_ID, LENS_LIBRARY } from '../lenses';
import { LensCard } from './LensCard';
import { BUTTON, CARD } from './parts';

export interface LensPickerProps {
  primary: LensId | null;
  secondary: LensId | null;
  recommendation: Recommendation | null;
  /** Locked once the draft exists: changing the lens goes through the warning. */
  disabled?: boolean;
  onPrimary: (id: LensId) => void;
  onSecondary: (id: LensId | null) => void;
}

/**
 * Module steps 1 to 4: all eight lenses in order, the recommendation in one sentence, one primary
 * (mandatory), an optional secondary that differs from it, and the "Works well with" hint.
 */
export function LensPicker({ primary, secondary, recommendation, disabled, onPrimary, onSecondary }: LensPickerProps) {
  const name = useId();
  const select = useId();
  const pair = primary ? LENS_BY_ID[primary].worksWith : null;
  return (
    <div className="flex flex-col gap-4">
      <p className="m-0 text-15 text-pretty">Your lens shapes the team, scenarios, scoring and participant report. Select one primary lens. Add a secondary lens if you want a richer report.</p>
      {recommendation && (
        <p className={`${CARD} m-0 border-accent-secondary p-3 text-14 text-pretty`} role="note">
          <b>Our recommendation. </b>{recommendation.reason}
        </p>
      )}
      <fieldset className="m-0 flex flex-col gap-2.5 border-0 p-0" disabled={disabled}>
        <legend className="mb-2 p-0 text-16 font-700">Primary lens (required)</legend>
        {LENS_LIBRARY.map((l, i) => (
          <LensCard key={l.id} lens={l} n={i + 1} name={name} checked={primary === l.id} recommended={recommendation?.id === l.id} disabled={disabled}
            onSelect={() => onPrimary(l.id)} />
        ))}
      </fieldset>
      <div className="flex flex-col gap-2">
        <label htmlFor={select} className="text-16 font-700">Secondary lens (optional)</label>
        <select id={select} value={secondary ?? ''} disabled={disabled || !primary} onChange={e => onSecondary((e.target.value || null) as LensId | null)}
          className="min-h-10 max-w-md rounded-12 border border-solid border-line-control bg-surface-solid px-3 text-14 text-fg-primary">
          <option value="">No secondary lens</option>
          {LENS_LIBRARY.filter(l => l.id !== primary).map(l => <option key={l.id} value={l.id}>{l.title}</option>)}
        </select>
        {pair && pair !== secondary && (
          <p className="m-0 text-13 text-fg-secondary">
            Works well with {LENS_BY_ID[pair].title}.{' '}
            {!disabled && <button type="button" className={BUTTON.link} onClick={() => onSecondary(pair)}>Add it as secondary</button>}
          </p>
        )}
        <p className="m-0 text-13 text-fg-secondary">{secondary
          ? `${LENS_BY_ID[secondary].title} adds report dimensions only. It does not change the team, events or game mechanics.`
          : 'A secondary lens adds report dimensions only, never game mechanics.'}</p>
      </div>
    </div>
  );
}
