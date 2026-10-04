/**
 * Descriptive conversation analytics. COACHING DATA, NEVER SCORES.
 *
 * The Simulation Design allows audio to add descriptive analytics only (talk to listen ratio, open
 * versus closed questions) shown as coaching data. These numbers must never feed a skill rating,
 * an outcome or the engine's judgement, and must never be labelled as a grade. They work on
 * transcripts and turn timing only: nothing here looks at how a voice sounds, and there is no
 * emotion inference.
 */

export interface Turn {
  /** `participant` is the learner; any other value is someone they listen to (an NPC). */
  speaker: 'participant' | (string & {});
  /** Spoken duration. When any turn lacks it, the ratio falls back to word counts. */
  durationMs?: number;
  text?: string;
}

export interface TalkListen {
  /** Participant talk, in ms or words (see `basis`). */
  talk: number;
  /** Everyone else, same unit. */
  listen: number;
  /** talk / (talk + listen), 0..1. 0 when nobody spoke. */
  talkShare: number;
  /** talk / listen, or null when nobody else spoke. */
  ratio: number | null;
  basis: 'time' | 'words';
}

const words = (t = '') => t.split(/\s+/).filter(Boolean).length;

/** Talk to listen ratio over a conversation. Coaching data, never a score. */
export function talkListenRatio(turns: readonly Turn[]): TalkListen {
  const byTime = turns.length > 0 && turns.every(t => typeof t.durationMs === 'number' && t.durationMs >= 0);
  const size = (t: Turn) => (byTime ? t.durationMs! : words(t.text));
  let talk = 0;
  let listen = 0;
  for (const t of turns) {
    if (t.speaker === 'participant') talk += size(t);
    else listen += size(t);
  }
  const total = talk + listen;
  return { talk, listen, talkShare: total ? talk / total : 0, ratio: listen ? talk / listen : null, basis: byTime ? 'time' : 'words' };
}

export type QuestionKind = 'open' | 'closed';

export interface QuestionCounts {
  open: number;
  closed: number;
  total: number;
  questions: Array<{ text: string; kind: QuestionKind }>;
}

// Leading fillers that do not change the kind of question ("So, what happened?").
const FILLER = /^(?:(?:so|and|but|okay|ok|well|um+|uh+|right|now|then|alright|hey|look|listen|also|just)\b[\s,]*)+/i;
const OPEN_START = /^(?:what|how|why|who|whom|whose|where|when|which|in what way|to what extent|tell me|describe|explain|walk me through|talk me through|help me understand|share)\b/i;
// Polite wrappers around an open request: "Could you tell me ...", "Can you walk me through ...".
const OPEN_REQUEST = /^(?:can|could|would|will) you (?:please )?(?:tell|describe|explain|walk|talk|share|say more|help me understand|expand|elaborate)\b/i;
const CLOSED_START =
  /^(?:is|isn't|are|aren't|am|was|wasn't|were|weren't|do|don't|does|doesn't|did|didn't|can|can't|could|couldn't|will|won't|would|wouldn't|shall|should|shouldn't|have|haven't|has|hasn't|had|hadn't|may|might|must)\b/i;

/**
 * Classifies one sentence as an open or closed question, or null when it is not a question.
 * English heuristics. A sentence ending in "?" is always a question (closed unless it leads with an
 * open form). Without the "?", which speech transcripts often lose, only clear leads count.
 */
export function classifyQuestion(sentence: string): QuestionKind | null {
  const trimmed = sentence.trim();
  const s = trimmed.replace(FILLER, '').trim();
  if (!s) return null;
  const kind: QuestionKind | null = OPEN_REQUEST.test(s) || OPEN_START.test(s) ? 'open' : CLOSED_START.test(s) ? 'closed' : null;
  // "You finished it?" is a yes or no question in statement form.
  if (trimmed.endsWith('?')) return kind ?? 'closed';
  return kind && looksLikeUnpunctuatedQuestion(s) ? kind : null;
}

/**
 * Counts open and closed questions the participant asked. Open questions invite an explanation
 * (what, how, why, tell me); closed ones invite yes or no (is, do, can, did, or a statement ending
 * in "?"). A heuristic for English transcripts: coaching data, never a score.
 */
export function questionCounts(text: string): QuestionCounts {
  const questions: QuestionCounts['questions'] = [];
  for (const raw of text.match(/[^.?!\n]+[.?!]*/g) ?? []) {
    const sentence = raw.trim();
    const kind = sentence ? classifyQuestion(sentence) : null;
    if (kind) questions.push({ text: sentence, kind });
  }
  const open = questions.filter(q => q.kind === 'open').length;
  return { open, closed: questions.length - open, total: questions.length, questions };
}

/** Speech transcripts often drop the "?". Accept auxiliary + pronoun leads and open prompts. */
function looksLikeUnpunctuatedQuestion(s: string): boolean {
  if (OPEN_REQUEST.test(s) || /^(?:tell me|describe|explain|walk me through|talk me through|help me understand)\b/i.test(s)) return true;
  // "What do you think" and "How are things" are questions; "What I mean is" and "How you
  // handle it matters" put a subject straight after the question word, so they are statements.
  if (/^(?:what|how|why|who|where|when|which)\b/i.test(s)) return !/^\w+ (?:i|we|they|he|she|you|it|this|that)\b/i.test(s);
  return /^(?:is|are|was|were|do|does|did|can|could|will|would|should|have|has|had) (?:you|we|they|he|she|it|i|there|this|that)\b/i.test(s);
}
