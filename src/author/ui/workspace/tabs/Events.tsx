import { useState, type DragEvent } from 'react';
import { EVENT_KINDS, type EventDraft } from '../../../model/draft';
import { freshKey } from '../../../model/seed';
import { useAuthor } from '../../../model/store';
import { BUTTON, CARD, CardHead, Field, MarkOf, Select, TextArea, TextInput, toneOf } from '../../kit';
import { TabBody, TabHead } from '../Workspace';
import { useRegenerate, useRegenerateItem } from './regenerate';

const KIND: Record<EventDraft['kind'], { label: string; bar: string; text: string }> = {
  impact: { label: 'Impact', bar: 'bg-author-event-impact', text: 'text-author-decline' },
  opportunity: { label: 'Opportunity', bar: 'bg-author-event-opportunity', text: 'text-author-gain' },
  people: { label: 'People', bar: 'bg-author-event-people', text: 'text-author-primary' },
  sponsor: { label: 'Sponsor', bar: 'bg-author-event-sponsor', text: 'text-author-need' }
};
const ARRIVES: Record<EventDraft['arrives'], string> = { modal: 'A card on the board', bulletin: 'News bulletin', chat: 'A chat message', email: 'An email', sponsorCall: 'A call from the sponsor' };
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const n = (v: string) => Math.max(-30, Math.min(30, Math.round(Number(v.replace('−', '-')) || 0)));

/**
 * Workspace: Events (docs/design/genie/Events): the run's events as cards across the weeks, coloured by
 * kind. Drag a card to another week, or set its week in the editor (the keyboard way); the editor holds
 * what participants read and what it does to the team.
 */
export default function Events() {
  const d = useAuthor(s => s.draft);
  const edit = useAuthor(s => s.edit);
  const regen = useRegenerate('events');
  const regenItem = useRegenerateItem();
  const [itemNote, setItemNote] = useState<{ key: string; text: string } | null>(null);
  const [selected, setSelected] = useState<string>(d.events.find(e => e.timing === 'fixed')?.key ?? d.events[0]?.key ?? '');
  const [dragging, setDragging] = useState<string | null>(null);
  const e = d.events.find(x => x.key === selected);
  const weeks = Array.from({ length: d.process.weeks }, (_, i) => i + 1);
  const set = (patch: Partial<EventDraft>) => e && edit(x => { const t = x.events.find(y => y.key === e.key); if (t) Object.assign(t, patch); }, `events.${e.key}`);
  const drop = (week: number) => (ev: DragEvent) => { ev.preventDefault(); const k = ev.dataTransfer.getData('text/plain') || dragging; if (k) edit(x => { const t = x.events.find(y => y.key === k); if (t) { t.week = week; t.timing = 'fixed'; } }, `events.${k}`); setDragging(null); };
  const floating = d.events.filter(x => x.timing !== 'fixed' || !x.week);
  const whoOptions = [['team', 'The whole team'], ['member', 'One person, Kora picks'], ['sponsor', 'The sponsor'], ...d.process.stages.map(s => [`stage:${s.key}`, `Everyone in ${s.name}`]), ...d.team.map(c => [c.id, `${c.first} ${c.last}`])];

  return (
    <TabBody label="Events" head={
      <TabHead title="Events" actions={<>
        <button type="button" className={BUTTON.secondary} onClick={() => {
          const key = freshKey('new_event', d.events.map(x => x.key));
          edit(x => { x.events.push({ key, title: 'New event', kind: 'impact', week: 1, day: 1, timing: 'fixed', timingNote: '', who: 'team', arrives: 'modal', body: '', skill: 0, morale: -3, result: -3, leadFlow: 0, response: '', within: 2, ignored: '', origin: 'yours' }); }, `events.${key}`);
          setSelected(key);
        }}>Add an event</button>
        {regen.button}
      </>}>{d.events.length} events across the run. Drag a card to move it to another week, or change its week below.</TabHead>
    }>
      {regen.note}
      <div className="flex flex-col gap-4">
        <section className={`${CARD} flex flex-col gap-3 p-5`} aria-labelledby="timeline">
          <CardHead id="timeline" title={`Across the ${d.process.weeks} weeks`}>
            <ul className="m-0 flex list-none flex-wrap gap-3 p-0 text-13" aria-label="Kinds">
              {EVENT_KINDS.map(k => <li key={k} className={`flex items-center gap-1.5 ${KIND[k].text}`}><span aria-hidden="true" className={`size-2.5 rounded-2 ${KIND[k].bar}`} />{KIND[k].label}</li>)}
            </ul>
          </CardHead>
          <ol className="m-0 grid list-none gap-2 p-0" style={{ gridTemplateColumns: `repeat(${weeks.length}, minmax(0, 1fr))` }} aria-label="Weeks">
            {weeks.map(w => (
              <li key={w} className={`flex min-w-0 flex-col gap-2 rounded-10 p-1 ${dragging ? 'bg-author-track' : ''}`} onDragOver={ev => ev.preventDefault()} onDrop={drop(w)}>
                <span className="text-11 font-800 tracking-[0.1em] text-author-label uppercase">Week {w}</span>
                <ul className="m-0 flex list-none flex-col gap-2 p-0" aria-label={`Week ${w}`}>
                  {d.events.filter(x => x.timing === 'fixed' && x.week === w).map(x => (
                    <li key={x.key} draggable onDragStart={ev => { ev.dataTransfer.setData('text/plain', x.key); setDragging(x.key); }} onDragEnd={() => setDragging(null)}>
                      <button type="button" aria-current={x.key === selected || undefined} onClick={() => setSelected(x.key)}
                        className={`flex w-full cursor-grab flex-col gap-0.5 rounded-10 border-2 border-solid bg-author-surface p-2 text-start focus-visible:outline-2 focus-visible:outline-author-primary ${x.key === selected ? 'border-author-primary' : 'border-author-line'}`}>
                        <span aria-hidden="true" className={`h-1 w-full rounded-pill ${KIND[x.kind].bar}`} />
                        <b className="text-12 leading-[1.25] break-words">{x.title}</b>
                        <span className="text-11 text-author-body">{KIND[x.kind].label} &middot; {x.who === 'team' ? 'all' : x.who === 'member' ? 'one' : x.who.startsWith('stage:') ? 'stage' : x.who === 'sponsor' ? 'sponsor' : d.team.find(c => c.id === x.who)?.first ?? 'one'}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
          {floating.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 border-t border-solid border-author-rule pt-3">
              <span className="text-13 font-700 text-author-label">When something happens:</span>
              {floating.map(x => <button key={x.key} type="button" aria-current={x.key === selected || undefined} onClick={() => setSelected(x.key)} className={`${BUTTON.secondary} ${x.key === selected ? 'border-author-primary' : ''}`}>{x.title} &middot; {x.timingNote}</button>)}
            </div>
          )}
        </section>
        {e && (
          <section className={`${CARD} flex flex-col gap-3 p-5`} aria-labelledby="event-title">
            <CardHead id="event-title" title={e.title}>
              <MarkOf path={`events.${e.key}`} />
              <button type="button" className={BUTTON.secondary} onClick={() => setItemNote({ key: e.key, text: regenItem({ event: e.key }) })}>Regenerate<span className="sr-only"> {e.title}</span></button>
              <button type="button" className={BUTTON.secondary} onClick={() => { edit(x => { x.events = x.events.filter(y => y.key !== e.key); }); setSelected(d.events.find(x => x.key !== e.key)?.key ?? ''); }}>Remove</button>
            </CardHead>
            {itemNote?.key === e.key && <p role="status" className="m-0 text-13 text-author-body">{itemNote.text}</p>}
            <Field label="Title">{id => <TextInput id={id} value={e.title} onChange={ev => set({ title: ev.target.value })} />}</Field>
            <div className="grid grid-cols-4 gap-3 max-[1180px]:grid-cols-2">
              <Field label="Kind">{id => <Select id={id} value={e.kind} onChange={ev => set({ kind: ev.target.value as EventDraft['kind'] })}>{EVENT_KINDS.map(k => <option key={k} value={k}>{KIND[k].label}</option>)}</Select>}</Field>
              <Field label="When">{id => (
                <Select id={id} value={e.timing === 'fixed' && e.week ? `${e.week}-${e.day}` : 'floating'} onChange={ev => { const [w, dd] = ev.target.value.split('-').map(Number); if (w) set({ week: w, day: dd, timing: 'fixed' }); }}>
                  {e.timing !== 'fixed' && <option value="floating">{e.timingNote}</option>}
                  {weeks.flatMap(w => DAYS.map((name, i) => <option key={`${w}-${i + 1}`} value={`${w}-${i + 1}`}>Week {w}, {name}</option>))}
                </Select>
              )}</Field>
              <Field label="Who it hits">{id => <Select id={id} value={e.who} onChange={ev => set({ who: ev.target.value })}>{whoOptions.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select>}</Field>
              <Field label="Arrives as">{id => <Select id={id} value={e.arrives} onChange={ev => set({ arrives: ev.target.value as EventDraft['arrives'] })}>{(Object.keys(ARRIVES) as Array<EventDraft['arrives']>).map(k => <option key={k} value={k} disabled={(k === 'chat' || k === 'email') && (e.who === 'team' || e.who.startsWith('stage:'))}>{ARRIVES[k]}</option>)}</Select>}</Field>
            </div>
            <Field label="What participants read">{id => <TextArea id={id} rows={3} tone={toneOf(d.marks[`events.${e.key}`])} value={e.body} onChange={ev => set({ body: ev.target.value })} />}</Field>
            <div className="grid grid-cols-4 gap-3 max-[1180px]:grid-cols-2">
              {(['skill', 'morale', 'result'] as const).map(k => <Field key={k} label={k[0].toUpperCase() + k.slice(1)}>{id => <TextInput id={id} inputMode="numeric" tone={toneOf(d.marks[`events.${e.key}`])} value={e[k] < 0 ? `−${-e[k]}` : e[k]} onChange={ev => set({ [k]: n(ev.target.value) })} />}</Field>)}
              <Field label="Lead flow" hint="Percent change in new leads that week">{id => <TextInput id={id} inputMode="numeric" value={`${e.leadFlow < 0 ? '−' : ''}${Math.abs(e.leadFlow)}%`} onChange={ev => set({ leadFlow: Math.max(-100, Math.min(100, Math.round(Number(ev.target.value.replace('−', '-').replace('%', '')) || 0))) })} />}</Field>
            </div>
            <details className="rounded-12 border border-solid border-author-line p-3">
              <summary className="cursor-pointer text-15 font-800">Advanced: expected response, time to respond, what happens if ignored</summary>
              <div className="mt-3 grid grid-cols-3 gap-3 max-[1000px]:grid-cols-1">
                <Field label="Expected response">{id => <TextInput id={id} value={e.response} placeholder="Actions that answer it" onChange={ev => set({ response: ev.target.value })} />}</Field>
                <Field label="Days to respond">{id => <TextInput id={id} type="number" min={1} max={5} value={e.within} onChange={ev => set({ within: Math.max(1, Math.min(5, Number(ev.target.value) || 1)) })} />}</Field>
                <Field label="If ignored">{id => <TextInput id={id} value={e.ignored} onChange={ev => set({ ignored: ev.target.value })} />}</Field>
              </div>
            </details>
          </section>
        )}
      </div>
    </TabBody>
  );
}
