import { useState, type RefObject } from 'react';
import type { Intent, IntentResult } from '../../../engine/contract';
import type { LivePerson } from '../../liveshell/types';

/** "The team is reacting" lasts at least this long, so the evaluation reads as a moment (D53). */
export const REACTING_MS = 1600;

/** Ends a live interaction: the board shows "The team is reacting" and holds the outcome until it has had its moment. */
export type FinishLive = (intent: Extract<Intent, { type: 'endInteraction' | 'submitInteraction' | 'chooseCandidate' }>, people: LivePerson[]) => Promise<boolean>;

interface Input {
  send: (i: Intent) => Promise<IntentResult | null>;
  /** An intent is on its way: the board does not start another. */
  inFlight: RefObject<boolean>;
}

/** Live interactions: the board owns "The team is reacting", and whose reaction the outcome panel is showing. */
export function useLiveReacting({ send, inFlight }: Input) {
  /** Whose reaction is showing, for which outcome: a new outcome starts with none. */
  const [reveal, setReveal] = useState<{ outcome: string; id: string } | null>(null);
  /** "The team is reacting", for one interaction. The outcome waits behind it until its moment has passed. */
  const [reacting, setReacting] = useState<{ id: string; people: LivePerson[] } | null>(null);
  const finishLive: FinishLive = async (i, people) => {
    if (inFlight.current) return false;
    const id = i.interactionId;
    setReacting({ id, people });
    const started = Date.now();
    const r = await send(i);
    if (!r) { setReacting(null); return false; }
    await new Promise(res => setTimeout(res, Math.max(0, REACTING_MS - (Date.now() - started))));
    setReacting(cur => (cur?.id === id ? null : cur));
    return true;
  };
  return { reveal, setReveal, reacting, finishLive };
}
