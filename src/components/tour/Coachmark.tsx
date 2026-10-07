import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';

export interface CoachmarkProps {
  /** A CSS selector for what the tip points at. When nothing matches, the tip sits in the middle of the window. */
  target: string | null;
  title: string;
  body: ReactNode;
  /** "Step 2 of 11", shown above the title. */
  counter?: string;
  /** The tip's buttons. */
  children: ReactNode;
  /** A quieter line under the buttons ("Do not show tips again"). */
  footer?: ReactNode;
  /** Escape. */
  onEscape: () => void;
  /** Changes when the tip moves to another step, so focus moves to the new title. */
  stepKey: string;
  /**
   * Keep Tab inside the tip (the tour). The demo lets focus leave it, since its steps are done on the
   * board itself; its tip offers a button that moves focus to the target instead.
   */
  trap?: boolean;
}

interface Box { top: number; left: number; width: number; height: number }

const GAP = 12;
const EDGE = 16;

/**
 * Where the tip goes: below the target if it fits, else above, else beside it, kept inside the window. A
 * tall target (a panel, a column) gets the tip beside it first, so the tip does not cover what it explains.
 */
export function placeTip(target: Box | null, tip: { width: number; height: number }, view: { width: number; height: number }): { top: number; left: number } {
  const clampX = (x: number) => Math.max(EDGE, Math.min(view.width - tip.width - EDGE, x));
  const clampY = (y: number) => Math.max(EDGE, Math.min(view.height - tip.height - EDGE, y));
  if (!target) return { top: clampY((view.height - tip.height) / 2), left: clampX((view.width - tip.width) / 2) };
  const below = target.top + target.height + GAP;
  const above = target.top - GAP - tip.height;
  const right = target.left + target.width + GAP;
  const left = target.left - GAP - tip.width;
  const beside = () => {
    if (left >= EDGE) return { top: clampY(target.top), left };
    if (right + tip.width <= view.width - EDGE) return { top: clampY(target.top), left: right };
    return null;
  };
  if (target.height > view.height * 0.4) { const b = beside(); if (b) return b; }
  if (below + tip.height <= view.height - EDGE) return { top: below, left: clampX(target.left) };
  if (above >= EDGE) return { top: above, left: clampX(target.left) };
  const b = beside();
  if (b) return b;
  // A target as big as the window: the tip sits over its lower part.
  return { top: clampY(view.height - tip.height - EDGE), left: clampX(target.left) };
}

/**
 * One tip of the guided tour or the demo (D92, D94): a ring around what it points at (everything else
 * dimmed), and the tip beside it. A non modal dialog that keeps focus: its title takes focus at every
 * step, Tab stays inside, and Escape ends. It follows its target when the window resizes or scrolls.
 */
export function Coachmark({ target, title, body, counter, children, footer, onEscape, stepKey, trap = true }: CoachmarkProps) {
  const tipRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const id = useId();
  const [box, setBox] = useState<Box | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const measure = useCallback(() => {
    const el = target ? document.querySelector<HTMLElement>(target) : null;
    const r = el?.getBoundingClientRect();
    const b = r && r.width > 0 && r.height > 0 ? { top: r.top, left: r.left, width: r.width, height: r.height } : null;
    setBox(b);
    const tip = tipRef.current;
    if (tip) setPos(placeTip(b, { width: tip.offsetWidth, height: tip.offsetHeight }, { width: window.innerWidth, height: window.innerHeight }));
  }, [target]);

  // A new step: bring the target into view, then place the tip and move focus to its title.
  useLayoutEffect(() => {
    const el = target ? document.querySelector<HTMLElement>(target) : null;
    el?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    // Placing the tip needs the target's and the tip's sizes from the DOM, after the step renders.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    measure();
    headingRef.current?.focus({ preventScroll: true });
    // A screen that has just opened moves focus to its own heading after this; take it back once, unless
    // the participant has already moved on to a control.
    const again = setTimeout(() => {
      const at = document.activeElement;
      if (!tipRef.current?.contains(at) && (!at || at === document.body || /^H[1-6]$/.test(at.tagName))) headingRef.current?.focus({ preventScroll: true });
    }, 350);
    return () => clearTimeout(again);
  }, [stepKey, target, measure]);

  useEffect(() => {
    const on = () => measure();
    window.addEventListener('resize', on);
    window.addEventListener('scroll', on, true);
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(on);
    const el = target ? document.querySelector<HTMLElement>(target) : null;
    if (el) ro?.observe(el);
    if (tipRef.current) ro?.observe(tipRef.current);
    // The target can arrive or move without a resize (a screen still rendering, a panel opening): check now and then.
    const poll = setInterval(on, 400);
    return () => { window.removeEventListener('resize', on); window.removeEventListener('scroll', on, true); ro?.disconnect(); clearInterval(poll); };
  }, [target, measure]);

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onEscape(); return; }
    if (e.key !== 'Tab' || !trap) return;
    const items = Array.from(tipRef.current?.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex="0"]') ?? []).filter(x => !x.hasAttribute('disabled'));
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && (document.activeElement === first || document.activeElement === headingRef.current)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };

  return (
    <>
      {/* The ring, and the dimming around it. Not interactive: the tip is the only control. */}
      {box
        ? <div aria-hidden="true" className="pointer-events-none fixed z-70 rounded-14 shadow-(--il-panel-tour-dim)" style={{ top: box.top - 4, left: box.left - 4, width: box.width + 8, height: box.height + 8 }}>
            <div className="size-full rounded-14 shadow-(--il-panel-tour-ring)" />
          </div>
        : <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-70 bg-surface-scrim" />}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- Escape ends the tour and Tab stays inside the tip */}
      <div ref={tipRef} role="dialog" aria-modal="false" aria-labelledby={`${id}-title`} aria-describedby={`${id}-body`} onKeyDown={onKeyDown} data-coachmark=""
        className="fixed z-71 flex w-(--il-panel-tour-width) flex-col gap-2.5 rounded-20 border border-line-strong bg-surface-solid p-4.5 shadow-(--il-event-card-shadow)"
        style={pos ? { top: pos.top, left: pos.left } : { visibility: 'hidden' }}>
        {counter && <span className="text-12 font-700 tracking-(--il-action-section-tracking) text-accent-secondary uppercase">{counter}</span>}
        <h2 ref={headingRef} id={`${id}-title`} tabIndex={-1} className="m-0 text-17 font-700 outline-0">{title}</h2>
        <div id={`${id}-body`} className="text-14 text-pretty text-fg-secondary">{body}</div>
        <div className="flex flex-wrap items-center justify-end gap-2 pt-1">{children}</div>
        {footer && <div className="-mb-1 flex border-t border-line-default pt-1.5">{footer}</div>}
      </div>
    </>
  );
}
