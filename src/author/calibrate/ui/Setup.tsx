import { Switch } from '../../../ds/Switch';
import { LABELS, NAMES } from '../logic/aggregate';
import { MAX_RUNS_PER_PERSONA, PERSONA_KEYS, type PersonaKey } from '../logic/schema';
import { CARD, INPUT, PERSONA_COLOR } from './parts';

/** How each level plays, in plain words (the AI players read the author's edits). */
export const PLAYS: Record<PersonaKey, string> = {
  beginner: 'Uses one style for everyone, misreads what people need, gives short closed replies, ignores events and forgets promises.',
  developing: 'Picks the right style about half the time, gives generic replies, answers some events and follows up sometimes.',
  proficient: 'Reads most needs, asks open questions, keeps most promises and adjusts style most weeks.',
  expert: 'Reads each person\'s need and adapts every week, uncovers hidden concerns, handles events and sequences development.'
};

export interface PersonaSetup { on: boolean; runs: number; plays: string }

/** The four persona cards (Calibrate.dc.html): include, how it plays, playthroughs. */
export function PersonaCards({ setup, onChange, disabled, aiNote }: { setup: Record<PersonaKey, PersonaSetup>; onChange(p: PersonaKey, next: PersonaSetup): void; disabled: boolean; aiNote: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-4 gap-3 tablet:grid-cols-2">
        {PERSONA_KEYS.map(p => {
          const s = setup[p];
          const id = `cal-runs-${p}`;
          return (
            <div key={p} className={`${CARD} gap-2 border-t-4`} style={{ borderTopColor: PERSONA_COLOR[p] }}>
              <div className="flex items-center justify-between gap-2">
                <h3 className="m-0 text-15 font-700">{NAMES[p]}</h3>
                <Switch checked={s.on} disabled={disabled} onChange={on => onChange(p, { ...s, on })} label={<span className="sr-only">Include {NAMES[p]}</span>} />
              </div>
              <span className="text-12 font-700 text-fg-secondary">{LABELS[p]}</span>
              <textarea
                aria-label={`How ${NAMES[p]} plays`} rows={3} value={s.plays} disabled={disabled || !s.on} maxLength={600}
                onChange={e => onChange(p, { ...s, plays: e.target.value })}
                className={`${INPUT} resize-y py-2 text-13 leading-normal disabled:opacity-60`}
              />
              <div className="flex items-center gap-2 text-13">
                <label htmlFor={id}>Playthroughs</label>
                <input
                  id={id} type="number" inputMode="numeric" min={1} max={MAX_RUNS_PER_PERSONA} value={s.runs} disabled={disabled || !s.on}
                  onChange={e => onChange(p, { ...s, runs: Math.max(1, Math.min(MAX_RUNS_PER_PERSONA, Math.round(Number(e.target.value) || 1))) })}
                  className={`${INPUT} h-9 w-16 disabled:opacity-60`}
                />
              </div>
            </div>
          );
        })}
      </div>
      {aiNote && <p className="m-0 text-12 text-fg-secondary">In this browser the built in players play each level. On the server with AI players, they follow how each level plays as written above.</p>}
    </div>
  );
}
