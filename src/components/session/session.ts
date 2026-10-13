import { useCallback } from 'react';
import { create } from 'zustand';
import type { EngineClient } from '../../engine/client';
import { useOptionalEngineClient } from '../../engine/react';

/**
 * Save and sign out on the engine player (D213). The engine saves the run after every intent, so Save
 * does not write anything of its own: it waits until every action this browser sent has been confirmed by
 * the server (the resilient client's queue is empty, D86) and then says when. While offline the actions
 * wait on this device and go out once the connection is back; Save says so instead of claiming a save.
 * Sign out saves the same way, then leaves (to the learning platform, or to the signed out screen).
 */
export type SaveStatus = 'saved' | 'queued';
export interface SaveResult { status: SaveStatus; at: number }

interface SessionState {
  /** When the server last confirmed the run (an answered intent or a Save), as epoch ms. */
  savedAt: number | null;
  /** The participant signed out on a launch with no return address: the board shows the signed out screen. */
  signedOut: boolean;
  /** When the participant signed out (epoch ms), for the signed out screen. */
  signedOutAt: number | null;
  /** A Save or a sign out is waiting for the server. */
  saving: boolean;
  markSaved(at?: number): void;
  setSignedOut(v: boolean): void;
  setSaving(v: boolean): void;
}

export const useSession = create<SessionState>(set => ({
  savedAt: null,
  signedOut: false,
  signedOutAt: null,
  saving: false,
  markSaved: (at = Date.now()) => set({ savedAt: at }),
  setSignedOut: v => set({ signedOut: v, signedOutAt: v ? Date.now() : null }),
  setSaving: v => set({ saving: v })
}));

/** What the resilient client (D86) exposes about its queue; a plain client has none, so it never waits. */
interface Queue { state(): { online: boolean; pending: number }; subscribe(fn: () => void): () => void }
const queueOf = (c: EngineClient | null): Queue | null => (c && 'state' in c && 'subscribe' in c ? (c as unknown as Queue) : null);

/**
 * Resolves once nothing this browser sent is waiting for the server: `saved`; or `queued` when the browser
 * is offline, or the queue has not drained within `timeout` ms (the actions stay queued on this device).
 */
export function flush(client: EngineClient | null, timeout = 8000): Promise<SaveStatus> {
  const q = queueOf(client);
  if (!q || q.state().pending === 0) return Promise.resolve('saved');
  if (!q.state().online) return Promise.resolve('queued');
  return new Promise(resolve => {
    let done = false;
    const finish = (s: SaveStatus) => { if (done) return; done = true; off(); clearTimeout(timer); resolve(s); };
    const off = q.subscribe(() => {
      const st = q.state();
      if (st.pending === 0) finish('saved');
      else if (!st.online) finish('queued');
    });
    const timer = setTimeout(() => finish('queued'), timeout);
  });
}

/** Save progress now: waits for the server to confirm everything sent, then records when. */
export function useSaveProgress() {
  const client = useOptionalEngineClient();
  return useCallback(async (): Promise<SaveResult> => {
    const s = useSession.getState();
    s.setSaving(true);
    try {
      const status = await flush(client);
      const at = Date.now();
      if (status === 'saved') useSession.getState().markSaved(at);
      return { status, at };
    } finally {
      useSession.getState().setSaving(false);
    }
  }, [client]);
}

/**
 * Sign out: saves first, then leaves to the learning platform when the launch gave a return address
 * (`leave`), else shows the signed out screen. Returns the save's result.
 */
export function useSignOut(leave?: () => void) {
  const save = useSaveProgress();
  return useCallback(async (): Promise<SaveResult> => {
    const r = await save();
    if (leave) leave();
    else useSession.getState().setSignedOut(true);
    return r;
  }, [save, leave]);
}
