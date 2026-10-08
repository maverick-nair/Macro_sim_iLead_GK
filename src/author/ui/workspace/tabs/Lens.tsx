import { useState } from 'react';
import { LENS_IDS, MAX_STYLES, MIN_STYLES, NEEDS, type LensId } from '../../../../engine/lens';
import { LENS_BY_ID } from '../../../lenses';
import type { AuthorDraft } from '../../../model/draft';
import { freshKey, seedDraft } from '../../../model/seed';
import { useAuthor } from '../../../model/store';
import { Badge, BUTTON, CARD, CardHead, Modal, Select, TextInput, toneOf } from '../../kit';
import { TabBody, TabHead } from '../Workspace';

export const CHANGE_LENS_WARNING = 'Changing your lens will regenerate your team, events and scoring rubric. Do you want to continue?';
const FIT = ['Best', 'Close', 'Wrong'] as const;

/** A new lens: its styles, needs and fit, and the team, events, actions and skills drafted for it. */
export function changeLens(d: AuthorDraft, id: LensId) {
  const fresh = seedDraft({ ...d.chat, primary: id, secondary: d.lens.secondary === id ? null : d.lens.secondary }, 'workspace');
  d.chat.primary = id;
  d.lens = fresh.lens;
  d.team = fresh.team;
  d.events = fresh.events;
  d.actions = d.actions.map(a => {
    const f = fresh.actions.find(x => x.key === a.key);
    return f ? { ...a, impact: f.impact, options: a.options.map((o, i) => ({ ...o, style: f.options[i]?.style ?? null })), scoredOn: f.scoredOn } : a;
  });
  d.scoring.skills = fresh.scoring.skills;
  for (const [k, m] of Object.entries(fresh.marks)) if (/^(lens|team|events)\./.test(k)) d.marks[k] = m;
  d.marks['lens.id'] = 'you';
}

/**
 * Workspace: Leadership lens (docs/design/genie/Lens, D104): the lens's 4 or 5 styles, renamable in the
 * organization's words (tag letter, name and what the participant reads), a fifth style to add, the
 * library's names to restore, and the fit table every action's impact is worked out from.
 */
export default function Lens() {
  const d = useAuthor(s => s.draft);
  const edit = useAuthor(s => s.edit);
  // The old sample calls and anything scored on the old skills are offered for update (D148).
  const setOffer = useAuthor(s => s.setOffer);
  const [choose, setChoose] = useState(false);
  const [next, setNext] = useState<LensId>(d.lens.id);
  const lens = d.lens;
  const lib = (key: string) => lens.library.find(s => s.key === key);
  const renamed = (key: string) => { const l = lib(key), s = lens.styles.find(x => x.key === key)!; return !l || l.name !== s.name || l.letter !== s.letter || l.short !== s.short; };
  const letters = lens.styles.map(s => s.letter.toUpperCase());
  const setStyle = (i: number, patch: Partial<AuthorDraft['lens']['styles'][number]>) => edit(x => { Object.assign(x.lens.styles[i], patch); }, `lens.styles.${lens.styles[i].key}`);

  return (
    <TabBody label="Leadership lens" head={
      <TabHead title="Leadership lens" actions={<button type="button" className={BUTTON.secondary} onClick={() => { setNext(lens.id); setChoose(true); }}>Change lens</button>}>
        {LENS_BY_ID[lens.id].title} &middot; secondary: {lens.secondary ? LENS_BY_ID[lens.secondary].title : 'none'}
      </TabHead>
    }>
      <div className="flex flex-col gap-4">
        <section className={`${CARD} flex flex-col gap-3 p-5`} aria-labelledby="styles-title">
          <CardHead id="styles-title" title="Your styles"><span className="text-13 text-author-body"><b className="text-author-ink">{lens.styles.length} styles</b> &middot; a simulation always has {MIN_STYLES} or {MAX_STYLES}</span></CardHead>
          <p className="m-0 text-14 text-author-body">Rename them in your organization&rsquo;s words. The letter is the tag participants see on the board and in style setting. New names flow into every action, the report and Kora&rsquo;s drafts.</p>
          <div role="table" aria-label="Your styles" className="flex flex-col gap-2">
            <div role="row" className="grid grid-cols-[4rem_12rem_minmax(0,1fr)_6.5rem] gap-3 text-11 font-800 tracking-[0.1em] text-author-label uppercase max-[1100px]:grid-cols-[3.5rem_9rem_minmax(0,1fr)_6rem]">
              <span role="columnheader">Tag</span><span role="columnheader">Name</span><span role="columnheader">What the participant reads</span><span role="columnheader"><span className="sr-only">Mark</span></span>
            </div>
            {lens.styles.map((s, i) => {
              const dup = letters.filter(l => l === s.letter.toUpperCase()).length > 1;
              return (
                <div role="row" key={s.key} className="grid grid-cols-[4rem_12rem_minmax(0,1fr)_6.5rem] items-center gap-3 max-[1100px]:grid-cols-[3.5rem_9rem_minmax(0,1fr)_6rem]">
                  <span role="cell"><TextInput aria-label={`Tag letter for ${s.name || `style ${i + 1}`}`} aria-invalid={dup || !s.letter.trim()} maxLength={2} className="text-center font-800" tone={!s.letter.trim() || dup ? toneOf(undefined, true) : ''} value={s.letter} onChange={e => setStyle(i, { letter: e.target.value.slice(0, 2) })} /></span>
                  <span role="cell"><TextInput aria-label={`Name of style ${i + 1}`} className="font-700" tone={!s.name.trim() ? toneOf(undefined, true) : ''} value={s.name} onChange={e => setStyle(i, { name: e.target.value })} /></span>
                  <span role="cell"><TextInput aria-label={`What the participant reads for ${s.name || `style ${i + 1}`}`} tone={toneOf(renamed(s.key) ? 'edited' : 'ai')} value={s.short} onChange={e => setStyle(i, { short: e.target.value, description: e.target.value })} /></span>
                  <span role="cell" className="flex items-center gap-1">
                    {!s.name.trim() || !s.letter.trim() ? <Badge kind="need" /> : renamed(s.key) ? <Badge kind="edited">{lib(s.key) ? 'Renamed' : 'Added'}</Badge> : <Badge kind="ai">From lens</Badge>}
                    {!lib(s.key) && lens.styles.length > MIN_STYLES && <button type="button" className={BUTTON.link} onClick={() => edit(x => { x.lens.styles.splice(i, 1); for (const n of NEEDS) delete x.lens.fit[n][s.key]; })}>Remove<span className="sr-only"> {s.name}</span></button>}
                  </span>
                </div>
              );
            })}
          </div>
          {letters.some((l, i) => letters.indexOf(l) !== i) && <p role="alert" className="m-0 text-13 font-700 text-author-decline">Two styles share a tag letter. Give each its own.</p>}
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className={BUTTON.secondary} disabled={lens.styles.length >= MAX_STYLES} onClick={() => edit(x => {
              const key = freshKey('style', x.lens.styles.map(s => s.key));
              x.lens.styles.push({ key, letter: '', name: '', short: '', description: '' });
              for (const n of NEEDS) x.lens.fit[n][key] = 1;
              for (const c of x.team) c.reactions[key] = 'Goes along with it, without much energy.';
            }, 'lens.styles')}>Add a fifth style</button>
            <span className="flex-1 text-13 text-author-body">{lens.styles.length >= MAX_STYLES ? 'A simulation has at most five styles.' : 'Kora adds it to every action’s impact table and asks you to confirm when it fits each person’s need.'}</span>
            <button type="button" className={BUTTON.secondary} onClick={() => edit(x => {
              x.lens.styles = x.lens.styles.map(s => { const l = x.lens.library.find(y => y.key === s.key); return l ? { ...l } : s; });
              for (const s of x.lens.styles) x.marks[`lens.styles.${s.key}`] = 'ai';
            })}>Restore lens names</button>
          </div>
        </section>
        <section className={`${CARD} flex flex-col gap-3 p-5`} aria-labelledby="fit-title">
          <CardHead id="fit-title" title="Which style fits each need"><Badge kind="ai">From your lens</Badge></CardHead>
          <div className="overflow-hidden rounded-12 border border-solid border-author-line">
            <table className="w-full table-fixed border-collapse text-14">
              <caption className="sr-only">Fit of each style for each need: Best, Close or Wrong</caption>
              <thead><tr className="bg-author-track text-11 font-800 tracking-[0.08em] text-author-label uppercase">
                <th scope="col" className="w-[24%] px-3 py-2 text-start">Person&rsquo;s need</th>
                {lens.styles.map(s => <th key={s.key} scope="col" className="px-2 py-2 text-center">{s.letter || '?'} &middot; {s.name || 'New style'}</th>)}
              </tr></thead>
              <tbody>
                {NEEDS.map(n => (
                  <tr key={n} className="border-t border-solid border-author-rule">
                    <th scope="row" className="px-3 py-1.5 text-start font-800">{lens.needs[n].label}</th>
                    {lens.styles.map(s => {
                      const v = lens.fit[n][s.key] ?? 1;
                      const onlyBest = v === 0 && lens.styles.filter(o => (lens.fit[n][o.key] ?? 1) === 0).length === 1;
                      return (
                        <td key={s.key} className={`px-1 py-1 text-center ${v === 0 ? 'bg-author-gain-soft' : ''}`}>
                          <select aria-label={`${s.name || 'New style'} for ${lens.needs[n].label}`} value={v} onChange={e => edit(x => { x.lens.fit[n][s.key] = Number(e.target.value) as 0 | 1 | 2; }, `lens.styles.${s.key}`)}
                            className={`w-full cursor-pointer appearance-none rounded-8 border border-transparent bg-transparent py-1 text-center text-14 font-700 hover:border-author-line-control focus-visible:outline-2 focus-visible:outline-author-primary ${v === 0 ? 'text-author-gain' : v === 2 ? 'text-author-decline' : 'text-author-ink'}`}>
                            {FIT.map((f, k) => <option key={f} value={k} disabled={onlyBest && k !== 0}>{f}</option>)}
                          </select>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="m-0 text-13 text-author-body">Every action&rsquo;s impact is worked out from this table, so changing the lens or a fit here changes what each action does in play. Each need keeps at least one Best style.</p>
        </section>
      </div>
      <Modal open={choose} onOpenChange={setChoose} title="Change lens" width="max-w-160" description={CHANGE_LENS_WARNING}
        footer={<>
          <button type="button" className={BUTTON.primary} disabled={next === lens.id} onClick={() => { edit(x => changeLens(x, next)); setOffer({ kind: 'skills', why: 'lens' }); setChoose(false); }}>Change to {LENS_BY_ID[next].title}</button>
          <button type="button" className={BUTTON.secondary} onClick={() => setChoose(false)}>Keep {LENS_BY_ID[lens.id].title}</button>
        </>}>
        <div className="flex flex-col gap-2 px-6 py-4">
          <label htmlFor="next-lens" className="text-13 font-700 text-author-label">Lens</label>
          <Select id="next-lens" value={next} onChange={e => setNext(e.target.value as LensId)}>
            {LENS_IDS.filter(id => id !== 'client_model' || d.chat.clientDimensions.length >= 2).map(id => <option key={id} value={id}>{LENS_BY_ID[id].title}</option>)}
          </Select>
          <p className="m-0 text-13 text-author-body">{LENS_BY_ID[next].description}</p>
        </div>
      </Modal>
    </TabBody>
  );
}
