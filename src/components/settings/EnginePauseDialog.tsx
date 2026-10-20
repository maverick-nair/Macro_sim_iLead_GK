import { useState } from 'react';
import { useEngineView } from '../../engine/react';
import { useI18n } from '../../i18n';
import { useSaveProgress, useSession, useSignOut } from '../session/session';
import { PauseDialog } from './SessionDialogs';

export interface EnginePauseDialogProps {
  onResume: () => void;
  /** Leaves to the learning platform after the save, when the launch gave a return address; else the signed out screen. */
  onLeave?: () => void;
  frozen?: boolean;
  returnFocus?: () => HTMLElement | null;
}

/**
 * The pause screen on the engine (D213): Resume, Save progress with the time the run was last saved, and
 * Sign out, which saves first. Save waits for the server to confirm what was sent; offline it says the
 * actions wait on this device.
 */
export function EnginePauseDialog({ onResume, onLeave, frozen, returnFocus }: EnginePauseDialogProps) {
  const { t } = useI18n();
  const view = useEngineView().data;
  const savedAt = useSession(s => s.savedAt);
  const saving = useSession(s => s.saving);
  const save = useSaveProgress();
  const signOut = useSignOut(onLeave);
  const [note, setNote] = useState<string | null>(null);
  return (
    // After signing out, focus goes to the signed out screen's heading, not back to what opened the dialog (gone with the board).
    <PauseDialog onResume={onResume} frozen={frozen} returnFocus={() => (useSession.getState().signedOut ? document.querySelector<HTMLElement>('[data-signed-out] h1') : returnFocus?.() ?? null)}
      session={{
        savedAt, saving, note, subPeriodUnit: view?.clock.subPeriodUnit ?? 'day',
        onSave: () => { void save().then(r => setNote(t('session.save.toast', { status: r.status, at: r.at }))); },
        // Without a return address the dialog closes first, then the signed out screen shows and takes focus.
        onSignOut: () => { void signOut().then(() => { if (!onLeave) onResume(); }); }
      }} />
  );
}
