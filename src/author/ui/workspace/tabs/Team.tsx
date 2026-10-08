import { useState } from 'react';
import { needOf } from '../../../../engine/lens';
import { MAX_TEAM, MIN_TEAM, type AuthorDraft, type Character } from '../../../model/draft';
import { applySuggestion } from '../../../model/kora';
import { freshKey, PORTRAITS } from '../../../model/seed';
import { nextMark, useAuthor } from '../../../model/store';
import { Avatar, Badge, BUTTON, CARD, Field, Icon, MarkOf, Scroll, Select, TextArea, toneOf } from '../../kit';
import { CharacterEditor } from '../CharacterEditor';
import { TabBody, TabHead } from '../Workspace';
import { useRegenerate, useRegenerateItem } from './regenerate';

/** Removes a character; their events go where the author picked (`to`), or are removed with them (D128). */
function removeCharacter(x: AuthorDraft, id: string, to: string) {
  x.team = x.team.filter(m => m.id !== id);
  for (const m of x.team) m.relationships = m.relationships.filter(r => r.with !== id);
  if (to === 'remove') {
    const gone = new Set(x.events.filter(e => e.who === id).map(e => e.key));
    x.events = x.events.filter(e => !gone.has(e.key));
    for (const e of x.events) if (e.ifIgnored.followUp && gone.has(e.ifIgnored.followUp)) e.ifIgnored = { ...e.ifIgnored, followUp: null };
  } else {
    for (const e of x.events) if (e.who === id) { e.who = to; if ((e.arrives === 'chat' || e.arrives === 'email') && (to === 'team' || to.startsWith('stage:'))) e.arrives = 'modal'; }
  }
}

/** The undo and History name of a removal (D122), with where the person's events went. */
function removeLabel(d: AuthorDraft, c: Character, to: string): string {
  const name = [c.first, c.last].filter(Boolean).join(' ') || c.id;
  if (to === 'remove') return `Remove ${name} and their events`;
  const other = d.team.find(m => m.id === to);
  const where = to === 'team' ? 'the whole team' : to === 'member' ? 'one person the engine picks' : other ? [other.first, other.last].filter(Boolean).join(' ') : to;
  return `Remove ${name}, their events to ${where}`;
}

const MOOD = (c: Character) => (c.stats.morale >= 70 ? 'upbeat' : c.stats.morale >= 50 ? 'steady' : c.stats.morale >= 35 ? 'concerned' : 'frustrated');

/**
 * Workspace: Team (docs/design/genie/Team, D109): every character with their mark and a pencil to edit,
 * the selected character's persona and hidden concern, and Kora's suggestion for them. The pencil opens
 * the character editor with every field.
 */
export default function Team() {
  const d = useAuthor(s => s.draft);
  const edit = useAuthor(s => s.edit);
  const regen = useRegenerate('team', 'Regenerate the whole team');
  const regenItem = useRegenerateItem();
  const [itemNote, setItemNote] = useState<{ id: string; text: string } | null>(null);
  const [selected, setSelected] = useState(d.team[0]?.id ?? '');
  const [editing, setEditing] = useState<string | null>(null);
  const [removing, setRemoving] = useState<{ id: string; to: string } | null>(null);
  const c = d.team.find(x => x.id === selected) ?? d.team[0];
  const markOf = (id: string) => {
    const ms = Object.entries(d.marks).filter(([k]) => k.startsWith(`team.${id}.`)).map(([, m]) => m);
    return ms.some(m => m === 'edited') ? 'edited' : ms.some(m => m === 'you') ? 'you' : 'ai';
  };
  const edited = d.team.filter(x => markOf(x.id) !== 'ai').length;
  const stageName = (k: string) => d.process.stages.find(s => s.key === k)?.name ?? k;
  const suggestion = d.suggestions.find(s => s.tab === 'team' && !s.done && s.id === `team.link.${c?.id}`);
  const editingChar = d.team.find(x => x.id === editing);

  return (
    <TabBody label="Team" head={
      <TabHead title="Team" actions={<>
        {regen.button}
        <button type="button" className={BUTTON.secondary} disabled={d.team.length >= MAX_TEAM} onClick={() => {
          const id = freshKey('new_member', d.team.map(m => m.id));
          edit(x => { x.team.push({ ...structuredClone(x.team[0]), id, first: 'New', last: 'Character', persona: '', hiddenConcern: '', concernLine: '', relationships: [], custom: [], photo: PORTRAITS[x.team.length % PORTRAITS.length] }); }, `team.${id}.identity`);
          setSelected(id); setEditing(id);
        }}>Add a character</button>
      </>}>
        {d.team.length} characters across {d.process.stages.length} stages &middot; {edited} edited by you &middot; a team has {MIN_TEAM} to {MAX_TEAM} people{d.team.length >= MAX_TEAM ? ', so this one is full' : d.team.length <= MIN_TEAM ? `, so none can be removed until you add one` : ''}
      </TabHead>
    }>
      {regen.note}
      <div className="grid grid-cols-[17.5rem_minmax(0,1fr)] gap-4 max-[1180px]:grid-cols-[15rem_minmax(0,1fr)] max-[900px]:grid-cols-1">
        <section aria-label="Characters" className={`${CARD} p-3`}>
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {d.team.map(x => (
              <li key={x.id} className={`flex items-center gap-2 rounded-12 border-2 border-solid p-2 ${x.id === c?.id ? 'border-author-primary bg-author-primary-faint' : 'border-transparent'}`}>
                <button type="button" aria-current={x.id === c?.id || undefined} onClick={() => setSelected(x.id)} className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 border-0 bg-transparent p-0 text-start focus-visible:outline-2 focus-visible:outline-author-primary">
                  <Avatar src={x.photo} name={x.first} size={40} />
                  <span className="flex min-w-0 flex-col"><b className="text-15 leading-[1.2]">{x.first} {x.last}</b><span className="text-12 text-author-body">{stageName(x.stage)} &middot; {MOOD(x)}</span></span>
                </button>
                <Badge kind={markOf(x.id)} />
                <button type="button" className={`${BUTTON.secondary} size-9 px-0`} aria-label={`Edit ${x.first} ${x.last}`} onClick={() => { setSelected(x.id); setEditing(x.id); }}>{Icon.pencil(14)}</button>
              </li>
            ))}
          </ul>
        </section>
        {c && (
          <section aria-labelledby="char-name" className={`${CARD} flex flex-col gap-4 p-5`}>
            <div className="flex flex-wrap items-center gap-4">
              <Avatar src={c.photo} name={c.first} size={64} />
              <div className="flex min-w-0 flex-1 flex-col">
                <h2 id="char-name" className="m-0 text-22 font-800">{c.first} {c.last}</h2>
                <span className="text-13 text-author-body">{c.title} &middot; {markOf(c.id) === 'ai' ? 'generated from your challenge' : 'edited by you'}</span>
              </div>
              <button type="button" className={BUTTON.secondary} onClick={() => setEditing(c.id)}>{Icon.pencil(14)} Edit profile</button>
              <button type="button" className={BUTTON.secondary} onClick={() => setItemNote({ id: c.id, text: regenItem({ character: c.id }) })}>{Icon.refresh(14)} Regenerate<span className="sr-only"> {c.first} {c.last}</span></button>
              {d.team.length > MIN_TEAM && <button type="button" className={BUTTON.secondary} onClick={() => {
                if (d.events.some(e => e.who === c.id)) setRemoving({ id: c.id, to: 'team' });
                else { edit(x => removeCharacter(x, c.id, 'team'), { label: `Remove ${[c.first, c.last].filter(Boolean).join(' ') || c.id}`, restorePoint: true }); setSelected(d.team.find(m => m.id !== c.id)?.id ?? ''); }
              }}>Remove<span className="sr-only"> {c.first}</span></button>}
            </div>
            {removing?.id === c.id && (
              <div role="alert" className="flex flex-wrap items-end gap-3 rounded-12 border border-solid border-author-need-line bg-author-need-field p-3 text-14">
                <span className="min-w-60 flex-1">{d.events.filter(e => e.who === c.id).map(e => e.title).join(', ')} {d.events.filter(e => e.who === c.id).length === 1 ? 'is' : 'are'} about {c.first}. Where should {d.events.filter(e => e.who === c.id).length === 1 ? 'it' : 'they'} go?</span>
                <Field label="Their events">{id => (
                  <Select id={id} value={removing.to} onChange={e => setRemoving({ id: c.id, to: e.target.value })}>
                    <option value="team">The whole team</option>
                    <option value="member">One person, the engine picks</option>
                    {d.team.filter(m => m.id !== c.id).map(m => <option key={m.id} value={m.id}>{m.first} {m.last}</option>)}
                    <option value="remove">Remove them too</option>
                  </Select>
                )}</Field>
                <button type="button" className={BUTTON.secondary} onClick={() => { edit(x => removeCharacter(x, c.id, removing.to), { label: removeLabel(d, c, removing.to), restorePoint: true }); setRemoving(null); setSelected(d.team.find(m => m.id !== c.id)?.id ?? ''); }}>Remove {c.first}</button>
                <button type="button" className={BUTTON.link} onClick={() => setRemoving(null)}>Keep {c.first}</button>
              </div>
            )}
            {itemNote?.id === c.id && <p role="status" className="m-0 text-13 text-author-body">{itemNote.text}</p>}
            <dl className="m-0 grid grid-cols-3 gap-3">
              <div className="flex flex-col gap-1"><dt className="text-13 font-700 text-author-label">Stage</dt><dd className="m-0 rounded-10 border border-solid border-author-line-control px-3 py-2 text-14">{stageName(c.stage)}</dd></div>
              <div className="flex flex-col gap-1"><dt className="text-13 font-700 text-author-label">Starting skill</dt><dd className={`m-0 rounded-10 border border-solid px-3 py-2 text-14 ${toneOf(d.marks[`team.${c.id}.stats`])}`}>{c.stats.skill} &middot; {c.stats.skill >= 70 ? 'strong' : c.stats.skill >= 40 ? 'steady' : 'low'}</dd></div>
              <div className="flex flex-col gap-1"><dt className="text-13 font-700 text-author-label">Starting morale</dt><dd className={`m-0 rounded-10 border border-solid px-3 py-2 text-14 ${toneOf(d.marks[`team.${c.id}.stats`])}`}>{c.stats.morale} &middot; {c.stats.morale >= 70 ? 'high' : c.stats.morale >= 40 ? 'steady' : 'low'}</dd></div>
            </dl>
            <Field label="Persona" mark={`team.${c.id}.persona`}>{id => <TextArea id={id} rows={3} tone={toneOf(d.marks[`team.${c.id}.persona`])} value={c.persona} onChange={e => edit(x => { const m = x.team.find(y => y.id === c.id); if (m) m.persona = e.target.value; }, `team.${c.id}.persona`)} />}</Field>
            <Field label="Hidden concern" mark={`team.${c.id}.hiddenConcern`}>{id => <TextArea id={id} rows={2} tone={toneOf(d.marks[`team.${c.id}.hiddenConcern`])} value={c.hiddenConcern} onChange={e => edit(x => { const m = x.team.find(y => y.id === c.id); if (m) m.hiddenConcern = e.target.value; }, `team.${c.id}.hiddenConcern`)} />}</Field>
            {suggestion && (
              <div className="flex flex-wrap items-center gap-3 rounded-14 border-[1.5px] border-dashed border-author-kora p-4">
                <span aria-hidden="true" className="text-author-kora">{Icon.spark()}</span>
                <p className="m-0 min-w-60 flex-1 text-14"><b>Suggestion:</b> {suggestion.text}</p>
                <button type="button" className={BUTTON.kora} onClick={() => edit(x => { for (const p of applySuggestion(x, suggestion.id)) x.marks[p] = nextMark(x.marks[p], 'ai'); }, { label: `Kora: ${suggestion.action}`, restorePoint: true })}>Use</button>
                <button type="button" className={BUTTON.secondary} onClick={() => edit(x => { const s = x.suggestions.find(y => y.id === suggestion.id); if (s) s.done = true; })}>Dismiss</button>
              </div>
            )}
            <details className="rounded-12 border border-solid border-author-line p-3">
              <summary className="cursor-pointer text-15 font-800">How the AI character plays {c.first}: voice, reply length, relationships</summary>
              <Scroll label="Advanced details" className="mt-2 max-h-48">
                <dl className="m-0 grid grid-cols-[9rem_minmax(0,1fr)] gap-x-3 gap-y-1 text-14">
                  <dt className="font-700 text-author-label">Voice</dt><dd className="m-0">{c.voice.accent}, pace {c.voice.pace}, warmth {c.voice.warmth}</dd>
                  <dt className="font-700 text-author-label">Reply length</dt><dd className="m-0">{c.voice.replyLength}</dd>
                  <dt className="font-700 text-author-label">Relationships</dt><dd className="m-0">{c.relationships.map(r => `${r.kind} ${d.team.find(o => o.id === r.with)?.first ?? ''}`).join('; ') || 'None'}</dd>
                  <dt className="font-700 text-author-label">Starts needing</dt><dd className="m-0">{d.lens.needs[needOf(c.stats)]?.label}</dd>
                </dl>
              </Scroll>
            </details>
            <p className="m-0 text-13"><MarkOf path={`team.${c.id}.identity`} /> <span className="text-author-muted">Open Edit profile for identity, voice, personality and starting stats.</span></p>
          </section>
        )}
      </div>
      {editingChar && (
        <CharacterEditor key={editingChar.id} draft={d} character={editingChar} open onOpenChange={o => { if (!o) setEditing(null); }}
          onSave={(next, changed) => { edit(x => { const i = x.team.findIndex(m => m.id === next.id); if (i >= 0) x.team[i] = next; }, changed); setEditing(null); }} />
      )}
    </TabBody>
  );
}
