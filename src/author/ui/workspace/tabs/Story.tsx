import { useState } from 'react';
import { useAuthor } from '../../../model/store';
import { Avatar, BUTTON, CARD, CardHead, EYEBROW, Field, MarkOf, Segmented, SubTabs, TextArea, TextInput, toneOf } from '../../kit';
import { TabBody, TabHead } from '../Workspace';
import { useRegenerate } from './regenerate';

type Sub = 'company' | 'market' | 'sponsor';

/**
 * Workspace: Story and world (docs/design/genie/Story and StoryIntro): the company and product, the
 * market, the sponsor and the screens participants read before week 1, with a preview of each screen.
 */
export default function Story() {
  const d = useAuthor(s => s.draft);
  const edit = useAuthor(s => s.edit);
  const regen = useRegenerate('story');
  const [sub, setSub] = useState<Sub>('company');
  const [screen, setScreen] = useState(d.story.screens[0]?.key ?? 'welcome');
  const [full, setFull] = useState(false);
  const c = d.story.company, p = d.story.product;
  const tone = (path: string, need = false) => toneOf(d.marks[path], need);
  const current = d.story.screens.find(s => s.key === screen) ?? d.story.screens[0];

  return (
    <TabBody label="Story and world" head={
      <div className="flex flex-col gap-3">
        <TabHead title="Story and world" actions={regen.button}>{sub === 'sponsor' ? 'The sponsor and the screens participants read before week 1.' : 'The company, what it sells, its market and rivals, and the sponsor who sets the scene.'}</TabHead>
        <SubTabs idBase="story" label="Story and world sections" value={sub} onChange={setSub} tabs={[{ value: 'company', label: 'Company and product' }, { value: 'market', label: 'Market and competitors' }, { value: 'sponsor', label: 'Sponsor and intro screens' }]} />
      </div>
    }>
      {regen.note}
      <div id="story-panel" role="tabpanel" aria-labelledby={`story-tab-${sub}`}>
        {sub === 'company' && (
          <div className="grid grid-cols-2 gap-4 max-[1180px]:grid-cols-1">
            <section className={`${CARD} flex flex-col gap-3 p-5`} aria-labelledby="company">
              <CardHead id="company" title="Company"><MarkOf path="story.company.name" /></CardHead>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Name" required>{id => <TextInput id={id} tone={tone('story.company.name', !c.name)} value={c.name} onChange={e => edit(x => { x.story.company.name = e.target.value; }, 'story.company.name')} />}</Field>
                <Field label="Headquarters" optional>{id => <TextInput id={id} tone={tone('story.company.hq')} value={c.hq} onChange={e => edit(x => { x.story.company.hq = e.target.value; }, 'story.company.hq')} />}</Field>
              </div>
              <Field label="What it does">{id => <TextArea id={id} rows={3} tone={tone('story.company.about')} value={c.about} onChange={e => edit(x => { x.story.company.about = e.target.value; }, 'story.company.about')} />}</Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Your team">{id => <TextInput id={id} tone={tone('story.company.team')} value={c.team} onChange={e => edit(x => { x.story.company.team = e.target.value; }, 'story.company.team')} />}</Field>
                <Field label="Office image" optional>{id => <TextInput id={id} tone={tone('story.company.office')} value={c.office} onChange={e => edit(x => { x.story.company.office = e.target.value; }, 'story.company.office')} />}</Field>
              </div>
              <Field label="Logo" optional>{id => (
                <div className="flex flex-wrap items-center gap-2">
                  <span aria-hidden="true" className="flex size-11 items-center justify-center rounded-10 bg-author-primary-soft text-16 font-800 text-author-primary">{c.logo || c.name.slice(0, 2).toUpperCase()}</span>
                  <TextInput id={id} className="max-w-24" aria-label="Logo initials" value={c.logo} onChange={e => edit(x => { x.story.company.logo = e.target.value.slice(0, 3); }, 'story.company.logo')} />
                  <label className={`${BUTTON.secondary} has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-author-primary`}>Upload<input type="file" accept="image/*" className="sr-only" onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) edit(x => { x.story.company.logo = f.name.slice(0, 3).toUpperCase(); }, 'story.company.logo'); }} /></label>
                  <button type="button" className={BUTTON.koraOutline} onClick={() => edit(x => { x.story.company.logo = x.story.company.name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase(); }, 'story.company.logo', 'ai')}>Create with Kora</button>
                </div>
              )}</Field>
            </section>
            <section className={`${CARD} flex flex-col gap-3 p-5`} aria-labelledby="product">
              <CardHead id="product" title="Product"><MarkOf path="story.product.name" /></CardHead>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Product name" required>{id => <TextInput id={id} tone={tone('story.product.name')} value={p.name} onChange={e => edit(x => { x.story.product.name = e.target.value; }, 'story.product.name')} />}</Field>
                <Field label="Average deal value" need={!p.dealValue} mark="story.product.dealValue">{id => (
                  <TextInput id={id} inputMode="decimal" tone={tone('story.product.dealValue', !p.dealValue)} placeholder="For example 30,000" value={p.dealValue ?? ''}
                    onChange={e => { const v = Number(e.target.value.replace(/[^\d.]/g, '')); edit(x => { x.story.product.dealValue = v > 0 ? v : null; }, 'story.product.dealValue'); }} />
                )}</Field>
              </div>
              <Field label="In one line">{id => <TextInput id={id} tone={tone('story.product.oneLine')} value={p.oneLine} onChange={e => edit(x => { x.story.product.oneLine = e.target.value; }, 'story.product.oneLine')} />}</Field>
              <div className="flex flex-col gap-2">
                <div className="flex justify-between gap-2"><span className="text-13 font-700 text-author-label">Selling points</span><span className="text-12 font-600 text-author-muted">Shown as hotspots on the product</span></div>
                {p.points.map((pt, i) => (
                  <div key={i} className="flex gap-2">
                    <TextInput aria-label={`Selling point ${i + 1}`} tone={tone('story.product.points')} value={pt} onChange={e => edit(x => { x.story.product.points[i] = e.target.value; }, 'story.product.points')} />
                    <button type="button" className={BUTTON.secondary} onClick={() => edit(x => { x.story.product.points.splice(i, 1); }, 'story.product.points')}>Remove<span className="sr-only"> selling point {i + 1}</span></button>
                  </div>
                ))}
                <button type="button" className={`${BUTTON.secondary} self-start`} onClick={() => edit(x => { x.story.product.points.push(''); }, 'story.product.points')}>Add a selling point</button>
              </div>
              <Field label="Product view" optional>{() => (
                <Segmented label="Product view" value={p.view} onChange={v => edit(x => { x.story.product.view = v; }, 'story.product.view')} options={[{ value: 'model', label: '3D model from the library' }, { value: 'photos', label: 'Photos' }, { value: 'none', label: 'None' }]} />
              )}</Field>
            </section>
          </div>
        )}
        {sub === 'market' && (
          <section className={`${CARD} flex flex-col gap-3 p-5`} aria-labelledby="market">
            <CardHead id="market" title="Market and competitors"><MarkOf path="story.market.rivals" /></CardHead>
            <Field label="Who the team sells to">{id => <TextInput id={id} value={d.story.market.customers} onChange={e => edit(x => { x.story.market.customers = e.target.value; }, 'story.market.customers')} />}</Field>
            {d.story.market.rivals.map((r, i) => (
              <div key={i} className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto] items-end gap-3 max-[900px]:grid-cols-1">
                <Field label={`Rival ${i + 1}`}>{id => <TextInput id={id} tone={tone('story.market.rivals')} value={r.name} onChange={e => edit(x => { x.story.market.rivals[i].name = e.target.value; }, 'story.market.rivals')} />}</Field>
                <Field label="How they compete">{id => <TextInput id={id} tone={tone('story.market.rivals')} value={r.angle} onChange={e => edit(x => { x.story.market.rivals[i].angle = e.target.value; }, 'story.market.rivals')} />}</Field>
                <button type="button" className={BUTTON.secondary} onClick={() => edit(x => { x.story.market.rivals.splice(i, 1); }, 'story.market.rivals')}>Remove<span className="sr-only"> rival {i + 1}</span></button>
              </div>
            ))}
            <button type="button" className={`${BUTTON.secondary} self-start`} onClick={() => edit(x => { x.story.market.rivals.push({ name: '', angle: '' }); }, 'story.market.rivals')}>Add a rival</button>
          </section>
        )}
        {sub === 'sponsor' && current && (
          <div className="grid grid-cols-[17rem_minmax(0,1fr)] gap-4 max-[1180px]:grid-cols-1">
            <section className={`${CARD} flex flex-col gap-2 p-5`} aria-labelledby="screens">
              <h2 id="screens" className="m-0 text-16 font-800">Intro screens, in order</h2>
              <ol className="m-0 flex list-none flex-col gap-2 p-0">
                {d.story.screens.map((s, i) => (
                  <li key={s.key} className="flex items-center gap-1">
                    <button type="button" aria-current={s.key === screen || undefined} onClick={() => setScreen(s.key)}
                      className={`min-h-10.5 flex-1 cursor-pointer rounded-10 border border-solid px-3 text-start text-13 font-700 ${s.key === screen ? 'border-author-primary bg-author-primary-faint' : 'border-author-line-control bg-author-surface'} focus-visible:outline-2 focus-visible:outline-author-primary`}>
                      {i + 1} &middot; {s.title}
                    </button>
                    <span className="flex flex-col">
                      <button type="button" className="cursor-pointer border-0 bg-transparent px-1 text-12 text-author-label disabled:opacity-30 focus-visible:outline-2 focus-visible:outline-author-primary" disabled={i === 0} aria-label={`Move ${s.title} up`} onClick={() => edit(x => { const a = x.story.screens; [a[i - 1], a[i]] = [a[i], a[i - 1]]; }, 'story.screens')}>&#9650;</button>
                      <button type="button" className="cursor-pointer border-0 bg-transparent px-1 text-12 text-author-label disabled:opacity-30 focus-visible:outline-2 focus-visible:outline-author-primary" disabled={i === d.story.screens.length - 1} aria-label={`Move ${s.title} down`} onClick={() => edit(x => { const a = x.story.screens; [a[i + 1], a[i]] = [a[i], a[i + 1]]; }, 'story.screens')}>&#9660;</button>
                    </span>
                  </li>
                ))}
              </ol>
              <button type="button" className={`${BUTTON.secondary} justify-start`} onClick={() => edit(x => { const key = `screen_${x.story.screens.length + 1}`; x.story.screens.push({ key, title: 'New screen', body: '' }); setScreen(key); })}>Add a screen</button>
              <p className="m-0 text-12 text-author-muted">Use the arrows to reorder. Participants see these before week 1.</p>
            </section>
            <section className={`${CARD} flex flex-col gap-3 p-5`} aria-labelledby="screen-title">
              <CardHead id="screen-title" title={current.title}>
                <MarkOf path={`story.screens.${current.key}`} />
                <button type="button" className={BUTTON.secondary} aria-pressed={full} onClick={() => setFull(!full)}>{full ? 'Back to editing' : 'Preview full screen'}</button>
              </CardHead>
              {current.key === 'welcome' && (
                <div className="grid grid-cols-3 gap-3 max-[1000px]:grid-cols-1">
                  <Field label="Sponsor" required>{id => <TextInput id={id} tone={tone('story.sponsor.name', !d.story.sponsor.name)} value={d.story.sponsor.name} onChange={e => edit(x => { x.story.sponsor.name = e.target.value; }, 'story.sponsor.name')} />}</Field>
                  <Field label="Title">{id => <TextInput id={id} tone={tone('story.sponsor.title')} value={d.story.sponsor.title} onChange={e => edit(x => { x.story.sponsor.title = e.target.value; }, 'story.sponsor.title')} />}</Field>
                  <Field label="Voice" optional>{id => <TextInput id={id} tone={tone('story.sponsor.voice')} value={d.story.sponsor.voice} onChange={e => edit(x => { x.story.sponsor.voice = e.target.value; }, 'story.sponsor.voice')} />}</Field>
                </div>
              )}
              {!['welcome', 'product', 'targets', 'team'].includes(current.key) && (
                <Field label="Screen title">{id => <TextInput id={id} value={current.title} onChange={e => edit(x => { const s = x.story.screens.find(y => y.key === current.key); if (s) s.title = e.target.value; }, `story.screens.${current.key}`)} />}</Field>
              )}
              {!full && <Field label={current.key === 'welcome' ? 'Letter' : 'What participants read'}>{id => <TextArea id={id} rows={6} tone={tone(`story.screens.${current.key}`)} value={current.body} onChange={e => edit(x => { const s = x.story.screens.find(y => y.key === current.key); if (s) s.body = e.target.value; }, `story.screens.${current.key}`)} />}</Field>}
              <figure aria-label={`Preview: ${current.title}`} className={`m-0 flex items-center gap-6 rounded-16 bg-author-preview p-6 ${full ? 'min-h-110' : 'min-h-60'}`}>
                {current.key === 'welcome' && <Avatar name={d.story.sponsor.name || 'S'} size={full ? 140 : 96} />}
                <div className="flex min-w-0 flex-col gap-2">
                  <span className={`${EYEBROW} text-brand-cyber-cyan`}>{current.key === 'welcome' ? 'A message from your sponsor' : current.title}</span>
                  {current.key === 'welcome' && <><b className="text-24 text-brand-pale-lavender">{d.story.sponsor.name}</b><span className="text-13 text-brand-pale-lavender opacity-80">{d.story.sponsor.title}, {d.story.company.name}</span></>}
                  {current.body.split(/\n\s*\n/).slice(0, full ? 6 : 2).map((para, i) => <p key={i} className="m-0 text-14 leading-[1.55] text-brand-pale-lavender">{para}</p>)}
                </div>
              </figure>
            </section>
          </div>
        )}
      </div>
    </TabBody>
  );
}
