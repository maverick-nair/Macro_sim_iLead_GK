import { Fragment, type ReactNode } from 'react';

/** Private use characters that mark where formatted values sit inside a message. */
export const mark = (i: number) => String.fromCharCode(0xe000 + i);
const MARKS = /([-])/;

/**
 * Renders a catalog message with some arguments as elements (bold numbers, a styled name), wherever
 * the locale puts them. Format the message with `mark(i)` for argument i, then pass the nodes in the
 * same order.
 */
export function rich(message: string, nodes: readonly ReactNode[]): ReactNode {
  return message.split(MARKS).map((part, i) => {
    if (part === '') return null;
    const code = part.charCodeAt(0) - 0xe000;
    return <Fragment key={i}>{part.length === 1 && code >= 0 && code < nodes.length ? nodes[code] : part}</Fragment>;
  });
}
