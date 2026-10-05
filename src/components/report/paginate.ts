/** A block as measured on one tall page: where it starts and ends, and whether it must start a page. */
export interface MeasuredBlock {
  top: number;
  bottom: number;
  pageBreak?: boolean;
}

/**
 * Packs blocks into pages of `capacity` height, in order. A page starts at its first block's top, so the
 * gaps between blocks on a page are kept and the gap before a page's first block is dropped. A block
 * taller than a page gets a page of its own. Returns block indices per page.
 */
export function paginate(blocks: MeasuredBlock[], capacity: number): number[][] {
  const pages: number[][] = [];
  let page: number[] = [];
  let start = 0;
  blocks.forEach((b, i) => {
    if (page.length && (b.pageBreak || b.bottom - start > capacity)) {
      pages.push(page);
      page = [];
    }
    if (!page.length) start = b.top;
    page.push(i);
  });
  if (page.length) pages.push(page);
  return pages;
}

/** Splits blocks into groups wherever `starts` is true (web cards, or forced pages before measuring). */
export function splitAt<T>(items: T[], starts: (item: T) => boolean): T[][] {
  const out: T[][] = [];
  items.forEach((item, i) => {
    if (i === 0 || starts(item)) out.push([item]);
    else out[out.length - 1].push(item);
  });
  return out;
}
