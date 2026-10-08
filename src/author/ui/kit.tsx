import * as Dialog from '@radix-ui/react-dialog';
import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { SHORT_MAX, TEXT_MAX, type Mark } from '../model/draft';

export { SHORT_MAX, TEXT_MAX };
import { useAuthor } from '../model/store';

/**
 * The authoring tool's parts, in the canvas's design language (docs/design/genie, D105): light cards on
 * a pale canvas, blue for the author's actions, teal for Kora, amber for what needs the author.
 * Provenance shows by words and marks as well as color (AI, You, Edited, Needs you, Suggestion).
 */

export const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-author-primary';
const BTN = `inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-10 font-700 whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS}`;
export const BUTTON = {
  primary: `${BTN} min-h-10 border-0 bg-author-primary px-4 text-14 text-author-on-primary hover:bg-author-primary-hover`,
  big: `${BTN} min-h-12 border-0 bg-author-primary px-6 text-16 text-author-on-primary hover:bg-author-primary-hover`,
  kora: `${BTN} min-h-9 border-0 bg-author-kora px-3 text-13 text-author-on-primary hover:brightness-110`,
  koraOutline: `${BTN} min-h-9 border border-solid border-author-kora bg-author-surface px-3 text-13 text-author-ai hover:bg-author-ai-field`,
  secondary: `${BTN} min-h-9 border border-solid border-author-line-control bg-author-surface px-3 text-13 text-author-ink hover:bg-author-track`,
  danger: `${BTN} min-h-10 border-0 bg-author-decline px-4 text-14 text-author-on-primary hover:brightness-110`,
  link: `inline cursor-pointer border-0 bg-transparent p-0 text-left text-14 font-700 text-author-primary underline underline-offset-2 hover:text-author-primary-hover ${FOCUS}`
};
export const CARD = 'rounded-16 border border-solid border-author-line bg-author-surface';
export const EYEBROW = 'text-12 font-800 uppercase tracking-[0.12em]';
export const LABEL = 'text-13 font-700 text-author-label';

/* Icons: 16px line icons, decorative (their buttons carry the words). */
const svg = (d: ReactNode, size = 16) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{d}</svg>;
export const Icon = {
  person: (s?: number) => svg(<><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></>, s),
  spark: (s?: number) => svg(<path d="M12 3v6M12 15v6M3 12h6M15 12h6" />, s),
  alert: (s?: number) => svg(<><circle cx="12" cy="12" r="9" /><path d="M12 7v6M12 17h.01" /></>, s),
  lock: (s?: number) => svg(<><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>, s),
  pencil: (s?: number) => svg(<path d="M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4" />, s),
  mic: (s?: number) => svg(<><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></>, s),
  clip: (s?: number) => svg(<path d="M21 11.5l-8.5 8.5a5 5 0 0 1-7-7L14 4.5a3.5 3.5 0 0 1 5 5L10.5 18a2 2 0 0 1-3-3L15 7.5" />, s),
  play: (s?: number) => svg(<path d="M8 5l11 7-11 7z" fill="currentColor" />, s),
  stop: (s?: number) => svg(<rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />, s),
  check: (s?: number) => svg(<path d="M5 12l5 5L20 7" />, s),
  close: (s?: number) => svg(<path d="M6 6l12 12M18 6L6 18" />, s),
  refresh: (s?: number) => svg(<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7" />, s),
  file: (s?: number) => svg(<><path d="M14 3H6v18h12V7z" /><path d="M14 3v4h4" /></>, s),
  menu: (s?: number) => svg(<path d="M4 7h16M4 12h16M4 17h16" />, s),
  chat: (s?: number) => svg(<path d="M4 5h16v11H9l-5 4z" />, s)
};

export type BadgeKind = Mark | 'need' | 'suggestion' | 'done' | 'generated' | 'default' | 'core' | 'yours' | 'passed' | 'muted' | 'beta';

const BADGE: Record<BadgeKind, string> = {
  ai: 'bg-author-ai-badge text-author-ai',
  generated: 'bg-author-ai-badge text-author-ai',
  you: 'bg-author-you-badge text-author-label',
  edited: 'bg-author-you-badge text-author-label',
  need: 'bg-author-need-badge text-author-need',
  suggestion: 'border border-dashed border-author-kora bg-author-surface text-author-ai',
  done: 'bg-author-gain-soft text-author-gain',
  passed: 'bg-author-gain-soft text-author-gain',
  default: 'bg-author-you-badge text-author-label',
  core: 'bg-author-you-badge text-author-label',
  yours: 'bg-author-yours-soft text-author-yours',
  muted: 'border border-solid border-author-line-control bg-author-surface text-author-label',
  beta: 'bg-author-need-badge text-author-need'
};
const BADGE_TEXT: Partial<Record<BadgeKind, string>> = { ai: 'AI', you: 'You', edited: 'Edited', need: 'Needs you', suggestion: 'Suggestion', generated: 'Generated', done: 'Done', default: 'Default', core: 'Core', yours: 'Yours', passed: 'Passed', beta: 'Beta', muted: 'Waiting' };

/** A provenance or status mark. The words always say it; the color repeats it. */
export function Badge({ kind, children, className = '' }: { kind: BadgeKind; children?: ReactNode; className?: string }) {
  const icon = kind === 'you' ? Icon.person(11) : kind === 'edited' ? Icon.pencil(11) : kind === 'ai' || kind === 'generated' ? Icon.spark(11) : kind === 'need' ? Icon.alert(11) : kind === 'core' ? Icon.lock(11) : null;
  return (
    <span className={`inline-flex min-h-5.5 shrink-0 items-center gap-1 rounded-pill px-2 text-11 font-700 whitespace-nowrap ${BADGE[kind]} ${className}`}>
      {icon}{children ?? BADGE_TEXT[kind]}
    </span>
  );
}

/** The mark of one field of the draft, or nothing when it has none. */
export function MarkOf({ path, need = false }: { path: string; need?: boolean }) {
  const m = useAuthor(s => s.draft.marks[path]);
  if (need) return <Badge kind="need" />;
  return m ? <Badge kind={m} /> : null;
}

/** The fill a field takes from its mark: Kora's words tinted teal, what needs the author amber. */
export function toneOf(mark: Mark | undefined, need = false): string {
  if (need) return 'border-author-need-line bg-author-need-field';
  if (mark === 'ai') return 'border-author-ai-line bg-author-ai-field';
  return 'border-author-line-control bg-author-surface';
}

const FIELD = `w-full min-w-0 rounded-10 border border-solid px-3 text-14 font-400 text-author-ink placeholder:text-author-muted ${FOCUS}`;
/** A one line input. It takes a short field's limit unless told otherwise; a text field passes TEXT_MAX. */
export function TextInput({ tone = '', className = '', maxLength = SHORT_MAX, ...p }: InputHTMLAttributes<HTMLInputElement> & { tone?: string }) {
  return <input {...p} maxLength={maxLength} className={`${FIELD} min-h-10.5 ${tone || 'border-author-line-control bg-author-surface'} ${className}`} />;
}
export function TextArea({ tone = '', className = '', maxLength = TEXT_MAX, ...p }: TextareaHTMLAttributes<HTMLTextAreaElement> & { tone?: string }) {
  return <textarea {...p} maxLength={maxLength} className={`${FIELD} resize-y py-2.5 leading-[1.5] ${tone || 'border-author-line-control bg-author-surface'} ${className}`} />;
}
export function Select({ tone = '', className = '', ...p }: SelectHTMLAttributes<HTMLSelectElement> & { tone?: string }) {
  return <select {...p} className={`${FIELD} min-h-10.5 cursor-pointer ${tone || 'border-author-line-control bg-author-surface'} ${className}`} />;
}

/**
 * A labelled field: the label, Required or Optional, its mark, then the control. The control gets the
 * label's id through `children(id)` so it is named.
 */
export function Field({ label, required, optional, mark, need, hint, children, className = '' }: {
  label: ReactNode; required?: boolean; optional?: boolean; mark?: string; need?: boolean; hint?: ReactNode; className?: string; children: (id: string) => ReactNode;
}) {
  const id = useId();
  return (
    <div className={`flex min-w-0 flex-col gap-1.5 ${className}`}>
      <div className="flex min-h-5.5 items-center justify-between gap-2">
        <label htmlFor={id} className={LABEL}>{label}</label>
        <span className="flex items-center gap-1.5">
          {required && <span className="text-12 font-700 text-author-decline">Required</span>}
          {optional && <span className="text-12 font-600 text-author-muted">Optional</span>}
          {(mark || need) && <MarkOf path={mark ?? ''} need={need} />}
        </span>
      </div>
      {children(id)}
      {hint && <p className="m-0 text-12 text-author-muted">{hint}</p>}
    </div>
  );
}

/** A choice of a few, as radio buttons drawn as a segmented control. */
export function Segmented<T extends string>({ label, value, options, onChange, vertical = false, size = 'md' }: {
  label: string; value: T; options: ReadonlyArray<{ value: T; label: ReactNode; disabled?: boolean }>; onChange: (v: T) => void; vertical?: boolean; size?: 'sm' | 'md';
}) {
  const name = useId();
  return (
    <div role="radiogroup" aria-label={label} className={`flex ${vertical ? 'flex-col' : 'flex-wrap'} gap-1 rounded-12 bg-author-track p-1`}>
      {options.map(o => (
        <label key={o.value} className={`relative flex cursor-pointer items-center rounded-8 px-3 ${size === 'sm' ? 'min-h-8 text-12' : 'min-h-9.5 text-13'} font-700 has-[:checked]:bg-author-surface has-[:checked]:text-author-ink has-[:checked]:shadow-[0_1px_2px_rgb(20_26_46/0.12)] has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-author-primary text-author-label`}>
          <input type="radio" name={name} className="sr-only" checked={value === o.value} disabled={o.disabled} onChange={() => onChange(o.value)} />
          {o.label}
        </label>
      ))}
    </div>
  );
}

/** A switch: a button with role switch, its label as its name. */
export function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-10.5 shrink-0 cursor-pointer items-center rounded-pill border-0 p-0.5 transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${checked ? 'bg-author-primary' : 'bg-author-line-control'} ${FOCUS}`}>
      <span aria-hidden="true" className={`size-5 rounded-round bg-author-surface shadow-[0_1px_2px_rgb(20_26_46/0.3)] transition-transform ${checked ? 'translate-x-4.5 rtl:-translate-x-4.5' : ''}`} />
    </button>
  );
}

/** A chip that toggles: a pressed button. */
export function Chip({ pressed, onClick, children, tone = 'primary' }: { pressed: boolean; onClick: () => void; children: ReactNode; tone?: 'primary' | 'kora' }) {
  const on = tone === 'kora' ? 'border-author-kora bg-author-ai-field text-author-ai' : 'border-author-primary bg-author-primary-soft text-author-primary';
  return (
    <button type="button" aria-pressed={pressed} onClick={onClick}
      className={`inline-flex min-h-8 cursor-pointer items-center rounded-pill border border-solid px-3 text-13 font-700 ${pressed ? on : 'border-author-line-control bg-author-surface text-author-label hover:bg-author-track'} ${FOCUS}`}>
      {children}
    </button>
  );
}

/** A region that scrolls on its own, focusable so the keyboard can scroll it. */
export function Scroll({ label, className = '', children }: { label: string; className?: string; children: ReactNode }) {
  return <div role="region" aria-label={label} tabIndex={0} className={`relative min-h-0 overflow-y-auto overscroll-contain focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-author-primary ${className}`}>{children}</div>;
}

export function CardHead({ title, children, level = 2, id }: { title: ReactNode; children?: ReactNode; level?: 2 | 3; id?: string }) {
  const H = level === 2 ? 'h2' : 'h3';
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <H id={id} className="m-0 text-17 font-800 text-author-ink">{title}</H>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

/** A modal over the workspace: the scrim, a titled panel whose body scrolls and whose footer stays. */
export function Modal({ open, onOpenChange, title, description, children, footer, width = 'max-w-230', side = false, head }: {
  open: boolean; onOpenChange: (o: boolean) => void; title: ReactNode; description?: ReactNode; children: ReactNode; footer?: ReactNode; width?: string; side?: boolean; head?: ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="il-theme fixed inset-0 z-50 bg-author-scrim [color-scheme:light]" />
        <Dialog.Content
          className={`il-theme fixed z-50 flex flex-col overflow-hidden bg-author-surface font-sans text-author-ink [color-scheme:light] focus:outline-none ${side ? 'inset-y-0 end-0 w-[min(100vw,820px)] shadow-[0_0_40px_rgb(20_26_46/0.25)]' : `inset-x-4 top-1/2 mx-auto max-h-[calc(100dvh-32px)] -translate-y-1/2 rounded-24 shadow-[0_20px_60px_rgb(20_26_46/0.3)] ${width}`}`}>
          <div className="flex flex-none items-start gap-4 border-b border-solid border-author-line px-6 pt-5 pb-4">
            {head}
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <Dialog.Title className="m-0 text-24 font-800">{title}</Dialog.Title>
              {description ? <Dialog.Description className="m-0 text-14 text-author-body">{description}</Dialog.Description> : <Dialog.Description className="sr-only">{typeof title === 'string' ? title : 'Dialog'}</Dialog.Description>}
            </div>
            <Dialog.Close className={`${BUTTON.secondary} size-10 px-0`} aria-label="Close">{Icon.close()}</Dialog.Close>
          </div>
          <div className="flex min-h-0 flex-1 flex-col">{children}</div>
          {footer && <div className="flex flex-none flex-wrap items-center gap-2 border-t border-solid border-author-line px-6 py-4">{footer}</div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** A portrait or a soft disc when there is none. */
export function Avatar({ src, name, size = 40 }: { src?: string; name: string; size?: number }) {
  return src && src.startsWith('/')
    ? <img src={src} alt="" width={size} height={size} className="shrink-0 rounded-round bg-author-track object-cover object-top" style={{ width: size, height: size }} />
    : <span aria-hidden="true" className="flex shrink-0 items-center justify-center rounded-round bg-author-primary-soft text-13 font-800 text-author-primary" style={{ width: size, height: size }}>{name.slice(0, 1)}</span>;
}

/** "Saved just now", "Saved 2 minutes ago", or that the draft could not be saved here. */
export function savedText(savedAt: number | null, failed: boolean | 'full' | 'blocked' | 'conflict', now = Date.now()): string {
  if (failed === 'full') return 'Not saved: storage is full';
  if (failed === 'conflict') return 'Not saved: changed in another tab';
  if (failed) return 'Not saved: this browser blocks storage';
  if (!savedAt) return 'Draft saved';
  const m = Math.floor((now - savedAt) / 60000);
  return m < 1 ? 'Saved just now' : `Saved ${m} minute${m === 1 ? '' : 's'} ago`;
}

/** Tabs inside a page (a tablist: arrows move between them). The panel is the caller's, labelled by the tab. */
export function SubTabs<T extends string>({ label, value, tabs, onChange, idBase, variant = 'pill' }: {
  label: string; value: T; tabs: ReadonlyArray<{ value: T; label: string }>; onChange: (v: T) => void; idBase: string; variant?: 'pill' | 'line';
}) {
  const move = (dir: number) => {
    const i = tabs.findIndex(t => t.value === value);
    const next = tabs[(i + dir + tabs.length) % tabs.length];
    onChange(next.value);
    requestAnimationFrame(() => document.getElementById(`${idBase}-tab-${next.value}`)?.focus());
  };
  return (
    <div role="tablist" aria-label={label} className={variant === 'pill' ? 'flex flex-wrap gap-1 self-start rounded-12 bg-author-track p-1' : 'flex flex-wrap gap-1 border-b border-solid border-author-line'}>
      {tabs.map(t => (
        <button key={t.value} id={`${idBase}-tab-${t.value}`} type="button" role="tab" aria-selected={value === t.value} aria-controls={`${idBase}-panel`} tabIndex={value === t.value ? 0 : -1}
          onClick={() => onChange(t.value)}
          onKeyDown={e => { if (e.key === 'ArrowRight') { e.preventDefault(); move(1); } if (e.key === 'ArrowLeft') { e.preventDefault(); move(-1); } }}
          className={variant === 'pill'
            ? `min-h-9.5 cursor-pointer rounded-8 border-0 px-3 text-13 font-700 ${value === t.value ? 'bg-author-surface text-author-ink shadow-[0_1px_2px_rgb(20_26_46/0.12)]' : 'bg-transparent text-author-label'} ${FOCUS}`
            : `min-h-10.5 -mb-px cursor-pointer border-0 border-b-2 border-solid bg-transparent px-3.5 text-14 font-700 ${value === t.value ? 'border-author-primary text-author-ink' : 'border-transparent text-author-muted'} ${FOCUS}`}>
          {t.label}
        </button>
      ))}
    </div>
  );
}
