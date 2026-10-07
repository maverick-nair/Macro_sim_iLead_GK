/**
 * Makes everything outside `keep` inert (no focus, no pointer, hidden from assistive tech), the way
 * a modal dialog's background should be. Returns the undo.
 */
export function inertOutside(keep: HTMLElement): () => void {
  const changed: HTMLElement[] = [];
  for (let el: HTMLElement | null = keep; el && el !== document.body; el = el.parentElement) {
    for (const sib of Array.from(el.parentElement?.children ?? [])) {
      // Live regions stay out of it, so a message about the dialog (a failed confirm) is still announced.
      if (sib === el || !(sib instanceof HTMLElement) || sib.inert || sib.tagName === 'SCRIPT' || sib.matches('[aria-live], [role="status"], [role="alert"]')) continue;
      sib.inert = true;
      changed.push(sib);
    }
  }
  return () => changed.forEach(el => { el.inert = false; });
}
