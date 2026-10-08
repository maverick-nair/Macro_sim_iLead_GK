import type { Brief, Clarify, Question, QuestionId } from '../api/author';
import { QUESTION_IDS } from '../api/author';
import { CHALLENGES, DEFAULT_PROCESS, DURATION_MODES, INDUSTRIES, OTHER_CHALLENGES, parseStages, PROCESSES, regionOf, REGIONS, ROLE_LEVELS, TONE_LABELS } from './context';
import { inferBrief, parseTeamSize } from './extract';
import { fillBrief, frameworkOf, industryClarify, industryOfText, inlineFramework, isLong, levelOnly, readBrief, SIZE_PROMPT, sizeClarify, tookFrom, type TookItem } from './read';

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
    case 'framework': {
      if (brief.framework === null) return 'No framework';
      if (!brief.framework) return '';
      const inline = inlineFramework(brief.framework);
      const dims = frameworkOf(brief.framework);
      return inline ? `${inline.name}: ${inline.skills.join(', ')}` : dims.length ? `Framework shared: ${dims.map(d => d.name).join(', ')}` : 'Framework shared';
    }
    case 'tone': return brief.tone ? TONE_LABELS[brief.tone] : '';
  }
}

const chips = (labels: readonly string[]) => labels.map(l => ({ label: l, value: l }));

/** The question as the chat asks it. */
export function questionFor(id: QuestionId, _brief?: Brief): Question {
  const q = ((): Omit<Question, 'id'> => {
    switch (id) {
      case 'role_level': return { prompt: 'Who are your participants?', help: 'Their role level shapes the team they lead and the lens we suggest.', chips: chips(ROLE_LEVELS.map(r => r.label)), input: 'text', placeholder: 'For example, first time sales managers' };
      case 'industry': return { prompt: 'Which industry is the simulation set in?', help: 'Why we ask: it sets the company, the product, the customers and the words people use at work.', chips: [...chips(INDUSTRIES.map(i => i.label)), { label: DECIDE, value: DECIDE }], input: 'text', placeholder: 'Type an industry' };
      case 'challenge': return { prompt: 'What business challenge should the simulation reflect?', help: 'One line is enough. It shapes the events and the lens we suggest.', chips: chips([...CHALLENGES.map(c => c.label), ...OTHER_CHALLENGES]), input: 'text', placeholder: 'Describe the challenge' };
      case 'client': return { prompt: 'Which client is this for?', help: 'We use the name for the company in the story. Choose a fictional company to keep it neutral.', chips: [{ label: 'Fictional company', value: 'Fictional company' }], input: 'text', placeholder: 'Client name' };
      case 'team_size': return { prompt: 'How many people are in the participant\'s team?', help: 'From 6 to 12. Most builds use 10.', chips: [6, 8, 10, 12].map(n => ({ label: n === 10 ? '10 (default)' : String(n), value: String(n) })), input: 'number', placeholder: '6 to 12' };
      case 'process': return { prompt: 'What work process does the team run?', help: 'Pick one, or type 3 to 6 stage names separated by commas.', chips: PROCESSES.map(p => ({ label: p === DEFAULT_PROCESS ? `${p.label} (default)` : p.label, value: p.label, detail: p.stages.join(', ') })), input: 'text', placeholder: 'Stage, stage, stage' };
      case 'duration': return { prompt: 'How long should a run take?', help: 'Why we ask: it sets how many weeks the participant plays and how long a run takes, so it fits the time your programme has.', chips: (Object.keys(DURATION_MODES) as Array<keyof typeof DURATION_MODES>).map(k => ({ label: DURATION_MODES[k].label, value: DURATION_MODES[k].label, detail: DURATION_MODES[k].detail })), input: 'text', placeholder: 'Full, Standard or Lite' };
      case 'language': return { prompt: 'Which language and region?', help: 'The region sets the currency and names. The draft is written in English; translation follows in the workspace.', chips: chips(REGIONS.map(r => r.label)), input: 'text', placeholder: 'Language and region' };
      case 'framework': return { prompt: 'Does the client have a leadership framework or documents to share?', help: 'Paste the text or upload a .txt, .md or .pdf file. The prototype reads text files only.', chips: [{ label: 'No framework', value: 'No framework' }], input: 'framework', placeholder: 'Paste the framework text' };
      case 'tone': return { prompt: 'What tone should the story take?', help: 'Why we ask: it sets how the sponsor, the team and the messages sound to the participant.', chips: (Object.keys(TONE_LABELS) as Array<keyof typeof TONE_LABELS>).map(k => ({ label: TONE_LABELS[k], value: TONE_LABELS[k] })), input: 'text', placeholder: 'Describe the tone' };
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

/**
 * The next question, and "Question n of about m". `taken` are questions a long answer or an upload answered and the
 * chat said back with a way to change each (D146): they count toward the minimum, so they are not asked again.
 */
export function planQuestions(brief: Brief, asked: readonly QuestionId[], taken: readonly QuestionId[] = []): Plan {
  const done = [...asked, ...taken.filter(t => !asked.includes(t))];
  const remaining = QUESTION_ORDER.filter(id => !done.includes(id) && !covered(brief, id));
  const extra = Math.max(0, MIN_QUESTIONS - done.length - remaining.length);
  const n = asked.length + 1;
  const about = Math.min(MAX_QUESTIONS, Math.max(n, asked.length + remaining.length + extra));
  if (asked.length >= MAX_QUESTIONS) return { next: null, n: asked.length, about: asked.length };
  if (remaining.length) return { next: remaining[0], n, about };
  if (done.length < MIN_QUESTIONS) {
    // Covered by an upload or an earlier answer, but too few questions asked: confirm the next one.
    const next = QUESTION_ORDER.find(id => !done.includes(id))!;
    return { next, confirm: describe(brief, next), n, about };
  }
  return { next: null, n: asked.length, about: asked.length };
}

/** The chip that hands a choice to Kora, said back in the chat (D133). */
export const DECIDE = 'Decide for me';

/** An answer that says "I do not know" rather than giving one: never taken as a name or an industry (D133). */
const UNSURE = /^\s*(?:i\s*d\s*k|idk|dunno|i\s+(?:do\s*n[o']?t|dont)\s+know|do\s*n[o']?t\s+know|not\s+sure(?:\s+yet)?|unsure|no\s+idea|no\s+clue|tbd|to\s+be\s+decided|not\s+decided(?:\s+yet)?|\?+|hmm+|whatever|anything)\s*[.!?]*\s*$/i;
/** Asking Kora to choose. */
const DELEGATE = /^\s*(?:decide for me|you decide|you choose|you pick|pick (?:one )?for me|surprise me|your call|up to you)\s*[.!]*\s*$/i;
/** Words that describe a tone, not a step of work: "warm and brisk and direct" is not a work process. */
const TONE_WORDS = /^(?:warm|warmly|brisk|direct|professional|friendly|formal|informal|casual|encouraging|supportive|serious|light|lighthearted|fun|playful|calm|upbeat|firm|kind|positive|tough|strict|gentle|crisp|clear|honest|energetic|relaxed|motivating|inspiring|urgent|punchy|neutral|human|empathetic|confident|bold|realistic|challenging)$/i;
/** A team size in words that is not a number. */
const VAGUE_SIZE = /\b(?:a few|few|several|some|small|a handful|handful|many|lots|a lot|big|large|medium|average|normal|typical)\b/i;
/** An answer that reads as a request or as who the participants are, not as an industry ("create a simulation for senior managers"). */
const NOT_AN_INDUSTRY = /\b(?:simulations?|create|build|make|participants?|managers?|leaders?|directors?|vps?|executives?|supervisors?|team leads?)\b/i;

/** Why an "I do not know" answer cannot be used, and what to do instead, per question. */
const UNSURE_HELP: Record<QuestionId, string> = {
  role_level: 'Tell me who will play it, even roughly, for example first time managers. Or pick one below.',
  industry: `No problem. Pick an industry below, or choose ${DECIDE} and I will pick one you can change later.`,
  challenge: 'Pick one of the challenges below, or describe the pressure your participants face in one line.',
  client: 'That is fine. Choose Fictional company and I will make one up, or type the client\'s name.',
  team_size: SIZE_PROMPT,
  process: 'Pick one of the processes below. The Sales Elevator funnel is a good place to start.',
  duration: 'Choose Full, Standard or Lite. Standard, about an hour, suits most programmes.',
  language: 'Pick a language and region below. If you are not sure yet, English, global is a safe start.',
  framework: '',
  tone: ''
};

/** "Create a leadership simulation for senior managers" names the participants after "for". */
function participantsOf(text: string): string {
  const m = text.match(/^(?:please\s+)?(?:can you\s+)?(?:create|build|make|design|develop|write)\s+(?:me\s+|us\s+)?(?:an?\s+)?(?:[\w-]+\s+){0,2}?simulations?\s+(?:for|aimed at|targeting)\s+(.+)$/i);
  if (!m) return text;
  const rest = m[1].trim().replace(/[.!]+$/, '');
  return rest.charAt(0).toUpperCase() + rest.slice(1);
}

const pick = <T extends string>(text: string, table: Record<T, string>): T | undefined =>
  (Object.keys(table) as T[]).find(k => text.toLowerCase().includes(table[k].toLowerCase().split(' ')[0].toLowerCase()));

/** What an answer did: the brief after it, and what to say. */
export interface Applied {
  brief: Brief;
  /** Shown under the answer box; the same question is asked again. */
  error?: string;
  /** Kora decided something for the author: said back in the chat. */
  note?: string;
  /** One short question with choices before going on (D147). */
  clarify?: Clarify;
  /** What a long answer gave, said back as "I took these from your brief" (D146). */
  took?: TookItem[];
  /** False when a long answer did not answer the question asked: it is asked again. */
  answered?: boolean;
}

/** Who the participants lead, when the answer names a level only ("Senior managers"). */
function levelClarify(level: string): Clarify {
  return {
    id: 'role_level', prompt: `${level} leading which kind of team? It decides the work the team does and the people in it.`,
    choices: [
      { label: 'Sales teams', value: `${level} leading sales teams` },
      { label: 'Service or operations teams', value: `${level} leading service or operations teams` },
      { label: 'Product or engineering teams', value: `${level} leading product or engineering teams` },
      { label: `Keep it as ${level.toLowerCase()}`, value: level }
    ]
  };
}

/** An answer to the industry question that is not an industry: ask which, with the industries as choices. */
const industryAgain = (): Clarify => ({
  id: 'industry', prompt: 'That sounds like who the participants are, not an industry. Which industry is the simulation set in?',
  choices: [...INDUSTRIES.slice(0, 7).map(i => ({ label: i.label, value: i.label })), { label: DECIDE, value: DECIDE }]
});

/**
 * A long answer (a pasted brief) read whole (D146): every field it states fills the brief, the question asked takes
 * its own field from it, and what was taken is said back. Ambiguity becomes one clarifying question (D147).
 */
function applyLong(brief: Brief, id: QuestionId, text: string): Applied {
  const r = readBrief(text, brief);
  let next = fillBrief(brief, r.fields);
  // The question asked takes the part of the answer that is its own; a challenge may be the whole answer.
  if (id === 'challenge' && !next.challenge) next = { ...next, challenge: text.slice(0, 4000) };
  if (id === 'tone' && !next.tone) next = { ...next, tone: pick(text, { professional: 'Professional', warm: 'Warm', direct: 'Direct' }) ?? 'professional' };
  if (id === 'process' && !next.process) { const s = parseStages(text); if (s) next = { ...next, process: s }; }
  const clarify = r.clarify && !covered(next, r.clarify.id) ? r.clarify : undefined;
  return { brief: next, took: tookFrom(brief, next), answered: covered(next, id), ...(clarify ? { clarify } : null) };
}

/** The chips' own words: a chip says exactly what it means, so it is never a reason to ask again. */
const chipValues = () => new Set(QUESTION_IDS.flatMap(id => questionFor(id).chips.map(c => c.value.toLowerCase())));

/**
 * Applies an answer to the brief. Returns an error to show when the answer cannot be used (the question is
 * asked again with what would work), a `note` when Kora decided something for the author, and a clarifying
 * question when the answer is ambiguous or contradicts itself (D147). A long answer is read whole (D146).
 * "I do not know" is never taken as an answer (D133): not as a name, an industry or a language.
 * `clarified`: the answer is a choice of a clarifying question, so it is taken as it is.
 */
export function applyAnswer(brief: Brief, id: QuestionId, raw: string, opts: { clarified?: boolean } = {}): Applied {
  const text = raw.trim();
  if (!text) return { brief, error: 'Type an answer or pick one of the suggestions.' };
  const next: Brief = { ...brief, documents: [...brief.documents] };
  let note: string | undefined;
  let clarify: Clarify | undefined;
  const unsure = UNSURE.test(text);
  const delegated = DELEGATE.test(text);
  if (unsure && id !== 'framework' && id !== 'tone') return { brief, error: UNSURE_HELP[id] };
  if (id !== 'framework' && !opts.clarified && isLong(text)) return applyLong(brief, id, text);
  const chip = opts.clarified || chipValues().has(text.toLowerCase());
  switch (id) {
    case 'role_level':
      if (delegated) return { brief, error: UNSURE_HELP.role_level };
      next.roleLevel = participantsOf(text);
      // "Senior managers" says the level, not what they lead: kept, and one question asks (D147).
      if (!chip && levelOnly(next.roleLevel)) clarify = levelClarify(next.roleLevel);
      break;
    case 'industry': {
      if (delegated) {
        const guess = INDUSTRIES.find(i => i.keywords.test(`${brief.roleLevel ?? ''} ${brief.challenge ?? ''}`)) ?? INDUSTRIES[0];
        next.industry = guess.label;
        note = `I picked ${guess.label} for now. Change it any time in the Brief.`;
        break;
      }
      const exact = INDUSTRIES.find(i => i.label.toLowerCase() === text.toLowerCase());
      if (exact) { next.industry = exact.label; break; }
      const read = industryOfText(text);
      if (read.ambiguous && !opts.clarified) return { brief, clarify: industryClarify(read.ambiguous) };
      if (!read.industry && !opts.clarified && NOT_AN_INDUSTRY.test(text)) {
        // Who the participants are, typed where the industry goes: kept as the participants when there are none yet.
        return { brief: brief.roleLevel ? brief : { ...brief, roleLevel: participantsOf(text) }, clarify: industryAgain() };
      }
      next.industry = read.industry?.label ?? text; break;
    }
    case 'challenge':
      if (delegated) return { brief, error: UNSURE_HELP.challenge };
      next.challenge = text; break;
    case 'client':
      if (delegated) { next.client = null; note = 'I will make up a fictional company. Name it any time in Story and world.'; break; }
      next.client = /^(fictional|none|no client|n\/a)\b/i.test(text) ? null : text.slice(0, 60); break;
    case 'team_size': {
      const n = parseTeamSize(text);
      if (n === null) {
        const number = text.match(/\b(\d{1,3})\b/);
        if (number) return { brief, error: Number(number[1]) < 6 ? `iLead teams have 6 to 12 people, so ${number[1]} is too few to play. Pick 6 for a small team.` : `iLead teams have 6 to 12 people, so ${number[1]} is too many to play. Pick 12 for a large team.` };
        if (VAGUE_SIZE.test(text) || delegated) return { brief, clarify: sizeClarify([]) };
        return { brief, error: 'Pick a team size from 6 to 12.' };
      }
      next.teamSize = n; break;
    }
    case 'process': {
      const s = parseStages(text);
      const tones = s?.filter(x => TONE_WORDS.test(x.trim())) ?? [];
      if (s && tones.length * 2 >= s.length) return { brief, error: `Those sound like a tone (${tones.map(x => x.toLowerCase()).join(', ')}), not the steps of a work process. What steps does the team's work move through, in order? For example: Intake, Diagnose, Resolve, Review. You can set the tone later.` };
      if (!s) return { brief, error: delegated ? UNSURE_HELP.process : 'List 3 to 6 stage names, separated by commas.' };
      next.process = s; break;
    }
    case 'duration': {
      const d = pick(text, { full: 'Full', standard: 'Standard', lite: 'Lite' });
      if (!d) return { brief, error: 'Choose Full, Standard or Lite.' };
      next.duration = d; break;
    }
    case 'language': {
      if (delegated) { next.region = REGIONS[0].id; next.language = REGIONS[0].label; note = `I picked ${REGIONS[0].label}. Change it any time in the Brief.`; break; }
      const r = regionOf(text) ?? REGIONS[0];
      next.region = r.id; next.language = regionOf(text) ? r.label : text; break;
    }
    case 'framework': next.framework = unsure || /^(no|none|no framework|not yet)\b/i.test(text) ? null : text; break;
    case 'tone': next.tone = pick(text, { professional: 'Professional', warm: 'Warm', direct: 'Direct' }) ?? 'professional'; break;
  }
  // An answer can cover later questions too ("first time managers at a bank in India").
  if (id !== 'framework') Object.assign(next, inferBrief(text, next, { upload: false }));
  return { brief: next, ...(note ? { note } : null), ...(clarify ? { clarify } : null) };
}

/** Adds an uploaded or pasted document and reads what it covers: labelled lines first, then the whole text (D146). */
export function readDocument(brief: Brief, doc: { name: string; text: string | null }): { brief: Brief; took: TookItem[]; clarify?: Clarify } {
  const withDoc: Brief = { ...brief, documents: [...brief.documents, doc] };
  if (!doc.text) return { brief: withDoc, took: [] };
  const labelled: Brief = { ...withDoc, ...inferBrief(doc.text, withDoc, { upload: true }) };
  const r = readBrief(doc.text, labelled);
  const next = fillBrief(labelled, r.fields);
  const clarify = r.clarify && !covered(next, r.clarify.id) ? r.clarify : undefined;
  return { brief: next, took: tookFrom(brief, next), ...(clarify ? { clarify } : null) };
}

/** Adds an uploaded or pasted document and reads what it covers. */
export function addDocument(brief: Brief, doc: { name: string; text: string | null }): Brief {
  return readDocument(brief, doc).brief;
}
