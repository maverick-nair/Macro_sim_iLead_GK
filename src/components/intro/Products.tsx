import { useEffect, useId, useRef, useState } from 'react';
import { useI18n } from '../../i18n';
import { useMoney } from '../../i18n/money';
import { onRovingKey } from '../roving';
import { Arrow, EYEBROW, FOCUS, PRIMARY, QUIET_BUTTON } from './IntroHeader';
import type { IntroProduct } from './intro';
import { unitWords, type SalesUnit } from '../../engine/units';

export interface ProductsProps {
  products: IntroProduct[];
  /** The organisation, over the list. */
  organisation: string | null;
  /** The storyline's sales unit (D227): "Know it well enough to coach an outlet order", "Typical outlet order". Left out, deal. */
  unit?: SalesUnit;
  onNext: () => void;
}

/** Where the four numbered spots sit on a product photo when the storyline does not place them (D221): evenly, in reading order. */
const SPOTS: Array<[string, string]> = [['22%', '28%'], ['68%', '20%'], ['36%', '66%'], ['76%', '58%']];

const Tick = ({ on }: { on: boolean }) => (
  <span aria-hidden="true" className={`flex size-6 flex-none items-center justify-center rounded-round border ${on ? 'border-transparent bg-accent-secondary text-fg-on-accent' : 'border-line-control'}`}>
    {on && <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>}
  </span>
);

/**
 * The product portfolio (D219, the canvas's Portfolio): the models in a list with an explored tick and how many
 * have been explored; the model's kind and number, short code, name, tagline and who it is for; its features as
 * tabs with their panel, and the same features as numbered spots on its photo, where the storyline places them
 * (D221); its specs and typical deal in a strip; Next model and See your objectives. Every word and image is the
 * storyline's; a storyline without named features shows its first four specs as the features, as before.
 */
export function Products({ products, organisation, unit, onNext }: ProductsProps) {
  const { t, number } = useI18n();
  const units = unitWords(t, unit);
  const money = useMoney();
  const [at, setAt] = useState(0);
  const [point, setPoint] = useState(0);
  const [seen, setSeen] = useState<Set<number>>(() => new Set([0]));
  const ids = { list: useId(), tabs: useId(), panel: useId() };
  const code = useRef<HTMLHeadingElement>(null);
  const p = products[Math.min(at, products.length - 1)];
  const open = (i: number) => { setAt(i); setPoint(0); setSeen(s => new Set([...s, i])); };
  const first = useRef(true);
  useEffect(() => { if (first.current) { first.current = false; return; } code.current?.focus({ preventScroll: true }); }, [at]);
  const next = products[(at + 1) % products.length];
  const explored = seen.size;
  return (
    <main className="grid min-h-0 flex-1 grid-cols-(--il-intro-products-columns) tablet:grid-cols-1">
      <h1 className="sr-only">{t('intro.products.title')}</h1>
      <nav aria-labelledby={ids.list} className="flex min-h-0 flex-col gap-4 overflow-y-auto border-e border-line-default px-4 py-6">
        <div className="flex flex-col gap-1 px-2">
          {organisation && <p className={EYEBROW}>{organisation}</p>}
          <h2 id={ids.list} className="m-0 text-22 font-700">{t('intro.products.title')}</h2>
          <p className="m-0 text-14 text-fg-secondary">{t('intro.products.intro', units)}</p>
        </div>
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {products.map((x, i) => (
            <li key={x.name}>
              <button type="button" onClick={() => open(i)} aria-current={i === at ? 'true' : undefined}
                className={`flex w-full cursor-pointer items-center gap-3 rounded-12 border p-2 text-start text-fg-primary ${i === at ? 'border-accent-secondary bg-accent-soft' : 'border-transparent bg-transparent hover:bg-surface-raised'} ${FOCUS}`}>
                {x.image ? <img src={x.image} alt="" className="size-14 flex-none rounded-8 object-cover" /> : <span aria-hidden="true" className="flex size-14 flex-none items-center justify-center rounded-8 bg-surface-raised text-15 font-700">{x.code}</span>}
                <span className="flex min-w-0 flex-1 flex-col"><b className="truncate text-15">{x.name}</b>{(x.kind ?? x.line) && <span className="truncate text-13 text-fg-secondary">{x.kind ?? x.line}</span>}</span>
                <Tick on={seen.has(i)} /><span className="sr-only">{t('intro.products.seen', { seen: seen.has(i) ? 'yes' : 'no' })}</span>
              </button>
            </li>
          ))}
        </ul>
        <div className="flex flex-col gap-1.5 px-2">
          <span className="flex justify-between text-13"><span>{t('intro.products.explored')}</span><span className="tabular-nums">{t('intro.products.exploredCount', { n: number(explored), total: number(products.length) })}</span></span>
          <span role="img" aria-label={t('intro.products.exploredAria', { n: explored, total: products.length })} className="block h-1.5 rounded-3 bg-track">
            <span className="block h-full rounded-3 bg-accent-secondary" style={{ width: `${Math.round((explored / products.length) * 100)}%` }} />
          </span>
        </div>
        <p className="mt-auto px-2 text-13 text-fg-secondary">{t('intro.products.note')}</p>
      </nav>
      <div className="flex min-h-0 flex-col">
        <div className="grid min-h-0 flex-1 grid-cols-(--il-intro-model-columns) items-center gap-10 overflow-y-auto px-12 py-8 tablet:grid-cols-1 tablet:px-6">
          <section aria-labelledby={`${ids.list}-code`} className="flex flex-col gap-3">
            {(p.kind ?? p.line) && <p className="m-0 text-13 uppercase tracking-(--il-desk-band-eyebrow-tracking) text-fg-secondary">{p.kind ? t('intro.products.kind', { kind: p.kind, n: String(at + 1).padStart(2, '0') }) : p.line}</p>}
            <h2 id={`${ids.list}-code`} ref={code} tabIndex={-1} className="m-0 flex flex-col outline-0">
              <span aria-hidden="true" className="text-(length:--il-intro-code-size) leading-none font-800 tracking-(--il-tracking-logo)">{p.code}</span>
              <span className="text-26 font-600">{p.name}</span>
            </h2>
            {p.kind && p.line && <p className="m-0 text-20 leading-snug">{p.line}</p>}
            {p.audience && <p className="m-0 text-15 text-fg-secondary"><b className="text-fg-primary">{t('intro.products.audience')}</b> {p.audience}</p>}
            {p.features.length > 0 && (
              <>
                <div role="tablist" aria-label={t('intro.products.points', { name: p.name })} className="mt-3 flex flex-wrap gap-2">
                  {p.features.map((x, i) => (
                    <button key={i} type="button" role="tab" id={`${ids.tabs}-${i}`} aria-selected={i === point} aria-controls={ids.panel} tabIndex={i === point ? 0 : -1}
                      onClick={() => setPoint(i)} onKeyDown={e => onRovingKey(e, i, p.features.length, setPoint)}
                      title={x.title}
                      className={`min-h-11 cursor-pointer rounded-10 border px-3 text-14 ${i === point ? 'border-accent-secondary bg-accent-soft font-700 text-fg-primary' : 'border-line-default bg-transparent text-fg-secondary'} ${FOCUS}`}>
                      <span className="me-1.5 tabular-nums text-12">{String(i + 1).padStart(2, '0')}</span><span className="inline-block max-w-60 truncate align-bottom">{x.title}</span>
                    </button>
                  ))}
                </div>
                <div role="tabpanel" id={ids.panel} aria-labelledby={`${ids.tabs}-${point}`} tabIndex={0} className={`border-s-2 border-accent-secondary ps-4 text-16 leading-relaxed ${FOCUS}`}>
                  {p.features[point]?.text}
                </div>
              </>
            )}
          </section>
          <figure className="relative m-0 aspect-square max-h-full w-full overflow-hidden tablet:max-h-none tablet:size-120 tablet:max-w-full tablet:justify-self-center rounded-16 border border-line-default bg-surface-raised">
            {p.image ? <img src={p.image} alt={p.imageAlt ?? t('intro.products.photo', { name: p.name })} className="absolute inset-0 size-full object-cover" />
              : <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center text-110 font-800 text-fg-secondary">{p.code}</span>}
            {p.features.map((x, i) => (
              <button key={i} type="button" onClick={() => setPoint(i)} aria-label={t('intro.products.spot', { n: i + 1, text: x.title })} aria-pressed={i === point}
                className={`absolute flex size-11 -translate-x-1/2 -translate-y-1/2 cursor-pointer items-center justify-center rounded-round border-2 text-13 font-700 tabular-nums rtl:translate-x-1/2 ${i === point ? 'border-transparent bg-accent-secondary text-fg-on-accent' : 'border-line-strong bg-surface-solid text-fg-primary'} ${FOCUS}`}
                style={x.spot ? { insetInlineStart: `${x.spot.x}%`, insetBlockStart: `${x.spot.y}%` } : { insetInlineStart: SPOTS[i][0], insetBlockStart: SPOTS[i][1] }}>
                {String(i + 1).padStart(2, '0')}
              </button>
            ))}
            <figcaption className="absolute start-4 bottom-4 rounded-8 bg-surface-material px-3 py-1.5 text-13">{t('intro.products.hint', { name: p.name })}</figcaption>
          </figure>
        </div>
        <div className="flex flex-none flex-wrap items-center gap-6 border-t border-line-default px-12 py-4 tablet:px-6">
          {(p.specs.length > 0 || p.dealValue !== null) && (
            <ul className="m-0 flex min-w-0 flex-1 list-none flex-wrap gap-x-8 gap-y-1 p-0 text-15 tabular-nums">
              {p.specs.map(s => <li key={s}>{s}</li>)}
              {p.dealValue !== null && <li>{t('intro.products.deal', units)} <b className="text-accent-secondary">{money.compact(p.dealValue)}</b></li>}
            </ul>
          )}
          <span className="ms-auto flex flex-wrap gap-3">
            {products.length > 1 && <button type="button" onClick={() => open((at + 1) % products.length)} className={QUIET_BUTTON}>{t('intro.products.next', { name: next.name })}</button>}
            <button type="button" onClick={onNext} className={PRIMARY}>{t('intro.products.objectives')}<Arrow /></button>
          </span>
        </div>
      </div>
    </main>
  );
}
