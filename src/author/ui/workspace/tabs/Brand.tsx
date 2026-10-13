import { contrastRatio, parseColor, toRgb } from '../../../../theme/color';
import { FONTS } from '../../../../theme/schema';
import { useAuthor } from '../../../model/store';
import { Badge, BUTTON, CARD, CardHead, Field, Segmented, Select, SubTabs, TextInput } from '../../kit';
import { TabBody, TabHead } from '../Workspace';

const WHITE = { r: 1, g: 1, b: 1, alpha: 1 };
const NIGHT = { r: 0.04, g: 0.03, b: 0.11, alpha: 1 };

/** How a brand color reads as text on both looks: the theme loader darkens or lightens it when it must. */
export function readability(hex: string): { ok: boolean; text: string } {
  const c = parseColor(hex);
  if (!c) return { ok: false, text: 'Not a color: use #RRGGBB' };
  const rgb = toRgb(c);
  const light = contrastRatio(rgb, WHITE), dark = contrastRatio(rgb, NIGHT);
  return light >= 4.5 && dark >= 4.5 ? { ok: true, text: 'Readable on every surface' } : { ok: false, text: `Adjusted slightly so text stays readable (${(Math.min(light, dark)).toFixed(1)}:1 as is)` };
}

/**
 * Workspace: Brand and theme (docs/design/genie/Brand): how the simulation looks for this client. Left
 * empty, it is the KNOLSKAPE look. Colors are checked for readability the way the theme loader corrects
 * them (D72); status colors stay fixed so gains and warnings keep their meaning.
 */
export default function Brand() {
  const d = useAuthor(s => s.draft);
  const edit = useAuthor(s => s.edit);
  const b = d.brand;
  const set = <K extends keyof typeof b>(k: K, v: (typeof b)[K]) => edit(x => { x.brand[k] = v; }, `brand.${k}`);
  const client = b.from === 'client';
  const main = readability(b.main), second = readability(b.second);
  return (
    <TabBody label="Brand and theme" head={<TabHead title="Brand and theme">How the simulation looks for this client. Everything falls back to the KNOLSKAPE look if left empty.</TabHead>}>
      <div className="grid grid-cols-2 gap-4 max-[1180px]:grid-cols-1">
        <section className={`${CARD} flex flex-col gap-3 p-5`} aria-labelledby="theme">
          <CardHead id="theme" title="Theme"><Badge kind={client ? 'you' : 'default'}>{client ? 'Client theme' : 'KNOLSKAPE default'}</Badge></CardHead>
          <Field label="Start from">{() => <Segmented label="Start from" value={b.from} onChange={v => edit(x => { x.brand.from = v; if (v === 'knolskape') { x.brand.main = '#249DFF'; x.brand.second = '#43D6E8'; x.brand.font = 'Manrope'; } }, 'brand.from')} options={[{ value: 'knolskape', label: 'KNOLSKAPE default' }, { value: 'client', label: 'Client brand' }]} />}</Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Brand name">{id => <TextInput id={id} disabled={!client} value={b.name} onChange={e => set('name', e.target.value)} />}</Field>
            <Field label="Logo">{id => (
              <label className={`${BUTTON.secondary} min-h-10.5 justify-center has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-author-primary ${client ? '' : 'pointer-events-none opacity-50'}`}>
                {b.logo ? `${b.logo} · replace` : 'Upload a logo'}
                <input id={id} type="file" accept="image/svg+xml,image/png,image/webp" className="sr-only" disabled={!client} onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) set('logo', f.name); }} />
              </label>
            )}</Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {([['main', 'Main color', main], ['second', 'Second color', second]] as const).map(([k, label, r]) => (
              <Field key={k} label={label} hint={<span className={`font-700 ${r.ok ? 'text-author-gain' : 'text-author-need'}`}>{r.text}</span>}>{id => (
                <div className="flex gap-2">
                  <input type="color" aria-label={`${label}, picker`} disabled={!client} value={/^#[0-9a-f]{6}$/i.test(b[k]) ? b[k] : '#000000'} onChange={e => set(k, e.target.value.toUpperCase())} className="h-10.5 w-11 cursor-pointer rounded-10 border border-solid border-author-line-control bg-author-surface p-1 disabled:opacity-50" />
                  <TextInput id={id} disabled={!client} value={b[k]} onChange={e => set(k, e.target.value)} />
                </div>
              )}</Field>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Font">{id => <Select id={id} disabled={!client} value={b.font} onChange={e => set('font', e.target.value)}>{Object.keys(FONTS).map(f => <option key={f}>{f}</option>)}</Select>}</Field>
            <Field label="Look">{() => <Segmented size="sm" label="Look" value={b.look} onChange={v => set('look', v)} options={[{ value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light' }, { value: 'participant', label: 'Participant chooses' }]} />}</Field>
          </div>
          <details className="rounded-12 border border-solid border-author-line p-3">
            <summary className="cursor-pointer text-15 font-800">Advanced: corner style, surfaces, report cover</summary>
            <p className="m-0 mt-2 text-13 text-author-body">The theme file takes a radius scale, four surfaces and a report cover color (README, Themes). The loader checks every color against the readability pairs before it applies them.</p>
          </details>
        </section>
        <section className={`${CARD} flex flex-col gap-3 p-5`} aria-labelledby="preview">
          <CardHead id="preview" title="Preview">
            <SubTabs idBase="brand" label="Preview" value={b.preview} onChange={v => set('preview', v)} tabs={[{ value: 'board', label: 'Board' }, { value: 'report', label: 'Report' }]} />
          </CardHead>
          <figure id="brand-panel" role="tabpanel" aria-labelledby={`brand-tab-${b.preview}`} className={`m-0 flex min-h-96 flex-col gap-2 rounded-16 p-3 ${b.look === 'light' ? 'bg-author-canvas' : 'bg-author-preview'}`} style={{ fontFamily: FONTS[b.font as keyof typeof FONTS]?.stack }}>
            <figcaption className="sr-only">{b.preview === 'board' ? 'The board' : 'The report cover'} in {client ? b.name : 'the KNOLSKAPE'} theme</figcaption>
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-6 text-11 font-800" style={{ background: b.second, color: 'var(--il-color-brand-deep-space)' }}>{(b.name || 'KS').slice(0, 2).toUpperCase()}</span>
              <b className={`text-14 ${b.look === 'light' ? 'text-author-ink' : 'text-brand-pale-lavender'}`}>{client ? b.name : 'iLead'}</b>
              <span className="flex-1" />
              {b.preview === 'board' && <span className="rounded-8 px-2.5 py-1 text-12 font-800" style={{ background: b.main, color: 'var(--il-color-brand-deep-space)' }}>End week 1</span>}
            </div>
            {b.preview === 'board' ? (
              <>
                <div className="grid grid-cols-3 gap-2">{[0, 1, 2].map(i => <span key={i} className={`h-10 rounded-8 ${b.look === 'light' ? 'bg-author-surface' : 'bg-author-preview-tile'}`} />)}</div>
                <div className="grid flex-1 grid-cols-5 gap-2">{[0, 1, 2, 3, 4].map(i => <span key={i} className={`rounded-8 ${b.look === 'light' ? 'bg-author-surface' : 'bg-author-preview-tile'}`} />)}</div>
              </>
            ) : (
              <div className="flex flex-1 flex-col justify-end gap-2 rounded-12 p-5" style={{ background: `linear-gradient(135deg, ${b.main}, ${b.second})` }}>
                <b className="text-22" style={{ color: 'var(--il-color-brand-deep-space)' }}>Leadership report</b>
                <span className="text-14" style={{ color: 'var(--il-color-brand-deep-space)' }}>{d.title}</span>
              </div>
            )}
          </figure>
          <p className="m-0 text-13 text-author-body">Colors are checked for readability automatically. Status colors for gains and warnings stay fixed so they keep their meaning.</p>
        </section>
      </div>
    </TabBody>
  );
}
