import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Versioned prompts (ai/prompts/*.md). Each file starts with a header:
 *
 *   ---
 *   id: evaluator
 *   version: 1
 *   ---
 *
 * Edit a prompt: change the text and raise `version`. The version string recorded with every evaluation
 * and NPC reply is `<id>@<version>` per file plus a short hash of the text, so an edit without a version
 * bump still shows in the audit trail.
 */

export interface Prompt { id: string; version: number; text: string; hash: string }

const DIR = fileURLToPath(new URL('../prompts/', import.meta.url));
const cache = new Map<string, Prompt>();

export function parsePrompt(raw: string, file = 'prompt'): Prompt {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!m) throw new Error(`${file}: missing the --- header`);
  const head = Object.fromEntries(m[1].split(/\r?\n/).map(l => l.split(':').map(s => s.trim())).filter(p => p.length >= 2).map(([k, ...v]) => [k, v.join(':')]));
  const version = Number(head.version);
  if (!head.id || !Number.isInteger(version) || version < 1) throw new Error(`${file}: the header needs an id and a whole version number`);
  const text = m[2].trim();
  return { id: head.id, version, text, hash: createHash('sha256').update(text).digest('hex').slice(0, 8) };
}

/** Loads `ai/prompts/<name>.md` (cached). */
export function loadPrompt(name: string, dir = DIR): Prompt {
  const key = `${dir}|${name}`;
  let p = cache.get(key);
  if (!p) {
    p = parsePrompt(readFileSync(`${dir}${name}.md`, 'utf8'), `${name}.md`);
    cache.set(key, p);
  }
  return p;
}

/** `npc@1#a1b2c3d4`, or several joined with `+`. */
export const versionOf = (...prompts: Prompt[]) => prompts.map(p => `${p.id}@${p.version}#${p.hash}`).join('+');

/** Fills `{{name}}` placeholders. A placeholder with no value is an error, so a typo never ships silently. */
export function render(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k: string) => {
    if (!(k in vars)) throw new Error(`Prompt placeholder {{${k}}} has no value`);
    return String(vars[k]);
  });
}

/** Text the participant or author typed, made safe to place inside an XML like tag in a prompt. */
export const quoteInput = (s: string) => s.replace(/</g, '‹').replace(/>/g, '›');

/** Language name for a locale, in English, for prompts ("es-MX" gives "Spanish (Mexico)"). */
export function languageName(locale: string): string {
  try {
    return new Intl.DisplayNames(['en'], { type: 'language', languageDisplay: 'standard' }).of(locale) ?? locale;
  } catch {
    return locale;
  }
}
