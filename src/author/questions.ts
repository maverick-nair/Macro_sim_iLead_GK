import type { Brief, Question, QuestionId } from '../api/author';
import { QUESTION_IDS } from '../api/author';
import { CHALLENGES, DEFAULT_PROCESS, DURATION_MODES, INDUSTRIES, OTHER_CHALLENGES, parseStages, PROCESSES, regionOf, REGIONS, ROLE_LEVELS, TONE_LABELS } from './context';
import { inferBrief, parseTeamSize } from './extract';

/**
 * The author chat's question policy (docs/genie/prompts/author-chat.md), as rules: ten core questions
 * in a fixed order, skipping any that an earlier answer or an upload already covers, never fewer than
 * five asked (covered ones come back as a quick confirmation) and never more than ten.
 */

export const MIN_QUESTIONS = 5;
export const MAX_QUESTIONS = 10;
export const QUESTION_ORDER: readonly QuestionId[] = QUESTION_IDS;

/** Whether the brief already answers a question. */
export function covered(brief: Brief, id: QuestionId): boolean {
  switch (id) {
    case 'role_level': return !!brief.roleLevel;
    case 'industry': return !!brief.industry;
    case 'challenge': return !!brief.challenge;
    case 'client': return brief.client !== undefined;
    case 'team_size': return brief.teamSize !== undefined;
    case 'process': return !!brief.process;
    case 'duration': return !!brief.duration;
    case 'language': return !!brief.region;
    case 'framework': return brief.framework !== undefined;
    case 'tone': return !!brief.tone;
  }
}

/** The brief's value for a question, as the chat words it back. */
export function describe(brief: Brief, id: QuestionId): string {
  switch (id) {
    case 'role_level': return brief.roleLevel ?? '';
    case 'industry': return brief.industry ?? '';
    case 'challenge': return brief.challenge ?? '';
    case 'client': return brief.client === null ? 'Fictional company' : brief.client ?? '';
    case 'team_size': return brief.teamSize === undefined ? '' : `${brief.teamSize} people`;
    case 'process': return brief.process?.join(', ') ?? '';
    case 'duration': return brief.duration ? `${DURATION_MODES[brief.duration].label}, ${DURATION_MODES[brief.duration].detail}` : '';
    case 'language': return brief.language ?? '';
    case 'framework': return brief.framework === null ? 'No framework' : brief.framework ? 'Framework shared' : '';
    case 'tone': return brief.tone ? TONE_LABELS[brief.tone] : '';
  }
}

const chips = (labels: readonly string[]) => labels.map(l => ({ label: l, value: l }));

/** The question as the chat asks it. */
export function questionFor(id: QuestionId, brief: Brief): Question {
  const q = ((): Omit<Question, 'id'> => {
    switch (id) {
      case 'role_level': return { prompt: 'Who are your participants?', help: 'Their role level shapes the team they lead and the lens we suggest.', chips: chips(ROLE_LEVELS.map(r => r.label)), input: 'text', placeholder: 'For example, first time sales managers' };
      case 'industry': return { prompt: 'Which industry is the simulation set in?', chips: chips(INDUSTRIES.map(i => i.label)), input: 'text', placeholder: 'Type an industry' };
      case 'challenge': return { prompt: 'What business challenge should the simulation reflect?', help: 'One line is enough. It shapes the events and the lens we suggest.', chips: chips([...CHALLENGES.map(c => c.label), ...OTHER_CHALLENGES]), input: 'text', placeholder: 'Describe the challenge' };
      case 'client': return { prompt: 'Which client is this for?', help: 'We use the name for the company in the story. Choose a fictional company to keep it neutral.', chips: [{ label: 'Fictional company', value: 'Fictional company' }], input: 'text', placeholder: 'Client name' };
      case 'team_size': return { prompt: 'How many people are in the participant\'s team?', help: 'From 6 to 12. Most builds use 10.', chips: [6, 8, 10, 12].map(n => ({ label: n === 10 ? '10 (default)' : String(n), value: String(n) })), input: 'number', placeholder: '6 to 12' };
      case 'process': return { prompt: 'What work process does the team run?', help: 'Pick one, or type 3 to 6 stage names separated by commas.', chips: PROCESSES.map(p => ({ label: p === DEFAULT_PROCESS ? `${p.label} (default)` : p.label, value: p.label, detail: p.stages.join(', ') })), input: 'text', placeholder: 'Stage, stage, stage' };
      case 'duration': return { prompt: 'How long should a run take?', chips: (Object.keys(DURATION_MODES) as Array<keyof typeof DURATION_MODES>).map(k => ({ label: DURATION_MODES[k].label, value: DURATION_MODES[k].label, detail: DURATION_MODES[k].detail })), input: 'text', placeholder: 'Full, Standard or Lite' };
      case 'language': return { prompt: 'Which language and region?', help: 'The region sets the currency and names. The draft is written in English; translation follows in the workspace.', chips: chips(REGIONS.map(r => r.label)), input: 'text', placeholder: 'Language and region' };
      case 'framework': return { prompt: 'Does the client have a leadership framework or documents to share?', help: 'Paste the text or upload a .txt, .md or .pdf file. The prototype reads text files only.', chips: [{ label: 'No framework', value: 'No framework' }], input: 'framework', placeholder: 'Paste the framework text' };
      case 'tone': return { prompt: 'What tone should the story take?', chips: (Object.keys(TONE_LABELS) as Array<keyof typeof TONE_LABELS>).map(k => ({ label: TONE_LABELS[k], value: TONE_LABELS[k] })), input: 'text', placeholder: 'Describe the tone' };
    }
  })();
  return { id, ...q };
}

export interface Plan {
  next: QuestionId | null;
  /** Set when the next question re-asks something an upload or answer covered: the value to confirm. */
  confirm?: string;
  n: number;
  about: number;
}

/** The next question, and "Question n of about m". */
export function planQuestions(brief: Brief, asked: readonly QuestionId[]): Plan {
  const remaining = QUESTION_ORDER.filter(id => !asked.includes(id) && !covered(brief, id));
  const about = Math.min(MAX_QUESTIONS, Math.max(MIN_QUESTIONS, asked.length + remaining.length));
  const n = asked.length + 1;
  if (asked.length >= MAX_QUESTIONS) return { next: null, n: asked.length, about: asked.length };
  if (remaining.length) return { next: remaining[0], n, about };
  if (asked.length < MIN_QUESTIONS) {
    // Covered by an upload or an earlier answer, but too few questions asked: confirm the next one.
    const next = QUESTION_ORDER.find(id => !asked.includes(id))!;
    return { next, confirm: describe(brief, next), n, about };
  }
  return { next: null, n: asked.length, about: asked.length };
}

const pick = <T extends string>(text: string, table: Record<T, string>): T | undefined =>
  (Object.keys(table) as T[]).find(k => text.toLowerCase().includes(table[k].toLowerCase().split(' ')[0].toLowerCase()));

/** Applies an answer to the brief. Returns an error to show when the answer cannot be used. */
export function applyAnswer(brief: Brief, id: QuestionId, raw: string): { brief: Brief; error?: string } {
  const text = raw.trim();
  if (!text) return { brief, error: 'Type an answer or pick one of the suggestions.' };
  const next: Brief = { ...brief, documents: [...brief.documents] };
  switch (id) {
    case 'role_level': next.roleLevel = text; break;
    case 'industry': next.industry = INDUSTRIES.find(i => i.label.toLowerCase() === text.toLowerCase() || i.keywords.test(text))?.label ?? text; break;
    case 'challenge': next.challenge = text; break;
    case 'client': next.client = /^(fictional|none|no client|n\/a)\b/i.test(text) ? null : text.slice(0, 60); break;
    case 'team_size': {
      const n = parseTeamSize(text);
      if (n === null) return { brief, error: 'Pick a team size from 6 to 12.' };
      next.teamSize = n; break;
    }
    case 'process': {
      const s = parseStages(text);
      if (!s) return { brief, error: 'List 3 to 6 stage names, separated by commas.' };
      next.process = s; break;
    }
    case 'duration': {
      const d = pick(text, { full: 'Full', standard: 'Standard', lite: 'Lite' });
      if (!d) return { brief, error: 'Choose Full, Standard or Lite.' };
      next.duration = d; break;
    }
    case 'language': {
      const r = regionOf(text) ?? REGIONS[0];
      next.region = r.id; next.language = regionOf(text) ? r.label : text; break;
    }
    case 'framework': next.framework = /^(no|none|no framework|not yet)\b/i.test(text) ? null : text; break;
    case 'tone': next.tone = pick(text, { professional: 'Professional', warm: 'Warm', direct: 'Direct' }) ?? 'professional'; break;
  }
  // An answer can cover later questions too ("first time managers at a bank in India").
  if (id !== 'framework') Object.assign(next, inferBrief(text, next, { upload: false }));
  return { brief: next };
}

/** Adds an uploaded or pasted document and reads what it covers. */
export function addDocument(brief: Brief, doc: { name: string; text: string | null }): Brief {
  const next: Brief = { ...brief, documents: [...brief.documents, doc] };
  return doc.text ? { ...next, ...inferBrief(doc.text, next, { upload: true }) } : next;
}
