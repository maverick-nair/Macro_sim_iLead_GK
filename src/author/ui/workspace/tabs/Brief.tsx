import { REGIONS } from '../../../context';
import { useAuthor } from '../../../model/store';
import { BUTTON, CARD, CardHead, Chip, Field, MarkOf, Segmented, Select, TextArea, TextInput, toneOf } from '../../kit';
import { TabBody, TabHead } from '../Workspace';
import { useRegenerate } from './regenerate';

const TONES = ['Realistic', 'Light hearted', 'High stakes', 'Formal', 'Professional', 'Warm and encouraging', 'Direct and brisk'];

/** Workspace: Brief (docs/design/genie/Brief): what the author told Kora, and the run's format. */
export default function Brief() {
  const d = useAuthor(s => s.draft);
  const edit = useAuthor(s => s.edit);
  const regen = useRegenerate('brief');
  const b = d.brief;
  const set = <K extends keyof typeof b>(k: K, v: (typeof b)[K]) => edit(x => { x.brief[k] = v; }, `brief.${k}`);
  return (
    <TabBody label="Brief" head={<TabHead title="Brief" actions={regen.button}>What you told Kora. Changing an answer here offers to update the sections it shaped.</TabHead>}>
      {regen.note}
      <div className="grid grid-cols-2 gap-4 max-[1180px]:grid-cols-1">
        <section className={`${CARD} flex flex-col gap-3 p-5`} aria-labelledby="who">
          <CardHead id="who" title="Who and why"><MarkOf path="brief.participants" /></CardHead>
          <Field label="Participants" required mark="brief.participants">{id => <TextInput id={id} tone={toneOf(d.marks['brief.participants'])} value={b.participants} onChange={e => set('participants', e.target.value)} />}</Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Industry" required>{id => <TextInput id={id} tone={toneOf(d.marks['brief.industry'])} value={b.industry} onChange={e => set('industry', e.target.value)} />}</Field>
            <Field label="Client" optional>{id => <TextInput id={id} tone={toneOf(d.marks['brief.client'])} value={b.client} placeholder="Fictional company" onChange={e => set('client', e.target.value)} />}</Field>
          </div>
          <Field label="Business challenge" required need={!b.challenge.trim()} mark="brief.challenge">{id => (
            <TextArea id={id} rows={3} tone={toneOf(d.marks['brief.challenge'], !b.challenge.trim())} value={b.challenge}
              onChange={e => edit(x => {
                x.brief.challenge = e.target.value;
                if (!x.suggestions.some(s => s.id === 'brief.challenge' && !s.done)) x.suggestions.push({ id: 'brief.challenge', tab: 'brief', text: 'You changed the challenge. Update the events and two characters to match?', action: 'Update them', done: false });
              }, 'brief.challenge')} />
          )}</Field>
          <Field label="Purpose" required>{() => (
            <Segmented label="Purpose" value={b.purpose} onChange={v => set('purpose', v)} options={[{ value: 'development', label: 'Development' }, { value: 'assessment', label: 'Assessment' }]} />
          )}</Field>
        </section>
        <section className={`${CARD} flex flex-col gap-3 p-5`} aria-labelledby="format">
          <CardHead id="format" title="Format"><MarkOf path="brief.run" /></CardHead>
          <Field label="Run length" required>{() => (
            <Segmented vertical label="Run length" value={b.run} onChange={v => edit(x => { x.brief.run = v; x.process.weeks = v === 'lite' ? 4 : 8; }, ['brief.run', 'process.weeks'])}
              options={[{ value: 'full', label: 'Full · 8 weeks · 90 min' }, { value: 'standard', label: 'Standard · 8 weeks · 60 min' }, { value: 'lite', label: 'Lite · 4 weeks · 30 min' }]} />
          )}</Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Language" required>{id => (
              <Select id={id} tone={toneOf(d.marks['brief.language'])} value={b.language} onChange={e => set('language', e.target.value)}>
                {[...new Set([b.language, ...REGIONS.map(r => r.label)])].map(l => <option key={l}>{l}</option>)}
              </Select>
            )}</Field>
            <Field label="Conversation by">{id => (
              <Select id={id} tone={toneOf(d.marks['brief.conversationBy'])} value={b.conversationBy} onChange={e => set('conversationBy', e.target.value as typeof b.conversationBy)}>
                <option value="both">Voice or text, participant chooses</option><option value="text">Text only</option><option value="voice">Voice only</option>
              </Select>
            )}</Field>
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between"><span className="text-13 font-700 text-author-label" id="tone-label">Tone</span><span className="text-12 font-600 text-author-muted">Optional</span></div>
            <div className="flex flex-wrap gap-2" role="group" aria-labelledby="tone-label">
              {TONES.map(t => <Chip key={t} pressed={b.tones.includes(t)} onClick={() => set('tones', b.tones.includes(t) ? b.tones.filter(x => x !== t) : [...b.tones, t])}>{t}</Chip>)}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-13 font-700 text-author-label">Documents you shared</span>
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
          <details className="rounded-12 border border-solid border-author-line p-3">
            <summary className="cursor-pointer text-15 font-800">Advanced: time per week, target skills, save and resume</summary>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <Field label="Minutes per week">{id => <TextInput id={id} type="number" min={3} max={30} value={b.minutesPerWeek} onChange={e => set('minutesPerWeek', Math.max(3, Math.min(30, Number(e.target.value) || 3)))} />}</Field>
              <Field label="Target skills" optional>{id => <TextInput id={id} value={b.targetSkills} placeholder="For example negotiation, coaching" onChange={e => set('targetSkills', e.target.value)} />}</Field>
              <label className="col-span-2 flex items-center gap-2 text-14"><input type="checkbox" checked={b.saveAndResume} onChange={e => set('saveAndResume', e.target.checked)} /> Participants can save and resume</label>
            </div>
          </details>
        </section>
      </div>
    </TabBody>
  );
}
