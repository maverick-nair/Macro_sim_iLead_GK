import { useState } from 'react';
import { REGIONS } from '../../../context';
import { fitRun, movedNote } from '../../../model/run';
import { useAuthor } from '../../../model/store';
import { BUTTON, CARD, CardHead, Chip, Field, MarkOf, Segmented, Select, TEXT_MAX, TextArea, TextInput, toneOf } from '../../kit';
import { TabBody, TabHead } from '../Workspace';
import { useRegenerate } from './regenerate';

const RUN_NAMES = { full: 'Full', standard: 'Standard', lite: 'Lite' } as const;
const TONES = ['Realistic', 'Light hearted', 'High stakes', 'Formal', 'Professional', 'Warm and encouraging', 'Direct and brisk'];

/**
 * Workspace: Brief (docs/design/genie/Brief, D128): what the author told Kora, kept as a record Kora drafts
 * from, and the run's format, which the simulation plays: purpose, run length (weeks and live
 * conversations a week) and language (number formats and the AI characters' language).
 */
export default function Brief() {
  const d = useAuthor(s => s.draft);
  const edit = useAuthor(s => s.edit);
  const regen = useRegenerate('brief');
  const [moved, setMoved] = useState<string | null>(null);
  const b = d.brief;
  const set = <K extends keyof typeof b>(k: K, v: (typeof b)[K]) => edit(x => { x.brief[k] = v; }, `brief.${k}`);
  return (
    <TabBody label="Brief" head={<TabHead title="Brief" actions={regen.button}>What you told Kora. Changing an answer here offers to update the sections it shaped.</TabHead>}>
      {regen.note}
      <div className="grid grid-cols-2 gap-4 max-[1180px]:grid-cols-1">
        <section className={`${CARD} flex flex-col gap-3 p-5`} aria-labelledby="who">
          <CardHead id="who" title="Who and why"><MarkOf path="brief.participants" /></CardHead>
          <p className="m-0 text-13 text-author-body">Your brief for Kora. Kora drafted the other tabs from it; the simulation plays what those tabs say, so change them there.</p>
          <Field label="Participants" required need={!b.participants.trim()} mark="brief.participants">{id => <TextInput id={id} maxLength={TEXT_MAX} tone={toneOf(d.marks['brief.participants'])} value={b.participants} onChange={e => set('participants', e.target.value)} />}</Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Industry" required need={!b.industry.trim()}>{id => <TextInput id={id} tone={toneOf(d.marks['brief.industry'])} value={b.industry} onChange={e => set('industry', e.target.value)} />}</Field>
            <Field label="Client" optional>{id => <TextInput id={id} tone={toneOf(d.marks['brief.client'])} value={b.client} placeholder="Fictional company" onChange={e => set('client', e.target.value)} />}</Field>
          </div>
          <Field label="Business challenge" required need={!b.challenge.trim()} mark="brief.challenge">{id => (
            <TextArea id={id} rows={3} tone={toneOf(d.marks['brief.challenge'], !b.challenge.trim())} value={b.challenge}
              onChange={e => edit(x => {
                x.brief.challenge = e.target.value;
                if (!x.suggestions.some(s => s.id === 'brief.challenge' && !s.done)) x.suggestions.push({ id: 'brief.challenge', tab: 'brief', text: 'You changed the challenge. Draft the events and the welcome screens again from it? What you wrote stays.', action: 'Draft them again', done: false });
              }, 'brief.challenge')} />
          )}</Field>
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
      </div>
    </TabBody>
  );
}
