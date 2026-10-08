import { useState } from 'react';
import { skillNames } from '../../model/choices';
import { GENDERS, STAKEHOLDER_KINDS, type AuthorDraft, type Character, type StakeholderDraft, type StakeholderEffectDraft, type StakeholderInteractionDraft, type StakeholderOptionDraft } from '../../model/draft';
import { freshKey, PORTRAITS, pronounsOf } from '../../model/seed';
import { blankStakeholderOption, KIND_LABEL, TYPE_LABEL } from '../../model/stakeholders';
import { Avatar, Badge, BUTTON, Chip, Field, Modal, Segmented, Select, SubTabs, TEXT_MAX, TextArea, TextInput, toneOf } from '../kit';
import { Slider } from './CharacterEditor';
import { Switch } from './tabs/Variables';

type EditTab = 'identity' | 'voice' | 'personality' | 'relationship' | 'interactions';
const GENDER_LABEL: Record<Character['gender'], string> = { woman: 'Woman', man: 'Man', nonbinary: 'Non binary', unstated: 'Not stated' };
const delta = (v: string) => Math.max(-30, Math.min(30, Math.round(Number(v.replace('−', '-')) || 0)));
const signed = (v: number) => (v < 0 ? `−${-v}` : String(v));
const amount = (v: string) => { const n = Number(v.replace('−', '-').replace(/[^\d.-]/g, '')); return Number.isFinite(n) ? n : 0; };
/** How a starting value reads in play, as the board's ring shows it. */
export const relationWord = (n: number) => (n < 30 ? 'strained' : n < 45 ? 'cool' : n < 60 ? 'steady' : n < 75 ? 'good' : 'strong');

/** The groups of fields the editor marks as the author's when they change (D163). */
const GROUPS: Record<string, Array<keyof StakeholderDraft>> = {
  identity: ['name', 'role', 'kind', 'gender', 'pronouns', 'photo', 'about'], voice: ['voice'],
  personality: ['persona', 'motivatedBy', 'noTopics', 'hiddenConcern', 'concernLine'], relationship: ['start', 'drift'], interactions: ['interactions']
};

/** A new first name follows into the interactions' labels and goals that used the old one ("Meet Priya" becomes "Meet Ana"). */
function renamed(before: StakeholderDraft, after: StakeholderDraft): StakeholderDraft {
  const was = before.name.trim().split(' ')[0];
  const now = after.name.trim().split(' ')[0];
  if (!was || !now || was === now) return after;
  const re = new RegExp(`\\b${was.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g');
  return { ...after, interactions: after.interactions.map(x => ({ ...x, label: x.label.replace(re, now), goal: x.goal.replace(re, now) })) };
}

/** One consequence: their trust and satisfaction, sponsor confidence, revenue once and each business variable. */
function EffectFields({ d, legend, effect, onChange }: { d: AuthorDraft; legend: string; effect: StakeholderEffectDraft; onChange: (e: StakeholderEffectDraft) => void }) {
  const put = (patch: Partial<StakeholderEffectDraft>) => onChange({ ...effect, ...patch });
  return (
    <fieldset className="m-0 flex flex-col gap-2 rounded-10 border border-solid border-author-line p-3">
      <legend className="px-1 text-13 font-800">{legend}</legend>
      <div className="grid grid-cols-4 gap-2 max-[900px]:grid-cols-2">
        <Field label="Their trust">{id => <TextInput id={id} inputMode="numeric" value={signed(effect.trust)} onChange={e => put({ trust: delta(e.target.value) })} />}</Field>
        <Field label="Their satisfaction">{id => <TextInput id={id} inputMode="numeric" value={signed(effect.satisfaction)} onChange={e => put({ satisfaction: delta(e.target.value) })} />}</Field>
        <Field label="Sponsor confidence">{id => <TextInput id={id} inputMode="numeric" value={signed(effect.sponsor)} onChange={e => put({ sponsor: delta(e.target.value) })} />}</Field>
        <Field label="Revenue, once">{id => <TextInput id={id} inputMode="decimal" value={signed(effect.revenue)} onChange={e => put({ revenue: amount(e.target.value) })} />}</Field>
        {d.variables.map(v => <Field key={v.key} label={v.name || v.key}>{id => <TextInput id={id} inputMode="decimal" value={signed(effect.variables[v.key] ?? 0)} onChange={e => { const n = amount(e.target.value); const vars = { ...effect.variables }; if (n) vars[v.key] = n; else delete vars[v.key]; put({ variables: vars }); }} />}</Field>)}
      </div>
      <Field label="What happened" optional hint="Shown after it plays; left empty, the participant sees how the relationship moved.">{id => <TextInput id={id} maxLength={TEXT_MAX} value={effect.outcome} onChange={e => put({ outcome: e.target.value })} />}</Field>
    </fieldset>
  );
}

/** One way to engage the stakeholder: on or off, what it is for, live or a decision, and what it does. */
function InteractionCard({ d, s, x, onChange }: { d: AuthorDraft; s: StakeholderDraft; x: StakeholderInteractionDraft; onChange: (x: StakeholderInteractionDraft) => void }) {
  const put = (patch: Partial<StakeholderInteractionDraft>) => onChange({ ...x, ...patch });
  const skills = skillNames(d);
  const first = s.name.split(' ')[0] || 'them';
  const setOption = (key: string, patch: Partial<StakeholderOptionDraft>) => put({ options: x.options.map(o => (o.key === key ? { ...o, ...patch } : o)) });
  const title = TYPE_LABEL[x.type];
  return (
    <section aria-label={title} className="flex flex-col gap-3 rounded-12 border border-solid border-author-line p-3">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="m-0 flex-1 text-15 font-800">{title}</h3>
        <Switch label={`${title}: participants can do this`} checked={x.enabled} onChange={on => put({ enabled: on, ...(on && x.plays === 'static' && x.options.length < 2 ? { options: [blankStakeholderOption('option_1', 'First option'), blankStakeholderOption('option_2', 'Second option')] } : null) })} />
      </div>
      {x.enabled && (
        <>
          <div className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-2 max-[900px]:grid-cols-2">
            <Field label="Label on the board">{id => <TextInput id={id} value={x.label} onChange={e => put({ label: e.target.value })} />}</Field>
            <Field label="Plays as">{() => <Segmented size="sm" label={`${title}, plays as`} value={x.plays} onChange={plays => put({ plays, ...(plays === 'static' && x.options.length < 2 ? { options: [blankStakeholderOption('option_1', 'First option'), blankStakeholderOption('option_2', 'Second option')] } : null) })} options={[{ value: 'live', label: 'Conversation' }, { value: 'static', label: 'Decision' }]} />}</Field>
            <Field label="Days it takes">{id => <Select id={id} value={x.cost} onChange={e => put({ cost: Number(e.target.value) })}>{[0, 1, 2, 3].map(n => <option key={n} value={n}>{n}</option>)}</Select>}</Field>
            <Field label="From week">{id => <Select id={id} value={x.from} onChange={e => put({ from: Number(e.target.value) })}>{Array.from({ length: d.process.weeks }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n}</option>)}</Select>}</Field>
          </div>
          <Field label="What the participant is trying to do" hint={`The goal ${first}'s side of the conversation is judged against.`}>{id => <TextArea id={id} rows={2} value={x.goal} onChange={e => put({ goal: e.target.value })} />}</Field>
          {x.plays === 'live' && (
            <>
              <div className="flex flex-col gap-2">
                <span id={`sk-${x.type}`} className="text-13 font-700 text-author-label">Scored on</span>
                <div role="group" aria-labelledby={`sk-${x.type}`} className="flex flex-wrap gap-2">
                  {skills.map(n => <Chip key={n} pressed={x.scoredOn.includes(n)} onClick={() => put({ scoredOn: x.scoredOn.includes(n) ? x.scoredOn.filter(k => k !== n) : [...x.scoredOn, n].slice(0, 4) })}>{n}</Chip>)}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 max-[900px]:grid-cols-1">
                <EffectFields d={d} legend="When it goes well" effect={x.good} onChange={good => put({ good })} />
                <EffectFields d={d} legend="When it goes badly" effect={x.bad} onChange={bad => put({ bad })} />
              </div>
              <p className="m-0 text-12 text-author-muted">A strong conversation does all of "goes well"; an adequate one about half. A weak one does "goes badly"; a harmful one half as much again. Higher trust makes gains bigger, low trust makes losses bigger.</p>
            </>
          )}
          {x.plays === 'static' && (
            <>
              <ol aria-label={`${title} options`} className="m-0 flex list-none flex-col gap-2 p-0">
                {x.options.map((o, i) => (
                  <li key={o.key} className="flex flex-col gap-2 rounded-10 border border-solid border-author-line p-3">
                    <div className="flex items-center gap-2">
                      <b className="flex-1 text-14">Option {i + 1}</b>
                      <button type="button" className={`${BUTTON.secondary} min-h-8 px-2 text-12`} disabled={x.options.length <= 2} onClick={() => put({ options: x.options.filter(y => y.key !== o.key) })}>Remove<span className="sr-only"> option {i + 1}</span></button>
                    </div>
                    <div className="grid grid-cols-[2fr_1fr] gap-2 max-[900px]:grid-cols-1">
                      <Field label="Label">{id => <TextInput id={id} value={o.label} onChange={e => setOption(o.key, { label: e.target.value })} />}</Field>
                      <Field label="Trust it needs" hint="0 for none">{id => <TextInput id={id} inputMode="numeric" value={o.needsTrust} onChange={e => setOption(o.key, { needsTrust: Math.max(0, Math.min(100, Math.round(amount(e.target.value)))) })} />}</Field>
                    </div>
                    {o.needsTrust > 0 && <Field label={`What ${first} says when trust is too low`}>{id => <TextInput id={id} maxLength={TEXT_MAX} value={o.refusal} onChange={e => setOption(o.key, { refusal: e.target.value })} />}</Field>}
                    <EffectFields d={d} legend="What it does" effect={o.effect} onChange={effect => setOption(o.key, { effect })} />
                  </li>
                ))}
              </ol>
              <button type="button" className={`${BUTTON.secondary} self-start`} disabled={x.options.length >= 4} onClick={() => put({ options: [...x.options, blankStakeholderOption(freshKey('option', x.options.map(o => o.key)), `Option ${x.options.length + 1}`)] })}>Add an option</button>
            </>
          )}
        </>
      )}
    </section>
  );
}

/**
 * Edit a stakeholder outside the team (D163), in the character editor's pattern: identity, voice, personality, the
 * relationship they start with, and the ways participants can engage them with what each does. Changes stay in the
 * dialog until Save changes; saving marks what the author changed as theirs, so Kora never overwrites it.
 */
export function StakeholderEditor({ draft, stakeholder, open, onOpenChange, onSave, initialTab = 'identity' }: {
  draft: AuthorDraft; stakeholder: StakeholderDraft; open: boolean; onOpenChange: (o: boolean) => void; onSave: (s: StakeholderDraft, changed: string[]) => void; initialTab?: EditTab;
}) {
  const [tab, setTab] = useState<EditTab>(initialTab);
  const [s, setS] = useState<StakeholderDraft>(() => structuredClone(stakeholder));
  const set = <K extends keyof StakeholderDraft>(k: K, v: StakeholderDraft[K]) => setS(x => ({ ...x, [k]: v }));
  const mark = (f: string) => toneOf(draft.marks[`stakeholders.${s.key}.${f}`]);
  const first = s.name.split(' ')[0] || 'them';
  const changed = (next: StakeholderDraft) => Object.entries(GROUPS).filter(([, ks]) => ks.some(k => JSON.stringify(next[k]) !== JSON.stringify(stakeholder[k]))).map(([g]) => `stakeholders.${s.key}.${g}`);
  const taken = draft.stakeholders.some(o => o.key !== s.key && o.name.trim().toLowerCase() === s.name.trim().toLowerCase()) || draft.team.some(c => `${c.first} ${c.last}`.toLowerCase() === s.name.trim().toLowerCase());

  return (
    <Modal open={open} onOpenChange={onOpenChange} width="max-w-230" title={`Edit ${s.name}`.trim()}
      description={`${s.role} · ${KIND_LABEL[s.kind]} · outside the team · changes save to this draft only`}
      head={<Avatar src={s.photo || undefined} name={s.name} size={56} />}
      footer={<>
        <span className="min-w-40 flex-1 text-13 text-author-body">Stakeholders are not in the work process: participants engage them, and their trust and satisfaction move the business. Fields you change are marked as yours.</span>
        <button type="button" className={BUTTON.secondary} onClick={() => onOpenChange(false)}>Cancel</button>
        <button type="button" className={BUTTON.primary} disabled={!s.name.trim()} onClick={() => { const next = renamed(stakeholder, s); onSave(next, changed(next)); }}>Save changes</button>
      </>}>
      <div className="flex-none px-6"><SubTabs idBase="sh" variant="line" label="Stakeholder details" value={tab} onChange={setTab} tabs={[{ value: 'identity', label: 'Identity' }, { value: 'voice', label: 'Voice' }, { value: 'personality', label: 'Personality' }, { value: 'relationship', label: 'Relationship' }, { value: 'interactions', label: 'Interactions' }]} /></div>
      <div id="sh-panel" role="tabpanel" aria-labelledby={`sh-tab-${tab}`} tabIndex={0} className="min-h-0 flex-1 overflow-y-auto px-6 py-5 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-author-primary">
        {tab === 'identity' && (
          <div className="grid grid-cols-[15rem_minmax(0,1fr)] gap-6 max-[1000px]:grid-cols-[12rem_minmax(0,1fr)] max-[1000px]:gap-4">
            <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
              <legend className="mb-2 flex w-full items-center justify-between text-13 font-700 text-author-label">Photo <Badge kind={draft.marks[`stakeholders.${s.key}.identity`] ?? 'ai'} /></legend>
              <div className="grid grid-cols-4 gap-1.5">
                <label className={`flex aspect-square cursor-pointer items-center justify-center rounded-10 border-2 border-solid text-12 font-700 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-author-primary ${!s.photo ? 'border-author-primary' : 'border-author-line'}`}>
                  <input type="radio" name="sh-photo" className="sr-only" checked={!s.photo} onChange={() => set('photo', '')} aria-label="Initials, no photo" />
                  <span aria-hidden="true">Aa</span>
                </label>
                {PORTRAITS.slice(0, 11).map(src => (
                  <label key={src} className={`cursor-pointer rounded-10 border-2 border-solid p-0.5 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-author-primary ${s.photo === src ? 'border-author-primary' : 'border-transparent'}`}>
                    <input type="radio" name="sh-photo" className="sr-only" checked={s.photo === src} onChange={() => set('photo', src)} aria-label={`Portrait ${PORTRAITS.indexOf(src) + 1}`} />
                    <img src={src} alt="" className="aspect-square w-full rounded-8 object-cover object-top" />
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3 max-[1000px]:grid-cols-1">
                <Field label="Name" required need={!s.name.trim()}>{id => <TextInput id={id} tone={toneOf(undefined, !s.name.trim())} value={s.name} onChange={e => set('name', e.target.value)} />}</Field>
                <Field label="Role" required>{id => <TextInput id={id} tone={mark('identity')} value={s.role} onChange={e => set('role', e.target.value)} />}</Field>
              </div>
              {taken && <p role="alert" className="m-0 text-13 text-author-need">Someone in this simulation already has this name. Give {first} their own.</p>}
              <Field label="Who they are to the team">{id => <Select id={id} value={s.kind} onChange={e => set('kind', e.target.value as StakeholderDraft['kind'])}>{STAKEHOLDER_KINDS.map(k => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}</Select>}</Field>
              <Field label="Gender">{() => <Segmented label="Gender" value={s.gender} onChange={g => setS(x => ({ ...x, gender: g, pronouns: pronounsOf(g) }))} options={GENDERS.map(g => ({ value: g, label: GENDER_LABEL[g] }))} />}</Field>
              <Field label="Pronouns" optional>{id => <TextInput id={id} value={s.pronouns} onChange={e => set('pronouns', e.target.value)} />}</Field>
              <Field label="What the participant knows about them">{id => <TextArea id={id} rows={3} tone={mark('identity')} value={s.about} onChange={e => set('about', e.target.value)} />}</Field>
            </div>
          </div>
        )}
        {tab === 'voice' && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between"><span className="text-13 font-700 text-author-label">How {first} sounds</span><Badge kind={draft.marks[`stakeholders.${s.key}.voice`] ?? 'ai'} /></div>
            <Slider label="Speaking pace" value={s.voice.pace} low="slow" high="fast" onChange={v => set('voice', { ...s.voice, pace: v })} />
            <Slider label="Warmth" value={s.voice.warmth} low="cool" high="warm" onChange={v => set('voice', { ...s.voice, warmth: v })} />
            <Slider label="Formality" value={s.voice.formality} low="casual" high="formal" onChange={v => set('voice', { ...s.voice, formality: v })} />
            <Field label="Reply length">{() => <Segmented label="Reply length" value={s.voice.replyLength} onChange={v => set('voice', { ...s.voice, replyLength: v })} options={[{ value: 'short', label: 'Short' }, { value: 'medium', label: 'Medium' }, { value: 'long', label: 'Long' }]} />}</Field>
            <p className="m-0 text-13 text-author-muted">The AI character reads these when it speaks as {first}, and their trust in the participant changes how open they are.</p>
          </div>
        )}
        {tab === 'personality' && (
          <div className="grid grid-cols-2 gap-5 max-[900px]:grid-cols-1">
            <div className="flex flex-col gap-4">
              <Field label="Persona" hint="How they talk and what they care about">{id => <TextArea id={id} rows={4} tone={mark('personality')} value={s.persona} onChange={e => set('persona', e.target.value)} />}</Field>
              <Field label="Motivated by">{id => <TextArea id={id} rows={2} tone={mark('personality')} value={s.motivatedBy} onChange={e => set('motivatedBy', e.target.value)} />}</Field>
              <Field label="Topics they will not discuss" optional>{id => <TextInput id={id} maxLength={TEXT_MAX} value={s.noTopics} onChange={e => set('noTopics', e.target.value)} />}</Field>
            </div>
            <div className="flex flex-col gap-4">
              <Field label="Hidden concern" optional hint="Kept back until trust is good and the conversation earns it.">{id => <TextArea id={id} rows={3} tone={mark('personality')} value={s.hiddenConcern} onChange={e => set('hiddenConcern', e.target.value)} />}</Field>
              <Field label="What they say when it comes out" optional>{id => <TextArea id={id} rows={2} tone={mark('personality')} value={s.concernLine} onChange={e => set('concernLine', e.target.value)} />}</Field>
            </div>
          </div>
        )}
        {tab === 'relationship' && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between"><span className="text-13 font-700 text-author-label">Where the relationship starts, 0 to 100</span><Badge kind={draft.marks[`stakeholders.${s.key}.relationship`] ?? 'ai'} /></div>
            <Slider label="Trust in you" value={s.start.trust} low="wary" high="trusting" onChange={v => set('start', { ...s.start, trust: v })} />
            <Slider label="Satisfaction" value={s.start.satisfaction} low="unhappy" high="happy" onChange={v => set('start', { ...s.start, satisfaction: v })} />
            <Field label="Satisfaction lost each week nobody engages them" hint="0 for none">{id => <Select id={id} value={s.drift} onChange={e => set('drift', Number(e.target.value))}>{Array.from({ length: 11 }, (_, n) => <option key={n} value={n}>{n}</option>)}</Select>}</Field>
            <div className="rounded-12 bg-author-ai-field p-3 text-14" role="status">
              <b className="block text-13 text-author-ai">What this means in play</b>
              {first} starts {relationWord(Math.min(s.start.trust, s.start.satisfaction))}. Trust makes good conversations land harder and bad ones hurt less; satisfaction falls by {s.drift} a week while nobody talks to {first}.
            </div>
          </div>
        )}
        {tab === 'interactions' && (
          <div className="flex flex-col gap-3">
            <p className="m-0 text-13 text-author-muted">The ways participants can engage {first}. A conversation plays live with the AI character and is scored; a decision is a choice between 2 to 4 options. Each takes days, once a week, except answering a meeting {first} asked for.</p>
            {s.interactions.map((x, i) => <InteractionCard key={x.type} d={draft} s={s} x={x} onChange={next => set('interactions', s.interactions.map((y, k) => (k === i ? next : y)))} />)}
          </div>
        )}
      </div>
    </Modal>
  );
}
