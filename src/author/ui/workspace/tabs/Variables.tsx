import { useState } from 'react';
import { MAX_VARIABLES, VARIABLE_FORMATS, type AuthorDraft, type VariableDraft } from '../../../model/draft';
import { freshKey } from '../../../model/seed';
import { useAuthor } from '../../../model/store';
import { BUTTON, CARD, CardHead, Field, Select, TextInput, Toggle } from '../../kit';

const FORMAT: Record<VariableDraft['format'], string> = { money: 'Money', percent: 'Percent', points: 'Points' };
/** A switch with its words beside it. */
export function Switch({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return <span className="flex items-center gap-2 text-14"><Toggle label={label} checked={checked} onChange={onChange} /><span aria-hidden="true">{label}</span></span>;
}
const num = (v: string) => { const n = Number(v.replace('−', '-').replace(/[^\d.-]/g, '')); return Number.isFinite(n) ? n : 0; };

/** What refers to a variable: choice options that move it and events that test it. */
export function variableUses(d: AuthorDraft, key: string) {
  const options = d.events.flatMap(e => (e.choice?.options ?? []).filter(o => o.variables[key] !== undefined).map(o => `${e.title || e.key}: ${o.label || o.key}`));
  const conditions = d.events.filter(e => (e.conditions ?? []).some(c => c.kind === 'variable' && c.variable === key)).map(e => e.title || e.key);
  return { options, conditions };
}

/**
 * Work process: Business variables (D136). Up to six named measures the participant's choices move: Budget, Customer
 * trust, Quality, Reputation. Each has a format, a start and a range, a change each week, whether participants see it on
 * their board, and its share of the Business score (revenue keeps the rest; 80% at most across all of them). Removing one
 * that a decision or a condition uses says which, and removes those references with it.
 */
export function VariablesCard() {
  const d = useAuthor(s => s.draft);
  const edit = useAuthor(s => s.edit);
  const [removing, setRemoving] = useState<string | null>(null);
  const set = (key: string, patch: Partial<VariableDraft>) => edit(x => { const v = x.variables.find(y => y.key === key); if (v) Object.assign(v, patch); }, 'variables');
  const weights = d.variables.reduce((a, v) => a + v.weight, 0);
  const remove = (key: string) => {
    const name = d.variables.find(v => v.key === key)?.name || key;
    edit(x => {
      x.variables = x.variables.filter(v => v.key !== key);
      for (const e of x.events) {
        for (const o of e.choice?.options ?? []) delete o.variables[key];
        if (e.conditions) e.conditions = e.conditions.filter(c => !(c.kind === 'variable' && c.variable === key));
      }
    }, { label: `Remove the business variable "${name}"`, restorePoint: true });
    setRemoving(null);
  };
  return (
    <section className={`${CARD} flex flex-col gap-3 p-5`} aria-labelledby="variables">
      <CardHead id="variables" title="Business variables">
        <button type="button" className={BUTTON.secondary} disabled={d.variables.length >= MAX_VARIABLES} onClick={() => edit(x => {
          const key = freshKey('measure', x.variables.map(v => v.key));
          x.variables.push({ key, name: 'New measure', format: 'points', start: 50, min: 0, max: 100, drift: 0, shown: true, weight: 0, higherIsBetter: true, about: '' });
        }, { mark: 'variables', label: 'Add a business variable' })}>Add a variable</button>
      </CardHead>
      <p className="m-0 text-13 text-author-body">What the participant&rsquo;s decisions move beside revenue and the team, such as a budget, customer trust or quality. Decisions in Events change them, and conditions can wait on them. Up to {MAX_VARIABLES}.</p>
      {d.variables.length === 0 && <p className="m-0 text-13 text-author-muted">No business variables: revenue is the whole Business score.</p>}
      <ul className="m-0 flex list-none flex-col gap-3 p-0" aria-label="Business variables">
        {d.variables.map(v => {
          const uses = variableUses(d, v.key);
          return (
            <li key={v.key} className="flex flex-col gap-2 rounded-14 border border-solid border-author-line p-3">
              <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr] gap-2 max-[1180px]:grid-cols-3">
                <Field label="Name">{id => <TextInput id={id} value={v.name} onChange={e => set(v.key, { name: e.target.value })} />}</Field>
                <Field label="Shown as">{id => <Select id={id} value={v.format} onChange={e => set(v.key, { format: e.target.value as VariableDraft['format'] })}>{VARIABLE_FORMATS.map(f => <option key={f} value={f}>{FORMAT[f]}</option>)}</Select>}</Field>
                <Field label="Start">{id => <TextInput id={id} inputMode="decimal" value={v.start} onChange={e => set(v.key, { start: num(e.target.value) })} />}</Field>
                <Field label="Lowest">{id => <TextInput id={id} inputMode="decimal" value={v.min} onChange={e => set(v.key, { min: num(e.target.value) })} />}</Field>
                <Field label="Highest">{id => <TextInput id={id} inputMode="decimal" value={v.max} onChange={e => set(v.key, { max: num(e.target.value) })} />}</Field>
                <Field label="Change each week">{id => <TextInput id={id} inputMode="decimal" value={v.drift} onChange={e => set(v.key, { drift: num(e.target.value) })} />}</Field>
              </div>
              <div className="flex flex-wrap items-end gap-4">
                <Field label="Share of the Business score, percent" hint="Revenue keeps the rest">{id => <TextInput id={id} type="number" min={0} max={80} value={v.weight} onChange={e => set(v.key, { weight: Math.max(0, Math.min(80, Math.round(num(e.target.value)))) })} />}</Field>
                <Switch label="Participants see it on their board" checked={v.shown} onChange={c => set(v.key, { shown: c })} />
                <Switch label="More is better" checked={v.higherIsBetter} onChange={c => set(v.key, { higherIsBetter: c })} />
                <span className="flex-1" />
                <button type="button" className={BUTTON.secondary} onClick={() => (uses.options.length + uses.conditions.length ? setRemoving(v.key) : remove(v.key))}>Remove<span className="sr-only"> {v.name}</span></button>
              </div>
              <Field label="What it means, for participants">{id => <TextInput id={id} value={v.about} onChange={e => set(v.key, { about: e.target.value })} />}</Field>
              {(v.min >= v.max || v.start < v.min || v.start > v.max) && <p role="alert" className="m-0 text-13 text-author-need">The start must be between the lowest and the highest, and the highest above the lowest.</p>}
              {removing === v.key && (
                <div role="alert" className="flex flex-wrap items-center gap-3 rounded-12 border border-solid border-author-need-line bg-author-need-field p-3 text-14">
                  <span className="min-w-60 flex-1">{[uses.options.length ? `${uses.options.join(', ')} ${uses.options.length === 1 ? 'changes' : 'change'} it` : '', uses.conditions.length ? `${uses.conditions.join(', ')} ${uses.conditions.length === 1 ? 'waits' : 'wait'} on it` : ''].filter(Boolean).join('; ')}. Removing it removes those effects and conditions too.</span>
                  <button type="button" className={BUTTON.secondary} onClick={() => remove(v.key)}>Remove anyway</button>
                  <button type="button" className={BUTTON.link} onClick={() => setRemoving(null)}>Keep it</button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {weights > 80 && <p role="alert" className="m-0 text-13 text-author-need">The variables take {weights}% of the Business score. 80% is the most, so revenue keeps a share.</p>}
    </section>
  );
}

/** Work process: people dynamics (D135), on for new drafts. */
export function DynamicsCard() {
  const d = useAuthor(s => s.draft);
  const edit = useAuthor(s => s.edit);
  return (
    <section className={`${CARD} flex flex-col gap-3 p-5`} aria-labelledby="dynamics">
      <CardHead id="dynamics" title="People dynamics" />
      <Switch label="How people feel shows in their work" checked={!!d.process.dynamics} onChange={c => edit(x => { x.process.dynamics = c; }, { mark: 'process.dynamics', label: c ? 'Switch people dynamics on' : 'Switch people dynamics off' })} />
      <p className="m-0 text-13 text-author-body">{d.process.dynamics
        ? 'On: someone whose morale has been low for a few days delivers less and improves more slowly, low trust blunts what your actions do, and people who stay worn out go off sick or resign. Pushing a tired team for results stops paying.'
        : 'Off: only results count in the work, however people feel. A participant can push a worn out team for results without it showing.'}</p>
    </section>
  );
}
