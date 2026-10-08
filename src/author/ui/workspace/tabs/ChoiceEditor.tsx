import { useId } from 'react';
import { skillNames } from '../../../model/choices';
import { BANDS_READ, CONDITION_METRICS, type AuthorDraft, type ChoiceDraft, type ChoiceOptionDraft, type ClauseDraft, type EventDraft } from '../../../model/draft';
import { blankOption, freshKey, slugKey } from '../../../model/seed';
import { BUTTON, Field, Select, TextArea, TextInput } from '../../kit';
import { Switch } from './Variables';

/**
 * Events: a decision (D137) and its conditions (D138). A decision has what the participant knows, the days to decide,
 * what happens when nobody does, and 2 to 4 options, each with who it lands on, its effects on people, revenue, the
 * sponsor and the business variables, the flags it sets or clears, an event it leads to after some days or weeks, and the
 * leadership it shows. "Plays only if" waits on flags, business variables or team measures, for any event.
 */

const METRIC: Record<(typeof CONDITION_METRICS)[number], string> = {
  teamMorale: 'Team morale', teamTrust: 'Team trust', teamSkill: 'Team skill', teamResult: 'Team result', revenuePace: 'Revenue against pace, percent', sponsor: 'Sponsor confidence'
};
const READ: Record<(typeof BANDS_READ)[number], string> = { strong: 'Shows it well', adequate: 'Shows some of it', weak: 'Falls short on it', harmful: 'Works against it' };
const delta = (v: string) => Math.max(-30, Math.min(30, Math.round(Number(v.replace('−', '-')) || 0)));
const signed = (v: number) => (v < 0 ? `−${-v}` : String(v));
const amount = (v: string) => { const n = Number(v.replace('−', '-').replace(/[^\d.-]/g, '')); return Number.isFinite(n) ? n : 0; };
/** Flags as the author types them ("budget cut, rushed") to keys, and back. */
const flagKeys = (v: string) => [...new Set(v.split(',').map(x => x.trim()).filter(Boolean).map(x => slugKey(x, 'flag')))].slice(0, 6);
const flagText = (keys: string[]) => keys.map(k => k.replace(/_/g, ' ')).join(', ');

/** A new decision on an event: two options that change nothing yet, the first the default. */
export function newChoice(): ChoiceDraft {
  return { known: '', within: 2, default: 'option_1', options: [blankOption('option_1', 'First option'), blankOption('option_2', 'Second option')] };
}

interface Props { d: AuthorDraft; e: EventDraft; set: (patch: Partial<EventDraft>) => void }

export function ChoiceEditor({ d, e, set }: Props) {
  const id = useId();
  const ch = e.choice;
  const skills = skillNames(d);
  const targetOptions: Array<[string, string]> = [['target', 'Who the event is about'], ['team', 'The whole team'], ...d.process.stages.map(s => [`stage:${s.key}`, `Everyone in ${s.name}`] as [string, string]), ...d.team.map(c => [c.id, `${c.first} ${c.last}`] as [string, string])];
  const setChoice = (patch: Partial<ChoiceDraft>) => ch && set({ choice: { ...ch, ...patch } });
  const setOption = (key: string, patch: Partial<ChoiceOptionDraft>) => ch && setChoice({ options: ch.options.map(o => (o.key === key ? { ...o, ...patch } : o)) });
  return (
    <fieldset className="m-0 flex flex-col gap-3 rounded-12 border border-solid border-author-line p-3">
      <legend className="px-1 text-15 font-800">Decision</legend>
      <Switch label="The participant decides what to do" checked={!!ch} onChange={on => set(on ? { choice: newChoice(), respondWith: [], arrives: 'modal' } : { choice: null })} />
      {!ch && <p className="m-0 text-13 text-author-muted">Off: the event just happens. On: it opens a decision with 2 to 4 options, none of them right on every count.</p>}
      {ch && (
        <>
          <div className="grid grid-cols-[2fr_1fr_1fr] gap-3 max-[1180px]:grid-cols-1">
            <Field label="What the participant knows" hint="A line each, up to 4">{fid => <TextArea id={fid} rows={2} value={ch.known} onChange={ev => setChoice({ known: ev.target.value })} />}</Field>
            <Field label="Days to decide">{fid => <Select id={fid} value={ch.within} onChange={ev => setChoice({ within: Number(ev.target.value) })}>{[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n} day{n === 1 ? '' : 's'}</option>)}</Select>}</Field>
            <Field label="If nobody decides">{fid => (
              <Select id={fid} value={ch.default ?? ''} onChange={ev => setChoice({ default: ev.target.value || null })}>
                <option value="">Nothing happens</option>
                {ch.options.map(o => <option key={o.key} value={o.key}>{o.label || o.key} applies</option>)}
              </Select>
            )}</Field>
          </div>
          <ol className="m-0 flex list-none flex-col gap-3 p-0" aria-label="Options">
            {ch.options.map((o, i) => (
              <li key={o.key} className="flex flex-col gap-2 rounded-12 border border-solid border-author-line p-3" aria-labelledby={`${id}o${i}`}>
                <div className="flex items-center gap-2">
                  <b id={`${id}o${i}`} className="text-14">Option {i + 1}</b>
                  <span className="flex-1" />
                  <button type="button" className={`${BUTTON.secondary} min-h-8 px-2 text-12`} disabled={ch.options.length <= 2}
                    onClick={() => setChoice({ options: ch.options.filter(x => x.key !== o.key), default: ch.default === o.key ? null : ch.default })}>Remove<span className="sr-only"> option {i + 1}</span></button>
                </div>
                <div className="grid grid-cols-2 gap-2 max-[1180px]:grid-cols-1">
                  <Field label="Label">{fid => <TextInput id={fid} value={o.label} onChange={ev => setOption(o.key, { label: ev.target.value })} />}</Field>
                  <Field label="One line more" optional>{fid => <TextInput id={fid} value={o.detail} onChange={ev => setOption(o.key, { detail: ev.target.value })} />}</Field>
                </div>
                <Field label="What happened, shown after it is chosen">{fid => <TextArea id={fid} rows={2} value={o.outcome} onChange={ev => setOption(o.key, { outcome: ev.target.value })} />}</Field>
                <div className="grid grid-cols-5 gap-2 max-[1180px]:grid-cols-3">
                  <Field label="Lands on">{fid => <Select id={fid} value={o.who} onChange={ev => setOption(o.key, { who: ev.target.value })}>
                    {!targetOptions.some(([v]) => v === o.who) && <option value={o.who}>Missing: pick someone</option>}
                    {targetOptions.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </Select>}</Field>
                  {(['skill', 'morale', 'result', 'trust'] as const).map(k => <Field key={k} label={k[0].toUpperCase() + k.slice(1)}>{fid => <TextInput id={fid} inputMode="numeric" value={signed(o[k])} onChange={ev => setOption(o.key, { [k]: delta(ev.target.value) })} />}</Field>)}
                </div>
                <div className="grid grid-cols-4 gap-2 max-[1180px]:grid-cols-2">
                  <Field label="Revenue, once">{fid => <TextInput id={fid} inputMode="decimal" value={signed(o.revenue)} onChange={ev => setOption(o.key, { revenue: amount(ev.target.value) })} />}</Field>
                  <Field label="Sponsor confidence">{fid => <TextInput id={fid} inputMode="numeric" value={signed(o.sponsor)} onChange={ev => setOption(o.key, { sponsor: delta(ev.target.value) })} />}</Field>
                  {d.variables.map(v => <Field key={v.key} label={v.name || v.key}>{fid => <TextInput id={fid} inputMode="decimal" value={signed(o.variables[v.key] ?? 0)} onChange={ev => { const n = amount(ev.target.value); const vars = { ...o.variables }; if (n) vars[v.key] = n; else delete vars[v.key]; setOption(o.key, { variables: vars }); }} />}</Field>)}
                </div>
                {d.stakeholders.length > 0 && (
                  <div className="grid grid-cols-4 gap-2 max-[1180px]:grid-cols-2">
                    {d.stakeholders.flatMap(s => (['trust', 'satisfaction'] as const).map(m => (
                      <Field key={`${s.key}.${m}`} label={`${s.name.split(' ')[0] || s.key}: ${m === 'trust' ? 'trust' : 'satisfaction'}`}>{fid => <TextInput id={fid} inputMode="numeric" value={signed(o.stakeholders?.[s.key]?.[m] ?? 0)} onChange={ev => {
                        const n = delta(ev.target.value);
                        const all = { ...(o.stakeholders ?? {}) };
                        const cur = { trust: all[s.key]?.trust ?? 0, satisfaction: all[s.key]?.satisfaction ?? 0, [m]: n };
                        if (cur.trust || cur.satisfaction) all[s.key] = cur; else delete all[s.key];
                        setOption(o.key, { stakeholders: all });
                      }} />}</Field>
                    )))}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2 max-[1180px]:grid-cols-1">
                  <Field label="Sets these flags" hint="Names, separated by commas; later events can wait on them">{fid => <TextInput id={fid} defaultValue={flagText(o.set)} onBlur={ev => setOption(o.key, { set: flagKeys(ev.target.value) })} />}</Field>
                  <Field label="Clears these flags" optional>{fid => <TextInput id={fid} defaultValue={flagText(o.clear)} onBlur={ev => setOption(o.key, { clear: flagKeys(ev.target.value) })} />}</Field>
                </div>
                <div className="grid grid-cols-[2fr_1fr_1fr] gap-2 max-[1180px]:grid-cols-1">
                  <Field label="Then this event follows">{fid => (
                    <Select id={fid} value={o.followUp?.event ?? ''} onChange={ev => setOption(o.key, { followUp: ev.target.value ? { event: ev.target.value, days: o.followUp?.days ?? 0, weeks: o.followUp?.weeks ?? 1 } : null })}>
                      <option value="">None</option>
                      {o.followUp && !d.events.some(x => x.key === o.followUp!.event) && <option value={o.followUp.event}>Missing: pick another</option>}
                      {d.events.filter(x => x.key !== e.key).map(x => <option key={x.key} value={x.key}>{x.title}</option>)}
                    </Select>
                  )}</Field>
                  <Field label="Weeks later">{fid => <Select id={fid} disabled={!o.followUp} value={o.followUp?.weeks ?? 0} onChange={ev => o.followUp && setOption(o.key, { followUp: { ...o.followUp, weeks: Number(ev.target.value) } })}>{[0, 1, 2, 3, 4].map(n => <option key={n} value={n}>{n}</option>)}</Select>}</Field>
                  <Field label="Days later">{fid => <Select id={fid} disabled={!o.followUp} value={o.followUp?.days ?? 0} onChange={ev => o.followUp && setOption(o.key, { followUp: { ...o.followUp, days: Number(ev.target.value) } })}>{[0, 1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}</Select>}</Field>
                </div>
                <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
                  <legend className="mb-1 text-13 font-700 text-author-label">The leadership it shows, apart from how the business does</legend>
                  {o.read.map((r, k) => (
                    <div key={k} className="grid grid-cols-[2fr_2fr_auto] items-end gap-2">
                      <Field label={`Skill ${k + 1}`}>{fid => <Select id={fid} value={r.skill} onChange={ev => setOption(o.key, { read: o.read.map((x, j) => (j === k ? { ...x, skill: ev.target.value } : x)) })}>
                        {!skills.includes(r.skill) && <option value={r.skill}>Missing: pick a skill</option>}
                        {skills.map(n => <option key={n} value={n}>{n}</option>)}
                      </Select>}</Field>
                      <Field label="How well">{fid => <Select id={fid} value={r.band} onChange={ev => setOption(o.key, { read: o.read.map((x, j) => (j === k ? { ...x, band: ev.target.value as typeof r.band } : x)) })}>{BANDS_READ.map(b => <option key={b} value={b}>{READ[b]}</option>)}</Select>}</Field>
                      <button type="button" className={`${BUTTON.link} text-12`} onClick={() => setOption(o.key, { read: o.read.filter((_, j) => j !== k) })}>Remove<span className="sr-only"> skill {k + 1}</span></button>
                    </div>
                  ))}
                  <button type="button" className={`${BUTTON.secondary} min-h-8 self-start px-2 text-12`} disabled={o.read.length >= 4 || !skills.length}
                    onClick={() => setOption(o.key, { read: [...o.read, { skill: skills.find(n => !o.read.some(r => r.skill === n)) ?? skills[0], band: 'adequate' }] })}>Add a skill</button>
                </fieldset>
              </li>
            ))}
          </ol>
          <button type="button" className={`${BUTTON.secondary} self-start`} disabled={ch.options.length >= 4} onClick={() => {
            const key = freshKey('option', ch.options.map(o => o.key));
            setChoice({ options: [...ch.options, blankOption(key, `Option ${ch.options.length + 1}`)] });
          }}>Add an option</button>
          <p className="m-0 text-12 text-author-muted">Give each option something it helps and something it costs. Options that all do the same block publishing.</p>
        </>
      )}
    </fieldset>
  );
}

const CLAUSES: Array<[ClauseDraft['kind'], string]> = [['flag', 'A decision was made (a flag)'], ['variable', 'A business variable'], ['metric', 'A team measure'], ['stakeholder', 'A stakeholder relationship']];

/** "Plays only if": up to three clauses, all of which must hold (D138). */
export function ConditionsEditor({ d, e, set }: Props) {
  const list = e.conditions ?? [];
  const flags = [...new Set(d.events.flatMap(x => (x.choice?.options ?? []).flatMap(o => o.set)))];
  const put = (i: number, c: ClauseDraft) => set({ conditions: list.map((x, j) => (j === i ? c : x)) });
  const fresh = (kind: ClauseDraft['kind']): ClauseDraft => (kind === 'flag' ? { kind, flag: flags[0] ?? 'flag', is: true } : kind === 'variable' ? { kind, variable: d.variables[0]?.key ?? 'budget', op: 'below', value: 50 }
    : kind === 'stakeholder' ? { kind, stakeholder: d.stakeholders[0]?.key ?? 'stakeholder', measure: 'satisfaction', op: 'below', value: 40 } : { kind: 'metric', metric: 'teamMorale', op: 'below', value: 60 });
  return (
    <fieldset className="m-0 flex flex-col gap-2 rounded-12 border border-solid border-author-line p-3">
      <legend className="px-1 text-15 font-800">Plays only if</legend>
      <p className="m-0 text-13 text-author-muted">{list.length ? 'All of these must hold when it is due; otherwise it never plays.' : 'Always plays when it is due. Add a condition to make it depend on an earlier decision, a business variable or the team.'}</p>
      <ol className="m-0 flex list-none flex-col gap-2 p-0" aria-label="Conditions">
        {list.map((c, i) => (
          <li key={i} className="grid grid-cols-[2fr_2fr_1fr_1fr_auto] items-end gap-2 max-[1180px]:grid-cols-2">
            <Field label={`Condition ${i + 1}`}>{fid => <Select id={fid} value={c.kind} onChange={ev => put(i, fresh(ev.target.value as ClauseDraft['kind']))}>{CLAUSES.filter(([k]) => k !== 'stakeholder' || d.stakeholders.length || c.kind === 'stakeholder').map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select>}</Field>
            {c.kind === 'flag' && <>
              <Field label="Flag">{fid => <Select id={fid} value={c.flag} onChange={ev => put(i, { ...c, flag: ev.target.value })}>
                {!flags.includes(c.flag) && <option value={c.flag}>{c.flag.replace(/_/g, ' ')}: no decision sets it</option>}
                {flags.map(f => <option key={f} value={f}>{f.replace(/_/g, ' ')}</option>)}
              </Select>}</Field>
              <Field label="Is">{fid => <Select id={fid} value={c.is ? 'set' : 'unset'} onChange={ev => put(i, { ...c, is: ev.target.value === 'set' })}><option value="set">Set</option><option value="unset">Not set</option></Select>}</Field>
              <span />
            </>}
            {c.kind === 'variable' && <>
              <Field label="Variable">{fid => <Select id={fid} value={c.variable} onChange={ev => put(i, { ...c, variable: ev.target.value })}>
                {!d.variables.some(v => v.key === c.variable) && <option value={c.variable}>Missing: pick a variable</option>}
                {d.variables.map(v => <option key={v.key} value={v.key}>{v.name || v.key}</option>)}
              </Select>}</Field>
              <Field label="Is">{fid => <Select id={fid} value={c.op} onChange={ev => put(i, { ...c, op: ev.target.value as typeof c.op })}><option value="below">Below</option><option value="atLeast">At least</option></Select>}</Field>
              <Field label="Value">{fid => <TextInput id={fid} inputMode="decimal" value={c.value} onChange={ev => put(i, { ...c, value: amount(ev.target.value) })} />}</Field>
            </>}
            {c.kind === 'stakeholder' && <>
              <Field label="Stakeholder">{fid => <Select id={fid} value={`${c.stakeholder}.${c.measure}`} onChange={ev => { const [stakeholder, measure] = ev.target.value.split('.'); put(i, { ...c, stakeholder, measure: measure as typeof c.measure }); }}>
                {!d.stakeholders.some(s => s.key === c.stakeholder) && <option value={`${c.stakeholder}.${c.measure}`}>Missing: pick a stakeholder</option>}
                {d.stakeholders.flatMap(s => (['trust', 'satisfaction'] as const).map(m => <option key={`${s.key}.${m}`} value={`${s.key}.${m}`}>{s.name || s.key}: {m === 'trust' ? 'trust in you' : 'satisfaction'}</option>))}
              </Select>}</Field>
              <Field label="Is">{fid => <Select id={fid} value={c.op} onChange={ev => put(i, { ...c, op: ev.target.value as typeof c.op })}><option value="below">Below</option><option value="atLeast">At least</option></Select>}</Field>
              <Field label="Value, 0 to 100">{fid => <TextInput id={fid} inputMode="decimal" value={c.value} onChange={ev => put(i, { ...c, value: amount(ev.target.value) })} />}</Field>
            </>}
            {c.kind === 'metric' && <>
              <Field label="Measure">{fid => <Select id={fid} value={c.metric} onChange={ev => put(i, { ...c, metric: ev.target.value as typeof c.metric })}>{CONDITION_METRICS.map(m => <option key={m} value={m}>{METRIC[m]}</option>)}</Select>}</Field>
              <Field label="Is">{fid => <Select id={fid} value={c.op} onChange={ev => put(i, { ...c, op: ev.target.value as typeof c.op })}><option value="below">Below</option><option value="atLeast">At least</option></Select>}</Field>
              <Field label="Value">{fid => <TextInput id={fid} inputMode="decimal" value={c.value} onChange={ev => put(i, { ...c, value: amount(ev.target.value) })} />}</Field>
            </>}
            <button type="button" className={`${BUTTON.link} text-12`} onClick={() => set({ conditions: list.filter((_, j) => j !== i) })}>Remove<span className="sr-only"> condition {i + 1}</span></button>
          </li>
        ))}
      </ol>
      <button type="button" className={`${BUTTON.secondary} self-start`} disabled={list.length >= 3} onClick={() => set({ conditions: [...list, fresh(flags.length ? 'flag' : 'metric')] })}>Add a condition</button>
    </fieldset>
  );
}
