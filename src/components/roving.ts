import type { KeyboardEvent } from 'react';

/**
 * Arrow key handling for a radio group or tab list whose items are sibling buttons: the arrows,
 * Home and End move to another item, select it and focus it. Only the selected item is in the tab
 * order (`tabIndex={on ? 0 : -1}`), so Tab enters and leaves the group in one step.
 */
export function onRovingKey(e: KeyboardEvent<HTMLElement>, index: number, count: number, select: (index: number) => void) {
  const next = ({ ArrowRight: index + 1, ArrowDown: index + 1, ArrowLeft: index - 1, ArrowUp: index - 1, Home: 0, End: count - 1 } as Record<string, number>)[e.key];
  if (next === undefined || count < 2) return;
  e.preventDefault();
  const i = (next + count) % count;
  select(i);
  const item = e.currentTarget.parentElement?.children[i];
  if (item instanceof HTMLElement) item.focus();
}
