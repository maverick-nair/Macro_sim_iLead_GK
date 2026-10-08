import { useState } from 'react';
import { MAX_STAKEHOLDERS, STAKEHOLDER_KINDS, type StakeholderDraft } from '../../../model/draft';
import { useAuthor } from '../../../model/store';
import { briefStakeholders, hasInteraction, KIND_LABEL, newStakeholder, removeStakeholder, stakeholderUses, TYPE_LABEL } from '../../../model/stakeholders';
import { Avatar, Badge, BUTTON, CARD, CardHead, Field, Icon, Select } from '../../kit';
import { relationWord, StakeholderEditor } from '../StakeholderEditor';

/**
 * Team: stakeholders outside the team (D163). They are authored here, under the characters, rather than in a tab of
 * their own: they are people the participant leads alongside, with the character editor's pattern, and the Team tab is
 * where an author looks for people. Each card shows who they are, where the relationship starts and what participants
 * can do with them; Edit opens the stakeholder editor, Remove asks first when events refer to them.
 */
export default function TeamStakeholders() {
  const d = useAuthor(s => s.draft);
  const edit = useAuthor(s => s.edit);
  const [editing, setEditing] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [kind, setKind] = useState<StakeholderDraft['kind']>('executive');
  const offered = briefStakeholders(d);
  const full = d.stakeholders.length >= MAX_STAKEHOLDERS;
  const markOf = (key: string) => {
    const ms = Object.entries(d.marks).filter(([k]) => k.startsWith(`stakeholders.${key}.`)).map(([, m]) => m);
    return ms.some(m => m === 'edited') ? 'edited' : ms.some(m => m === 'you') ? 'you' : 'ai';
  };
  const add = (s: StakeholderDraft) => { edit(x => { x.stakeholders.push(s); }, { label: `Add ${s.name}`, mark: `stakeholders.${s.key}.identity` }); setEditing(s.key); };
  const current = d.stakeholders.find(s => s.key === editing);

  return (
    <section aria-labelledby="sh-head" className={`${CARD} mt-4 flex flex-col gap-3 p-5`}>
      <CardHead id="sh-head" title="Stakeholders outside the team">
        <span className="text-13 text-author-body">{d.stakeholders.length} of up to {MAX_STAKEHOLDERS}</span>
      </CardHead>
      <p className="m-0 text-14 text-author-body">People the participant does not manage but has to lead with: a client, an executive, a peer. They are not in the work process. Participants meet, brief, negotiate with or write to them; trust and satisfaction carry from week to week and move the business.</p>
      {offered.length > 0 && !full && (
        <div className="flex flex-wrap items-center gap-3 rounded-14 border-[1.5px] border-dashed border-author-kora p-4">
          <span aria-hidden="true" className="text-author-kora">{Icon.spark()}</span>
          <p className="m-0 min-w-60 flex-1 text-14"><b>From your brief:</b> {offered.map(b => `${b.name}${b.role ? `, ${b.role}` : ''}`).join('; ')}.</p>
          <button type="button" className={BUTTON.kora} onClick={() => {
            const made: StakeholderDraft[] = [];
            const w = structuredClone(d);
            for (const b of offered) { const s = { ...newStakeholder(w, b), ...(b.role ? { role: b.role } : null) }; w.stakeholders.push(s); made.push(s); }
            edit(x => { x.stakeholders.push(...made); }, { label: `Kora: add ${made.length} stakeholder${made.length === 1 ? '' : 's'} from the brief`, restorePoint: true, by: 'ai', mark: made.map(s => `stakeholders.${s.key}.identity`) });
          }}>Create {offered.length === 1 ? 'them' : `all ${offered.length}`}</button>
        </div>
      )}
      {d.stakeholders.length > 0 && (
        <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0 max-[900px]:grid-cols-1" aria-label="Stakeholders">
          {d.stakeholders.map(s => {
            const uses = stakeholderUses(d, s.key);
            const on = s.interactions.filter(i => i.enabled);
            return (
              <li key={s.key} className="flex flex-col gap-2 rounded-12 border border-solid border-author-line p-3">
                <div className="flex items-center gap-3">
                  <Avatar src={s.photo || undefined} name={s.name} size={44} />
                  <span className="flex min-w-0 flex-1 flex-col"><b className="text-15 leading-[1.2]">{s.name}</b><span className="text-12 text-author-body">{s.role} &middot; {KIND_LABEL[s.kind]}</span></span>
                  <Badge kind={markOf(s.key)} />
                  <button type="button" className={`${BUTTON.secondary} size-9 px-0`} aria-label={`Edit ${s.name}`} onClick={() => setEditing(s.key)}>{Icon.pencil(14)}</button>
                </div>
                <p className="m-0 text-13">Starts {relationWord(s.start.trust)} on trust ({s.start.trust}) and {relationWord(s.start.satisfaction)} on satisfaction ({s.start.satisfaction}).{' '}
                  {on.length ? <>Participants can {on.map(i => `${TYPE_LABEL[i.type].toLowerCase()}${i.plays === 'static' ? ' (a decision)' : ''}`).join(', ')}.</> : null}
                  {uses.count ? <> Used by {uses.count} event{uses.count === 1 ? '' : 's'}.</> : null}</p>
                {!hasInteraction(s) && <p className="m-0 text-13 text-author-need">Nothing switched on: participants can never meet {s.name.split(' ')[0]}. Edit to switch an interaction on.</p>}
                {removing === s.key ? (
                  <div role="alert" className="flex flex-wrap items-center gap-2 rounded-10 border border-solid border-author-need-line bg-author-need-field p-2 text-13">
                    <span className="min-w-50 flex-1">{[...new Set([...uses.from, ...uses.moves, ...uses.conditions])].join(', ')} {uses.count === 1 ? 'refers' : 'refer'} to {s.name}. Removing them stops those events coming from them and drops what refers to them.</span>
                    <button type="button" className={BUTTON.secondary} onClick={() => { edit(x => removeStakeholder(x, s.key), { label: `Remove ${s.name}`, restorePoint: true }); setRemoving(null); }}>Remove {s.name.split(' ')[0]}</button>
                    <button type="button" className={BUTTON.link} onClick={() => setRemoving(null)}>Keep {s.name.split(' ')[0]}</button>
                  </div>
                ) : (
                  <button type="button" className={`${BUTTON.link} self-start text-13`} onClick={() => { if (uses.count) setRemoving(s.key); else edit(x => removeStakeholder(x, s.key), { label: `Remove ${s.name}`, restorePoint: true }); }}>Remove<span className="sr-only"> {s.name}</span></button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <div className="flex flex-wrap items-end gap-2">
        <Field label="Kind of stakeholder">{id => <Select id={id} value={kind} onChange={e => setKind(e.target.value as StakeholderDraft['kind'])}>{STAKEHOLDER_KINDS.map(k => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}</Select>}</Field>
        <button type="button" className={BUTTON.secondary} disabled={full} onClick={() => add(newStakeholder(d, { kind }))}>Add a stakeholder</button>
        {full && <span className="text-13 text-author-muted">{MAX_STAKEHOLDERS} is the most. Remove one to add another.</span>}
      </div>
      {current && (
        <StakeholderEditor key={current.key} draft={d} stakeholder={current} open onOpenChange={o => { if (!o) setEditing(null); }}
          onSave={(next, changed) => { edit(x => { const i = x.stakeholders.findIndex(s => s.key === next.key); if (i >= 0) x.stakeholders[i] = next; }, changed); setEditing(null); }} />
      )}
    </section>
  );
}
