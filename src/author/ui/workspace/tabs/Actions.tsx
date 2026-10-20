import { useState } from 'react';
import { LENS_BY_ID } from '../../../lenses';
import type { ActionDraft, Plays } from '../../../model/draft';
import { ENGINE_TEMPLATES, PLAYS_LABEL } from '../../../model/library';
import { effectText, freshKey, seedDraft } from '../../../model/seed';
import { useAuthor } from '../../../model/store';
import { Badge, BUTTON, CARD, Field, Icon, Segmented, Select, SHORT_MAX, TEXT_MAX, TextArea, TextInput, Toggle, toneOf } from '../../kit';
import { ActionAdd } from '../ActionAdd';
import { TabBody, TabHead } from '../Workspace';

const GLYPH: Record<Plays, { mark: string; cls: string }> = {
  live: { mark: '◐', cls: 'bg-author-ai-badge text-author-ai' },
  static: { mark: '■', cls: 'bg-author-primary-soft text-author-ink' },
  hybrid: { mark: '◧', cls: 'bg-author-need-badge text-author-need' }
};
function Glyph({ plays }: { plays: Plays }) {
  return <span aria-hidden="true" className={`flex size-7 shrink-0 items-center justify-center rounded-8 text-14 ${GLYPH[plays].cls}`}>{GLYPH[plays].mark}</span>;
}
const GROUPS: Array<[ActionDraft['group'], string]> = [['team', 'For the team'], ['person', 'For one person'], ['story', 'Added for this story']];

/**
 * Workspace: Actions and conversations (docs/design/genie/Actions, ActionStatic, ActionAdd; D108): the
 * action library for this simulation. Core actions are locked in; optional ones have switches. Each
 * plays as a static decision, a live AI conversation, or a decision then a conversation, as its rule
 * allows. A conversation's impact by style follows the lens's styles; a decision lists its options.
 */
export default function Actions() {
  const d = useAuthor(s => s.draft);
  const edit = useAuthor(s => s.edit);
  const [selected, setSelected] = useState(d.actions.find(a => a.key === 'f2f')?.key ?? d.actions[0]?.key);
  const [adding, setAdding] = useState(false);
  const a = d.actions.find(x => x.key === selected) ?? d.actions[0];
  const inUse = d.actions.filter(x => x.core || x.enabled).length;
  const core = d.actions.filter(x => x.core).length;
  const path = (k: string) => `actions.${k}`;
  const set = (patch: Partial<ActionDraft>) => edit(x => { const t = x.actions.find(y => y.key === a.key); if (t) Object.assign(t, patch); }, path(a.key));
  const skills = d.scoring.skills.map(s => s.name);
  const reportOnly = new Set(d.scoring.skills.filter(s => s.reportOnly).map(s => s.name));
  const optionKey = (t: ActionDraft) => freshKey(`${t.key}_opt${t.options.length + 1}`, t.options.map(o => o.key));
  const lensTitle = LENS_BY_ID[d.lens.id].title.replace(' Leadership', '');

  return (
    <TabBody label="Actions and conversations" head={
      <div className="flex flex-col gap-3">
        <TabHead title="Actions and conversations" actions={<button type="button" className={`${BUTTON.primary} min-h-11 text-15`} onClick={() => setAdding(true)}>Add an action</button>}>
          What participants can do each week. {core} core actions are always included; turn the optional ones on or off. {inUse} in use.
        </TabHead>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-13 text-author-body" aria-label="Key">
          {(['live', 'static', 'hybrid'] as const).map(p => <span key={p} className="flex items-center gap-2"><Glyph plays={p} />{PLAYS_LABEL[p]}</span>)}
          <span className="flex-1" />
          <span className="flex items-center gap-2"><Badge kind="core" /> always included</span>
          <span className="flex items-center gap-2"><span aria-hidden="true" className="inline-flex h-6 w-10.5 items-center justify-end rounded-pill bg-author-primary p-0.5"><span className="size-5 rounded-round bg-author-surface" /></span> optional, your choice</span>
        </div>
      </div>
    }>
      <div className="grid grid-cols-[21rem_minmax(0,1fr)] items-start gap-4 max-[1180px]:grid-cols-[17rem_minmax(0,1fr)] max-[900px]:grid-cols-1">
        <section aria-label="Actions" className={`${CARD} flex flex-col gap-1 p-3`}>
          {GROUPS.map(([g, label]) => {
            const list = d.actions.filter(x => x.group === g);
            if (!list.length) return null;
            return (
              <div key={g} className="flex flex-col gap-1">
                <h2 className="m-0 px-2 pt-2 text-11 font-800 tracking-[0.12em] text-author-label uppercase">{label}</h2>
                <ul className="m-0 flex list-none flex-col gap-1 p-0">
                  {list.map(x => (
                    <li key={x.key} className={`flex items-center gap-2 rounded-12 border-2 border-solid px-2 py-1.5 ${x.key === a.key ? 'border-author-primary bg-author-primary-faint' : 'border-transparent'}`}>
                      <Glyph plays={x.plays} />
                      <button type="button" aria-current={x.key === a.key || undefined} onClick={() => setSelected(x.key)} className="flex min-w-0 flex-1 cursor-pointer flex-col border-0 bg-transparent p-0 text-start focus-visible:outline-2 focus-visible:outline-author-primary">
                        <b className={`text-14 ${x.core || x.enabled ? '' : 'text-author-muted'}`}>{x.name}</b>
                        <span className="truncate text-12 text-author-body">{x.format.split(' · ')[0]} &middot; {x.cost} day{x.cost === 1 ? '' : 's'}{x.availableFrom > 1 ? ` · week ${x.availableFrom}` : ''}</span>
                      </button>
                      {x.origin === 'yours' && <Badge kind="yours" />}
                      {x.core ? <Badge kind="core" /> : <Toggle label={`Use ${x.name}`} checked={x.enabled} onChange={v => edit(y => { const t = y.actions.find(z => z.key === x.key); if (t) t.enabled = v; }, path(x.key))} />}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </section>
        {a && (
          <section aria-labelledby="action-title" className={`${CARD} flex flex-col gap-4 p-5`}>
            <div className="flex flex-wrap items-start gap-3">
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <h2 id="action-title" className="m-0 text-22 font-800">{a.name}</h2>
                <span className="text-13 text-author-body">{a.origin === 'yours' ? 'Added for this story' : 'From the action library'} &middot; {a.plays === 'static' ? 'options' : 'goal and scoring'} written for this story by Kora</span>
              </div>
              {a.core ? <Badge kind="core">Core action &middot; always included</Badge> : <span className="flex items-center gap-2 text-14 font-700"><Toggle label={`Use ${a.name}`} checked={a.enabled} onChange={v => set({ enabled: v })} />Optional &middot; in this simulation</span>}
              {a.origin === 'library' && <button type="button" className={BUTTON.secondary} onClick={() => edit(x => {
                const f = seedDraft({ ...x.chat, primary: x.lens.id }, 'workspace').actions.find(y => y.key === a.key);
                const i = x.actions.findIndex(y => y.key === a.key);
                if (f && i >= 0) { x.actions[i] = { ...f, enabled: x.actions[i].enabled }; x.marks[path(a.key)] = 'ai'; }
              })}>Reset to library</button>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Name">{id => <TextInput id={id} value={a.name} onChange={e => set({ name: e.target.value })} />}</Field>
              <Field label="What the participant reads">{id => <TextInput id={id} maxLength={TEXT_MAX} tone={toneOf(d.marks[path(a.key)])} value={a.description} onChange={e => set({ description: e.target.value })} />}</Field>
            </div>
            <Field label="How it plays" required hint={a.canPlay.length === 1 ? 'This action’s rule plays one way only.' : undefined}>{() => (
              <Segmented label="How it plays" value={a.plays} onChange={v => set({ plays: v })} options={(['static', 'live', 'hybrid'] as const).map(p => ({ value: p, label: PLAYS_LABEL[p], disabled: !a.canPlay.includes(p) }))} />
            )}</Field>
            <div className="grid grid-cols-4 gap-3 max-[1180px]:grid-cols-2">
              <Field label="For">{id => <TextInput id={id} readOnly value={a.forWhom} />}</Field>
              <Field label="Costs">{id => <Select id={id} value={a.cost} onChange={e => set({ cost: Number(e.target.value) })}>{[0.5, 1, 2, 3].map(n => <option key={n} value={n}>{n === 0.5 ? 'Half a day' : `${n} day${n === 1 ? '' : 's'}`}</option>)}</Select>}</Field>
              <Field label="Again after">{id => <Select id={id} value={a.againAfter} onChange={e => set({ againAfter: Number(e.target.value) })}>{[0, 1, 2, 3, 5, 10, 20].map(n => <option key={n} value={n}>{n === 0 ? 'Any time' : n === 5 ? '1 week' : n === 10 ? '2 weeks' : n === 20 ? '4 weeks' : `${n} day${n === 1 ? '' : 's'}`}</option>)}</Select>}</Field>
              <Field label="Available from">{id => <Select id={id} value={a.availableFrom} onChange={e => set({ availableFrom: Number(e.target.value) })}>{Array.from({ length: d.process.weeks }, (_, i) => i + 1).map(w => <option key={w} value={w}>Week {w}</option>)}</Select>}</Field>
            </div>
            {a.plays !== 'static' ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Format" hint="Set by the action's tested rules">{id => <TextInput id={id} readOnly value={a.format} />}</Field>
                  <Field label="Who starts">{id => <Select id={id} value={a.starts} onChange={e => set({ starts: e.target.value as ActionDraft['starts'] })}><option value="npc">{a.group === 'team' ? 'The team' : 'The team member'}</option><option value="participant">The participant</option></Select>}</Field>
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-13 font-700 text-author-label">Impact by style</span><Badge kind="ai">From your lens &middot; {lensTitle}</Badge></div>
                  <div className="overflow-hidden rounded-12 border border-solid border-author-line">
                    <table className="w-full table-fixed border-collapse text-14">
                      <caption className="sr-only">Impact of each lens style in {a.name}</caption>
                      <thead><tr className="bg-author-track text-11 font-800 tracking-[0.08em] text-author-label uppercase"><th scope="col" className="w-[22%] px-3 py-2 text-start">Style used</th><th scope="col" className="px-2 py-2 text-start">Fits the need</th><th scope="col" className="px-2 py-2 text-start">One step off</th><th scope="col" className="px-2 py-2 text-start">Wrong style</th></tr></thead>
                      <tbody>
                        {d.lens.styles.map(s => {
                          const row = a.impact[s.key] ?? a.impact[d.lens.styles[0].key] ?? { fit: effectText([1, 3, 3]), close: effectText([0, -1, -1]), wrong: effectText([0, -3, -3]) };
                          const cell = (k: 'fit' | 'close' | 'wrong', cls: string) => (
                            <td className="px-1 py-1"><input maxLength={SHORT_MAX} aria-label={`${s.name}, ${k === 'fit' ? 'fits the need' : k === 'close' ? 'one step off' : 'wrong style'}`} value={row[k]} onChange={e => set({ impact: { ...a.impact, [s.key]: { ...row, [k]: e.target.value } } })}
                              className={`w-full rounded-8 border border-transparent bg-transparent px-2 py-1 text-14 font-700 hover:border-author-line-control focus-visible:outline-2 focus-visible:outline-author-primary ${cls}`} /></td>
                          );
                          return <tr key={s.key} className="border-t border-solid border-author-rule"><th scope="row" className="px-3 py-1.5 text-start font-800">{s.name || 'New style'}</th>{cell('fit', 'text-author-gain')}{cell('close', 'text-author-need')}{cell('wrong', 'text-author-decline')}</tr>;
                        })}
                      </tbody>
                    </table>
                  </div>
                  <p className="m-0 text-13 text-author-body">Style names come from the Leadership lens tab. Change the lens or rename a style and Kora updates this table; edit any cell to override.</p>
                </div>
                <Field label="Goal the participant sees" mark={path(a.key)}>{id => <TextArea id={id} rows={2} tone={toneOf(d.marks[path(a.key)])} value={a.goal} onChange={e => set({ goal: e.target.value })} />}</Field>
              </>
            ) : (
              <>
                <Field label="How the result is decided" hint="Set by the action's tested rules">{id => <TextInput id={id} readOnly maxLength={TEXT_MAX} value={a.decides} />}</Field>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between"><span className="text-13 font-700 text-author-label">Options the participant chooses from</span><Badge kind="ai">Generated</Badge></div>
                  <div className="overflow-x-auto rounded-12 border border-solid border-author-line">
                    <table className="w-full min-w-[40rem] border-collapse text-14">
                      <caption className="sr-only">Options for {a.name}</caption>
                      <thead><tr className="bg-author-track text-11 font-800 tracking-[0.08em] text-author-label uppercase"><th scope="col" className="px-3 py-2 text-start">Option</th><th scope="col" className="w-32 px-2 py-2 text-start">Style</th><th scope="col" className="w-20 px-2 py-2 text-start">Away</th><th scope="col" className="px-2 py-2 text-start">If it fits</th><th scope="col" className="px-2 py-2 text-start">If it does not</th><th scope="col" className="w-10"><span className="sr-only">Remove</span></th></tr></thead>
                      <tbody>
                        {a.options.map((o, i) => {
                          const upd = (patch: Partial<typeof o>) => set({ options: a.options.map((x, k) => (k === i ? { ...x, ...patch } : x)) });
                          const inp = 'w-full rounded-8 border border-transparent bg-transparent px-2 py-1 text-14 hover:border-author-line-control focus-visible:outline-2 focus-visible:outline-author-primary';
                          return (
                            <tr key={o.key} className="border-t border-solid border-author-rule">
                              <td className="px-1 py-1"><input maxLength={SHORT_MAX} aria-label={`Option ${i + 1}`} className={inp} value={o.label} onChange={e => upd({ label: e.target.value })} /></td>
                              <td className="px-1 py-1"><select aria-label={`Style of option ${i + 1}`} className={inp} value={o.style ?? ''} onChange={e => upd({ style: e.target.value || null })}><option value="">None</option>{d.lens.styles.map(s => <option key={s.key} value={s.key}>{s.name || 'New style'}</option>)}</select></td>
                              <td className="px-1 py-1"><select aria-label={`Days away for option ${i + 1}`} className={inp} value={o.away} onChange={e => upd({ away: Number(e.target.value) })}>{[0, 1, 2, 3, 5].map(n => <option key={n} value={n}>{n ? `${n} day${n === 1 ? '' : 's'}` : 'None'}</option>)}</select></td>
                              <td className="px-1 py-1"><input maxLength={SHORT_MAX} aria-label={`Option ${i + 1}, if it fits`} className={`${inp} font-700 text-author-gain`} value={o.fits} onChange={e => upd({ fits: e.target.value })} /></td>
                              <td className="px-1 py-1"><input maxLength={SHORT_MAX} aria-label={`Option ${i + 1}, if it does not`} className={`${inp} font-700 text-author-decline`} value={o.misses} onChange={e => upd({ misses: e.target.value })} /></td>
                              <td className="px-1 py-1">{a.options.length > 1 && <button type="button" className={`${BUTTON.secondary} size-8 px-0`} aria-label={`Remove option ${i + 1}`} onClick={() => set({ options: a.options.filter((_, k) => k !== i) })}>{Icon.close(12)}</button>}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className={BUTTON.secondary} onClick={() => set({ options: [...a.options, { key: optionKey(a), label: '', style: null, away: 0, fits: effectText([3, 2, 2]), misses: effectText([0, -2, 0]) }] })}>Add an option</button>
                    <button type="button" className={BUTTON.koraOutline} onClick={() => edit(x => {
                      const t = x.actions.find(y => y.key === a.key);
                      const s = x.lens.styles[t ? t.options.length % x.lens.styles.length : 0];
                      if (t) t.options.push({ key: optionKey(t), label: `${a.name}, the ${s.name.toLowerCase()} way`, style: s.key, away: 1, fits: effectText([4, 3, 2]), misses: effectText([0, -2, -1]) });
                    }, path(a.key), 'ai')}>Suggest options with Kora</button>
                  </div>
                </div>
              </>
            )}
            {a.plays !== 'static' && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between"><span className="text-13 font-700 text-author-label">Scored on</span><Badge kind={d.scoring.framework?.confirmed ? 'you' : 'ai'}>{d.scoring.framework?.confirmed ? 'Your framework' : 'From your lens'}</Badge></div>
                <div className="flex flex-wrap gap-2">
                  {a.scoredOn.map(s => (
                    <span key={s} className={`inline-flex min-h-9 items-center gap-2 rounded-pill px-3 text-14 font-700 ${skills.includes(s) ? 'bg-author-ai-field' : 'bg-author-need-field text-author-need'}`}>
                      {s}{!skills.includes(s) && ', not one of your skills'}{reportOnly.has(s) && ', report only'}
                      <button type="button" aria-label={`Remove ${s}`} className="cursor-pointer border-0 bg-transparent p-0 text-author-label focus-visible:outline-2 focus-visible:outline-author-primary" onClick={() => set({ scoredOn: a.scoredOn.filter(x => x !== s) })}>{Icon.close(12)}</button>
                    </span>
                  ))}
                  {a.scoredOn.length < 4 && skills.filter(s => !a.scoredOn.includes(s)).length > 0 && (
                    <Select aria-label="Add a skill" className="w-auto" value="" onChange={e => { if (e.target.value) set({ scoredOn: [...a.scoredOn, e.target.value] }); }}>
                      <option value="">Add a skill</option>{skills.filter(s => !a.scoredOn.includes(s)).map(s => <option key={s}>{s}</option>)}
                    </Select>
                  )}
                </div>
                <p className="m-0 text-12 text-author-muted">The conversation is rated on these skills, at most 4. None: it counts toward no skill in the report.</p>
              </div>
            )}
            {a.template !== a.key && <p className="m-0 text-12 text-author-muted">Plays with the tested rules of {ENGINE_TEMPLATES.find(t => t.key === a.template)?.name ?? a.template}.</p>}
          </section>
        )}
      </div>
      {adding && <ActionAdd open onOpenChange={setAdding} onAdded={key => { setSelected(key); setAdding(false); }} />}
    </TabBody>
  );
}
