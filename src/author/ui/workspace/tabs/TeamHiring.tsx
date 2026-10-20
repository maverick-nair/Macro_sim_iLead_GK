import { useState } from 'react';
import { GENDERS, type CandidateDraft } from '../../../model/draft';
import { hiringOf } from '../../../model/export';
import { pronounsOf, PORTRAITS } from '../../../model/seed';
import { useAuthor } from '../../../model/store';
import { AboutThis } from '../../AboutThis';
import { ImageUpload } from '../../ImageUpload';
import { Avatar, BUTTON, CARD, CardHead, Field, MarkOf, Modal, Select, TextArea, TextInput, toneOf } from '../../kit';

const GENDER_LABEL: Record<(typeof GENDERS)[number], string> = { woman: 'Woman', man: 'Man', nonbinary: 'Non binary', unstated: 'Not stated' };

/**
 * Team, Hiring (D228): the candidates the participant interviews when they hire, as their CV card shows them: name,
 * background, experience, strengths, remarks and photo, and the stage they would start in. Drafted from the brief and
 * the region like the team; Draft again from the brief replaces them. Every field reaches the interview (traced).
 */
export default function TeamHiring() {
  const d = useAuthor(s => s.draft);
  const edit = useAuthor(s => s.edit);
  const list = hiringOf(d);
  const [editing, setEditing] = useState<string | null>(null);
  const current = list.find(c => c.id === editing) ?? null;
  const stageName = (k: string) => d.process.stages.find(s => s.key === k)?.name ?? k;
  /** Edits one candidate: a stored draft's drafted ones become its own first. */
  const change = (id: string, patch: Partial<CandidateDraft>) => edit(x => {
    x.candidates = hiringOf(x).map(c => (c.id === id ? { ...c, ...patch } : c));
  }, `candidates.${id}`);
  const redraft = () => edit(x => {
    x.candidates = undefined;
    x.candidates = hiringOf(x);
  }, { mark: 'candidates', label: 'Draft the hire candidates again from the brief', restorePoint: true });
  return (
    <section className={`${CARD} flex flex-col gap-3 p-5`} aria-labelledby="hiring-title">
      <CardHead id="hiring-title" title="Hiring"><MarkOf path="candidates" /><button type="button" className={BUTTON.koraOutline} onClick={redraft}>Draft again from the brief</button></CardHead>
      <AboutThis
        what="The people the participant interviews when they use the hiring action: who they are, where they work now, what they bring, and the stage they would start in."
        why="Hiring is a leadership decision: the participant reads each candidate against what the team needs. Candidates who fit the company and the region make it believable."
        paths={['candidates[].name', 'candidates[].profile.remarks', 'candidates[].portrait']}
        experience="An interview: each candidate's CV card (background, experience, strengths, remarks), three questions, and a comparison before hiring one. The one hired joins the team in their stage." />
      <ul aria-label="Hire candidates" className="m-0 grid list-none grid-cols-2 gap-2 p-0 max-[1180px]:grid-cols-1">
        {list.map(c => {
          const name = [c.first, c.last].filter(Boolean).join(' ') || 'New candidate';
          return (
            <li key={c.id} className="flex items-start gap-3 rounded-14 border border-solid border-author-line p-3">
              <Avatar src={c.photo} name={name} size={40} />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5 text-13">
                <b className="text-15">{name}</b>
                <span className="text-author-body">{c.title} &middot; starts in {stageName(c.stage)}</span>
                <span className="text-author-muted">{c.remarks}</span>
              </span>
              <button type="button" className={BUTTON.secondary} onClick={() => setEditing(c.id)}>Edit<span className="sr-only"> {name}</span></button>
            </li>
          );
        })}
      </ul>
      {current && (
        <Modal open onOpenChange={o => { if (!o) setEditing(null); }} title={`Edit ${[current.first, current.last].filter(Boolean).join(' ') || 'the candidate'}`} description="What the participant reads on the candidate's CV card in the interview."
          footer={<button type="button" className={BUTTON.primary} onClick={() => setEditing(null)}>Done</button>}>
          <div className="flex flex-col gap-3 overflow-y-auto px-6 py-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="First name">{id => <TextInput id={id} value={current.first} onChange={e => change(current.id, { first: e.target.value })} />}</Field>
              <Field label="Last name">{id => <TextInput id={id} value={current.last} onChange={e => change(current.id, { last: e.target.value })} />}</Field>
              <Field label="Gender">{id => <Select id={id} value={current.gender} onChange={e => { const g = e.target.value as CandidateDraft['gender']; change(current.id, { gender: g, pronouns: pronounsOf(g) }); }}>{GENDERS.map(g => <option key={g} value={g}>{GENDER_LABEL[g]}</option>)}</Select>}</Field>
              <Field label="Pronouns">{id => <TextInput id={id} value={current.pronouns} onChange={e => change(current.id, { pronouns: e.target.value })} />}</Field>
              <Field label="Job title">{id => <TextInput id={id} value={current.title} onChange={e => change(current.id, { title: e.target.value })} />}</Field>
              <Field label="Starts in">{id => <Select id={id} value={current.stage} onChange={e => change(current.id, { stage: e.target.value })}>{d.process.stages.map(s => <option key={s.key} value={s.key}>{s.name}</option>)}</Select>}</Field>
              <Field label="Background" hint="Where they work now, for example Sales officer at a regional distributor.">{id => <TextInput id={id} value={current.background} onChange={e => change(current.id, { background: e.target.value })} />}</Field>
              <Field label="Experience">{id => <TextInput id={id} value={current.experience} onChange={e => change(current.id, { experience: e.target.value })} />}</Field>
            </div>
            <Field label="Strengths">{id => <TextInput id={id} value={current.strengths} onChange={e => change(current.id, { strengths: e.target.value })} />}</Field>
            <Field label="Remarks" hint="What the interviewer's notes say about them.">{id => <TextArea id={id} rows={3} tone={toneOf(d.marks[`candidates.${current.id}`])} value={current.remarks} onChange={e => change(current.id, { remarks: e.target.value })} />}</Field>
            <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
              <legend className="mb-1 p-0 text-13 font-700 text-author-label">Photo</legend>
              <div role="radiogroup" aria-label="Photo from the library" className="flex flex-wrap gap-2">
                {['', ...PORTRAITS].map(src => (
                  <button key={src || 'none'} type="button" role="radio" aria-checked={current.photo === src} aria-label={src ? `Portrait ${PORTRAITS.indexOf(src) + 1}` : 'No photo'}
                    className={`rounded-round border-2 border-solid p-0.5 ${current.photo === src ? 'border-author-primary' : 'border-transparent'}`} onClick={() => change(current.id, { photo: src })}>
                    <Avatar src={src} name={current.first || '?'} size={36} />
                  </button>
                ))}
              </div>
              <ImageUpload label="Upload a photo" maxSide={512} onImage={src => change(current.id, { photo: src })} />
            </fieldset>
          </div>
        </Modal>
      )}
    </section>
  );
}
