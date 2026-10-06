import { DASH } from '../i18n/copy';
import { LENS_TITLES } from './lenses';

/**
 * The copy guard for drafted and author facing copy (leadership-lens-module.md, Guardrails; D70):
 * KNOLSKAPE lens titles only, original sources only in "Based on", no certification claims, "skills"
 * never "competency", no em dashes or dashes as punctuation, no emojis. Participant copy is stricter:
 * no dash characters at all (D9). The mock drafter's output and every author facing string pass it
 * (src/author/copyGuard.test.ts); the server's drafts are checked with it before they are shown.
 */

export type CopyRule = 'em_dash' | 'dash_punctuation' | 'dash' | 'emoji' | 'competency' | 'certification' | 'source_name' | 'lens_title';
export interface CopyIssue { path: string; rule: CopyRule; text: string }

const EM_DASH = /[‒–—―⸺⸻]/;
/** A hyphen used as punctuation: spaced, or opening or closing a line. */
const DASH_PUNCT = /(^|\s)[-‐‑](\s|$)|^\s*[-‐‑]\s*\S/;
const EMOJI = /[\p{Extended_Pictographic}\p{Emoji_Modifier}\p{Regional_Indicator}⃣️]/u;
const COMPETENCY = /competenc/i;
const CERTIFICATION = /\b(certif(?:ied|ication|y)|accredit\w*|licen[cs]ed (?:from|by)|endorsed by|approved by|official (?:version|partner)|equivalent to)\b/i;
/** Framework owners, authors and instrument names: they belong in "Based on" only. */
const SOURCES = /\b(Hersey|Blanchard|Goleman|Burns|Bass|Kouzes|Posner|Greenleaf|Heifetz|Wiseman|Situational Leadership|SLII|Leadership Challenge|Multipliers|Leadership That Gets Results|LPI|MLQ)\b/;

/** Issues in one piece of copy. `participant`: copy a participant sees, where no dash is allowed at all. */
export function guardCopy(text: string, opts: { participant?: boolean } = {}): CopyRule[] {
  const out: CopyRule[] = [];
  if (EM_DASH.test(text)) out.push('em_dash');
  else if (DASH_PUNCT.test(text)) out.push('dash_punctuation');
  else if (opts.participant && DASH.test(text)) out.push('dash');
  if (EMOJI.test(text)) out.push('emoji');
  if (COMPETENCY.test(text)) out.push('competency');
  if (CERTIFICATION.test(text)) out.push('certification');
  if (SOURCES.test(text)) out.push('source_name');
  return out;
}

/** Whether a lens title is a KNOLSKAPE title. */
export const isLensTitle = (title: string) => LENS_TITLES.includes(title);

/** Fields that are ids, enums, paths or numbers, not copy. `basedOn` is the one place sources belong. */
export const SKIP = new Set(['basedOn', 'id', 'key', 'portrait', 'portraits', 'voice', 'homeStage', 'target', 'locale', 'currency', 'display', 'unit', 'rule', 'kind',
  'format', 'card', 'delivery', 'condition', 'intent', 'pronoun', 'style', 'opening', 'hints', 'use', 'celebration', 'scope', 'sections', 'linkage', 'fit',
  'byStage', 'start', 'effects', 'money', 'time', 'prerequisite', 'unlocks', 'actions_keys', 'event', 'letter']);

/**
 * Walks a drafted storyline (or the lens module) and returns every issue with its path. Lens titles
 * must be KNOLSKAPE titles; every other string is checked as participant copy.
 */
export function guardDraft(value: unknown, path: string[] = []): CopyIssue[] {
  if (typeof value === 'string') {
    const at = path.join('.');
    const issues: CopyIssue[] = guardCopy(value, { participant: true }).map(rule => ({ path: at, rule, text: value }));
    if (/(^|\.)(lens(\.secondary)?|primary|secondary)\.title$/.test(at) && !isLensTitle(value)) issues.push({ path: at, rule: 'lens_title', text: value });
    return issues;
  }
  if (Array.isArray(value)) return value.flatMap((v, i) => guardDraft(v, [...path, String(i)]));
  if (value && typeof value === 'object') return Object.entries(value).flatMap(([k, v]) => (SKIP.has(k) ? [] : guardDraft(v, [...path, k])));
  return [];
}
