import type { MoodKey, StyleKey } from '../../data/types';

/**
 * Shared shapes of the live interaction shell. Everything here is data: the engine (or the screen's
 * stand in) fills it, the components only render it and report intents back.
 */

/** All seven formats (spec, "Live interaction screens"). Chat, interview and plan stages live in liveformats (D14). */
export type LiveFormat = 'roleplay' | 'email' | 'meeting' | 'sponsor' | 'chat' | 'interview' | 'plan';


/** How the participant answers right now. */
export type LiveMode = 'voice' | 'text';

/**
 * Whose move it is. `npcSpeaking`: an NPC line is playing (speaking or pressing the mic interrupts it).
 * `npcThinking`: waiting for the AI reply. `yourTurn`: waiting for you. `closed`: the conversation
 * reached a natural close and can be ended.
 */
export type LiveConversation = 'npcSpeaking' | 'npcThinking' | 'yourTurn' | 'closed';

/** A person in a live interaction: an NPC, the sponsor, an attendee or a recipient. */
export interface LivePerson {
  id: string;
  /** Full name ("Kent Goldberg"). */
  name: string;
  /** For captions, tiles and running text. Defaults to the first word of `name`. */
  shortName?: string;
  /** Portrait URL. Empty when there is none (initials or the sponsor avatar show instead). */
  img: string;
  pronoun?: 'he' | 'she' | 'they';
}

export const shortNameOf = (p: Pick<LivePerson, 'name' | 'shortName'>) => p.shortName ?? p.name.trim().split(/\s+/)[0];

/** Up to two initials from a name, for avatars without a portrait. */
export const initialsOf = (name: string) =>
  name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');

/** One turn of the conversation, in order. */
export interface LiveTurn {
  id: string;
  speaker: 'you' | LivePerson;
  /** What was said so far. Grows token by token while `streaming`. */
  text: string;
  /** The NPC line is still arriving. */
  streaming?: boolean;
  /** The participant cut this NPC line off. */
  interrupted?: boolean;
  /** True for NPC lines written by the AI model: they carry the "AI persona" label (D27). */
  aiGenerated: boolean;
}

/** The NPC line under the portrait, meeting grid or sponsor avatar. */
export interface LiveCaptionLine {
  /** Short name of whoever is speaking. */
  name: string;
  text: string;
  streaming?: boolean;
  aiGenerated: boolean;
}

/** How the 1:1 counterpart comes across right now: the colour of the mood ring and the pill under it. */
export type LiveMood = 'frustrated' | 'guarded' | 'open';

/**
 * The brief card. Rows render in this order and only when present: agenda, what you know, mood,
 * open promises, your declared style, tone. `undefined` hides a row; `promises: []` reads "None yet"
 * and `declaredStyle: null` reads "Not set yet".
 */
export interface LiveBrief {
  /** Your goal for this moment. */
  goal: string;
  /** Meeting agenda items, numbered in the card. */
  agenda?: string[];
  /** What you know about the person (or, by format: watch for, what the sponsor cares about, the email's context). */
  known?: string[];
  /** Their current mood: a member mood key, or authored text such as a team mood or the sponsor's confidence. */
  mood?: { key: MoodKey } | { text: string };
  /** Promises you made to them that are still open. */
  promises?: string[];
  /** The style you declared for them this period. */
  declaredStyle?: StyleKey | null;
  /** Tone guidance for written formats. */
  tone?: string;
}

export const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-secondary';
