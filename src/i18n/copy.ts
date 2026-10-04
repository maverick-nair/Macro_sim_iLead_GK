/**
 * Copy rules for every string a participant sees, including engine and AI generated text:
 * no dash characters (hyphen-minus U+002D or any Unicode dash, category Pd). Numbers use the
 * minus sign U+2212, which is a math symbol, not a dash (docs/DECISIONS.md D9).
 */
/** Hyphen-minus, every Unicode dash (Pd), and dash look-alikes: hyphen bullet, box drawing lines, modifier minus, small and full width hyphen-minus. */
export const DASH = /[-\p{Pd}\u2043\u2500\u2501\u02D7\uFE63\uFF0D]/u;
const DASH_G = new RegExp(DASH.source, 'gu');
export const MINUS = '−';
/** Pictographs, skin tone modifiers, flags (regional indicators), keycaps, joiners and emoji presentation. */
const EMOJI = /[\p{Extended_Pictographic}\p{Emoji_Modifier}\p{Regional_Indicator}\u20E3\uFE0F]/u;
const EMOJI_G = /[\p{Extended_Pictographic}\p{Emoji_Modifier}\p{Regional_Indicator}\u20E3\uFE0F\u200D]/gu;

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
 *  - ranges like "6-10" or "Q3–Q4" become "6 to 10" and "Q3 to Q4"
 *  - emoji are removed; "competency" and "competencies" become "skill" and "skills"
 */
export function sanitizeCopy(text: string): string {
  return text
    .replace(EMOJI_G, '')
    .replace(/\bcompetenc(?:y|ies)\b/gi, m => (m[0] === 'C' ? 'S' : 's') + (/ies$/i.test(m) ? 'kills' : 'kill'))
    .replace(/\b(?:competent|competence)\b/gi, m => (m[0] === 'C' ? 'S' : 's') + 'killed')
    .replace(/(\d)\s*[-–—]\s*(\d)/g, '$1 to $2')
    .replace(/(\p{Lu}\d+)\s*[–—]\s*(\p{Lu}\d+)/gu, '$1 to $2')
    .replace(/(^|[\s(+])[-–−](?=\d)/g, `$1${MINUS}`)
    .replace(/\s+[-\p{Pd}]+\s+/gu, ', ')
    .replace(/[–—―]/g, ', ')
    .replace(/(\p{L})[-‐‑](?=\p{L})/gu, '$1 ')
    .replace(DASH_G, ' ')
    .replace(/ {2,}/g, ' ')
    .replace(/ ,/g, ',')
    .replace(/ +([.!?])/g, '$1')
    .trim();
}

/** Signed number for deltas: "+8", "−2", "0". */
export function formatDelta(n: number, locale = 'en'): string {
  const abs = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(Math.abs(n));
  return n > 0 ? `+${abs}` : n < 0 ? `${MINUS}${abs}` : abs;
}
