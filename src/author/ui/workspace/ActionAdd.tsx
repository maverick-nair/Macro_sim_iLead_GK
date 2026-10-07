import { useMemo, useState } from 'react';
import { z } from 'zod';
import { LENS_IDS } from '../../../engine/lens';
import { PLAYS, SHORT_MAX, TEXT_MAX, type ActionDraft, type AuthorDraft, type Plays } from '../../model/draft';
import { ACTION_TEMPLATES, ENGINE_TEMPLATES, PLAYS_LABEL, type ActionTemplate } from '../../model/library';
import { freshKey, seedDraft } from '../../model/seed';
import { useAuthor } from '../../model/store';
import { Badge, BUTTON, Chip, Modal, Scroll, TextArea, TextInput } from '../kit';

/** Templates the author saved from "Describe your own", kept in this browser. */
export const MY_LIBRARY_KEY = 'ilead.author.library';
const ENGINE_KEYS = ENGINE_TEMPLATES.map(t => t.key) as [string, ...string[]];
/** A saved template as stored; it must play as one of the engine's actions. */
const StoredTemplate = z.object({
  key: z.string().regex(/^[a-z][a-z0-9_]*$/).max(200),
  name: z.string().min(1).max(SHORT_MAX),
  description: z.string().max(TEXT_MAX),
  type: z.string().max(64),
  plays: z.enum(PLAYS),
  template: z.enum(ENGINE_KEYS),
  group: z.enum(['team', 'person']),
  inNew: z.enum(['core', 'on', 'off']),
  version: z.number().int().min(0),
  format: z.string().max(SHORT_MAX),
  lenses: z.array(z.enum(LENS_IDS)).optional()
});
/** The saved templates in `raw`, keeping each one that parses and dropping the rest. */
export function parseMyLibrary(raw: string | null): ActionTemplate[] {
  let v: unknown;
  try { v = JSON.parse(raw ?? '[]'); } catch { return []; }
  if (!Array.isArray(v)) return [];
  return v.flatMap(x => { const r = StoredTemplate.safeParse(x); return r.success ? [r.data] : []; });
}
export function readMyLibrary(): ActionTemplate[] {
  try { return parseMyLibrary(localStorage.getItem(MY_LIBRARY_KEY)); } catch { return []; }
}
function saveMyLibrary(t: ActionTemplate) {
  try { localStorage.setItem(MY_LIBRARY_KEY, JSON.stringify([...readMyLibrary().filter(x => x.key !== t.key), t])); } catch { /* storage blocked */ }
}

/** A new action from a template: the engine action it plays as, with the template's words. */
export function actionFromTemplate(d: AuthorDraft, t: ActionTemplate, extra: Partial<ActionDraft> = {}): ActionDraft {
  const base = seedDraft({ ...d.chat, primary: d.lens.id }, 'workspace').actions.find(a => a.key === t.template)!;
  const key = freshKey(t.key, d.actions.map(a => a.key));
  const lensStyles = new Set(d.lens.styles.map(s => s.key));
  return {
    ...base, key, template: t.template, name: t.name, description: t.description, group: d.actions.some(a => a.key === t.key) || t.key !== t.template ? 'story' : t.group,
    core: false, enabled: true, plays: base.canPlay.includes(t.plays) ? t.plays : base.plays, origin: t.key === t.template ? 'library' : 'yours',
    options: base.options.map(o => ({ ...o, style: o.style && lensStyles.has(o.style) ? o.style : null })), ...extra
  };
}

/** Kora's reading of a described action (offline: by rule). */
export function describeAction(text: string, skills: string[]): { template: ActionTemplate; options: string[]; then: string; affects: string; scoredOn: string[] } {
  const t = text.toLowerCase();
  const decide = /\b(approve|refuse|decide|choose|pick|allocate|assign)\b/.test(t);
  const meeting = /\b(meeting|town hall|team|everyone|all hands)\b/.test(t) && !/\brep\b|\bone\b/.test(t);
  const written = /\b(email|write|message|letter)\b/.test(t);
  const plays: Plays = decide ? 'hybrid' : 'live';
  const template = decide ? 'reward' : meeting ? 'meet' : written ? 'feedback' : 'f2f';
  const named = /discount/.test(t) ? 'Discount approval' : /budget/.test(t) ? 'Budget request' : /leave|holiday|time off/.test(t) ? 'Leave request' : /promot/.test(t) ? 'Promotion decision' : text.trim().split(/\s+/).slice(0, 3).join(' ').replace(/^\w/, c => c.toUpperCase()).replace(/[,.;:]+$/, '');
  const key = named.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'new_action';
  return {
    template: { key: /^[a-z]/.test(key) ? key : `a_${key}`, name: named, description: text.trim().split(/(?<=[.!?])\s/)[0], type: decide ? 'hybrid' : meeting ? 'meeting' : 'live_1to1', plays, template, group: meeting ? 'team' : 'person', inNew: 'off', version: 1, format: decide ? 'Decide, then talk' : meeting ? 'Team meeting' : '1:1' },
    options: /approve|refuse/.test(t) ? ['Approve', 'Approve with conditions', 'Refuse'] : decide ? ['Yes', 'Not yet', 'No'] : [],
    then: decide ? 'A 3 minute 1:1 to explain the decision' : meeting ? 'A team meeting with several characters' : 'A 1:1 by voice or text',
    affects: /margin|discount|price/.test(t) ? 'Revenue margin, the person\u2019s morale and trust' : 'The person\u2019s morale, result and trust',
    scoredOn: skills.slice(0, 2)
  };
}

type Filter = 'all' | Plays | 'lens';

/**
 * Add an action (docs/design/genie/ActionAdd, D108): a ready made action from the KNOLSKAPE library, or
 * one the author describes in plain words that Kora sets up. Library actions arrive with tested rules.
 */
export function ActionAdd({ open, onOpenChange, onAdded }: { open: boolean; onOpenChange: (o: boolean) => void; onAdded: (key: string) => void }) {
  const d = useAuthor(s => s.draft);
  const edit = useAuthor(s => s.edit);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [text, setText] = useState('');
  const [kora, setKora] = useState<ReturnType<typeof describeAction> | null>(null);
  const [saved, setSaved] = useState(false);
  const skills = d.scoring.skills.filter(s => !s.reportOnly).map(s => s.name);
  const library = useMemo(() => [...ACTION_TEMPLATES, ...readMyLibrary()], []);
  const inUse = (t: ActionTemplate) => d.actions.some(a => a.key === t.key || (a.name === t.name && (a.core || a.enabled)));
  const list = library.filter(t => (filter === 'all' || (filter === 'lens' ? t.lenses?.includes(d.lens.id) : t.plays === filter)) && (!q.trim() || `${t.name} ${t.description}`.toLowerCase().includes(q.trim().toLowerCase())));

  function add(t: ActionTemplate, extra: Partial<ActionDraft> = {}) {
    const existing = d.actions.find(a => a.key === t.key);
    if (existing && !existing.core && !existing.enabled) { edit(x => { const a = x.actions.find(y => y.key === t.key); if (a) a.enabled = true; }, `actions.${t.key}`); onAdded(t.key); return; }
    const a = actionFromTemplate(d, t, extra);
    edit(x => { x.actions.push(a); }, `actions.${a.key}`, extra.origin === 'yours' ? 'ai' : 'you');
    onAdded(a.key);
  }
  const fromKora = (k: NonNullable<typeof kora>): Partial<ActionDraft> => ({
    origin: 'yours', group: 'story', goal: k.then, scoredOn: k.scoredOn,
    ...(k.options.length ? { options: k.options.map((label, i) => ({ key: `${k.template.key}_${i + 1}`, label, style: d.lens.styles[i % d.lens.styles.length].key, away: 0, fits: 'Morale +3, result +2', misses: 'Morale −3' })) } : null)
  });

  return (
    <Modal open={open} onOpenChange={onOpenChange} width="max-w-290" title="Add an action" description="Pick a ready made action from the library, or describe a new one and Kora sets it up.">
      <div className="grid min-h-0 flex-1 grid-cols-2 max-[900px]:grid-cols-1">
        <section aria-labelledby="lib-title" className="flex min-h-0 flex-col gap-3 border-e border-solid border-author-line px-6 py-4">
          <h3 id="lib-title" className="m-0 text-17 font-800">From the KNOLSKAPE library</h3>
          <TextInput aria-label="Search actions" placeholder={`Search ${library.length} actions`} value={q} onChange={e => setQ(e.target.value)} />
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter">
            {([['all', 'All'], ['live', PLAYS_LABEL.live], ['static', PLAYS_LABEL.static], ['hybrid', PLAYS_LABEL.hybrid], ['lens', 'Suggested for your lens']] as Array<[Filter, string]>).map(([v, l]) => <Chip key={v} pressed={filter === v} onClick={() => setFilter(v)}>{l}</Chip>)}
          </div>
          <Scroll label="Library actions" className="flex-1">
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {list.map(t => (
                <li key={t.key} className="flex items-center gap-3 rounded-12 border border-solid border-author-line p-3">
                  <span className="flex min-w-0 flex-1 flex-col"><b className="text-15">{t.name}</b><span className="text-13 text-author-body">{t.description}</span><span className="text-12 text-author-muted">{PLAYS_LABEL[t.plays]}</span></span>
                  {inUse(t) ? <Badge kind="passed">In use</Badge> : <button type="button" className={BUTTON.secondary} onClick={() => add(t)}>Add<span className="sr-only"> {t.name}</span></button>}
                </li>
              ))}
              {list.length === 0 && <li className="text-14 text-author-muted">No library action matches. Describe your own instead.</li>}
            </ul>
          </Scroll>
          <p className="m-0 text-12 text-author-muted">Library actions arrive with tested rules. You can change any field after adding.</p>
        </section>
        <section aria-labelledby="own-title" className="flex min-h-0 flex-col gap-3 bg-author-canvas px-6 py-4">
          <h3 id="own-title" className="m-0 text-17 font-800">Describe your own</h3>
          <form className="flex flex-col gap-2 rounded-14 border border-solid border-author-primary bg-author-surface p-3" onSubmit={e => { e.preventDefault(); if (text.trim()) { setKora(describeAction(text, skills)); setSaved(false); } }}>
            <label htmlFor="describe" className="text-13 font-700 text-author-label">What should the participant be able to do?</label>
            <TextArea id="describe" rows={3} className="border-0 px-0" placeholder="For example: approve or refuse a discount a rep asks for, then explain the decision" value={text} onChange={e => setText(e.target.value)} />
            <button type="submit" className={`${BUTTON.kora} self-end`} disabled={!text.trim()}>Set it up with Kora</button>
          </form>
          <Scroll label="Kora's draft" className="flex-1">
            {kora && (
              <section aria-labelledby="kora-draft" className="flex flex-col gap-1 rounded-14 border border-solid border-author-ai-line bg-author-ai-field p-4">
                <div className="flex items-center justify-between gap-2"><h4 id="kora-draft" className="m-0 text-17 font-800">{kora.template.name}</h4><Badge kind="ai">Kora&rsquo;s draft</Badge></div>
                <dl className="m-0 grid grid-cols-[8rem_minmax(0,1fr)] gap-x-3 text-14">
                  {[['How it plays', PLAYS_LABEL[kora.template.plays]], ['For', kora.template.group === 'team' ? 'The whole team' : 'One person, when they ask'], ['Costs', kora.template.plays === 'hybrid' ? 'Half a day' : '1 day'], ...(kora.options.length ? [['Decision options', kora.options.join(' · ')]] : []), ['Then', kora.then], ['Scored on', kora.scoredOn.join(', ')], ['Affects', kora.affects]].map(([k, v]) => (
                    <div key={k} className="contents"><dt className="border-b border-solid border-author-ai-line py-2 font-800 text-author-label">{k}</dt><dd className="m-0 border-b border-solid border-author-ai-line py-2">{v}</dd></div>
                  ))}
                </dl>
              </section>
            )}
          </Scroll>
          {saved && <p role="status" className="m-0 text-13 text-author-gain">Saved to your library in this browser.</p>}
          <div className="flex flex-none flex-wrap gap-2">
            <button type="button" className={BUTTON.primary} disabled={!kora} onClick={() => kora && add(kora.template, { ...fromKora(kora), plays: kora.template.plays, enabled: true, cost: kora.template.plays === 'hybrid' ? 0.5 : 1 })}>Add to this simulation</button>
            <button type="button" className={BUTTON.secondary} disabled={!kora} onClick={() => kora && add(kora.template, { ...fromKora(kora), enabled: false })}>Edit details first</button>
            <button type="button" className={BUTTON.secondary} disabled={!kora} onClick={() => { if (kora) { saveMyLibrary(kora.template); setSaved(true); } }}>Save to my library</button>
          </div>
        </section>
      </div>
    </Modal>
  );
}
