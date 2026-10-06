import type { Brief, FrameworkDimension } from '../api/author';
import { CHALLENGES, INDUSTRIES, parseStages, REGIONS, ROLE_LEVELS } from './context';

/**
 * Reading answers and uploads without a model (the mock): a client framework from headings and bullet
 * lists, and brief fields from plain keywords. The server does the same with the model
 * (docs/genie/prompts/author-chat.md); this is the deterministic stand in.
 */

const BULLET = /^\s*(?:[-*••–]|\d+[.)])\s+(.*)$/;
const HEADING = /^\s*(?:#{1,6}\s+(.+?)\s*#*\s*$|(.+?):\s*$)/;
const LEVELS = /^(?:proficiency\s+)?levels?\b|^proficiency\b/i;
/** Level names on one line: "Levels: Emerging, Proficient, Role model". */
const LEVEL_LINE = /^\s*(?:proficiency\s+)?levels?\s*[:=]\s*(.+)$/i;

const clean = (s: string) => s.replace(/\*\*|__|`/g, '').replace(/\s+/g, ' ').trim();
const list = (s: string) => s.split(/,|;|\/|\|/).map(clean).filter(Boolean);

/**
 * Dimensions, observable behaviours and proficiency levels from a framework document: each heading
 * followed by a bullet list is a dimension and its bullets are behaviours; a "Levels" heading or line
 * gives the levels. Nothing is invented: text without that shape gives an empty list.
 */
export function extractFramework(text: string): FrameworkDimension[] {
  const out: FrameworkDimension[] = [];
  let shared: string[] = [];
  let current: FrameworkDimension | null = null;
  let inLevels = false;
  for (const raw of text.split(/\r?\n/)) {
    if (!raw.trim()) continue;
    // "Levels: a, b" on its own line, or a "Levels" section, applies to every dimension.
    const levelLine = raw.match(LEVEL_LINE);
    if (levelLine && !raw.trim().endsWith(':')) { shared = list(levelLine[1]); inLevels = false; continue; }
    const bullet = raw.match(BULLET);
    if (bullet) {
      const item = clean(bullet[1]);
      if (!item) continue;
      // "- Levels: a, b" under a dimension is that dimension's own.
      const own = item.match(LEVEL_LINE);
      if (inLevels) shared.push(item);
      else if (current && own) current.levels = list(own[1]);
      else if (current) current.behaviours.push(item);
      continue;
    }
    const heading = raw.match(HEADING);
    if (heading) {
      const name = clean(heading[1] ?? heading[2]);
      if (LEVELS.test(name)) { inLevels = true; continue; }
      inLevels = false;
      if (current && current.behaviours.length) out.push(current);
      current = { name, behaviours: [], levels: [] };
      continue;
    }
    // A plain line under a heading that is a sentence ends the section: only bullets count as behaviours.
  }
  if (current && current.behaviours.length) out.push(current);
  // A section of "Label: value" bullets is a brief, not a framework dimension.
  const isBrief = (d: FrameworkDimension) => d.behaviours.filter(b => /^[\w ]{1,24}:\s/.test(b)).length * 2 > d.behaviours.length;
  return out.filter(d => !isBrief(d)).map(d => ({ ...d, levels: d.levels.length ? d.levels : [...shared] }));
}

const WORDS: Record<string, number> = { six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12 };
/** A team size from 6 to 12 in "10", "ten", "a team of 8", or null. */
export function parseTeamSize(text: string): number | null {
  const m = text.match(/\b(\d{1,2}|six|seven|eight|nine|ten|eleven|twelve)\b/i);
  if (!m) return null;
  const n = WORDS[m[1].toLowerCase()] ?? Number(m[1]);
  return n >= 6 && n <= 12 ? n : null;
}

/**
 * Brief fields a piece of text states clearly, for fields not yet known. Answers give industry, role
 * level, challenge and region by keyword; uploads also give the client name, team size, stages and a
 * framework, read from labelled lines ("Client: Acme Bank", "Team size: 8", "Stages: A, B, C").
 */
export function inferBrief(text: string, known: Brief, opts: { upload: boolean }): Partial<Brief> {
  const out: Partial<Brief> = {};
  if (!known.industry) { const i = INDUSTRIES.find(x => x.keywords.test(text)); if (i) out.industry = i.label; }
  if (!known.region) { const r = REGIONS.find(x => x.id !== 'global' && x.keywords.test(text)); if (r) { out.region = r.id; out.language = r.label; } }
  if (!opts.upload) return out;
  if (!known.roleLevel) { const r = ROLE_LEVELS.find(x => x.keywords.test(text)); if (r) out.roleLevel = r.label; }
  if (!known.challenge) {
    const line = text.match(/^\s*(?:business\s+)?challenge\s*[:=]\s*(.+)$/im);
    const c = line ? line[1].trim() : CHALLENGES.find(x => x.keywords.test(text))?.label;
    if (c) out.challenge = c;
  }
  if (known.client === undefined) { const m = text.match(/^\s*(?:client|company|organi[sz]ation)(?:\s+name)?\s*[:=]\s*(.+)$/im); if (m) out.client = clean(m[1]).slice(0, 60); }
  if (known.teamSize === undefined) { const m = text.match(/^\s*team\s*size\s*[:=]\s*(.+)$/im) ?? text.match(/\bteams? of (\w+)/i); const n = m && parseTeamSize(m[1]); if (n) out.teamSize = n; }
  if (!known.process) { const m = text.match(/^\s*(?:stages|process|funnel|work process)\s*[:=]\s*(.+)$/im); const s = m && parseStages(m[1]); if (s) out.process = s; }
  if (known.framework === undefined && extractFramework(text).length) out.framework = text;
  return out;
}
