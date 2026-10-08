import { useAuthor, useAuthorStore } from '../../model/store';
import { BUTTON } from '../kit';
import { downloadText, fileName } from './download';

const BAR = 'flex flex-none flex-wrap items-center gap-x-4 gap-y-2 border-b border-solid px-6 py-2.5 text-14 max-[1100px]:px-4';

/** Downloads the draft as it is in memory, for when it cannot be saved here. */
export function useDownloadDraft() {
  const store = useAuthorStore();
  return () => { const d = store.getState().draft; downloadText(fileName(d.title, 'draft'), JSON.stringify(d, null, 2)); };
}

/**
 * What could cost the author work, said in view at every width (D123, D124): another tab changed the
 * draft, storage is full or blocked, or the stored draft had to be repaired or could not be read. Each
 * says what happened and offers the way out. Shown above every /author page.
 */
export function SafetyNotices() {
  const conflict = useAuthor(s => s.conflict);
  const failed = useAuthor(s => s.saveFailed);
  const recovery = useAuthor(s => s.recovery);
  const resolve = useAuthor(s => s.resolveConflict);
  const dismiss = useAuthor(s => s.dismissRecovery);
  const restoreOriginal = useAuthor(s => s.restoreOriginal);
  const title = useAuthor(s => s.draft.title);
  const download = useDownloadDraft();
  if (!conflict && failed !== 'full' && failed !== 'blocked' && !recovery) return null;

  return (
    <div className="flex flex-none flex-col">
      {conflict && (
        <section role="alert" aria-label="Changed in another tab" className={`${BAR} border-author-need-line bg-author-need-field text-author-ink`}>
          <p className="m-0 min-w-0 flex-1"><b>This draft changed in another tab.</b> Changes here are not being saved until you pick which version to keep.</p>
          <span className="flex flex-wrap gap-2">
            <button type="button" className={BUTTON.primary} onClick={() => resolve('theirs')}>Reload to latest</button>
            <button type="button" className={BUTTON.secondary} onClick={() => resolve('mine')}>Keep mine</button>
          </span>
          <p className="m-0 basis-full text-13 text-author-body">Reload to latest keeps this tab&rsquo;s version in History. Keep mine saves this tab&rsquo;s draft over the other tab&rsquo;s, and keeps theirs in History.</p>
        </section>
      )}
      {!conflict && (failed === 'full' || failed === 'blocked') && (
        <section role="alert" aria-label="Not saved" className={`${BAR} border-author-need-line bg-author-need-field text-author-ink`}>
          <p className="m-0 min-w-0 flex-1">
            {failed === 'full'
              ? <><b>Your browser&rsquo;s storage for this site is full, so changes are not being saved.</b> Download a copy of your draft to keep your work, then free some space (older versions in History are removed first).</>
              : <><b>This browser is blocking storage for this site, so changes are not being saved.</b> A private window or a browser setting can do this. Download a copy of your draft to keep your work.</>}
          </p>
          <button type="button" className={BUTTON.primary} onClick={download}>Download draft</button>
        </section>
      )}
      {recovery && (
        <section aria-labelledby="recovery-title" className={`${BAR} border-author-line bg-author-primary-faint text-author-ink`}>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <h2 id="recovery-title" className="m-0 text-15 font-800">
              {recovery.unreadable ? 'Your saved draft could not be read' : 'Your saved draft was repaired'}
            </h2>
            <p className="m-0 text-14 text-author-body">
              {recovery.unreadable
                ? 'A new draft was started. The original is kept in this browser, so you can download it.'
                : `Some values could not be read as they were. Only these changed; everything else is as you left it. The original is kept in this browser.`}
            </p>
            {!recovery.unreadable && recovery.notes.length > 0 && (
              <details className="text-13">
                <summary className="cursor-pointer font-700 text-author-primary">What changed ({recovery.notes.length})</summary>
                <ul className="m-0 mt-1 flex max-h-40 flex-col gap-0.5 overflow-y-auto ps-5">
                  {recovery.notes.map((n, i) => <li key={i}>{n}</li>)}
                </ul>
              </details>
            )}
          </div>
          <span className="flex flex-wrap gap-2">
            <button type="button" className={BUTTON.secondary} onClick={() => downloadText(fileName(title, 'original'), recovery.original)}>Download the original</button>
            {recovery.restorable && <button type="button" className={BUTTON.secondary} onClick={restoreOriginal}>Restore original</button>}
            <button type="button" className={BUTTON.secondary} onClick={dismiss}>Got it</button>
          </span>
        </section>
      )}
    </div>
  );
}
