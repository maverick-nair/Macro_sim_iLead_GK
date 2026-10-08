import { useState, type DragEvent } from 'react';
import { EVENT_CONDITIONS, EVENT_KINDS, type EventDraft } from '../../../model/draft';
import { CONDITION_LABELS, timingText } from '../../../model/run';
import { freshKey } from '../../../model/seed';
import { useAuthor } from '../../../model/store';
import { BUTTON, CARD, CardHead, Field, MarkOf, Select, TextArea, TextInput, toneOf } from '../../kit';
import { TabBody, TabHead } from '../Workspace';
import { useRegenerate } from './regenerate';

const KIND: Record<EventDraft['kind'], { label: string; bar: string; text: string }> = {
  impact: { label: 'Impact', bar: 'bg-author-event-impact', text: 'text-author-decline' },
  opportunity: { label: 'Opportunity', bar: 'bg-author-event-opportunity', text: 'text-author-gain' },
  people: { label: 'People', bar: 'bg-author-event-people', text: 'text-author-primary' },
  sponsor: { label: 'Sponsor', bar: 'bg-author-event-sponsor', text: 'text-author-need' }
};
const ARRIVES: Record<EventDraft['arrives'], string> = { modal: 'A card on the board', bulletin: 'News bulletin', chat: 'A chat message', email: 'An email', sponsorCall: 'A call from the sponsor' };
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MESSAGES = new Set<EventDraft['arrives']>(['chat', 'email', 'sponsorCall']);
const delta = (v: string) => Math.max(-30, Math.min(30, Math.round(Number(v.replace('−', '-')) || 0)));
const signed = (v: number) => (v < 0 ? `−${-v}` : String(v));
const FLOATING: Array<[Exclude<EventDraft['timing'], 'fixed'>, string]> = [['random', 'Some time in a range of weeks'], ['condition', 'When something happens'], ['followup', 'Only when another event is ignored']];

/**
 * Workspace: Events (docs/design/genie/Events, D128): the run's events as cards across the weeks, coloured
 * by kind. Drag a card to another week, or set its timing in the editor (the keyboard way). Every field
 * here reaches the simulation: the timing (a fixed day, a range of weeks, a condition the engine checks,
 * or only as a follow up), who it hits and how it arrives, its effects and the week's lead flow, and the
 * response it expects, with what happens when that response does not come.
 */
export default function Events() {
  const d = useAuthor(s => s.draft);
  const edit = useAuthor(s => s.edit);
  const regen = useRegenerate('events');
  const [selected, setSelected] = useState<string>(d.events.find(e => e.timing === 'fixed')?.key ?? d.events[0]?.key ?? '');
  const [dragging, setDragging] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const e = d.events.find(x => x.key === selected);
  const weeks = Array.from({ length: d.process.weeks }, (_, i) => i + 1);
  const days = DAYS.slice(0, d.process.daysPerWeek);
  const set = (patch: Partial<EventDraft>) => e && edit(x => { const t = x.events.find(y => y.key === e.key); if (t) Object.assign(t, patch); }, `events.${e.key}`);
  const drop = (week: number) => (ev: DragEvent) => { ev.preventDefault(); const k = ev.dataTransfer.getData('text/plain') || dragging; if (k) edit(x => { const t = x.events.find(y => y.key === k); if (t) { t.week = week; t.timing = 'fixed'; } }, `events.${k}`); setDragging(null); };
  const floating = d.events.filter(x => x.timing !== 'fixed' || !x.week);
  const whoOptions = [['team', 'The whole team'], ['member', 'One person, the engine picks'], ['sponsor', 'The sponsor'], ...d.process.stages.map(s => [`stage:${s.key}`, `Everyone in ${s.name}`]), ...d.team.map(c => [c.id, `${c.first} ${c.last}`])];
  const inUse = d.actions.filter(a => a.core || a.enabled);
  const followers = (key: string) => d.events.filter(x => x.ifIgnored.followUp === key);
  const remove = (key: string) => {
    edit(x => { x.events = x.events.filter(y => y.key !== key); for (const y of x.events) if (y.ifIgnored.followUp === key) y.ifIgnored = { ...y.ifIgnored, followUp: null }; });
    setSelected(d.events.find(x => x.key !== key)?.key ?? '');
    setRemoving(null);
  };
  const setTiming = (v: string) => {
    if (!e) return;
    if (v === 'random') set({ timing: 'random', week: null, window: e.window ?? { from: 1, to: d.process.weeks, chance: 100 }, leadFlow: 0 });
    else if (v === 'condition') set({ timing: 'condition', week: null, condition: e.condition ?? { kind: 'teamMoraleBelow', value: 40, weeks: 1 }, leadFlow: 0 });
    else if (v === 'followup') set({ timing: 'followup', week: null, leadFlow: 0 });
    else { const [w, dd] = v.split('-').map(Number); if (w) set({ week: w, day: dd, timing: 'fixed' }); }
  };
  const answers = e ? [...(MESSAGES.has(e.arrives) ? [['reply', 'Reply to the message']] : []), ...inUse.map(a => [a.key, a.name]), ...e.respondWith.filter(k => k !== 'reply' && !inUse.some(a => a.key === k)).map(k => [k, `${d.actions.find(a => a.key === k)?.name ?? k} (not in this simulation)`])] : [];
  const responds = !!e && e.respondWith.length > 0;

  return (
    <TabBody label="Events" head={
      <TabHead title="Events" actions={<>
        <button type="button" className={BUTTON.secondary} onClick={() => {
          const key = freshKey('new_event', d.events.map(x => x.key));
          edit(x => { x.events.push({ key, title: 'New event', kind: 'impact', week: 1, day: 1, timing: 'fixed', who: 'team', arrives: 'modal', body: '', skill: 0, morale: -3, result: -3, leadFlow: 0, respondWith: [], within: 2, onTime: [0, 2, 0], ifIgnored: { sponsor: false, followUp: null }, origin: 'yours' }); }, `events.${key}`);
          setSelected(key);
        }}>Add an event</button>
        {regen.button}
      </>}>{d.events.length} events across the run. Drag a card to move it to another week, or change its timing below.</TabHead>
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
                        <span className="text-11 text-author-body">{KIND[x.kind].label} &middot; {x.who === 'team' ? 'all' : x.who === 'member' ? 'one' : x.who.startsWith('stage:') ? 'stage' : x.who === 'sponsor' ? 'sponsor' : d.team.find(c => c.id === x.who)?.first ?? 'missing'}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
          {floating.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 border-t border-solid border-author-rule pt-3">
              <span className="text-13 font-700 text-author-label">Not on a fixed week:</span>
              {floating.map(x => <button key={x.key} type="button" aria-current={x.key === selected || undefined} onClick={() => setSelected(x.key)} className={`${BUTTON.secondary} ${x.key === selected ? 'border-author-primary' : ''}`}>{x.title} &middot; {timingText(x, d.process.weeks)}</button>)}
            </div>
          )}
        </section>
        {e && (
          <section className={`${CARD} flex flex-col gap-3 p-5`} aria-labelledby="event-title">
            <CardHead id="event-title" title={e.title}>
              <MarkOf path={`events.${e.key}`} />
              <button type="button" className={BUTTON.secondary} onClick={() => edit(x => { const t = x.events.find(y => y.key === e.key); if (t) t.body = `${t.body.replace(/\s*The team is watching how you respond\.$/, '')} The team is watching how you respond.`.trim(); }, `events.${e.key}`, 'ai')}>Regenerate</button>
              <button type="button" className={BUTTON.secondary} onClick={() => (followers(e.key).length ? setRemoving(e.key) : remove(e.key))}>Remove</button>
            </CardHead>
            {removing === e.key && (
              <div role="alert" className="flex flex-wrap items-center gap-3 rounded-12 border border-solid border-author-need-line bg-author-need-field p-3 text-14">
                <span className="min-w-60 flex-1">{followers(e.key).map(f => f.title).join(', ')} {followers(e.key).length === 1 ? 'leads' : 'lead'} to this event when ignored. Removing it leaves {followers(e.key).length === 1 ? 'that event' : 'those events'} with no follow up.</span>
                <button type="button" className={BUTTON.secondary} onClick={() => remove(e.key)}>Remove anyway</button>
                <button type="button" className={BUTTON.link} onClick={() => setRemoving(null)}>Keep it</button>
              </div>
            )}
            <Field label="Title">{id => <TextInput id={id} value={e.title} onChange={ev => set({ title: ev.target.value })} />}</Field>
            <div className="grid grid-cols-4 gap-3 max-[1180px]:grid-cols-2">
              <Field label="Kind">{id => <Select id={id} value={e.kind} onChange={ev => set({ kind: ev.target.value as EventDraft['kind'] })}>{EVENT_KINDS.map(k => <option key={k} value={k}>{KIND[k].label}</option>)}</Select>}</Field>
              <Field label="When">{id => (
                <Select id={id} value={e.timing === 'fixed' ? `${e.week ?? 1}-${e.day}` : e.timing} onChange={ev => setTiming(ev.target.value)}>
                  {weeks.flatMap(w => days.map((name, i) => <option key={`${w}-${i + 1}`} value={`${w}-${i + 1}`}>Week {w}, {name}</option>))}
                  {FLOATING.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </Select>
              )}</Field>
              <Field label="Who it hits">{id => (
                <Select id={id} value={e.who} onChange={ev => { const who = ev.target.value; set({ who, ...((e.arrives === 'chat' || e.arrives === 'email') && (who === 'team' || who.startsWith('stage:')) ? { arrives: 'modal' as const } : null) }); }}>
                  {!whoOptions.some(([v]) => v === e.who) && <option value={e.who}>Missing: pick someone</option>}
                  {whoOptions.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </Select>
              )}</Field>
              <Field label="Arrives as" hint={e.who === 'team' || e.who.startsWith('stage:') ? 'A chat or email comes from one person.' : undefined}>{id => <Select id={id} value={e.arrives} onChange={ev => set({ arrives: ev.target.value as EventDraft['arrives'], ...(MESSAGES.has(ev.target.value as EventDraft['arrives']) ? null : { respondWith: e.respondWith.filter(k => k !== 'reply') }) })}>{(Object.keys(ARRIVES) as Array<EventDraft['arrives']>).map(k => <option key={k} value={k} disabled={(k === 'chat' || k === 'email') && (e.who === 'team' || e.who.startsWith('stage:'))}>{ARRIVES[k]}</option>)}</Select>}</Field>
            </div>
            {e.timing === 'random' && (() => {
              const w = e.window ?? { from: 1, to: d.process.weeks, chance: 100 };
              const setW = (patch: Partial<typeof w>) => set({ window: { ...w, ...patch } });
              return (
                <div className="grid grid-cols-3 gap-3 max-[1180px]:grid-cols-1">
                  <Field label="From week">{id => <Select id={id} value={w.from} onChange={ev => { const from = Number(ev.target.value); setW({ from, to: Math.max(from, w.to) }); }}>{weeks.map(n => <option key={n} value={n}>Week {n}</option>)}</Select>}</Field>
                  <Field label="To week">{id => <Select id={id} value={w.to} onChange={ev => { const to = Number(ev.target.value); setW({ to, from: Math.min(to, w.from) }); }}>{weeks.map(n => <option key={n} value={n}>Week {n}</option>)}</Select>}</Field>
                  <Field label="Happens in" hint="Out of 100 runs; drawn once per run">{id => <TextInput id={id} type="number" min={0} max={100} value={w.chance} onChange={ev => setW({ chance: Math.max(0, Math.min(100, Math.round(Number(ev.target.value) || 0))) })} />}</Field>
                </div>
              );
            })()}
            {e.timing === 'condition' && (() => {
              const c = e.condition ?? { kind: 'teamMoraleBelow' as const, value: 40, weeks: 1 };
              const setC = (patch: Partial<typeof c>) => set({ condition: { ...c, ...patch } });
              return (
                <div className="grid grid-cols-3 gap-3 max-[1180px]:grid-cols-1">
                  <Field label="Condition" hint="Checked at the start of each week">{id => <Select id={id} value={c.kind} onChange={ev => setC({ kind: ev.target.value as typeof c.kind })}>{EVENT_CONDITIONS.map(k => <option key={k} value={k}>{CONDITION_LABELS[k]}</option>)}</Select>}</Field>
                  <Field label="Value, 0 to 100">{id => <TextInput id={id} type="number" min={0} max={100} value={c.value} onChange={ev => setC({ value: Math.max(0, Math.min(100, Math.round(Number(ev.target.value) || 0))) })} />}</Field>
                  <Field label="Weeks in a row">{id => <Select id={id} value={c.weeks} onChange={ev => setC({ weeks: Number(ev.target.value) })}>{[1, 2, 3, 4].map(n => <option key={n} value={n}>{n}</option>)}</Select>}</Field>
                </div>
              );
            })()}
            {e.timing === 'followup' && <p className="m-0 text-13 text-author-body">{followers(e.key).length ? `Follows ${followers(e.key).map(f => f.title).join(', ')} when ${followers(e.key).length === 1 ? 'it is' : 'they are'} ignored.` : 'No event leads to this one yet. Pick it as the follow up of another event, or give it a week.'}</p>}
            <Field label="What participants read">{id => <TextArea id={id} rows={3} tone={toneOf(d.marks[`events.${e.key}`])} value={e.body} onChange={ev => set({ body: ev.target.value })} />}</Field>
            <div className="grid grid-cols-4 gap-3 max-[1180px]:grid-cols-2">
              {(['skill', 'morale', 'result'] as const).map(k => <Field key={k} label={k[0].toUpperCase() + k.slice(1)}>{id => <TextInput id={id} inputMode="numeric" tone={toneOf(d.marks[`events.${e.key}`])} value={signed(e[k])} onChange={ev => set({ [k]: delta(ev.target.value) })} />}</Field>)}
              <Field label="Lead flow" hint={e.timing === 'fixed' ? 'Percent change in new leads that week' : 'Needs a fixed week'}>{id => <TextInput id={id} inputMode="numeric" disabled={e.timing !== 'fixed'} value={`${e.leadFlow < 0 ? '−' : ''}${Math.abs(e.leadFlow)}%`} onChange={ev => set({ leadFlow: Math.max(-100, Math.min(100, Math.round(Number(ev.target.value.replace('−', '-').replace('%', '')) || 0))) })} />}</Field>
            </div>
            <details className="rounded-12 border border-solid border-author-line p-3">
              <summary className="cursor-pointer text-15 font-800">Response: {responds ? `${e.respondWith.map(k => answers.find(([v]) => v === k)?.[1] ?? k).join(' or ')}, within ${e.within} day${e.within === 1 ? '' : 's'}${e.ifIgnored.sponsor || e.ifIgnored.followUp ? '; if ignored, it escalates' : ''}` : 'none expected'}</summary>
              <div className="mt-3 grid grid-cols-2 gap-4 max-[1000px]:grid-cols-1">
                <fieldset className="m-0 flex flex-col gap-1.5 border-0 p-0">
                  <legend className="mb-1 text-13 font-700 text-author-label">What counts as a response</legend>
                  {answers.map(([k, l]) => (
                    <label key={k} className="flex items-center gap-2 text-14"><input type="checkbox" checked={e.respondWith.includes(k)} onChange={ev => set({ respondWith: ev.target.checked ? [...e.respondWith, k] : e.respondWith.filter(x => x !== k) })} /> {l}</label>
                  ))}
                  <p className="m-0 text-12 text-author-muted">None ticked: no response is expected.</p>
                </fieldset>
                <div className="flex flex-col gap-3">
                  <Field label="Days to respond">{id => <Select id={id} disabled={!responds} value={e.within} onChange={ev => set({ within: Number(ev.target.value) })}>{[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n} day{n === 1 ? '' : 's'}</option>)}</Select>}</Field>
                  <fieldset className="m-0 flex flex-col gap-1.5 border-0 p-0" disabled={!responds}>
                    <legend className="mb-1 text-13 font-700 text-author-label">If answered in time, for the person</legend>
                    <div className="grid grid-cols-3 gap-2">
                      {(['Skill', 'Morale', 'Result'] as const).map((l, i) => <Field key={l} label={l}>{id => <TextInput id={id} inputMode="numeric" value={signed(e.onTime[i])} onChange={ev => set({ onTime: e.onTime.map((v, k) => (k === i ? delta(ev.target.value) : v)) as EventDraft['onTime'] })} />}</Field>)}
                    </div>
                  </fieldset>
                  <fieldset className="m-0 flex flex-col gap-2 border-0 p-0" disabled={!responds}>
                    <legend className="mb-1 text-13 font-700 text-author-label">If ignored</legend>
                    <label className="flex items-center gap-2 text-14"><input type="checkbox" checked={e.ifIgnored.sponsor} onChange={ev => set({ ifIgnored: { ...e.ifIgnored, sponsor: ev.target.checked } })} /> The sponsor hears of it, and their confidence drops</label>
                    <Field label="Then this event follows">{id => (
                      <Select id={id} value={e.ifIgnored.followUp ?? ''} onChange={ev => set({ ifIgnored: { ...e.ifIgnored, followUp: ev.target.value || null } })}>
                        <option value="">None</option>
                        {e.ifIgnored.followUp && !d.events.some(x => x.key === e.ifIgnored.followUp) && <option value={e.ifIgnored.followUp}>Missing: pick another</option>}
                        {d.events.filter(x => x.key !== e.key).map(x => <option key={x.key} value={x.key}>{x.title}</option>)}
                      </Select>
                    )}</Field>
                    <p className="m-0 text-12 text-author-muted">The follow up plays its own effects and message. Set it to &ldquo;Only when another event is ignored&rdquo; so it happens only then.</p>
                  </fieldset>
                </div>
              </div>
            </details>
          </section>
        )}
      </div>
    </TabBody>
  );
}
