import { useEffect, useId, useRef, useState } from 'react';
import { useI18n } from '../../i18n';
import { useMoney } from '../../i18n/money';
import { onRovingKey } from '../roving';
import { Arrow, FOCUS, QUIET_BUTTON } from './IntroHeader';
import type { IntroProduct } from './intro';

export interface ProductsProps {
  products: IntroProduct[];
  /** The organisation, over the list. */
  organisation: string | null;
  onNext: () => void;
}

/** Where the four numbered spots sit on a product photo when the storyline does not place them (D221): evenly, in reading order. */
const SPOTS: Array<[string, string]> = [['22%', '28%'], ['68%', '20%'], ['36%', '66%'], ['76%', '58%']];

const Tick = ({ on }: { on: boolean }) => (
  <span aria-hidden="true" className={`flex size-5.5 flex-none items-center justify-center rounded-round border-(length:--il-canvas-product-spot-border) ${on ? 'border-accent-secondary bg-accent-secondary text-fg-on-accent' : 'border-line-control'}`}>
    {on && <svg className="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>}
  </span>
);

/**
 * The product portfolio (D219, the canvas's Portfolio, D232): the models in a list with an explored tick and how many
 * have been explored; the model's kind and number, short code, name, tagline and who it is for; its features as tabs
 * with their panel, and the same features as numbered spots on its photo, where the storyline places them (D221); its
 * specs and typical deal in a strip; Next model and See your objectives, which turns to paper once every model has been
 * seen. Every word and image is the storyline's; a storyline without named features shows its first four specs as the
 * features, as before.
 */
export function Products({ products, organisation, onNext }: ProductsProps) {
  const { t, number } = useI18n();
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
  const all = explored >= products.length;
  const feature = p.features[point];
  return (
    <main className="grid min-h-0 flex-1 grid-cols-(--il-intro-products-columns) bg-surface-card tablet:grid-cols-1">
      <h1 className="sr-only">{t('intro.products.title')}</h1>
      <nav aria-labelledby={ids.list} className="flex min-h-0 flex-col gap-2.5 overflow-y-auto border-e border-line-default bg-surface-solid px-4 pt-6.5 pb-5.5">
        <div className="flex flex-col gap-2.5 px-3 pb-1.5">
          {organisation && <p className="m-0 text-12 font-600 uppercase tracking-(--il-tracking-eyebrow-wide) text-fg-secondary">{organisation}</p>}
          <h2 id={ids.list} className="m-0 font-serif text-26 font-400">{t('intro.products.title')}</h2>
          <p className="m-0 text-14 leading-normal text-fg-secondary">{t('intro.products.intro')}</p>
        </div>
        <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
          {products.map((x, i) => (
            <li key={x.name}>
              <button type="button" onClick={() => open(i)} aria-current={i === at ? 'true' : undefined}
                className={`flex w-full cursor-pointer items-center gap-3.5 rounded-4 border py-2 ps-2 pe-2.5 text-start text-fg-primary ${i === at ? 'border-accent-secondary bg-surface-raised' : 'border-transparent bg-transparent hover:bg-surface-raised'} ${FOCUS}`}>
                {x.image ? <img src={x.image} alt="" className="h-16.5 w-13.5 flex-none rounded-3 object-cover" /> : <span aria-hidden="true" className="flex h-16.5 w-13.5 flex-none items-center justify-center rounded-3 bg-surface-raised font-mono text-15">{x.code}</span>}
                <span className="flex min-w-0 flex-1 flex-col gap-1"><b className="truncate text-16 font-600">{x.name}</b>{(x.kind ?? x.line) && <span className="truncate text-13 text-fg-secondary">{x.kind ?? x.line}</span>}</span>
                <Tick on={seen.has(i)} /><span className="sr-only">{t('intro.products.seen', { seen: seen.has(i) ? 'yes' : 'no' })}</span>
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-1.5 flex flex-col gap-2 px-3">
          <span className="flex justify-between text-13 text-fg-secondary"><span>{t('intro.products.explored')}</span><span className="font-mono font-500 text-fg-primary">{t('intro.products.exploredCount', { n: number(explored), total: number(products.length) })}</span></span>
          <span role="img" aria-label={t('intro.products.exploredAria', { n: explored, total: products.length })} className="block h-1 bg-surface-raised">
            <span className="block h-full bg-accent-secondary" style={{ width: `${Math.round((explored / products.length) * 100)}%` }} />
          </span>
        </div>
        <p className="mt-auto mb-0 px-3 text-13 leading-(--il-canvas-leading-body) text-fg-secondary">{t('intro.products.note')}</p>
      </nav>
      <div className="flex min-h-0 flex-col">
        <div className="grid min-h-0 flex-1 grid-cols-(--il-canvas-product-columns) items-center gap-10 overflow-y-auto px-13 pt-7 pb-5.5 short:pt-4 tablet:grid-cols-1 tablet:px-7">
          <section aria-labelledby={`${ids.list}-code`} className="flex min-w-0 flex-col gap-3">
            {(p.kind ?? p.line) && <p className="m-0 text-13 font-500 uppercase tracking-(--il-tracking-eyebrow) text-fg-secondary">{p.kind ? t('intro.products.kind', { kind: p.kind, n: String(at + 1).padStart(2, '0') }) : p.line}</p>}
            <h2 id={`${ids.list}-code`} ref={code} tabIndex={-1} className="m-0 flex flex-col gap-1 outline-0">
              <span aria-hidden="true" className="text-(length:--il-intro-code-size) leading-(--il-canvas-leading-display) font-700 tracking-(--il-canvas-tracking-display) short:text-96">{p.code}<span className="text-accent-secondary">.</span></span>
              <span className="text-26 font-500">{p.name}</span>
            </h2>
            {p.kind && p.line && <p className="m-0 font-display text-36 leading-(--il-canvas-leading-title) font-400 short:text-30">{p.line}</p>}
            {p.audience && <p className="m-0 max-w-(--il-canvas-measure-lead) text-16 leading-(--il-canvas-leading-body) text-fg-secondary"><span className="sr-only">{t('intro.products.audience')} </span>{p.audience}</p>}
            {p.features.length > 0 && (
              <>
                <div role="tablist" aria-label={t('intro.products.points', { name: p.name })} className="-ms-3 mt-1.5 flex flex-wrap gap-1">
                  {p.features.map((x, i) => (
                    <button key={i} type="button" role="tab" id={`${ids.tabs}-${i}`} aria-selected={i === point} aria-controls={ids.panel} tabIndex={i === point ? 0 : -1}
                      onClick={() => setPoint(i)} onKeyDown={e => onRovingKey(e, i, p.features.length, setPoint)}
                      title={x.title}
                      className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-4 border-0 px-3 text-14 font-500 text-(--il-color-canvas-mist-light) ${i === point ? 'bg-surface-raised shadow-(--il-canvas-product-tab-mark)' : 'bg-transparent'} ${FOCUS}`}>
                      <span className="font-mono text-12 text-accent-secondary">{String(i + 1).padStart(2, '0')}</span><span className="inline-block max-w-60 truncate">{x.title}</span>
                    </button>
                  ))}
                </div>
                <div role="tabpanel" id={ids.panel} aria-labelledby={`${ids.tabs}-${point}`} tabIndex={0} className={`flex min-h-31 max-w-(--il-canvas-measure-lead) flex-col gap-1.5 border-s-2 border-accent-secondary py-2 ps-4 short:min-h-0 ${FOCUS}`}>
                  <span aria-hidden="true" className="font-mono text-13 text-accent-secondary">{String(point + 1).padStart(2, '0')} · {feature?.title}</span>
                  <span className="text-16 leading-(--il-canvas-leading-body) text-(--il-color-canvas-mist-light)">{feature?.text}</span>
                </div>
              </>
            )}
          </section>
          <figure className="relative m-0 aspect-(--il-canvas-product-aspect) max-h-full w-full justify-self-end overflow-hidden rounded-4 bg-(--il-color-canvas-sand-600) shadow-(--il-canvas-product-shadow) tablet:max-h-none tablet:w-100 tablet:max-w-full tablet:justify-self-center">
            {p.image ? <img src={p.image} alt={p.imageAlt ?? t('intro.products.photo', { name: p.name })} className="absolute inset-0 size-full object-cover" />
              : <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center text-110 font-700 text-(--il-color-canvas-navy)">{p.code}</span>}
            {p.features.map((x, i) => (
              <button key={i} type="button" onClick={() => setPoint(i)} aria-label={t('intro.products.spot', { n: i + 1, text: x.title })} aria-pressed={i === point}
                className={`group absolute flex size-11 -translate-x-1/2 -translate-y-1/2 cursor-pointer items-center justify-center rounded-round border-0 bg-transparent p-0 rtl:translate-x-1/2 ${FOCUS}`}
                style={x.spot ? { insetInlineStart: `${x.spot.x}%`, insetBlockStart: `${x.spot.y}%` } : { insetInlineStart: SPOTS[i][0], insetBlockStart: SPOTS[i][1] }}>
                <span className={`flex size-8.5 items-center justify-center rounded-round border-(length:--il-canvas-product-spot-border) font-mono text-12 font-500 ${i === point ? 'border-accent-secondary bg-accent-secondary text-fg-on-accent' : 'border-(--il-canvas-veil-line) bg-(--il-canvas-veil-strong) text-(--il-color-white)'}`}>{String(i + 1).padStart(2, '0')}</span>
              </button>
            ))}
            <figcaption className="absolute start-3.5 bottom-3 rounded-3 bg-(--il-canvas-veil-soft) px-2.25 py-1.25 text-12 text-(--il-color-canvas-mist-light)">{t('intro.products.hint', { name: p.name })}</figcaption>
          </figure>
        </div>
        <div className="flex flex-none flex-wrap items-center gap-6 border-t border-line-default px-13 py-4 tablet:px-7">
          {(p.specs.length > 0 || p.dealValue !== null) && (
            <ul className="m-0 flex min-w-0 flex-1 list-none flex-wrap gap-x-10 gap-y-1 p-0 text-15 text-(--il-color-canvas-mist-light)">
              {p.specs.map(s => <li key={s}>{s}</li>)}
              {p.dealValue !== null && <li>{t('intro.products.deal')} <b className="font-mono font-500 text-accent-secondary">{money.compact(p.dealValue)}</b></li>}
            </ul>
          )}
          <span className="ms-auto flex flex-wrap gap-3">
            {products.length > 1 && <button type="button" onClick={() => open((at + 1) % products.length)} className={`${QUIET_BUTTON} min-h-13 px-4 text-15`}>{t('intro.products.next', { name: next.name })}</button>}
            <button type="button" onClick={onNext}
              className={`inline-flex min-h-13 cursor-pointer items-center justify-center gap-2.5 rounded-4 border-0 px-5.5 text-16 font-600 ${all ? 'bg-(image:--il-fill-brand) text-button-on-solid' : 'bg-(--il-color-canvas-button) text-(--il-color-white)'} ${FOCUS}`}>
              {t('intro.products.objectives')}<Arrow />
            </button>
          </span>
        </div>
      </div>
    </main>
  );
}
