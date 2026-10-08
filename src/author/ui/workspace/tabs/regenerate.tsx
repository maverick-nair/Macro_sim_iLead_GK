import { useRef, useState } from 'react';
import type { Tab } from '../../../model/draft';
import { regenerate, regenerateItem, regenSummary, type RegenResult } from '../../../model/regenerate';
import { useAuthor } from '../../../model/store';
import { BUTTON, Icon } from '../../kit';

/**
 * "Regenerate this tab" (D126): Kora drafts the tab again from the draft as it is now (the current brief,
 * industry, company, team and lens, not the chat's first answers) and replaces only what is still Kora's.
 * What the author wrote or edited stays, and the note says what changed and what was kept.
 */
export function useRegenerate(tab: Tab, label = 'Regenerate this tab') {
  const edit = useAuthor(s => s.edit);
  const [done, setDone] = useState<string | null>(null);
  return {
    button: <button type="button" className={BUTTON.secondary} onClick={() => { let r: RegenResult = { changed: [], kept: [] }; edit(d => { r = regenerate(d, { tab }); }); setDone(regenSummary(r)); }}>{Icon.refresh(14)} {label}</button>,
    note: done !== null ? <p role="status" className="m-0 mb-3 text-13 text-author-body">{done}</p> : null
  };
}

/** Regenerate one event or one person (D126): that item only, again on each press; returns the summary to show. */
export function useRegenerateItem() {
  const edit = useAuthor(s => s.edit);
  const presses = useRef(new Map<string, number>());
  return (scope: { event: string } | { character: string }): string => {
    const key = 'event' in scope ? `event:${scope.event}` : `character:${scope.character}`;
    const n = presses.current.get(key) ?? 0;
    presses.current.set(key, n + 1);
    let r: RegenResult = { changed: [], kept: [] };
    edit(d => { r = regenerateItem(d, scope, n); });
    if (!r.changed.length && r.kept.length) return 'You wrote this, so Kora kept it as it is. Edit it yourself, or ask Kora for a specific change.';
    return regenSummary(r);
  };
}
