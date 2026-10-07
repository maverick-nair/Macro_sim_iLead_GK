import { useEffect, useRef, useState, type ReactNode } from 'react';

export interface ScrollAreaProps {
  /** Names the region while it scrolls (WCAG 2.1.1: a scrolling region takes focus so the keyboard can scroll it). */
  label: string;
  className?: string;
  children: ReactNode;
}

/**
 * A region that scrolls inside its own height when its content does not fit the window (D101): only then is
 * it a named, focusable region, and a fade at the bottom shows there is more below. Where everything fits it
 * is a plain block.
 */
export function ScrollArea({ label, className = '', children }: ScrollAreaProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [scrolls, setScrolls] = useState(false);
  const [more, setMore] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => {
      setScrolls(el.scrollHeight > el.clientHeight + 1);
      setMore(el.scrollTop + el.clientHeight < el.scrollHeight - 2);
    };
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(check);
    ro?.observe(el);
    if (el.firstElementChild) ro?.observe(el.firstElementChild);
    el.addEventListener('scroll', check, { passive: true });
    check();
    return () => { ro?.disconnect(); el.removeEventListener('scroll', check); };
  }, []);
  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div ref={ref} {...(scrolls ? { role: 'region', 'aria-label': label, tabIndex: 0 } : {})}
        className={`min-h-0 flex-1 overflow-y-auto overscroll-contain focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent-secondary ${className}`}>
        {children}
      </div>
      {more && <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-(image:--il-board-scroll-fade)" />}
    </div>
  );
}
