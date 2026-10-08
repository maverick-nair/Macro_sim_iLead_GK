/**
 * What the synthetic player hears (D151): the other person's last line, read as one of a few kinds, so the
 * player's next line answers it. Written for how people talk at work, independent of the evaluator's cues
 * and of any one NPC's wording: it reads the model's NPC lines as well as the offline stand in's.
 *
 *   concern    a worry or a problem the person owns ("I am not sure what is expected of me anymore")
 *   pushback   doubt or resistance ("I am not sure that solves it, but fine", "Right. Anything else?")
 *   emotional  a feeling, either way ("Honestly, it has been a rough week", "It means something that you noticed")
 *   question   a question to the player ("What is it about?")
 *   agreement  a yes, a commitment ("Fair. I will have it ready.")
 *   update     how the work is going ("Things are okay. The work is moving, slowly.")
 *   none       nothing said yet
 */
export type Heard = 'concern' | 'pushback' | 'emotional' | 'question' | 'agreement' | 'update' | 'none';

const CONCERN = /\b(?:worr(?:y|ied|ying)|afraid|scared|nervous|anxious|struggl\w*|not sure (?!that\b)|(?:have|has)(?: not|n't) gone well|not going well|on my mind|my concern|concerned about|the problem is|keeps me up|losing sleep|behind on|falling behind|trying, but|i do not know (?:how|what|if)|i don't know (?:how|what|if)|not working)\b/i;
const PUSHBACK = /\b(?:if you say so|not sure that|not really what|but fine|i doubt|not convinced|why should|disagree|that will not work|that won't work|i would rather (?:not|stop)|nobody asks|not okay)\b|\b(?:again|anything else|is that all)\?/i;
const FEELING = /\b(?:rough|tough|tired|exhausted|upset|frustrat\w*|stressed|hurt|fed up|overwhelm\w*|drained|burn(?:ed|t) out|means (?:something|a lot)|glad|happy|grateful|excited|proud|relieved|appreciate you)\b/i;
const NEGATIVE = /\b(?:rough|tough|tired|exhausted|upset|frustrat\w*|stressed|hurt|fed up|overwhelm\w*|drained|burn(?:ed|t) out|not okay|worr\w*|afraid|struggl\w*)\b/i;
const YES = /^(?:okay|ok|alright|all right|fair|sure|good|great|right|thanks|thank you|yes)\b|\b(?:sounds good|i can do that|i will (?:have|make|do|get|give|start|try|send)|that works|that helps|that is clear|will do|got it|makes sense)\b/i;

/** The kind of line the other person just said. */
export function hear(text: string | null | undefined): Heard {
  const t = (text ?? '').trim();
  if (!t) return 'none';
  if (PUSHBACK.test(t)) return 'pushback';
  // A line that ends on a question is a question; a question followed by a feeling is the feeling.
  if (/\?\s*$/.test(t)) return 'question';
  if (CONCERN.test(t)) return 'concern';
  if (FEELING.test(t)) return 'emotional';
  if (/\?/.test(t)) return 'question';
  if (YES.test(t)) return 'agreement';
  return 'update';
}

/** True when a line carries a hard feeling (for an emotional line: comfort, not celebrate). */
export const isNegative = (text: string | null | undefined) => NEGATIVE.test(text ?? '');

/** The other person's last line in a transcript, or null. */
export function lastHeard(transcript: ReadonlyArray<{ by: 'player' | 'other'; text: string }>): string | null {
  for (let i = transcript.length - 1; i >= 0; i--) if (transcript[i].by === 'other') return transcript[i].text;
  return null;
}
