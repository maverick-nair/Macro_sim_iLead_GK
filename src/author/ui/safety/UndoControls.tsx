import { useEffect, useState } from 'react';
import { useAuthor, useAuthorStore } from '../../model/store';
import { BUTTON, Modal, savedText } from '../kit';

const svg = (d: string) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d={d} /></svg>;
const UNDO = svg('M9 14L4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3');
const REDO = svg('M15 14l5-5-5-5M20 9H10a6 6 0 0 0 0 12h3');
const CLOCK = svg('M12 7v5l3 2M21 12a9 9 0 1 1-9-9 9 9 0 0 1 9 9z');

/** True when a key press belongs to a field: its own undo and redo apply there (D122). */
export function isEditable(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  if (t.isContentEditable) return true;
  if (t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement) return true;
  if (t instanceof HTMLInputElement) return !['button', 'checkbox', 'radio', 'range', 'color', 'file', 'submit', 'reset', 'image'].includes(t.type);
  return false;
}

/**
 * Ctrl or Cmd+Z undoes, Ctrl or Cmd+Shift+Z and Ctrl+Y redo, for the draft. Not while typing in a
 * field (the field's own undo applies) and not inside a dialog (its changes are not in the draft yet).
 */
export function useUndoKeys() {
  const store = useAuthorStore();
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || !(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      const redo = (k === 'z' && e.shiftKey) || (k === 'y' && !e.shiftKey && e.ctrlKey);
      const undo = k === 'z' && !e.shiftKey;
      if (!undo && !redo) return;
      if (isEditable(e.target) || (e.target instanceof Element && e.target.closest('[role="dialog"],[role="alertdialog"]'))) return;
      e.preventDefault();
      if (redo) store.getState().redo(); else store.getState().undo();
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [store]);
}

const when = (at: number) => new Date(at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

/** The draft's named versions: the current one, then each restore point with Restore (D122). */
export function HistoryDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const versions = useAuthor(s => s.versions);
  const failed = useAuthor(s => s.versionsFailed);
  const restore = useAuthor(s => s.restore);
  const saved = useAuthor(s => savedText(s.savedAt, s.saveFailed));
  const published = useAuthor(s => s.draft.publish.version);
  const title = useAuthor(s => s.draft.title);
  const list = [...versions].reverse();
  return (
    <Modal open={open} onOpenChange={onOpenChange} width="max-w-160" title="History"
      description="Versions are saved before a change that replaces or removes work, and when you publish. Restoring one can be undone.">
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-6 py-4">
        <section aria-labelledby="history-current" className="flex flex-col gap-0.5 rounded-12 bg-author-primary-faint p-3">
          <h3 id="history-current" className="m-0 text-14 font-800">Current version</h3>
          <p className="m-0 text-14">{title}</p>
          <p className="m-0 text-13 text-author-body">{saved}{published > 0 ? ` · Published as version ${published}` : ' · Not published yet'}</p>
        </section>
        {failed && <p className="m-0 text-13 text-author-need">Some versions could not be kept in this browser&rsquo;s storage. They are listed until you leave the page.</p>}
        {list.length === 0
          ? <p className="m-0 text-14 text-author-body">No saved versions yet.</p>
          : (
            <ol aria-label="Saved versions" className="m-0 flex list-none flex-col gap-2 p-0">
              {list.map(v => (
                <li key={v.id} className="flex items-center gap-3 rounded-12 border border-solid border-author-line px-3 py-2">
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="text-14 font-700">{v.label}</span>
                    <time dateTime={new Date(v.at).toISOString()} className="text-13 text-author-muted">{when(v.at)}</time>
                  </div>
                  <button type="button" className={BUTTON.secondary} aria-label={`Restore ${v.label}, ${when(v.at)}`} onClick={() => { restore(v.id); onOpenChange(false); }}>Restore</button>
                </li>
              ))}
            </ol>
          )}
      </div>
    </Modal>
  );
}

/** Undo, Redo and History in the workspace header, with a polite live region that says what each did. */
export function UndoControls() {
  const undo = useAuthor(s => s.undo);
  const redo = useAuthor(s => s.redo);
  const next = useAuthor(s => s.past[s.past.length - 1]?.label ?? null);
  const back = useAuthor(s => s.future[s.future.length - 1]?.label ?? null);
  const announcement = useAuthor(s => s.announcement);
  const [history, setHistory] = useState(false);
  useUndoKeys();
  const ICON = `${BUTTON.secondary} size-9 px-0`;
  return (
    <>
      <span className="flex shrink-0 items-center gap-1">
        <button type="button" className={ICON} aria-label="Undo" title={next ? `Undo: ${next}` : 'Nothing to undo'} disabled={!next} onClick={undo}>{UNDO}</button>
        <button type="button" className={ICON} aria-label="Redo" title={back ? `Redo: ${back}` : 'Nothing to redo'} disabled={!back} onClick={redo}>{REDO}</button>
        <button type="button" className={`${BUTTON.secondary} max-[1180px]:size-9 max-[1180px]:px-0`} aria-haspopup="dialog" onClick={() => setHistory(true)}>{CLOCK}<span className="max-[1180px]:sr-only">History</span></button>
      </span>
      {/* The same words twice in a row differ by a trailing space, so they are read again. */}
      <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">{announcement ? `${announcement.text}${announcement.n % 2 ? '' : '\u00a0'}` : ''}</span>
      <HistoryDialog open={history} onOpenChange={setHistory} />
    </>
  );
}
