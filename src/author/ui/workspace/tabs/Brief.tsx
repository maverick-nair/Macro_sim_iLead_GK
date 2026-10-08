import { useRef, useState, type FocusEvent } from 'react';
import { REGIONS } from '../../../context';
import { previewBrief, propagateBrief, type BriefField } from '../../../model/deps';
import { fitRun, movedNote } from '../../../model/run';
import { useAuthor } from '../../../model/store';
import { BUTTON, CARD, CardHead, Chip, Field, MarkOf, Segmented, Select, TEXT_MAX, TextArea, TextInput, toneOf } from '../../kit';
import { TabBody, TabHead } from '../Workspace';
import { useRegenerate } from './regenerate';

const RUN_NAMES = { full: 'Full', standard: 'Standard', lite: 'Lite' } as const;
const TONES = ['Realistic', 'Light hearted', 'High stakes', 'Formal', 'Professional', 'Warm and encouraging', 'Direct and brisk'];
const NAMES: Record<BriefField, string> = { participants: 'participants', industry: 'industry', client: 'client', challenge: 'challenge' };

/** An answer changed here, with what it changes in the draft, waiting for Apply or Keep as note only (D146). */
interface Pending { field: BriefField; to: string; summary: string[] }

/**
 * Workspace: Brief (docs/design/genie/Brief, D128): what the author told Kora, kept as a record Kora drafts
 * from, and the run's format, which the simulation plays: purpose, run length (weeks and live
 * conversations a week) and language (number formats and the AI characters' language).
 *
 * Every answer from the chat can be changed here (D146). Leaving a changed answer shows what it changes in the
 * draft ("This changes: company name in 4 places, the industry of the story, 2 events") with Apply, one named
 * step of undo with a version saved first, or Keep as note only. The stakeholders, objectives and dilemmas read
 * from the brief are the author's notes for Kora, editable here.
 */
export default function Brief() {
  const d = useAuthor(s => s.draft);
  const edit = useAuthor(s => s.edit);
  const regen = useRegenerate('brief');
  const [moved, setMoved] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [said, setSaid] = useState<{ field: BriefField; text: string } | null>(null);
  const at = useRef<string | null>(null);
  const b = d.brief;
  const set = <K extends keyof typeof b>(k: K, v: (typeof b)[K]) => edit(x => { x.brief[k] = v; }, `brief.${k}`);

  /** Focus remembers the answer; leaving it changed previews what it changes in the draft. */
  const watch = (field: BriefField) => ({
    onFocus: (e: FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => { at.current = e.currentTarget.value; },
    onBlur: (e: FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const from = at.current, to = e.currentTarget.value;
      at.current = null;
      if (from === null || from.trim() === to.trim()) return;
      const { summary } = previewBrief(d, field);
      if (summary.length) { setPending({ field, to, summary }); setSaid(null); } else { setPending(null); setSaid({ field, text: 'Kept in your brief. Nothing else in the draft depends on it.' }); }
    }
  });
  const card = (field: BriefField) => {
    if (pending?.field === field) {
      return (
        <div role="group" aria-label={`What changing the ${NAMES[field]} does`} className="flex flex-col gap-2 rounded-12 border-2 border-solid border-author-kora bg-author-surface p-3">
          <p className="m-0 text-14">This changes: {pending.summary.join(', ')}.</p>
          <span className="flex flex-wrap gap-2">
            <button type="button" className={BUTTON.kora} onClick={() => {
              edit(x => propagateBrief(x, field), { label: `Apply the new ${NAMES[field]} to the draft`, restorePoint: true });
              setPending(null);
              setSaid({ field, text: 'Applied. Undo is in the header.' });
            }}>Apply</button>
            <button type="button" className={BUTTON.secondary} onClick={() => { setPending(null); setSaid({ field, text: 'Kept as a note in your brief. The draft stays as it is.' }); }}>Keep as note only</button>
          </span>
        </div>
      );
    }
    return said?.field === field ? <p role="status" className="m-0 text-13 text-author-body">{said.text}</p> : null;
  };

  const people = b.stakeholders, goals = b.objectives, dilemmas = b.dilemmas;
  return (
    <TabBody label="Brief" head={<TabHead title="Brief" actions={regen.button}>What you told Kora. Changing an answer here shows what it changes in the draft before anything moves.</TabHead>}>
      {regen.note}
      <div className="grid grid-cols-2 gap-4 max-[1180px]:grid-cols-1">
        <section className={`${CARD} flex flex-col gap-3 p-5`} aria-labelledby="who">
          <CardHead id="who" title="Who and why"><MarkOf path="brief.participants" /></CardHead>
          <p className="m-0 text-13 text-author-body">Your brief for Kora. Kora drafted the other tabs from it; the simulation plays what those tabs say, so change them there.</p>
          <Field label="Participants" required need={!b.participants.trim()} mark="brief.participants">{id => <TextInput id={id} {...watch('participants')} maxLength={TEXT_MAX} tone={toneOf(d.marks['brief.participants'])} value={b.participants} onChange={e => set('participants', e.target.value)} />}</Field>
          {card('participants')}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Industry" required need={!b.industry.trim()}>{id => <TextInput id={id} {...watch('industry')} tone={toneOf(d.marks['brief.industry'])} value={b.industry} onChange={e => set('industry', e.target.value)} />}</Field>
            <Field label="Client" optional>{id => <TextInput id={id} {...watch('client')} tone={toneOf(d.marks['brief.client'])} value={b.client} placeholder="Fictional company" onChange={e => set('client', e.target.value)} />}</Field>
          </div>
          {card('industry')}
          {card('client')}
          <Field label="Business challenge" required need={!b.challenge.trim()} mark="brief.challenge">{id => (
            <TextArea id={id} {...watch('challenge')} rows={3} tone={toneOf(d.marks['brief.challenge'], !b.challenge.trim())} value={b.challenge} onChange={e => set('challenge', e.target.value)} />
          )}</Field>
          {card('challenge')}
          <Field label="Purpose" required>{() => (
            <Segmented label="Purpose" value={b.purpose} onChange={v => set('purpose', v)} options={[{ value: 'development', label: 'Development' }, { value: 'assessment', label: 'Assessment' }]} />
          )}</Field>
        </section>
        <section className={`${CARD} flex flex-col gap-3 p-5`} aria-labelledby="format">
          <CardHead id="format" title="Format"><MarkOf path="brief.run" /></CardHead>
          <Field label="Run length" required>{() => (
            <Segmented vertical label="Run length" value={b.run} onChange={v => { let note: string | null = null; edit(x => { x.brief.run = v; note = movedNote(fitRun(x, v === 'lite' ? 4 : 8)); }, { mark: ['brief.run', 'process.weeks'], label: `Change the run length to ${RUN_NAMES[v]}`, restorePoint: true }); setMoved(note); }}
              options={[{ value: 'full', label: 'Full · 8 weeks · 2 conversations a week' }, { value: 'standard', label: 'Standard · 8 weeks · 1 conversation a week' }, { value: 'lite', label: 'Lite · 4 weeks · 1 conversation a week' }]} />
          )}</Field>
          {moved && <p role="status" className="m-0 rounded-12 bg-author-need-field p-3 text-13 text-author-need">{moved}</p>}
          <div className="grid grid-cols-1 gap-3">
            <Field label="Language" required hint="Number formats, and the language and region the AI characters speak">{id => (
              <Select id={id} tone={toneOf(d.marks['brief.language'])} value={b.language} onChange={e => set('language', e.target.value)}>
                {[...new Set([b.language, ...REGIONS.map(r => r.label)])].map(l => <option key={l}>{l}</option>)}
              </Select>
            )}</Field>
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between"><span className="text-13 font-700 text-author-label" id="tone-label">Tone, for Kora&rsquo;s drafting</span><span className="text-12 font-600 text-author-muted">Optional</span></div>
            <div className="flex flex-wrap gap-2" role="group" aria-labelledby="tone-label">
              {TONES.map(t => <Chip key={t} pressed={b.tones.includes(t)} onClick={() => set('tones', b.tones.includes(t) ? b.tones.filter(x => x !== t) : [...b.tones, t])}>{t}</Chip>)}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-13 font-700 text-author-label">Documents you shared with Kora</span>
            {b.documents.length === 0 && <p className="m-0 text-13 text-author-muted">None yet.</p>}
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {b.documents.map((doc, i) => (
                <li key={i} className="flex flex-wrap items-center gap-3 rounded-12 bg-author-track px-3 py-2 text-14">
                  <b>{doc.name}</b><span className="flex-1 text-author-body">{doc.use}</span>
                  <button type="button" className={BUTTON.link} onClick={() => set('documents', b.documents.filter((_, k) => k !== i))}>Remove<span className="sr-only"> {doc.name}</span></button>
                </li>
              ))}
            </ul>
            <label className={`${BUTTON.secondary} self-start has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-author-primary`}>
              Add a document
              <input type="file" className="sr-only" onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) set('documents', [...b.documents, { name: f.name, use: 'Shared in the workspace' }]); }} />
            </label>
          </div>
        </section>
        <section className={`${CARD} col-span-2 flex flex-col gap-3 p-5 max-[1180px]:col-span-1`} aria-labelledby="notes">
          <CardHead id="notes" title="From your brief"><MarkOf path="brief.stakeholders" /></CardHead>
          <p className="m-0 text-13 text-author-body">Kora drafts from these. The simulation plays the participant&rsquo;s own team, so people outside it reach the story through events and the sponsor, not as characters yet; dilemmas are kept as two options and what is at stake, ready to become choice events.</p>
          <div className="grid grid-cols-3 gap-4 max-[1400px]:grid-cols-1">
            <div className="flex flex-col gap-2" role="group" aria-labelledby="people-label">
              <span id="people-label" className="text-13 font-700 text-author-label">Stakeholders</span>
              {people.length === 0 && <p className="m-0 text-13 text-author-muted">None yet.</p>}
              {people.map((p, i) => (
                <div key={i} className="flex flex-col gap-1.5 rounded-12 bg-author-track p-2.5">
                  <TextInput aria-label={`Stakeholder ${i + 1}, name`} placeholder="Name" value={p.name} onChange={e => edit(x => { x.brief.stakeholders[i].name = e.target.value; }, 'brief.stakeholders')} />
                  <TextInput aria-label={`Stakeholder ${i + 1}, role`} placeholder="Role" value={p.role} onChange={e => edit(x => { x.brief.stakeholders[i].role = e.target.value; }, 'brief.stakeholders')} />
                  <span className="flex items-center gap-2">
                    <TextInput aria-label={`Stakeholder ${i + 1}, relation to the participant`} placeholder="Relation, for example boss" value={p.relation} onChange={e => edit(x => { x.brief.stakeholders[i].relation = e.target.value; }, 'brief.stakeholders')} />
                    <button type="button" className={BUTTON.link} onClick={() => edit(x => { x.brief.stakeholders.splice(i, 1); }, 'brief.stakeholders')}>Remove<span className="sr-only"> {p.name || p.role}</span></button>
                  </span>
                </div>
              ))}
              <button type="button" className={`${BUTTON.secondary} self-start`} disabled={people.length >= 20} onClick={() => edit(x => { x.brief.stakeholders.push({ name: '', role: '', relation: '' }); }, 'brief.stakeholders')}>Add a stakeholder</button>
            </div>
            <div className="flex flex-col gap-2" role="group" aria-labelledby="goals-label">
              <span id="goals-label" className="text-13 font-700 text-author-label">Objectives</span>
              {goals.length === 0 && <p className="m-0 text-13 text-author-muted">None yet.</p>}
              {goals.map((g, i) => (
                <span key={i} className="flex items-center gap-2">
                  <TextInput aria-label={`Objective ${i + 1}`} value={g} onChange={e => edit(x => { x.brief.objectives[i] = e.target.value; }, 'brief.objectives')} />
                  <button type="button" className={BUTTON.link} onClick={() => edit(x => { x.brief.objectives.splice(i, 1); }, 'brief.objectives')}>Remove<span className="sr-only"> objective {i + 1}</span></button>
                </span>
              ))}
              <button type="button" className={`${BUTTON.secondary} self-start`} disabled={goals.length >= 12} onClick={() => edit(x => { x.brief.objectives.push(''); }, 'brief.objectives')}>Add an objective</button>
            </div>
            <div className="flex flex-col gap-2" role="group" aria-labelledby="dilemmas-label">
              <span id="dilemmas-label" className="text-13 font-700 text-author-label">Dilemmas</span>
              {dilemmas.length === 0 && <p className="m-0 text-13 text-author-muted">None yet.</p>}
              {dilemmas.map((x, i) => {
                const put = (k: 'a' | 'b' | 'stake', v: string) => edit(y => {
                  const t = y.brief.dilemmas[i];
                  t[k] = v;
                  if (k !== 'stake') t.title = [t.a, t.b.charAt(0).toLowerCase() + t.b.slice(1)].filter(Boolean).join(' or ');
                }, 'brief.dilemmas');
                return (
                  <div key={i} className="flex flex-col gap-1.5 rounded-12 bg-author-track p-2.5">
                    <b className="text-14">{x.title || `Dilemma ${i + 1}`}</b>
                    <TextInput aria-label={`Dilemma ${i + 1}, option A`} placeholder="Option A" value={x.a} onChange={e => put('a', e.target.value)} />
                    <TextInput aria-label={`Dilemma ${i + 1}, option B`} placeholder="Option B" value={x.b} onChange={e => put('b', e.target.value)} />
                    <span className="flex items-center gap-2">
                      <TextInput aria-label={`Dilemma ${i + 1}, what is at stake`} placeholder="What is at stake" value={x.stake} onChange={e => put('stake', e.target.value)} />
                      <button type="button" className={BUTTON.link} onClick={() => edit(y => { y.brief.dilemmas.splice(i, 1); }, 'brief.dilemmas')}>Remove<span className="sr-only"> {x.title}</span></button>
                    </span>
                  </div>
                );
              })}
              <button type="button" className={`${BUTTON.secondary} self-start`} disabled={dilemmas.length >= 12} onClick={() => edit(y => { y.brief.dilemmas.push({ title: '', a: '', b: '', stake: '' }); }, 'brief.dilemmas')}>Add a dilemma</button>
            </div>
          </div>
        </section>
      </div>
    </TabBody>
  );
}
