import { useEffect, useState } from 'react';
import { getTrace } from './trace';

interface Box { top: number; left: number; width: number; height: number; text: string }

const same = (a: Box[], b: Box[]) => a.length === b.length && a.every((x, i) => x.top === b[i].top && x.left === b[i].left && x.width === b[i].width && x.height === b[i].height && x.text === b[i].text);

/** Every traced surface in view, with its GenieKreator section and field (through `getTrace`, D197). */
function measure(): Box[] {
  const out: Box[] = [];
  for (const el of document.querySelectorAll<HTMLElement>('[data-trace]')) {
    const info = getTrace(el.dataset.trace ?? '');
    if (!info) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1 || r.bottom < 0 || r.top > innerHeight) continue;
    out.push({ top: Math.round(r.top), left: Math.round(r.left), width: Math.round(r.width), height: Math.round(r.height), text: `${info.section} · ${info.label}` });
  }
  return out;
}

/**
 * "Show where this comes from" (D197): an outline and a label on every surface that carries `data-trace`,
 * naming the GenieKreator section it comes from. Drawn over the app, never in its way (no pointer events),
 * and kept in step as the screen changes, scrolls or resizes. A visual aid: the bar says how many are
 * labelled, for screen readers.
 */
export function TraceOverlay({ onCount, theme }: { onCount?: (n: number) => void; theme: 'dark' | 'light' }) {
  const [boxes, setBoxes] = useState<Box[]>([]);
  useEffect(() => {
    let frame = 0;
    const run = () => { frame = 0; const next = measure(); setBoxes(prev => (same(prev, next) ? prev : next)); };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(run); };
    schedule();
    const watch = new MutationObserver(schedule);
    watch.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-trace', 'class', 'hidden'] });
    addEventListener('scroll', schedule, true);
    addEventListener('resize', schedule);
    return () => { cancelAnimationFrame(frame); watch.disconnect(); removeEventListener('scroll', schedule, true); removeEventListener('resize', schedule); };
  }, []);
  useEffect(() => { onCount?.(boxes.length); }, [boxes.length, onCount]);
  return (
    <div aria-hidden="true" data-preview-trace="" style={{ colorScheme: theme }} className="il-theme pointer-events-none fixed inset-0 z-55 overflow-hidden">
      {boxes.map((b, i) => (
        <div key={i} className="absolute rounded-4 outline-2 outline-offset-1 outline-accent-secondary outline-dashed" style={{ top: b.top, left: b.left, width: b.width, height: b.height }}>
          {/* Above the outline where there is room, so the label does not cover what it names. */}
          <span className={`absolute start-0 ${b.top > 24 ? 'bottom-full mb-0.5' : 'top-0'} rounded-4 whitespace-nowrap bg-accent-secondary px-1.5 py-0.5 text-11 font-600 text-fg-on-accent`}>{b.text}</span>
        </div>
      ))}
    </div>
  );
}
