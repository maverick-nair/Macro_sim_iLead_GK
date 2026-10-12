import { IMAGE_BUDGET_BYTES, imageBytes, kb } from '../../engine/assets';

/**
 * Reads an image the author uploads into a data URL the storyline can carry (D183). Photos are shrunk to `maxSide`
 * pixels on their longer side and saved as WebP (JPEG where the browser cannot write WebP), stepping the quality down
 * until they fit the budget; an SVG is kept as it is. The result says, in the author's words, why a file cannot be used.
 */
export type Upload = { ok: true; src: string } | { ok: false; message: string };

const TYPES = /^image\/(png|jpeg|webp|gif|svg\+xml)$/;

function asDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error ?? new Error('read failed'));
    r.readAsDataURL(file);
  });
}

async function shrink(file: File, maxSide: number): Promise<string | null> {
  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') return null;
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  for (const q of [0.86, 0.76, 0.64, 0.5]) {
    let url = canvas.toDataURL('image/webp', q);
    if (!url.startsWith('data:image/webp')) url = canvas.toDataURL('image/jpeg', q);
    if (imageBytes(url) <= IMAGE_BUDGET_BYTES) return url;
  }
  return null;
}

/** The uploaded file as an embedded image within the budget, or why it cannot be used. */
export async function readImage(file: File, maxSide = 1024): Promise<Upload> {
  if (!TYPES.test(file.type)) return { ok: false, message: `${file.name} is not a PNG, JPEG, WebP, GIF or SVG image.` };
  try {
    if (file.type !== 'image/svg+xml' && file.type !== 'image/gif') {
      const small = await shrink(file, maxSide).catch(() => null);
      if (small) return { ok: true, src: small };
    }
    const src = await asDataUrl(file);
    if (imageBytes(src) > IMAGE_BUDGET_BYTES) return { ok: false, message: `${file.name} is ${kb(imageBytes(src))} KB. Use an image under ${kb(IMAGE_BUDGET_BYTES)} KB.` };
    return { ok: true, src };
  } catch {
    return { ok: false, message: `${file.name} could not be read. Try another image.` };
  }
}
