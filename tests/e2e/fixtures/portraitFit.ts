import type { Page } from '@playwright/test';

/**
 * Which actor portraits on screen crop the person. A portrait fits when the whole head shows: the photo's top
 * row (the crown), down to 80% of its height (the chin), across its middle 40% (the face). Worked out from each
 * image's frame, object-fit and object-position, so it holds for any frame size and any photo size.
 */
export async function croppedPortraits(page: Page): Promise<string[]> {
  return page.evaluate(`(() => {
    const out = [];
    for (const img of document.querySelectorAll('img[src*="/assets/npc/"]')) {
      if (!img.complete || !img.naturalWidth) continue;
      const box = img.getBoundingClientRect(), cs = getComputedStyle(img);
      if (box.width < 2 || box.height < 2 || cs.visibility === 'hidden' || cs.display === 'none') continue;
      const w = img.naturalWidth, h = img.naturalHeight, W = box.width, H = box.height;
      const s = cs.objectFit === 'contain' ? Math.min(W / w, H / h) : cs.objectFit === 'cover' ? Math.max(W / w, H / h) : NaN;
      const [px, py] = cs.objectPosition.split(' ');
      const at = (v, free) => v.endsWith('%') ? free * parseFloat(v) / 100 : parseFloat(v);
      const x0 = Number.isNaN(s) ? 0 : at(px, W - w * s), y0 = Number.isNaN(s) ? 0 : at(py, H - h * s);
      const k = Number.isNaN(s) ? 1 : s;
      const sx = Number.isNaN(s) ? W / w : k, sy = Number.isNaN(s) ? H / h : k;
      const top = Math.max(0, -y0 / sy), bottom = Math.min(h, (H - y0) / sy);
      const left = Math.max(0, -x0 / sx), right = Math.min(w, (W - x0) / sx);
      const cut = [];
      if (top > 1) cut.push('crown ' + Math.round(top / h * 100) + '%');
      if (bottom < h * 0.8) cut.push('chin, shows ' + Math.round(bottom / h * 100) + '% of the height');
      if (left > w * 0.3 || right < w * 0.7) cut.push('face sides');
      if (cut.length) {
        const where = img.closest('[aria-label],[data-member-id],[role=dialog],section,li')?.getAttribute('aria-label') || '';
        out.push(img.src.split('/').pop() + ' ' + Math.round(W) + 'x' + Math.round(H) + ' ' + cs.objectFit + ' ' + cs.objectPosition + ' [' + cut.join(', ') + '] ' + where.slice(0, 50));
      }
    }
    return out;
  })()`) as Promise<string[]>;
}
