import { Switch } from '../../../ds/Switch';
import { LABELS, NAMES } from '../logic/aggregate';
import { ARCHETYPE_KEYS, LEVEL_KEYS, MAX_RUNS_PER_PERSONA, type PersonaKey } from '../logic/schema';
import { CARD, INPUT, PERSONA_COLOR } from './parts';

/** How each level and player type plays, in plain words (the AI players read the author's edits). */
export const PLAYS: Record<PersonaKey, string> = {
  beginner: 'Uses one style for everyone, misreads what people need, gives short closed replies, ignores events and forgets promises.',
  developing: 'Picks the right style about half the time, gives generic replies, answers some events and follows up sometimes.',
  proficient: 'Reads most needs, asks open questions, keeps most promises and adjusts style most weeks.',
  expert: 'Reads each person\'s need and adapts every week, uncovers hidden concerns, handles events and sequences development.',
  riskTaker: 'Hires, lets people go and moves them between stages, picks the boldest option and stretches skilled people. Makes promises freely.',
  conservative: 'Takes few actions and the safest options: two careful one to ones a week, rarely changes a style, keeps every promise.',
  peopleFirst: 'Always puts morale and development first: team energy every week, recognition for whoever is lowest, one to ones that lift people.',
  businessFirst: 'Always puts results and revenue first: directs anyone below par, trains every week, answers the sponsor first and lets the weakest go.'
};

export interface PersonaSetup { on: boolean; runs: number; plays: string }

interface CardsProps { setup: Record<PersonaKey, PersonaSetup>; onChange(p: PersonaKey, next: PersonaSetup): void; disabled: boolean }

function Card({ p, setup, onChange, disabled }: CardsProps & { p: PersonaKey }) {
  const s = setup[p];
  const id = `cal-runs-${p}`;
  return (
    <div className={`${CARD} gap-2 border-t-4`} style={{ borderTopColor: PERSONA_COLOR[p] }}>
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
}

/**
 * The persona cards (Calibrate.dc.html): the four levels, then "More player types" (D150), the four player
 * types off by default behind a disclosure, open when one of them is on.
 */
export function PersonaCards({ setup, onChange, disabled, aiNote }: CardsProps & { aiNote: boolean }) {
  const typesOn = ARCHETYPE_KEYS.filter(p => setup[p].on).length;
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-4 gap-3 tablet:grid-cols-2">
        {LEVEL_KEYS.map(p => <Card key={p} p={p} setup={setup} onChange={onChange} disabled={disabled} />)}
      </div>
      <details className="group flex flex-col gap-2" open={typesOn > 0 || undefined}>
        <summary className="cursor-pointer py-1 text-14 font-700 text-fg-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-secondary">
          More player types{typesOn ? `, ${typesOn} on` : ''}
          <span className="ml-2 text-13 font-400 text-fg-secondary">Risk taker, Conservative, People first and Business first: do different ways of leading play out differently?</span>
        </summary>
        <div className="mt-2 grid grid-cols-4 gap-3 tablet:grid-cols-2">
          {ARCHETYPE_KEYS.map(p => <Card key={p} p={p} setup={setup} onChange={onChange} disabled={disabled} />)}
        </div>
      </details>
      {aiNote && <p className="m-0 text-12 text-fg-secondary">In this browser the built in players play each level and type. On the server with AI players, they follow how each one plays as written above.</p>}
    </div>
  );
}
