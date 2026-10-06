import { Fragment, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useI18n } from '../../i18n';
import { REPORT_PAGE_RULE } from '../../styles/print';
import { useReport } from './context';
import { paginate, splitAt } from './paginate';
import type { ReportBlock } from './types';
import './messages';

const WEB_PAGE = 'flex flex-col gap-7 border border-line-default bg-surface-card backdrop-blur-14';
/** A letter page: light colours whatever the theme, shown at 0.8 so it is 8.5 by 11 inches on screen and on paper. */
const PRINT_PAGE = 'flex flex-col gap-7 overflow-hidden bg-surface-solid px-16 pt-16 pb-12 text-fg-primary shadow-(--il-report-print-shadow) scheme-light w-(--il-report-print-page-width) [zoom:var(--il-report-print-zoom)] print:shadow-none print:[zoom:1] print:origin-top-left print:scale-(--il-report-print-scale)';
/** Printing: one letter sheet per page, clipping the unscaled layout box so it never spills onto a blank sheet. */
const SHEET = 'contents print:block print:h-(--il-report-print-sheet-height) print:w-(--il-report-print-sheet-width) print:overflow-hidden print:break-after-page print:last:break-after-auto';
const FOOTER = 'mt-auto flex justify-between text-12 text-fg-secondary';

export interface ReportFooter {
  /** Left side of every page footer. */
  brand: string;
  /** Left side of the last page's footer, when it differs. */
  last?: string;
}

export interface ReportDocumentProps {
  blocks: ReportBlock[];
  /** Above the pages; hidden when printing. */
  toolbar?: ReactNode;
  footer: ReportFooter;
  /** Render as the page's main landmark (the playable app). The design frames sit in a gallery and are not. */
  landmark?: boolean;
  /** Each page's name; the participant reports' "Development report, page N" when left out (the group report names its own). */
  pageLabel?: (n: number) => string;
}

/**
 * The report's frame. Web view: the blocks in cards (a block with `card` starts a new one). Print view:
 * letter pages with "Page N of M" footers. The blocks are first laid out on one tall page and measured,
 * then packed into pages before the browser paints, so the footers count the pages that print.
 */
export function ReportDocument({ blocks, toolbar, footer, landmark = false, pageLabel }: ReportDocumentProps) {
  const { print, purpose = 'development' } = useReport();
  const { t } = useI18n();
  const label = pageLabel ?? ((n: number) => t('report.page', { n, purpose }));
  const Outer = landmark ? 'main' : 'div';
  const outer = print
    ? 'relative mx-auto flex w-full max-w-none flex-1 flex-col items-center gap-6 bg-(--il-report-print-desk) p-8 print:block print:bg-transparent print:p-0'
    : `mx-auto flex w-full max-w-(--il-report-width) flex-1 flex-col items-stretch gap-5 bg-transparent px-8 pt-6 pb-10`;
  return (
    <Outer className={outer}>
      {toolbar && <div className={`w-full print:hidden ${print ? 'scheme-dark' : ''}`}>{toolbar}</div>}
      {print && <style>{REPORT_PAGE_RULE}</style>}
      {print ? <PrintPages blocks={blocks} footer={footer} label={label} /> : splitAt(blocks, b => !!b.card).map((group, i) => (
        <article key={group[0].key} aria-label={label(i + 1)} className={`${WEB_PAGE} rounded-28 p-8`}>
          {group.map(b => <Fragment key={b.key}>{b.node}</Fragment>)}
        </article>
      ))}
    </Outer>
  );
}

type Layout = { phase: 'measure' } | { phase: 'paged'; pages: number[][]; tall: boolean[] };

function PrintPages({ blocks, footer, label }: { blocks: ReportBlock[]; footer: ReportFooter; label: (n: number) => string }) {
  const { t } = useI18n();
  const signature = blocks.map(b => `${b.key}${b.pageBreak ? '!' : ''}`).join('|');
  const [layout, setLayout] = useState<Layout & { signature: string }>({ phase: 'measure', signature });
  const tall = useRef<HTMLElement>(null);
  const probe = useRef<HTMLDivElement>(null);
  // New blocks: lay them out again before packing.
  if (layout.signature !== signature) setLayout({ phase: 'measure', signature });

  useLayoutEffect(() => {
    if (layout.phase !== 'measure' || !tall.current || !probe.current) return;
    const els = Array.from(tall.current.children).slice(0, blocks.length);
    const capacity = probe.current.getBoundingClientRect().height;
    const measured = els.map((el, i) => {
      const r = el.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, pageBreak: !!blocks[i].pageBreak };
    });
    // Nothing laid out (no layout engine, as in unit tests): break only where a page is forced.
    const pages = capacity > 0 && els.length === blocks.length ? paginate(measured, capacity + 0.5) : splitAt(blocks.map((_, i) => i), i => !!blocks[i].pageBreak);
    setLayout({ phase: 'paged', signature, pages, tall: pages.map(p => p.length > 0 && measured[p.at(-1)!].bottom - measured[p[0]].top > capacity + 0.5) });
  }, [layout, blocks, signature]);

  // Web fonts change line breaks: pack again once they have loaded.
  useEffect(() => {
    const fonts = globalThis.document?.fonts;
    if (!fonts || fonts.status === 'loaded') return;
    let alive = true;
    void fonts.ready.then(() => { if (alive) setLayout(l => ({ phase: 'measure', signature: l.signature })); });
    return () => { alive = false; };
  }, []);

  const pageFooter = (n: number, total: number) => (
    <footer className={FOOTER}>
      <span>{n === total && footer.last ? footer.last : footer.brand}</span>
      <span>{t('report.pageOf', { n, total })}</span>
    </footer>
  );

  if (layout.phase === 'measure') {
    return (
      <>
        <article ref={tall} aria-label={label(1)} className={`${PRINT_PAGE} min-h-(--il-report-print-page-height)`}>
          {blocks.map(b => <Fragment key={b.key}>{b.node}</Fragment>)}
          {pageFooter(1, 1)}
        </article>
        {/* An empty page: its flexible middle is the height a page has for blocks. */}
        <div aria-hidden="true" className={`${PRINT_PAGE} invisible absolute top-0 left-0 h-(--il-report-print-page-height)`}>
          <div ref={probe} className="flex-1"></div>
          {pageFooter(1, 1)}
        </div>
      </>
    );
  }
  const total = layout.pages.length;
  return layout.pages.map((page, i) => (
    <div key={blocks[page[0]].key} className={SHEET}>
      <article aria-label={label(i + 1)}
        className={`${PRINT_PAGE} ${layout.tall[i] ? 'min-h-(--il-report-print-page-height)' : 'h-(--il-report-print-page-height)'}`}>
        {page.map(b => <Fragment key={blocks[b].key}>{blocks[b].node}</Fragment>)}
        {pageFooter(i + 1, total)}
      </article>
    </div>
  ));
}

