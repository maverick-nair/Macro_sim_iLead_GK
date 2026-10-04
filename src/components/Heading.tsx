import type { ComponentPropsWithRef } from 'react';

/** Heading levels a component may be told to render, so the page that places it sets the outline. */
export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

/**
 * A heading whose level comes from a prop. The look comes from `className` only (preflight is off,
 * so callers set margin, size and weight), so changing the level never changes the pixels.
 */
export function Heading({ level, ...rest }: ComponentPropsWithRef<'h2'> & { level: HeadingLevel }) {
  const Tag = `h${level}` as const;
  return <Tag {...rest} />;
}
