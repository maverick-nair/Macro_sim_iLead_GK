import { useState } from 'react';
import { isImageRef } from '../../../../engine/assets';
import { OFFICES } from '../../../model/seed';
import { useAuthor } from '../../../model/store';
import { AboutThis } from '../../AboutThis';
import { ImageUpload } from '../../ImageUpload';
import { Avatar, BUTTON, CARD, CardHead, EYEBROW, Field, MarkOf, Segmented, SubTabs, TEXT_MAX, TextArea, TextInput, toneOf } from '../../kit';
import { TabBody, TabHead } from '../Workspace';
import { useRenameOffer } from '../UpdatePrompt';
import { useRegenerate } from './regenerate';

type Sub = 'company' | 'market' | 'sponsor';

/** A spot coordinate as typed: a whole percent from 0 to 100, or none when empty. */
const percent = (v: string): number | null => (v.trim() === '' || !Number.isFinite(Number(v)) ? null : Math.min(100, Math.max(0, Math.round(Number(v)))));

/**
 * Workspace: Story and world (docs/design/genie/Story and StoryIntro): the company and product, the
 * market, the sponsor and the screens participants read before week 1, with a preview of each screen.
 */
export default function Story() {
  const d = useAuthor(s => s.draft);
  const edit = useAuthor(s => s.edit);
  const renameCompany = useRenameOffer('company'), renameProduct = useRenameOffer('product'), renameSponsor = useRenameOffer('sponsor');
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
                <Field label="Name" required>{id => <TextInput id={id} {...renameCompany} tone={tone('story.company.name', !c.name)} value={c.name} onChange={e => edit(x => { x.story.company.name = e.target.value; }, 'story.company.name')} />}</Field>
                <Field label="Headquarters" optional>{id => <TextInput id={id} tone={tone('story.company.hq')} value={c.hq} onChange={e => edit(x => { x.story.company.hq = e.target.value; }, 'story.company.hq')} />}</Field>
              </div>
              <Field label="What it does">{id => <TextArea id={id} rows={3} tone={tone('story.company.about')} value={c.about} onChange={e => edit(x => { x.story.company.about = e.target.value; }, 'story.company.about')} />}</Field>
              <Field label="Your team">{id => <TextInput id={id} tone={tone('story.company.team')} value={c.team} onChange={e => edit(x => { x.story.company.team = e.target.value; }, 'story.company.team')} />}</Field>
              <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
                <legend className="mb-1 text-13 font-700 text-author-label">Office image <span className="font-600 text-author-muted">(behind every screen participants see)</span></legend>
                <div className="grid grid-cols-3 gap-2">
                  {[...OFFICES.map(o => ({ src: o.src as string, label: o.label })), ...(c.office.startsWith('data:') ? [{ src: c.office, label: 'Your upload' }] : [])].map(o => (
                    <label key={o.label} className={`flex cursor-pointer flex-col gap-1 rounded-10 border-2 border-solid p-1 text-12 font-700 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-author-primary ${c.office === o.src ? 'border-author-primary' : 'border-transparent'}`}>
                      <input type="radio" name="office" className="sr-only" checked={c.office === o.src} onChange={() => edit(x => { x.story.company.office = o.src; }, 'story.company.office')} />
                      <img src={o.src} alt="" className="aspect-video w-full rounded-8 object-cover" />{o.label}
                    </label>
                  ))}
                </div>
                <ImageUpload label="Upload an office photo" maxSide={1600} onImage={src => edit(x => { x.story.company.office = src; }, 'story.company.office')} />
                {c.office.trim() && !isImageRef(c.office) && <p className="m-0 text-12 text-author-muted">Described as "{c.office}": the characters can mention it, and participants see the default office until you pick or upload an image.</p>}
              </fieldset>
              <Field label="Logo" optional hint="Uploaded, it shows next to the iLead wordmark and in onboarding; otherwise the letters do.">{id => (
                <div className="flex flex-wrap items-start gap-2">
                  {c.logoImage
                    ? <img src={c.logoImage} alt={`${c.name} logo`} className="size-11 rounded-10 bg-author-primary-soft object-contain" />
                    : <span aria-hidden="true" className="flex size-11 items-center justify-center rounded-10 bg-author-primary-soft text-16 font-800 text-author-primary">{c.logo || c.name.slice(0, 2).toUpperCase()}</span>}
                  <TextInput id={id} className="max-w-24" aria-label="Logo initials" value={c.logo} onChange={e => edit(x => { x.story.company.logo = e.target.value.slice(0, 3); }, 'story.company.logo')} />
                  <ImageUpload label={c.logoImage ? 'Replace the logo' : 'Upload a logo'} maxSide={512} onImage={src => edit(x => { x.story.company.logoImage = src; }, 'story.company.logoImage')} />
                  {c.logoImage && <button type="button" className={BUTTON.secondary} onClick={() => edit(x => { x.story.company.logoImage = ''; }, 'story.company.logoImage')}>Remove the logo</button>}
                  <button type="button" className={BUTTON.koraOutline} onClick={() => edit(x => { x.story.company.logo = x.story.company.name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase(); }, 'story.company.logo', 'ai')}>Create with Kora</button>
                </div>
              )}</Field>
            </section>
            <section className={`${CARD} flex flex-col gap-3 p-5`} aria-labelledby="product">
              <CardHead id="product" title="Product"><MarkOf path="story.product.name" /></CardHead>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Product name" required need={!p.name.trim()}>{id => <TextInput id={id} {...renameProduct} tone={tone('story.product.name')} value={p.name} onChange={e => edit(x => { x.story.product.name = e.target.value; }, 'story.product.name')} />}</Field>
                <Field label="Average deal value" need={!p.dealValue} mark="story.product.dealValue">{id => (
                  <TextInput id={id} inputMode="decimal" tone={tone('story.product.dealValue', !p.dealValue)} placeholder="For example 30,000" value={p.dealValue ?? ''}
                    onChange={e => { const v = Number(e.target.value.replace(/[^\d.]/g, '')); edit(x => { x.story.product.dealValue = v > 0 ? v : null; }, 'story.product.dealValue'); }} />
                )}</Field>
              </div>
              <Field label="In one line">{id => <TextInput id={id} maxLength={TEXT_MAX} tone={tone('story.product.oneLine')} value={p.oneLine} onChange={e => edit(x => { x.story.product.oneLine = e.target.value; }, 'story.product.oneLine')} />}</Field>
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
              <p className="m-0 text-12 text-author-muted">{p.view === 'none' ? 'Participants see no product scene in onboarding.' : 'Participants see the product, its line and its selling points in a portfolio scene during onboarding.'}</p>
              {p.view === 'photos' && (
                <div className="flex flex-wrap items-start gap-3">
                  {p.image && <img src={p.image} alt={p.name} className="h-20 w-28 rounded-10 bg-author-track object-cover" />}
                  <ImageUpload label={p.image ? 'Replace the photo' : 'Upload a product photo'} maxSide={1024} onImage={src => edit(x => { x.story.product.image = src; }, 'story.product.image')} />
                </div>
              )}
            </section>
            {p.view !== 'none' && (
              <section className={`${CARD} col-span-2 flex flex-col gap-3 p-5 max-[1180px]:col-span-1`} aria-labelledby="portfolio">
                <CardHead id="portfolio" title="Portfolio scene"><MarkOf path="story.product.features" /></CardHead>
                <AboutThis
                  what="How the product appears in the product portfolio screen before week 1: its code, kind, tagline, who it is for and up to four features placed on its photo."
                  why="Participants coach deals on this product all run long. Knowing what it is, who buys it and how it is won makes their conversations with the team concrete."
                  paths={['world.products[].code', 'world.products[].features[]', 'world.products[].dealValue']}
                  experience="A product screen in onboarding: the code large, the kind and tagline, who it is for, the features as tabs and as numbered spots on the photo, and the specs with the typical deal. Nothing on it is scored."
                  preview="onboarding" />
                <div className="grid grid-cols-4 gap-3 max-[1180px]:grid-cols-2">
                  <Field label="Short code" optional hint="Shown large, for example B10.">{id => <TextInput id={id} maxLength={8} tone={tone('story.product.code')} value={p.code} onChange={e => edit(x => { x.story.product.code = e.target.value.slice(0, 8); }, 'story.product.code')} />}</Field>
                  <Field label="Kind" optional hint="For example Commercial.">{id => <TextInput id={id} maxLength={40} tone={tone('story.product.kind')} value={p.kind} onChange={e => edit(x => { x.story.product.kind = e.target.value; }, 'story.product.kind')} />}</Field>
                  <Field label="Tagline" optional className="col-span-2">{id => <TextInput id={id} maxLength={120} tone={tone('story.product.tagline')} value={p.tagline} onChange={e => edit(x => { x.story.product.tagline = e.target.value; }, 'story.product.tagline')} />}</Field>
                </div>
                <Field label="Who it is for" optional>{id => <TextInput id={id} maxLength={240} tone={tone('story.product.audience')} value={p.audience} onChange={e => edit(x => { x.story.product.audience = e.target.value; }, 'story.product.audience')} />}</Field>
                {p.view === 'photos' && p.image && (
                  <Field label="Describe the photo" optional hint="Read out by screen readers in place of the photo.">{id => <TextInput id={id} maxLength={200} tone={tone('story.product.imageAlt')} value={p.imageAlt} onChange={e => edit(x => { x.story.product.imageAlt = e.target.value; }, 'story.product.imageAlt')} />}</Field>
                )}
                <fieldset className="m-0 flex flex-col gap-3 border-0 p-0">
                  <legend className="mb-1 text-13 font-700 text-author-label">Features <span className="font-600 text-author-muted">(up to four; with none, the first four selling points show)</span></legend>
                  {p.features.map((f, i) => (
                    <div key={i} className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)_6rem_6rem_auto] items-end gap-3 max-[1180px]:grid-cols-2">
                      <Field label={`Feature ${i + 1} title`}>{id => <TextInput id={id} maxLength={40} tone={tone('story.product.features')} value={f.title} onChange={e => edit(x => { x.story.product.features[i].title = e.target.value; }, 'story.product.features')} />}</Field>
                      <Field label={`Feature ${i + 1} text`}>{id => <TextInput id={id} maxLength={300} tone={tone('story.product.features')} value={f.text} onChange={e => edit(x => { x.story.product.features[i].text = e.target.value; }, 'story.product.features')} />}</Field>
                      <Field label="Spot across" optional hint="% from the left">{id => <TextInput id={id} inputMode="numeric" value={f.x ?? ''} onChange={e => edit(x => { x.story.product.features[i].x = percent(e.target.value); }, 'story.product.features')} />}</Field>
                      <Field label="Spot down" optional hint="% from the top">{id => <TextInput id={id} inputMode="numeric" value={f.y ?? ''} onChange={e => edit(x => { x.story.product.features[i].y = percent(e.target.value); }, 'story.product.features')} />}</Field>
                      <button type="button" className={BUTTON.secondary} onClick={() => edit(x => { x.story.product.features.splice(i, 1); }, 'story.product.features')}>Remove<span className="sr-only"> feature {i + 1}</span></button>
                    </div>
                  ))}
                  {p.features.length < 4 && <button type="button" className={`${BUTTON.secondary} self-start`} onClick={() => edit(x => { x.story.product.features.push({ title: '', text: '', x: null, y: null }); }, 'story.product.features')}>Add a feature</button>}
                </fieldset>
              </section>
            )}
          </div>
        )}
        {sub === 'market' && (
          <section className={`${CARD} flex flex-col gap-3 p-5`} aria-labelledby="market">
            <CardHead id="market" title="Market and competitors"><MarkOf path="story.market.rivals" /></CardHead>
            <Field label="Who the team sells to">{id => <TextInput id={id} value={d.story.market.customers} onChange={e => edit(x => { x.story.market.customers = e.target.value; }, 'story.market.customers')} />}</Field>
            {d.story.market.rivals.map((r, i) => (
              <div key={i} className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto] items-end gap-3 max-[900px]:grid-cols-1">
                <Field label={`Rival ${i + 1}`}>{id => <TextInput id={id} tone={tone('story.market.rivals')} value={r.name} onChange={e => edit(x => { x.story.market.rivals[i].name = e.target.value; }, 'story.market.rivals')} />}</Field>
                <Field label="How they compete">{id => <TextInput id={id} maxLength={TEXT_MAX} tone={tone('story.market.rivals')} value={r.angle} onChange={e => edit(x => { x.story.market.rivals[i].angle = e.target.value; }, 'story.market.rivals')} />}</Field>
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
                    <span className="flex gap-0.5">
                      <button type="button" className="flex size-7 cursor-pointer items-center justify-center rounded-6 border-0 bg-transparent text-12 text-author-label hover:bg-author-track disabled:opacity-30 focus-visible:outline-2 focus-visible:outline-author-primary" disabled={i === 0} aria-label={`Move ${s.title} up`} onClick={() => edit(x => { const a = x.story.screens; [a[i - 1], a[i]] = [a[i], a[i - 1]]; }, 'story.screens')}>&#9650;</button>
                      <button type="button" className="flex size-7 cursor-pointer items-center justify-center rounded-6 border-0 bg-transparent text-12 text-author-label hover:bg-author-track disabled:opacity-30 focus-visible:outline-2 focus-visible:outline-author-primary" disabled={i === d.story.screens.length - 1} aria-label={`Move ${s.title} down`} onClick={() => edit(x => { const a = x.story.screens; [a[i + 1], a[i]] = [a[i], a[i + 1]]; }, 'story.screens')}>&#9660;</button>
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
                  <Field label="Sponsor" required>{id => <TextInput id={id} {...renameSponsor} tone={tone('story.sponsor.name', !d.story.sponsor.name)} value={d.story.sponsor.name} onChange={e => edit(x => { x.story.sponsor.name = e.target.value; }, 'story.sponsor.name')} />}</Field>
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
