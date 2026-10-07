import { useEffect } from 'react';
import type { PlanFields } from '../liveformats/PlanForm';

/**
 * What the participant has written in a live conversation but not sent (D86): the reply box, the
 * email, the sponsor notes, the plan and the interview notes. Kept per interaction in session storage
 * as it changes, so a reload or a crash brings it back; cleared when the conversation ends.
 */
export interface LiveDraft {
  draft: string;
  email: { subject: string; body: string };
  notes: string[];
  plan: PlanFields;
  cvNotes: Record<string, string>;
}

const key = (id: string) => `ilead.draft.${id}`;
const store = () => { try { return globalThis.sessionStorage ?? null; } catch { return null; } };

export function loadDraft(id: string): Partial<LiveDraft> {
  try { const raw = store()?.getItem(key(id)); return raw ? (JSON.parse(raw) as Partial<LiveDraft>) : {}; } catch { return {}; }
}
export function saveDraft(id: string, d: LiveDraft) {
  try { if (hasWords(d)) store()?.setItem(key(id), JSON.stringify(d)); else store()?.removeItem(key(id)); } catch { /* storage blocked: the draft lives on screen only */ }
}
export function clearDraft(id: string) {
  try { store()?.removeItem(key(id)); } catch { /* blocked */ }
}

/** Anything written and not sent. */
export function hasWords(d: LiveDraft): boolean {
  return !!(d.draft.trim() || d.email.subject.trim() || d.email.body.trim() || d.notes.some(n => n.trim())
    || d.plan.goals.trim() || d.plan.measures.trim() || d.plan.owner.trim() || d.plan.support.trim());
}

/**
 * Asks before the page unloads while a conversation has work in it (D86): words not sent, or a
 * conversation under way that the engine would close unfinished. The browser shows its own wording.
 */
export function useUnloadGuard(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Older browsers need a value; the text is never shown.
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [active]);
}
