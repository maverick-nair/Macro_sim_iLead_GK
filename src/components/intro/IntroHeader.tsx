import type { ReactNode } from 'react';
import { useI18n } from '../../i18n';
import { ClientLogo } from '../../theme/brand';
import { ILeadLogo } from '../shell/Logo';

/*
 * The pre-game flow's shared styles, as the approved canvas draws them (D219, D227): navy screens, 4px corners, outlined
 * quiet buttons, the paper button for the way forward, small uppercase eyebrows in mint, Newsreader for the headlines.
 * The flow sits in a dark scheme (`il-scheme-dark`), so every token reads its dark value here, in either theme.
 */
export const FOCUS = 'focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accent-secondary';
export const EYEBROW = 'm-0 text-12 font-600 uppercase tracking-(--il-tracking-eyebrow-wide) text-accent-secondary';
export const QUIET_BUTTON = `flex min-h-11 cursor-pointer items-center gap-2 rounded-4 border border-line-strong bg-transparent px-3.5 text-14 font-500 text-fg-primary hover:bg-surface-raised ${FOCUS}`;
export const PRIMARY = `inline-flex min-h-12 cursor-pointer items-center justify-center gap-2.5 rounded-4 border-0 bg-(image:--il-fill-brand) px-6 text-16 font-600 text-button-on-solid ${FOCUS}`;
export const LINK = `inline-flex min-h-11 cursor-pointer items-center rounded-4 border-0 bg-transparent p-0 text-15 text-fg-secondary underline underline-offset-3 hover:text-fg-primary ${FOCUS}`;
/** The headlines: Newsreader at its display size, regular weight. */
export const DISPLAY = 'm-0 font-display font-400 leading-(--il-canvas-leading-display) tracking-(--il-tracking-headline)';

const LogOutIcon = () => (
  <svg className="size-4 rtl:-scale-x-100" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></svg>
);
export const Arrow = () => (
  <svg className="size-4.5 rtl:-scale-x-100" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
);

export interface IntroHeaderProps {
  /** The storyline's company logo (D182), when it has one, beside the iLead mark. */
  logo?: { image: string | null; text: string | null } | null;
  /** More controls before Log out (the message's Mute video). */
  extra?: ReactNode;
  /** A hairline under the header (the screens with panels under it; the landing's photo runs up behind it). */
  rule?: boolean;
  onLogOut: () => void;
}

/** The pre-game header (D219): the iLead mark and the client's, and Log out; nothing else to wander off to. */
export function IntroHeader({ logo, extra, rule = true, onLogOut }: IntroHeaderProps) {
  const { t } = useI18n();
  return (
    <header className={`relative z-2 flex min-h-18 flex-none items-center gap-3 px-12 tablet:px-8 ${rule ? 'border-b border-(--il-color-canvas-navy-800)' : ''}`}>
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <ClientLogo />
        <ILeadLogo size="md" />
        {logo?.image ? <img src={logo.image} alt="" className="h-8 w-auto" /> : logo?.text ? <span aria-hidden="true" className="flex size-8 items-center justify-center rounded-4 bg-surface-raised text-12 font-600">{logo.text}</span> : null}
      </div>
      {extra}
      <button type="button" onClick={onLogOut} className={QUIET_BUTTON}><LogOutIcon />{t('intro.logout')}</button>
    </header>
  );
}
