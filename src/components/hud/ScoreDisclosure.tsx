import { useId, useRef, useState, type ReactNode } from 'react';

export interface ScoreDisclosureProps {
  /** The button's accessible name ("Leadership score 412. Show breakdown"). */
  label: string;
  /** What the button shows. */
  children: ReactNode;
  /** The popover's content. */
  content: ReactNode;
  /** Content with controls of its own (the full breakdown): the popover is not the button's description then. */
  rich?: boolean;
  /** Controlled when passed. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  buttonClassName: string;
  /** Where the popover sits; defaults to under the button, aligned to its end. */
  popoverClassName?: string;
  className?: string;
}

/**
 * The Leadership Score with its breakdown (HUD and the desk's status band, D211). A disclosure: a mouse
 * hover opens it, Enter, Space and a tap toggle it, a mouse click keeps it open, Escape inside closes it
 * and returns to the button, and focus leaving it closes it. The button carries `data-hud-score`.
 */
export function ScoreDisclosure({ label, children, content, rich = false, open: given, onOpenChange, buttonClassName, popoverClassName, className }: ScoreDisclosureProps) {
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  /** How the score was last pressed: a touch has no hover, so a tap toggles the breakdown (D69, tablets). */
  const touch = useRef(false);
  const [own, setOwn] = useState(false);
  const open = given ?? own;
  const setOpen = (v: boolean) => {
    if (given === undefined) setOwn(v);
    onOpenChange?.(v);
  };
  const tipId = useId();
  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions -- a mouse hover opens the breakdown (not a touch, whose emulated hover would fight the tap); the button is the control
    <div ref={wrap} className={`relative ${className ?? ''}`} onPointerEnter={e => { if (e.pointerType === 'mouse') setOpen(true); }} onPointerLeave={e => { if (e.pointerType === 'mouse') setOpen(false); }}
      onBlur={e => { if (!wrap.current?.contains(e.relatedTarget as Node | null)) setOpen(false); }}
      onKeyDown={e => { if (e.key === 'Escape' && open) { e.stopPropagation(); setOpen(false); button.current?.focus(); } }}>
      <button ref={button} type="button" data-hud-score="" aria-label={label} aria-expanded={open} aria-controls={open ? tipId : undefined} aria-describedby={open && !rich ? tipId : undefined}
        onPointerDown={e => { touch.current = e.pointerType !== 'mouse'; }}
        onClick={e => setOpen(e.detail === 0 || touch.current ? !open : true)}
        className={buttonClassName}>
        {children}
      </button>
      {open && (
        <div id={tipId} className={`absolute z-40 flex ${popoverClassName ?? 'top-full end-0 mt-2'} ${rich ? 'w-80 ' : 'w-65'} flex-col gap-2 rounded-4 border border-line-strong bg-surface-material p-3.5 whitespace-normal shadow-(--il-hud-score-shadow)`}>
          {content}
        </div>
      )}
    </div>
  );
}
