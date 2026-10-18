import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type { EngineView } from '../../../engine/contract';

/** The outcome panel's headline, made focusable, when the outcome is on screen. */
export const headlineIn = (panel: HTMLElement | null) => {
  const h = panel?.querySelector<HTMLElement>('h2, h3');
  if (h && !h.hasAttribute('tabindex')) h.setAttribute('tabindex', '-1');
  return h ?? null;
};

/**
 * Where focus lands when the focused control disappears (Confirm styles, Go back, Got it, Start week, the
 * end of a conversation): focus would fall to the page. Put it somewhere sensible instead: a hint if one
 * was left, the outcome headline, or the screen's heading. A modal handles its own focus.
 */
export function useFocusRescue() {
  const mainRef = useRef<HTMLElement>(null);
  const h1Ref = useRef<HTMLHeadingElement>(null);
  const outcomeRef = useRef<HTMLDivElement>(null);
  const lastFocus = useRef<Element | null>(null);
  /** The dialog the last focused element was in, if any: focus stays in it when an item inside goes away. */
  const lastDialog = useRef<HTMLElement | null>(null);
  /** Where focus should go the next time it is lost, when somewhere better than the default is known. */
  const focusHintRef = useRef<(() => HTMLElement | null | undefined) | null>(null);

  const rescue = useCallback((closing = false) => {
    const main = mainRef.current;
    if (!main) return;
    const active = document.activeElement;
    if (active && active !== document.body) return;
    const lost = lastFocus.current;
    if (!lost || (lost.isConnected && (lost as HTMLElement).checkVisibility?.() !== false)) return;
    if (main.querySelector('[role="dialog"][aria-modal="true"]')) return;
    const dialog = lastDialog.current;
    if (dialog?.isConnected) { dialog.focus({ preventScroll: true }); return; }
    // A modal that just closed puts focus back itself (Radix), unless it hands that to us (`closing`).
    if (!closing && dialog?.getAttribute('aria-modal') === 'true') return;
    const hinted = focusHintRef.current?.();
    focusHintRef.current = null;
    (hinted ?? headlineIn(outcomeRef.current) ?? h1Ref.current)?.focus({ preventScroll: true });
  }, []);
  useEffect(() => {
    const main = mainRef.current;
    if (!main) return;
    const onFocusIn = (e: FocusEvent) => {
      lastFocus.current = e.target as Element;
      lastDialog.current = (e.target as Element).closest?.<HTMLElement>('[role="dialog"]') ?? null;
    };
    document.addEventListener('focusin', onFocusIn);
    // Removals by child components (a stage switching, a dialog closing) are caught here.
    const mo = new MutationObserver(() => rescue());
    mo.observe(main, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'hidden'] });
    return () => { document.removeEventListener('focusin', onFocusIn); mo.disconnect(); };
  }, [rescue]);
  return { mainRef, h1Ref, outcomeRef, focusHintRef, rescue };
}

interface OutcomeInput {
  outcome: EngineView['outcome'];
  outcomeRef: RefObject<HTMLDivElement | null>;
  /** Truthy while the team is reacting, in a conversation, or during style setting: the outcome is not in front. */
  reacting: unknown;
  live: unknown;
  styling: boolean;
  /** Truthy while an action is being planned, an event card is up, or the end screen is in front: the headline is announced instead. */
  flow: unknown;
  card: unknown;
  endScreen: boolean;
  tablet: boolean;
  tabletReady: boolean;
}

/** A new outcome takes focus, so it is read out; while an action is being planned it is announced instead. */
export function useOutcomeFocus({ outcome: oc, outcomeRef, reacting, live, styling, flow, card, endScreen, tablet, tabletReady }: OutcomeInput) {
  /** The outcome headline, for screen readers, when focus cannot move to it (an action is being planned). */
  const [announce, setAnnounce] = useState('');
  const shownOutcome = useRef<string | null>(null);
  useEffect(() => {
    // The tablet board loads on demand: wait until it is on screen to focus its outcome.
    if (!oc || reacting || live || styling || (tablet && !tabletReady)) return;
    if (shownOutcome.current === oc.id) return;
    shownOutcome.current = oc.id;
    // A new outcome from the engine is announced when focus cannot move to it (D78 keeps this finding).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (flow || card || endScreen) { setAnnounce(oc.headline); return; }
    const h = headlineIn(outcomeRef.current);
    h?.focus({ preventScroll: true });
  }, [oc, reacting, live, styling, flow, card, endScreen, tablet, tabletReady, outcomeRef]);
  return announce;
}
