import { useMemo, useRef, useState, type FocusEvent } from 'react';
import { applyChange, changeAction, changeTitle, scanRefs, type Change } from '../../model/deps';
import { useAuthor } from '../../model/store';
import { BUTTON } from '../kit';

/** What the places still have, in a few words. */
const STILL: Record<Change['kind'], string> = {
  person: 'still say the old name', company: 'still say the old name', product: 'still say the old name', sponsor: 'still say the old name',
  skills: 'still use the old skills', challenge: 'were drafted from the old challenge'
};

/**
 * "Update N places" (D148): after a rename, a new lens, a confirmed framework or a new challenge, the places that
 * still refer to the old value, found by the dependency scanner, with one button that updates them all as one named
 * step of undo (a version is saved first), or Leave them. It closes itself once nothing refers to the old value.
 */
export function UpdatePrompt() {
  const offer = useAuthor(s => s.offer);
  const draft = useAuthor(s => s.draft);
  const edit = useAuthor(s => s.edit);
  const setOffer = useAuthor(s => s.setOffer);
  const [done, setDone] = useState<string | null>(null);
  const refs = useMemo(() => (offer ? scanRefs(draft, offer) : []), [offer, draft]);
  if (!offer || !refs.length) return done ? <p role="status" className="m-0 flex-none px-7 pt-3 text-13 text-author-body max-[1100px]:px-5">{done}</p> : null;
  const { button, label } = changeAction(offer, refs.length);
  const n = refs.length;
  return (
    <section aria-label="Update what still refers to it" className="mx-7 mt-4 flex flex-none flex-col gap-2 rounded-16 border-2 border-solid border-author-kora bg-author-surface px-4 py-3 max-[1100px]:mx-5">
      <p className="m-0 text-15"><b>{changeTitle(offer)}.</b> {n} place{n === 1 ? '' : 's'} {STILL[offer.kind]}:</p>
      <ul className="m-0 flex flex-col gap-0.5 ps-5 text-14 text-author-body" aria-label="Places to update">
        {refs.slice(0, 5).map(r => <li key={r.path}>{r.where}</li>)}
        {n > 5 && <li>and {n - 5} more</li>}
      </ul>
      <span className="flex flex-wrap gap-2">
        <button type="button" className={BUTTON.kora} onClick={() => {
          let changed = 0;
          edit(d => { changed = applyChange(d, offer); }, { label, restorePoint: true });
          setOffer(null);
          setDone(`Updated ${changed} place${changed === 1 ? '' : 's'}. Undo is in the header.`);
        }}>{button}</button>
        <button type="button" className={BUTTON.secondary} onClick={() => { setOffer(null); setDone(null); }}>Leave them</button>
      </span>
    </section>
  );
}

/**
 * For a name field: focus remembers the name, and leaving the field with a different one offers to update every place
 * that still says the old one (D148).
 */
export function useRenameOffer(kind: 'company' | 'product' | 'sponsor') {
  const setOffer = useAuthor(s => s.setOffer);
  const at = useRef<string | null>(null);
  return {
    onFocus: (e: FocusEvent<HTMLInputElement>) => { at.current = e.currentTarget.value; },
    onBlur: (e: FocusEvent<HTMLInputElement>) => {
      const from = at.current, to = e.currentTarget.value;
      at.current = null;
      if (from?.trim() && to.trim() && from.trim() !== to.trim()) setOffer({ kind, from, to });
    }
  };
}
