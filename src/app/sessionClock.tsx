import { useEffect } from 'react';
import { create } from 'zustand';

/**
 * The session clock on the engine board (D13): the app shell's wall time, counting down from the
 * saved session, shown in the HUD's Pause button. The engine has no clock of its own. It runs while
 * the board is on screen, and stops while the run is paused (any app dialog), in style setting, live
 * conversations, event cards and the week end (spec: the clock pauses in live screens, modals and
 * events). A store of its own, so only the HUD text re-renders each second.
 */
interface SessionClockState {
  secs: number;
  set(secs: number): void;
  tick(): void;
}

export const useSessionClock = create<SessionClockState>(set => ({
  secs: 0,
  set: secs => set({ secs: Math.max(0, Math.round(secs)) }),
  tick: () => set(s => ({ secs: Math.max(0, s.secs - 1) }))
}));

/** Counts the session clock down once a second while `running`. */
export function useSessionTicker(running: boolean) {
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => useSessionClock.getState().tick(), 1000);
    return () => clearInterval(id);
  }, [running]);
}

/** "m:ss", as the prototype HUD shows it. */
export const clockText = (secs: number) => `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;

/** The clock's text, subscribed on its own. */
export function SessionClockText() {
  const secs = useSessionClock(s => s.secs);
  return <>{clockText(secs)}</>;
}
