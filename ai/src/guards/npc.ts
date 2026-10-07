import { sanitizeCopy } from '../../../src/i18n/copy';

/**
 * Output guardrails for NPC replies. The prompt asks the model to stay in role; these checks make sure a
 * reply that does not never reaches the participant (docs/AI.md, Guardrails):
 *
 * - out of role: the NPC talks about being an AI, a model, a bot, a character, a simulation or its prompt;
 * - scoring: it mentions scores, rubrics, bands, evaluation or its trust and morale as numbers;
 * - leak: it repeats the author's description of its hidden concern, or shares the concern while trust is
 *   below the floor where nobody would open up.
 *
 * Replies also pass the copy rules (no dashes, no emoji, "skills"). The signal tag the model ends with
 * (`[[signals reveal=yes|no end=yes|no]]`) is never released.
 */

export type NpcGuard = 'outOfRole' | 'scoring' | 'leak' | 'empty' | 'refusal' | 'error';

const OUT_OF_ROLE = /\b(?:as an ai|an ai (?:model|assistant|language model)|language model|chat ?bot|system prompt|my (?:instructions|prompt|programming)|i(?:'m| am) (?:just |only )?(?:an? )?(?:ai|bot|virtual|fictional|simulated|character|npc|assistant)\b|this (?:simulation|role ?play|game|exercise)|\bnpc\b|role ?play(?:ing)?\b|in character|out of character|stay in character)/i;
const SCORING = /\b(?:rubric|evaluator|(?:your|my|this|a|the) (?:leadership )?score|scor(?:ed|ing) (?:you|me|this conversation|your)|(?:strong|adequate|weak|harmful) band|band (?:of|is) (?:strong|adequate|weak|harmful)|you(?:'re| are) being (?:graded|scored|assessed|evaluated)|my (?:trust|morale|mood) (?:is at|level|score|value|meter)|(?:trust|morale) (?:score|level|meter|value|points?)|hidden concern|hidden state)\b/i;

const STOP = new Set(['the', 'and', 'that', 'this', 'with', 'from', 'what', 'when', 'have', 'been', 'into', 'over', 'they', 'them', 'their', 'there', 'about', 'more', 'than', 'just', 'some', 'very', 'will', 'would', 'could', 'should', 'does', 'his', 'her', 'hers', 'him', 'she', 'he', 'it', 'its', 'was', 'were', 'not', 'but', 'for', 'you', 'your', 'are', 'has', 'had', 'who', 'how', 'why', 'one', 'all', 'any', 'feels', 'felt']);
export const contentWords = (s: string) => [...new Set(s.toLowerCase().normalize('NFKC').match(/\p{L}{3,}/gu) ?? [])].filter(w => !STOP.has(w));

/** Share of `source`'s content words that `text` contains (0 to 1). */
export function overlap(text: string, source: string): number {
  const src = contentWords(source);
  if (src.length < 3) return 0;
  const have = new Set(contentWords(text));
  return src.filter(w => have.has(w)).length / src.length;
}

export interface GuardContext {
  /** The author's description of the hidden concern (third person). Never said as written. */
  hiddenConcern?: string;
  /** What the person says when the concern surfaces. */
  concernLine?: string;
  /** Below this trust nobody opens up, whatever the model decides. */
  shareBlocked: boolean;
}

/** Guardrails a piece of reply text breaks. */
export function checkReply(text: string, g: GuardContext): NpcGuard[] {
  const out: NpcGuard[] = [];
  if (OUT_OF_ROLE.test(text)) out.push('outOfRole');
  if (SCORING.test(text)) out.push('scoring');
  if ((g.hiddenConcern && overlap(text, g.hiddenConcern) >= 0.7) || (g.shareBlocked && g.concernLine && overlap(text, g.concernLine) >= 0.6)) out.push('leak');
  return out;
}

export interface Signals { reveal: boolean; end: boolean }
const TAG = /\[\[\s*signals?\b([^\]]*)\]\]?/i;
const TAG_START = '[[';

/** Splits the trailing signal tag off a reply. Missing or malformed tag: no reveal, no sign off. */
export function splitSignals(raw: string): { text: string; signals: Signals; tagged: boolean } {
  const i = raw.indexOf(TAG_START);
  const text = (i >= 0 ? raw.slice(0, i) : raw).trim();
  const m = i >= 0 ? raw.slice(i).match(TAG) : null;
  const yes = (k: string) => !!m && new RegExp(`\\b${k}\\s*=\\s*(?:yes|true|1)\\b`, 'i').test(m[1]);
  return { text, signals: { reveal: yes('reveal'), end: yes('end') }, tagged: !!m };
}

const SENTENCE_END = /[.!?…。！？](?:["'”’)\]]*)\s+/g;

/**
 * Turns streamed model text into the words the participant sees. In `sentence` mode it releases whole
 * sentences once they pass the guardrails; in `none` mode it releases text as it arrives. Text from the
 * signal tag on is never released. After a violation nothing more is released.
 */
export class ReplyFilter {
  private raw = '';
  private released = 0;
  private parts: string[] = [];
  readonly guards: NpcGuard[] = [];

  constructor(private readonly g: GuardContext, private readonly mode: 'sentence' | 'none' = 'sentence') {}

  get blocked() { return this.guards.length > 0; }
  /** Everything released so far, as one reply. */
  get text() { return this.parts.join(this.mode === 'sentence' ? ' ' : '').trim(); }

  /** Where releasable text ends: before the tag, or before a trailing `[` that may start one. */
  private safeEnd(): number {
    const tag = this.raw.indexOf(TAG_START);
    if (tag >= 0) return tag;
    return this.raw.endsWith('[') ? this.raw.length - 1 : this.raw.length;
  }

  private emit(chunk: string, out: string[]) {
    if (!chunk.trim()) return;
    const bad = checkReply(chunk, this.g);
    if (bad.length) { this.guards.push(...bad); return; }
    const clean = this.mode === 'sentence' ? sanitizeCopy(chunk) : chunk;
    if (!clean) return;
    const piece = this.mode === 'sentence' && this.parts.length ? ` ${clean}` : clean;
    this.parts.push(clean);
    out.push(piece);
  }

  /** Adds streamed text; returns what may be shown now. */
  push(delta: string): string[] {
    const out: string[] = [];
    if (this.blocked) return out;
    this.raw += delta;
    const end = this.safeEnd();
    if (this.mode === 'none') {
      if (end > this.released) { this.emit(this.raw.slice(this.released, end), out); this.released = end; }
      return out;
    }
    const pending = this.raw.slice(this.released, end);
    SENTENCE_END.lastIndex = 0;
    let cut = 0;
    for (let m = SENTENCE_END.exec(pending); m; m = SENTENCE_END.exec(pending)) {
      this.emit(pending.slice(cut, m.index + m[0].length).trim(), out);
      cut = m.index + m[0].length;
      if (this.blocked) break;
    }
    this.released += cut;
    return out;
  }

  /** The stream ended: release the rest and read the signals. */
  finish(): { out: string[]; signals: Signals; tagged: boolean } {
    const { signals, tagged } = splitSignals(this.raw);
    const out: string[] = [];
    if (!this.blocked) {
      const tag = this.raw.indexOf(TAG_START);
      const rest = this.raw.slice(this.released, tag >= 0 ? tag : this.raw.length);
      this.emit(this.mode === 'sentence' ? rest.trim() : rest.replace(/\s+$/, ''), out);
      this.released = this.raw.length;
    }
    if (this.mode === 'none' && !this.blocked) {
      // Released as it came; check the reply as a whole once more.
      const bad = checkReply(this.text, this.g);
      if (bad.length) this.guards.push(...bad);
    }
    return { out, signals, tagged };
  }
}
