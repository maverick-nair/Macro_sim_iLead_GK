import type { ReactNode } from 'react';

/** Shared class names for the author chat, on the participant app's tokens (Night Studio, light and client themes). */
export const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-secondary';
export const CARD = 'rounded-16 border border-solid border-line-default bg-surface-card';
export const EYEBROW = 'text-12 font-700 uppercase tracking-wide text-accent-secondary';
const BTN = `inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-pill px-4 text-14 font-700 whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS}`;
export const BUTTON = {
  primary: `${BTN} border-0 bg-accent-default text-fg-on-accent hover:brightness-110`,
  secondary: `${BTN} border border-solid border-line-strong bg-transparent text-fg-primary hover:bg-accent-soft`,
  link: `inline cursor-pointer border-0 bg-transparent p-0 text-13 font-600 text-fg-link underline underline-offset-2 hover:text-fg-link-hover ${FOCUS}`
};

export function Section({ title, eyebrow, children, id, headingRef }: { title: string; eyebrow?: string; children: ReactNode; id?: string; headingRef?: React.Ref<HTMLHeadingElement> }) {
  return (
    <section aria-labelledby={id} className={`${CARD} flex flex-col gap-4 p-5`}>
      <div className="flex flex-col gap-1">
        {eyebrow && <span className={EYEBROW}>{eyebrow}</span>}
        <h2 id={id} ref={headingRef} tabIndex={-1} className="m-0 text-20 font-700 outline-none">{title}</h2>
      </div>
      {children}
    </section>
  );
}

/** A small label, such as "Report only" or "Recommended". */
export function Tag({ children, tone = 'accent' }: { children: ReactNode; tone?: 'accent' | 'muted' }) {
  return <span className={`inline-flex items-center rounded-pill px-2 py-0.5 text-11 font-700 ${tone === 'accent' ? 'bg-accent-soft text-fg-primary' : 'border border-solid border-line-default text-fg-secondary'}`}>{children}</span>;
}
