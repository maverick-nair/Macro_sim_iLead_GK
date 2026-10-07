/**
 * Verbatim quote checks (scoring-and-report.md 5.5: "a quote that is not a verbatim substring of the
 * stored transcript is never shown"). A model quote is accepted only when it occurs in the participant's
 * own words. The comparison forgives what a model cannot see as different (runs of whitespace and line
 * breaks, curly against straight quotes and apostrophes, surrounding quotation marks, a trailing
 * full stop) and nothing else: the same words, in the same order, with the same spelling and case. The
 * quote kept is the exact slice of the participant's text, so what the report shows is what was said.
 */

const QUOTE_CHARS: Record<string, string> = { '‘': "'", '’': "'", '‚': "'", '‛': "'", '“': '"', '”': '"', '„': '"', '‟': '"', '«': '"', '»': '"', '‹': '<', '›': '>' };

/** The text with forgiving characters folded, and for each folded character its index in the original. */
function fold(text: string): { s: string; map: number[] } {
  let s = '';
  const map: number[] = [];
  let space = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (/\s/.test(c)) {
      if (!space && s.length) { s += ' '; map.push(i); }
      space = true;
      continue;
    }
    space = false;
    s += QUOTE_CHARS[c] ?? c;
    map.push(i);
  }
  if (s.endsWith(' ')) { s = s.slice(0, -1); map.pop(); }
  return { s, map };
}

const TRIM = /^[\s"'“”‘’«»]+|[\s"'“”‘’«»]+$/g;

/** The exact slice of `source` that `quote` matches, or null when it is not there verbatim. */
export function findVerbatim(source: string, quote: string): string | null {
  let q = quote.replace(TRIM, '');
  if (q.length < 3) return null;
  if (/\.\.\.|…/.test(q)) return null;
  const src = fold(source);
  const tries = [q];
  if (/[.!?]$/.test(q)) tries.push(q.slice(0, -1));
  for (const t of tries) {
    q = fold(t).s;
    const at = src.s.indexOf(q);
    if (at < 0) continue;
    const start = src.map[at];
    const end = src.map[at + q.length - 1] + 1;
    return source.slice(start, end);
  }
  return null;
}

/** Keeps the quotes found verbatim (as their exact slices, without duplicates) and lists the rest. */
export function verifyQuotes(source: string, quotes: readonly string[]): { kept: string[]; dropped: string[] } {
  const kept: string[] = [];
  const dropped: string[] = [];
  for (const q of quotes) {
    const v = findVerbatim(source, q);
    if (v === null) dropped.push(q);
    else if (!kept.includes(v)) kept.push(v);
  }
  return { kept, dropped };
}
