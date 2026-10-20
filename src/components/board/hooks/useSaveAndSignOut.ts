import { useEffect, useState } from 'react';
import type { I18n } from '../../../i18n';
import { useSaveProgress, useSession, useSignOut } from '../../session/session';

interface Input {
  /** Leave to the learning platform (D89), when the launch gave a return address. */
  onExit?: () => void;
  say: (msg: string) => void;
  t: I18n['t'];
}

/** Save and sign out (D213): the session's state, Save now with its note, and leaving. */
export function useSaveAndSignOut({ onExit, say, t }: Input) {
  const session = useSession();
  // The view just came from the server, so the run as shown is the saved one.
  useEffect(() => { if (useSession.getState().savedAt === null) useSession.getState().markSaved(); }, []);
  const saveProgress = useSaveProgress();
  const leave = useSignOut(onExit);
  const [saveNote, setSaveNote] = useState<string | null>(null);
  const saveNow = async () => {
    const r = await saveProgress();
    const note = t('session.save.toast', { status: r.status, at: r.at });
    setSaveNote(note);
    say(note);
  };
  return { session, saveNote, saveNow, leave };
}
