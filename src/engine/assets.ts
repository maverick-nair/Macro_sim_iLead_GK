import { z } from 'zod';

/**
 * Images a storyline carries (D183): portraits, the office backdrop, the company and brand logos and the
 * product image. Each is a path on this site (`/assets/...`, the library GenieKreator offers), an https
 * address, or an image uploaded in GenieKreator and embedded as a base64 data URL. Embedded images have a
 * budget each and together, so a storyline stays quick to load for participants and in a SCORM package.
 */

/** The most one embedded image may weigh, decoded. GenieKreator downsizes uploads to fit. */
export const IMAGE_BUDGET_BYTES = 300 * 1024;
/** The most all embedded images of one storyline may weigh together, decoded. */
export const IMAGES_BUDGET_BYTES = 3 * 1024 * 1024;
/** The longest image reference text kept: a data URL just over the budget, so a too large one can still be named. */
export const IMAGE_REF_MAX = 1_000_000;

const DATA_URL = /^data:image\/(png|jpeg|webp|gif|svg\+xml);base64,([a-z0-9+/=]+)$/i;
const PATH = /^\/(?!\/)[^\s"'<>()]*$/;
const HTTPS = /^https:\/\/[^\s"'<>()]+$/i;

/** True for an embedded image (a base64 data URL). */
export const isEmbedded = (src: string) => DATA_URL.test(src.trim());

/** An image reference the player can show: a site path, https, or a base64 image data URL. */
export function isImageRef(src: string): boolean {
  const s = src.trim();
  return PATH.test(s) || HTTPS.test(s) || DATA_URL.test(s);
}

/** Decoded bytes of an embedded image; 0 for a path or address (it costs the storyline nothing). */
export function imageBytes(src: string): number {
  const m = src.trim().match(DATA_URL);
  if (!m) return 0;
  const b64 = m[2];
  return Math.floor((b64.length * 3) / 4) - (b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0);
}

/** Kilobytes, rounded up, for messages. */
export const kb = (bytes: number) => Math.ceil(bytes / 1024);

/** What is wrong with an image reference, in the author's words, or null when it can be used. */
export function imageIssue(src: string): string | null {
  if (!isImageRef(src)) return 'is not an image the simulation can show. Pick one from the library or upload a PNG, JPEG, WebP, GIF or SVG.';
  const bytes = imageBytes(src);
  if (bytes > IMAGE_BUDGET_BYTES) return `is ${kb(bytes)} KB, over the ${kb(IMAGE_BUDGET_BYTES)} KB an uploaded image may be. Upload a smaller one (GenieKreator shrinks photos it can read).`;
  return null;
}

/** An image the storyline shows the participant (D183). */
export const ImageRef = z.string().trim().min(1).max(IMAGE_REF_MAX).superRefine((s, ctx) => {
  const issue = imageIssue(s);
  if (issue) ctx.addIssue({ code: 'custom', message: `The image ${issue}` });
}).meta({ description: 'A site path (/assets/...), an https address, or a base64 image data URL under the per image budget (D183).' });
