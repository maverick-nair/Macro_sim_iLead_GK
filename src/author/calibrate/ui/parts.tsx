import type { ReactNode } from 'react';
import type { CheckStatus, PersonaKey } from '../logic/schema';

/** Shared looks for the calibration screens, on the app's tokens so the host's theme applies (D118). */
export const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-secondary';
export const CARD = 'flex min-w-0 flex-col gap-3 rounded-16 border border-solid border-line-default bg-surface-card p-4';
const BTN = `inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-10 px-4 text-14 font-700 whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS}`;
export const BUTTON = {
  primary: `${BTN} border-0 bg-accent-default text-fg-on-accent hover:brightness-110`,
  secondary: `${BTN} border border-solid border-line-strong bg-transparent text-fg-primary hover:bg-accent-soft`,
  small: `inline-flex min-h-8 cursor-pointer items-center rounded-8 border border-solid border-line-strong bg-transparent px-3 text-13 font-600 text-fg-primary hover:bg-accent-soft ${FOCUS}`
};
export const INPUT = `rounded-10 border border-solid border-line-control bg-surface-solid px-3 text-14 text-fg-primary ${FOCUS}`;
export const SR = 'sr-only';

/** Each level's colour, as in the design (Calibrate.dc.html): marks and bars only, never text. */
export const PERSONA_COLOR: Record<PersonaKey, string> = {
  beginner: '#E26A5A', developing: '#E7A23B', proficient: '#5B8DEF', expert: '#3BAA6A',
  riskTaker: '#C2508A', conservative: '#7C8794', peopleFirst: '#2BA3A3', businessFirst: '#8A63D2'
};

export function Mark({ tone, children }: { tone: 'good' | 'look' | 'bad' | 'muted'; children: ReactNode }) {
  const cls = tone === 'good' ? 'bg-status-gain-soft' : tone === 'look' ? 'bg-status-attention-soft' : tone === 'bad' ? 'bg-status-decline-soft' : 'border border-solid border-line-default';
  return <span className={`inline-flex items-center rounded-pill px-2 py-0.5 text-12 font-700 whitespace-nowrap text-fg-primary ${cls}`}>{children}</span>;
}

const ICON: Record<CheckStatus, { glyph: string; label: string; cls: string }> = {
  pass: { glyph: '✓', label: 'Passed', cls: 'bg-status-gain-soft' },
  warn: { glyph: '!', label: 'To look at', cls: 'bg-status-attention-soft' },
  fail: { glyph: '!', label: 'Failed', cls: 'bg-status-decline-soft' }
};

export function StatusIcon({ status }: { status: CheckStatus }) {
  const i = ICON[status];
  return (
    <span className={`flex size-6 flex-none items-center justify-center rounded-full text-13 font-800 text-fg-primary ${i.cls}`}>
      <span aria-hidden="true">{i.glyph}</span>
      <span className={SR}>{i.label}:</span>
    </span>
  );
}

export const pct = (x: number) => `${Math.round(x * 100)}%`;
export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** "12 minutes ago", "just now". */
export function ago(iso: string, now = Date.now()) {
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${plural(m, 'minute')} ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${plural(h, 'hour')} ago`;
  return `${plural(Math.round(h / 24), 'day')} ago`;
}

export function money(n: number, m: { currency: string; locale: string }) {
  try {
    return new Intl.NumberFormat(m.locale, { style: 'currency', currency: m.currency, notation: 'compact', maximumFractionDigits: 1 }).format(n);
  } catch {
    return String(Math.round(n));
  }
}
