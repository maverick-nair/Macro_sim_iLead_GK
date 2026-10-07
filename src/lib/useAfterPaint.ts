import { startTransition, useEffect, useState, type ReactNode } from 'react';

/**
 * Splits a heavy first render (D87). False for the first render, then true once the browser has
 * painted it, set inside a transition: React renders what it gates in slices that yield to the browser,
 * instead of one long task, so input and the first paint are not held up by content that can follow.
 * `enabled: false` (a print view, a test) renders everything at once.
 */
export function useAfterPaint(enabled = true): boolean {
  const [after, setAfter] = useState(!enabled);
  useEffect(() => {
    if (after) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    // After the next frame has painted: rAF runs before paint, the timeout after it.
    const frame = requestAnimationFrame(() => { timer = setTimeout(() => startTransition(() => setAfter(true)), 0); });
    return () => { cancelAnimationFrame(frame); clearTimeout(timer); };
  }, [after]);
  return after;
}

/**
 * Renders a long list in steps (D87): the first `first` items at once, then the rest after paint, in a
 * transition. `all` renders everything at once (print).
 */
export function useProgressive(total: number, first: number, all = false): number {
  const after = useAfterPaint(!all && total > first);
  return after ? total : Math.min(total, first);
}

/**
 * Renders its content once the first paint is done (D87). The content is a function, so the work of
 * building it (props included) runs in this component's own render, inside the transition, and not in
 * the parent's: only this component renders again when the time comes.
 */
export function Deferred({ children, fallback = null }: { children: () => ReactNode; fallback?: ReactNode }) {
  return useAfterPaint() ? children() : fallback;
}
