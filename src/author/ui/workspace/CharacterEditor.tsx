import { useState } from 'react';
import { bestStyle, needOf } from '../../../engine/lens';
import { GENDERS, type AuthorDraft, type Character } from '../../model/draft';
import { PORTRAITS, pronounsOf, VOICE_LIBRARY } from '../../model/seed';
import { Avatar, Badge, BUTTON, Chip, Field, Icon, Modal, Segmented, Select, SubTabs, TEXT_MAX, TextArea, TextInput, toneOf } from '../kit';

type EditTab = 'identity' | 'voice' | 'personality' | 'stats';
const GENDER_LABEL: Record<Character['gender'], string> = { woman: 'Woman', man: 'Man', nonbinary: 'Non binary', unstated: 'Not stated' };
const COMM = ['Direct', 'Guarded at first', 'Detailed', 'Warm', 'Data driven', 'Competitive', 'Quiet', 'Talkative'];
const AGES = ['18 to 24', '25 to 34', '35 to 44', '45 to 54', '55 and over'];
const ACCENTS = ['US English', 'UK English', 'Indian English', 'Australian English', 'Singapore English', 'South African English'];

export function Slider({ label, value, onChange, low, high }: { label: string; value: number; onChange: (v: number) => void; low?: string; high?: string }) {
  const id = `sl-${label.replace(/\s+/g, '-').toLowerCase()}`;
  return (
    <div className="grid grid-cols-[8.5rem_minmax(0,1fr)_3.5rem] items-center gap-3 text-14">
      <label htmlFor={id} className="font-700 text-author-label">{label}</label>
      <input id={id} type="range" min={0} max={100} value={value} onChange={e => onChange(Number(e.target.value))} className="h-6 w-full accent-author-primary" aria-valuetext={low && high ? `${value}, ${value < 50 ? low : high}` : String(value)} />
      <input type="number" min={0} max={100} aria-label={`${label}, number`} value={value} onChange={e => onChange(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
        className="h-8.5 w-14 rounded-8 border border-solid border-author-line-control text-center text-13 font-700 focus-visible:outline-2 focus-visible:outline-author-primary" />
    </div>
  );
}

/**
 * Edit a character (docs/design/genie/TeamEdit, Voice, Personality, Starting stats; D109): every field
 * the engine and the AI character read, in four tabs. Changes stay in the dialog until Save changes;
 * saving marks what the author changed as theirs, so Kora never overwrites it.
 */
export function CharacterEditor({ draft, character, open, onOpenChange, onSave }: {
  draft: AuthorDraft; character: Character; open: boolean; onOpenChange: (o: boolean) => void; onSave: (c: Character, changed: string[]) => void;
}) {
  const [tab, setTab] = useState<EditTab>('identity');
  const [c, setC] = useState<Character>(() => structuredClone(character));
  const [newTag, setNewTag] = useState('');
  const set = <K extends keyof Character>(k: K, v: Character[K]) => setC(x => ({ ...x, [k]: v }));
  const stage = draft.process.stages.find(s => s.key === c.stage)?.name ?? '';
  const mark = (f: string) => toneOf(draft.marks[`team.${c.id}.${f}`]);
  const need = needOf(c.stats);
  const needLabel = draft.lens.needs[need]?.label ?? need;
  const needed = draft.lens.styles.find(s => s.key === bestStyle({ fit: draft.lens.fit, styles: draft.lens.styles }, need))?.name ?? '';
  const voices = VOICE_LIBRARY.filter(v => c.gender === 'woman' ? v.gender === 'woman' : c.gender === 'man' ? v.gender === 'man' : true);
  const p = c.gender === 'woman' ? 'she' : c.gender === 'man' ? 'he' : 'they';
  const changedFields = (): string[] => {
    const groups: Record<string, Array<keyof Character>> = {
      identity: ['first', 'last', 'gender', 'pronouns', 'ageRange', 'title', 'stage', 'photo'], voice: ['voice'], persona: ['persona'], hiddenConcern: ['hiddenConcern', 'concernLine'],
      personality: ['commStyles', 'motivatedBy', 'reactions', 'relationships', 'noTopics'], stats: ['stats', 'bestStage', 'experience', 'tenure', 'previousCompany', 'careerGoal', 'shown', 'custom']
    };
    return Object.entries(groups).filter(([, ks]) => ks.some(k => JSON.stringify(c[k]) !== JSON.stringify(character[k]))).map(([g]) => `team.${c.id}.${g}`);
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange} width="max-w-230" title={`Edit ${c.first} ${c.last}`.trim()}
      description={`${stage} · ${c.title} · changes save to this draft only`}
      head={<Avatar src={c.photo} name={c.first} size={56} />}
      footer={<>
        <button type="button" className={BUTTON.secondary} disabled={c.custom.length >= 12} onClick={() => { setC(x => ({ ...x, custom: [...x.custom, { label: 'New field', value: '' }] })); setTab('stats'); }}>Add a custom field</button>
        <span className="min-w-40 flex-1 text-13 text-author-body">Every field reaches the simulation or the AI character. Fields you change are marked as yours, and Kora will not overwrite them.</span>
        <button type="button" className={BUTTON.secondary} onClick={() => onOpenChange(false)}>Cancel</button>
        <button type="button" className={BUTTON.primary} onClick={() => onSave(c, changedFields())}>Save changes</button>
      </>}>
      <div className="flex-none px-6"><SubTabs idBase="char" variant="line" label="Character details" value={tab} onChange={setTab} tabs={[{ value: 'identity', label: 'Identity' }, { value: 'voice', label: 'Voice' }, { value: 'personality', label: 'Personality' }, { value: 'stats', label: 'Starting stats' }]} /></div>
      <div id="char-panel" role="tabpanel" aria-labelledby={`char-tab-${tab}`} tabIndex={0} className="min-h-0 flex-1 overflow-y-auto px-6 py-5 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-author-primary">
        {tab === 'identity' && (
          <div className="grid grid-cols-[18rem_minmax(0,1fr)] gap-6 max-[1000px]:grid-cols-[13rem_minmax(0,1fr)] max-[1000px]:gap-4">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between"><span className="text-13 font-700 text-author-label">Photo</span><Badge kind={draft.marks[`team.${c.id}.identity`] ?? 'ai'} /></div>
              <img src={c.photo.startsWith('/') ? c.photo : PORTRAITS[0]} alt={`${c.first} ${c.last}`.trim()} className="aspect-[6/5] w-full rounded-16 bg-author-track object-cover object-top" />
              <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
                <legend className="mb-2 text-13 font-700 text-author-label">Choose from the library</legend>
                <div className="grid grid-cols-5 gap-1.5 max-[1000px]:grid-cols-4">
                  {PORTRAITS.slice(0, 10).map(src => (
                    <label key={src} className={`cursor-pointer rounded-10 border-2 border-solid p-0.5 has-[:checked]:border-author-primary has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-author-primary ${c.photo === src ? 'border-author-primary' : 'border-transparent'}`}>
                      <input type="radio" name="photo" className="sr-only" checked={c.photo === src} onChange={() => set('photo', src)} aria-label={`Portrait ${PORTRAITS.indexOf(src) + 1}`} />
                      <img src={src} alt="" className="aspect-square w-full rounded-8 object-cover object-top" />
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="flex flex-wrap gap-2">
                <button type="button" className={`${BUTTON.koraOutline} flex-1`} onClick={() => set('photo', PORTRAITS[(PORTRAITS.indexOf(c.photo) + 1) % PORTRAITS.length])}>Create with Kora</button>
              </div>
              {!c.photo.startsWith('/') && <p className="m-0 text-12 text-author-need">This photo is not in the library, so participants see the first library portrait. Pick one above.</p>}
              <p className="m-0 text-12 text-author-muted">Each photo comes with four moods (upbeat, steady, concerned, frustrated) so the face matches how the person feels in play.</p>
            </div>
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3 max-[1000px]:grid-cols-1">
                <Field label="First name" required need={!c.first.trim()}>{id => <TextInput id={id} tone={toneOf(undefined, !c.first.trim())} value={c.first} onChange={e => set('first', e.target.value)} />}</Field>
                <Field label="Last name" required>{id => <TextInput id={id} value={c.last} onChange={e => set('last', e.target.value)} />}</Field>
              </div>
              <Field label="Gender" required>{() => <Segmented label="Gender" value={c.gender} onChange={g => setC(x => ({ ...x, gender: g, pronouns: pronounsOf(g) }))} options={GENDERS.map(g => ({ value: g, label: GENDER_LABEL[g] }))} />}</Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Pronouns" optional>{id => <TextInput id={id} value={c.pronouns} onChange={e => set('pronouns', e.target.value)} />}</Field>
                <Field label="Age range">{id => <Select id={id} tone={mark('identity')} value={c.ageRange} onChange={e => set('ageRange', e.target.value)}>{[...new Set([c.ageRange, ...AGES])].map(a => <option key={a}>{a}</option>)}</Select>}</Field>
                <Field label="Job title">{id => <TextInput id={id} tone={mark('identity')} value={c.title} onChange={e => set('title', e.target.value)} />}</Field>
                <Field label="Stage" required>{id => <Select id={id} value={c.stage} onChange={e => set('stage', e.target.value)}>{draft.process.stages.map(s => <option key={s.key} value={s.key}>{s.name}</option>)}</Select>}</Field>
              </div>
            </div>
          </div>
        )}
        {tab === 'voice' && (
          <div className="flex flex-col gap-5">
            <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
              <legend className="mb-2 flex w-full items-center justify-between text-13 font-700 text-author-label">Voice <Badge kind="ai">Matched by Kora to age, role and persona</Badge></legend>
              <div className="grid grid-cols-2 gap-2 max-[900px]:grid-cols-1">
                {voices.map(v => (
                  <label key={v.id} className={`flex cursor-pointer items-center gap-3 rounded-12 border border-solid p-3 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-author-primary ${c.voice.id === v.id ? 'border-author-primary bg-author-primary-faint' : 'border-author-line'}`}>
                    <input type="radio" name="voice" className="sr-only" checked={c.voice.id === v.id} onChange={() => set('voice', { ...c.voice, id: v.id, accent: v.accent, pace: v.pace, warmth: v.warmth, formality: v.formality })} />
                    <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-round border border-solid border-author-line-control">{Icon.play(14)}</span>
                    <span className="flex flex-1 flex-col"><b className="text-15">{v.name}</b><span className="text-13 text-author-body">{v.gender === 'woman' ? 'Female' : 'Male'} &middot; {v.accent} &middot; {v.pace > 60 ? 'fast' : v.pace < 45 ? 'slow' : 'medium'} pace</span></span>
                    {c.voice.id === v.id && <Badge kind="ai">Selected</Badge>}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Language" hint="From the brief">{id => <TextInput id={id} value={c.voice.language} onChange={e => set('voice', { ...c.voice, language: e.target.value })} />}</Field>
              <Field label="Accent" optional>{id => <Select id={id} value={c.voice.accent} onChange={e => set('voice', { ...c.voice, accent: e.target.value })}>{[...new Set([c.voice.accent, ...ACCENTS])].map(a => <option key={a}>{a}</option>)}</Select>}</Field>
            </div>
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between"><span className="text-13 font-700 text-author-label">How {p} sounds</span><Badge kind="ai">Generated</Badge></div>
              <Slider label="Speaking pace" value={c.voice.pace} low="slow" high="fast" onChange={v => set('voice', { ...c.voice, pace: v })} />
              <Slider label="Warmth" value={c.voice.warmth} low="cool" high="warm" onChange={v => set('voice', { ...c.voice, warmth: v })} />
              <Slider label="Formality" value={c.voice.formality} low="casual" high="formal" onChange={v => set('voice', { ...c.voice, formality: v })} />
              <Field label="Reply length">{() => <Segmented label="Reply length" value={c.voice.replyLength} onChange={v => set('voice', { ...c.voice, replyLength: v })} options={[{ value: 'short', label: 'Short' }, { value: 'medium', label: 'Medium' }, { value: 'long', label: 'Long' }]} />}</Field>
            </div>
            <p className="m-0 text-13 text-author-muted">The AI character reads the language, accent, pace, warmth, formality and reply length when it speaks as {c.first}. Hear a line in this voice when a speech service is configured.</p>
          </div>
        )}
        {tab === 'personality' && (
          <div className="grid grid-cols-2 gap-5 max-[900px]:grid-cols-1">
            <div className="flex flex-col gap-4">
              <Field label="Persona" mark={`team.${c.id}.persona`}>{id => <TextArea id={id} rows={4} tone={mark('persona')} value={c.persona} onChange={e => set('persona', e.target.value)} />}</Field>
              <Field label="Hidden concern" mark={`team.${c.id}.hiddenConcern`} hint="Kept secret until a good conversation brings it out.">{id => <TextArea id={id} rows={3} tone={mark('hiddenConcern')} value={c.hiddenConcern} onChange={e => set('hiddenConcern', e.target.value)} />}</Field>
              <Field label="What they say when it comes out" optional>{id => <TextArea id={id} rows={2} tone={mark('hiddenConcern')} value={c.concernLine} onChange={e => set('concernLine', e.target.value)} />}</Field>
              <div className="flex flex-col gap-2">
                <div className="flex justify-between"><span id="comm-label" className="text-13 font-700 text-author-label">Communication style</span><span className="text-12 text-author-muted">Pick any, or add your own</span></div>
                <div className="flex flex-wrap gap-2" role="group" aria-labelledby="comm-label">
                  {[...new Set([...COMM, ...c.commStyles])].map(t => <Chip key={t} tone="kora" pressed={c.commStyles.includes(t)} onClick={() => set('commStyles', c.commStyles.includes(t) ? c.commStyles.filter(x => x !== t) : [...c.commStyles, t])}>{t}</Chip>)}
                </div>
                <form className="flex gap-2" onSubmit={e => { e.preventDefault(); if (newTag.trim()) { set('commStyles', [...c.commStyles, newTag.trim()]); setNewTag(''); } }}>
                  <TextInput aria-label="Add a communication style" placeholder="Add your own" value={newTag} onChange={e => setNewTag(e.target.value)} />
                  <button type="submit" className={BUTTON.secondary}>Add</button>
                </form>
              </div>
              <Field label="Motivated by">{id => <TextArea id={id} rows={2} tone={mark('personality')} value={c.motivatedBy} onChange={e => set('motivatedBy', e.target.value)} />}</Field>
            </div>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <div className="flex justify-between"><span className="text-13 font-700 text-author-label">How {p} reacts to each style</span><span className="text-12 text-author-muted">The AI character reacts this way</span></div>
                {draft.lens.styles.map(s => (
                  <Field key={s.key} label={s.name}>{id => <TextInput id={id} maxLength={TEXT_MAX} tone={mark('personality')} value={c.reactions[s.key] ?? ''} onChange={e => set('reactions', { ...c.reactions, [s.key]: e.target.value })} />}</Field>
                ))}
              </div>
              <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
                <legend className="mb-2 text-13 font-700 text-author-label">Relationships <span className="font-600 text-author-muted">Optional</span></legend>
                {c.relationships.map((r, i) => (
                  <div key={i} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-2">
                    <Select aria-label={`Relationship ${i + 1}, with`} value={r.with} onChange={e => set('relationships', c.relationships.map((x, k) => (k === i ? { ...x, with: e.target.value } : x)))}>{draft.team.filter(o => o.id !== c.id).map(o => <option key={o.id} value={o.id}>{o.first} {o.last}</option>)}</Select>
                    <TextInput aria-label={`Relationship ${i + 1}, kind`} value={r.kind} onChange={e => set('relationships', c.relationships.map((x, k) => (k === i ? { ...x, kind: e.target.value } : x)))} />
                    <button type="button" className={`${BUTTON.secondary} size-10 px-0`} aria-label={`Remove relationship ${i + 1}`} onClick={() => set('relationships', c.relationships.filter((_, k) => k !== i))}>{Icon.close(14)}</button>
                  </div>
                ))}
                <button type="button" className={`${BUTTON.secondary} self-start`} onClick={() => set('relationships', [...c.relationships, { with: draft.team.find(o => o.id !== c.id)?.id ?? '', kind: 'Works closely with' }])}>Add a relationship</button>
              </fieldset>
              <Field label="Topics they will not discuss" optional>{id => <TextInput id={id} maxLength={TEXT_MAX} value={c.noTopics} onChange={e => set('noTopics', e.target.value)} />}</Field>
            </div>
          </div>
        )}
        {tab === 'stats' && (
          <div className="grid grid-cols-2 gap-5 max-[900px]:grid-cols-1">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between"><span className="text-13 font-700 text-author-label">Starting values, 0 to 100</span><Badge kind={draft.marks[`team.${c.id}.stats`] ?? 'ai'} /></div>
              <Slider label="Skill" value={c.stats.skill} onChange={v => set('stats', { ...c.stats, skill: v })} />
              <Slider label="Morale" value={c.stats.morale} onChange={v => set('stats', { ...c.stats, morale: v })} />
              <Slider label="Result" value={c.stats.result} onChange={v => set('stats', { ...c.stats, result: v })} />
              <Slider label="Trust in you" value={c.stats.trust} onChange={v => set('stats', { ...c.stats, trust: v })} />
              <div className="rounded-12 bg-author-ai-field p-3 text-14" role="status">
                <b className="block text-13 text-author-ai">What this means in play &middot; updates as you move the sliders</b>
                {needLabel}: {c.first} starts needing <b>{needed}</b>. The need changes as {p === 'they' ? 'their' : p === 'she' ? 'her' : 'his'} numbers change.
              </div>
              <Field label="Best stage" optional hint="Swap roles and Assess show them strongest here">{id => <Select id={id} value={c.bestStage} onChange={e => set('bestStage', e.target.value)}><option value="">The stage they are in</option>{draft.process.stages.map(s => <option key={s.key} value={s.key}>{s.name}</option>)}</Select>}</Field>
            </div>
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Experience">{id => <TextInput id={id} tone={mark('stats')} value={c.experience} onChange={e => set('experience', e.target.value)} />}</Field>
                <Field label="Time on this team">{id => <TextInput id={id} tone={mark('stats')} value={c.tenure} onChange={e => set('tenure', e.target.value)} />}</Field>
              </div>
              <Field label="Previous company" optional>{id => <TextInput id={id} value={c.previousCompany} onChange={e => set('previousCompany', e.target.value)} />}</Field>
              <Field label="Career goal">{id => <TextArea id={id} rows={2} tone={mark('stats')} value={c.careerGoal} onChange={e => set('careerGoal', e.target.value)} />}</Field>
              <fieldset className="m-0 flex flex-col gap-1.5 border-0 p-0">
                <legend className="mb-1 text-13 font-700 text-author-label">Shown to the participant</legend>
                {([['experience', 'Experience'], ['tenure', 'Time on team'], ['previousCompany', 'Previous company'], ['careerGoal', 'Career goal, after a good 1:1']] as const).map(([k, l]) => (
                  <label key={k} className="flex items-center gap-2 text-14"><input type="checkbox" checked={c.shown[k]} onChange={e => set('shown', { ...c.shown, [k]: e.target.checked })} /> {l}</label>
                ))}
              </fieldset>
              {c.custom.map((f, i) => (
                <div key={i} className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto] items-end gap-2">
                  <Field label="Custom field" hint="The AI character knows it">{id => <TextInput id={id} value={f.label} onChange={e => set('custom', c.custom.map((x, k) => (k === i ? { ...x, label: e.target.value } : x)))} />}</Field>
                  <Field label="Value">{id => <TextInput id={id} maxLength={TEXT_MAX} value={f.value} onChange={e => set('custom', c.custom.map((x, k) => (k === i ? { ...x, value: e.target.value } : x)))} />}</Field>
                  <button type="button" className={`${BUTTON.secondary} size-10 px-0`} aria-label={`Remove ${f.label}`} onClick={() => set('custom', c.custom.filter((_, k) => k !== i))}>{Icon.close(14)}</button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
