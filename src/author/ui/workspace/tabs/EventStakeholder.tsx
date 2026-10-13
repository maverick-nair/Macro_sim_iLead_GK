import type { AuthorDraft, EventDraft, RequestDraft } from '../../../model/draft';
import { defaultRequest, TYPE_LABEL } from '../../../model/stakeholders';
import { Field, Select, TextInput } from '../../kit';

const delta = (v: string) => Math.max(-30, Math.min(30, Math.round(Number(v.replace('−', '-')) || 0)));
const signed = (v: number) => (v < 0 ? `−${-v}` : String(v));

interface Props { d: AuthorDraft; e: EventDraft; set: (patch: Partial<EventDraft>) => void }

/**
 * Events: an event and stakeholders outside the team (D162, D163). It can come from a stakeholder (their message, their
 * card), and then ask for something by a deadline: a reply, or a meeting that one of their interactions answers, with
 * what answering in time and ignoring it do to the relationship. Any event can also move stakeholders when it plays.
 */
export function EventStakeholder({ d, e, set }: Props) {
  if (!d.stakeholders.length && !e.stakeholder && !Object.keys(e.moves ?? {}).length) return null;
  const from = d.stakeholders.find(s => s.key === e.stakeholder);
  const r = e.request ?? null;
  const setR = (patch: Partial<RequestDraft>) => r && set({ request: { ...r, ...patch } });
  const live = from?.interactions.filter(i => i.enabled) ?? [];
  const moves = e.moves ?? {};
  const first = from ? from.name.split(' ')[0] || from.name : '';
  return (
    <fieldset className="m-0 flex flex-col gap-3 rounded-12 border border-solid border-author-line p-3">
      <legend className="px-1 text-15 font-800">Stakeholders</legend>
      <div className="grid grid-cols-[2fr_2fr] gap-3 max-[1180px]:grid-cols-1">
        <Field label="Comes from" hint="Their name and face on the message, and their relationship moves with it">{id => (
          <Select id={id} value={e.stakeholder ?? ''} onChange={ev => set(ev.target.value ? { stakeholder: ev.target.value } : { stakeholder: null, request: null })}>
            <option value="">Nobody outside the team</option>
            {e.stakeholder && !from && <option value={e.stakeholder}>Missing: pick a stakeholder</option>}
            {d.stakeholders.map(s => <option key={s.key} value={s.key}>{s.name}, {s.role}</option>)}
          </Select>
        )}</Field>
        {from && !e.choice && (
          <Field label={`${first} asks for`}>{id => (
            <Select id={id} value={r ? (r.kind === 'meeting' ? `meeting:${r.interaction ?? ''}` : 'message') : ''} onChange={ev => {
              const v = ev.target.value;
              if (!v) return set({ request: null });
              const base = r ?? defaultRequest(from);
              set({ request: v === 'message' ? { ...base, kind: 'message', interaction: null } : { ...base, kind: 'meeting', interaction: v.split(':')[1] as RequestDraft['interaction'] }, respondWith: [] });
            }}>
              <option value="">Nothing by a deadline</option>
              <option value="message">A reply to the message</option>
              {r?.kind === 'meeting' && !live.some(i => i.type === r.interaction) && <option value={`meeting:${r.interaction ?? ''}`}>Missing: that interaction is off</option>}
              {live.map(i => <option key={i.type} value={`meeting:${i.type}`}>A meeting: {TYPE_LABEL[i.type].toLowerCase()} ({i.label})</option>)}
            </Select>
          )}</Field>
        )}
      </div>
      {from && r && !e.choice && (
        <div className="grid grid-cols-[1fr_2fr_2fr] gap-3 max-[1180px]:grid-cols-1">
          <Field label="Days to answer">{id => <Select id={id} value={r.within} onChange={ev => setR({ within: Number(ev.target.value) })}>{[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n} day{n === 1 ? '' : 's'}</option>)}</Select>}</Field>
          <fieldset className="m-0 grid grid-cols-2 gap-2 border-0 p-0">
            <legend className="mb-1 text-13 font-700 text-author-label">Answered in time</legend>
            <Field label="Trust">{id => <TextInput id={id} inputMode="numeric" value={signed(r.onTime.trust)} onChange={ev => setR({ onTime: { ...r.onTime, trust: delta(ev.target.value) } })} />}</Field>
            <Field label="Satisfaction">{id => <TextInput id={id} inputMode="numeric" value={signed(r.onTime.satisfaction)} onChange={ev => setR({ onTime: { ...r.onTime, satisfaction: delta(ev.target.value) } })} />}</Field>
          </fieldset>
          <fieldset className="m-0 grid grid-cols-2 gap-2 border-0 p-0">
            <legend className="mb-1 text-13 font-700 text-author-label">Ignored</legend>
            <Field label="Trust">{id => <TextInput id={id} inputMode="numeric" value={signed(r.ifIgnored.trust)} onChange={ev => setR({ ifIgnored: { ...r.ifIgnored, trust: delta(ev.target.value) } })} />}</Field>
            <Field label="Satisfaction">{id => <TextInput id={id} inputMode="numeric" value={signed(r.ifIgnored.satisfaction)} onChange={ev => setR({ ifIgnored: { ...r.ifIgnored, satisfaction: delta(ev.target.value) } })} />}</Field>
          </fieldset>
          <label className="col-span-full flex items-center gap-2 text-14"><input type="checkbox" checked={e.ifIgnored.sponsor} onChange={ev => set({ ifIgnored: { ...e.ifIgnored, sponsor: ev.target.checked } })} /> If ignored, the sponsor hears of it too</label>
        </div>
      )}
      {d.stakeholders.length > 0 && (
        <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
          <legend className="mb-1 text-13 font-700 text-author-label">When it plays, it moves</legend>
          <div className="grid grid-cols-4 gap-2 max-[1180px]:grid-cols-2">
            {d.stakeholders.flatMap(s => (['trust', 'satisfaction'] as const).map(m => (
              <Field key={`${s.key}.${m}`} label={`${s.name.split(' ')[0] || s.key}: ${m}`}>{id => <TextInput id={id} inputMode="numeric" value={signed(moves[s.key]?.[m] ?? 0)} onChange={ev => {
                const all = { ...moves };
                const cur = { trust: all[s.key]?.trust ?? 0, satisfaction: all[s.key]?.satisfaction ?? 0, [m]: delta(ev.target.value) };
                if (cur.trust || cur.satisfaction) all[s.key] = cur; else delete all[s.key];
                set({ moves: all });
              }} />}</Field>
            )))}
          </div>
        </fieldset>
      )}
    </fieldset>
  );
}
