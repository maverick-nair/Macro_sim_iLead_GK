/**
 * Copy rules for every string a participant sees, including engine and AI generated text:
 * no dash characters (hyphen-minus U+002D or any Unicode dash, category Pd). Numbers use the
 * minus sign U+2212, which is a math symbol, not a dash (docs/DECISIONS.md D9).
 */
export const DASH = /[-\p{Pd}]/u;
export const MINUS = '−';
const EMOJI = /\p{Extended_Pictographic}/u;

/** Finds rule violations in a piece of copy. Empty when the copy is clean. */
export function copyViolations(text: string): string[] {
  const out: string[] = [];
  const dash = text.match(DASH);
  if (dash) out.push(`dash character U+${dash[0].codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')}`);
  if (EMOJI.test(text)) out.push('emoji');
  if (/competenc/i.test(text)) out.push('says "competency", use "skills"');
  return out;
}

/**
 * Makes engine or AI text safe to show. Applied by the engine contract to every text field.
 *  - "-3" and "−3" style numbers become "−3"
 *  - "word - word", "word — word" and "word – word" become "word, word"
 *  - "follow-up" becomes "follow up"
 *  - ranges like "6-10" become "6 to 10"
 */
export function sanitizeCopy(text: string): string {
  return text
    .replace(/(\d)\s*[-–—]\s*(\d)/g, '$1 to $2')
    .replace(/(^|[\s(+])[-–−](?=\d)/g, `$1${MINUS}`)
    .replace(/\s+[-\p{Pd}]+\s+/gu, ', ')
    .replace(/[–—―]/g, ', ')
    .replace(/(\p{L})[-‐‑](?=\p{L})/gu, '$1 ')
    .replace(/[-\p{Pd}]/gu, ' ')
    .replace(/ {2,}/g, ' ')
    .replace(/ ,/g, ',');
}

/** Signed number for deltas: "+8", "−2", "0". */
export function formatDelta(n: number, locale = 'en'): string {
  const abs = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(Math.abs(n));
  return n > 0 ? `+${abs}` : n < 0 ? `${MINUS}${abs}` : abs;
}
