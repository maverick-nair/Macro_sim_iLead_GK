import type { ReactNode } from 'react';
import { useI18n } from '../../i18n';
import { ClientLogo } from '../../theme/brand';

export const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-secondary';
export const EYEBROW = 'm-0 text-12 font-700 uppercase tracking-(--il-desk-band-eyebrow-tracking) text-accent-secondary';
export const QUIET_BUTTON = `flex min-h-11 cursor-pointer items-center gap-2 rounded-10 border border-line-strong bg-transparent px-3.5 text-14 font-600 text-fg-primary hover:bg-surface-raised ${FOCUS}`;
export const PRIMARY = `inline-flex min-h-12 cursor-pointer items-center justify-center gap-2.5 rounded-12 border-0 bg-(image:--il-fill-brand) px-6 text-16 font-700 text-brand-deep-space ${FOCUS}`;
export const LINK = `inline-flex min-h-6 cursor-pointer items-center rounded-4 border-0 bg-transparent p-0 text-14 text-fg-primary underline decoration-line-control underline-offset-3 hover:decoration-fg-primary ${FOCUS}`;

const LogOutIcon = () => (
  <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 4h5v16h-5" /><path d="M10 8l-4 4 4 4M6 12h10" /></svg>
);
export const Arrow = () => (
  <svg className="size-4.5 rtl:-scale-x-100" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
);

export interface IntroHeaderProps {
  /** The storyline's company logo (D182), when it has one, beside the iLead mark. */
  logo?: { image: string | null; text: string | null } | null;
  /** More controls before Log out (the message's Mute video). */
  extra?: ReactNode;
  onLogOut: () => void;
}

/** The pre-game header (D219): the iLead mark and the client's, and Log out; nothing else to wander off to. */
export function IntroHeader({ logo, extra, onLogOut }: IntroHeaderProps) {
  const { t } = useI18n();
  return (
    <header className="flex min-h-18 flex-none items-center gap-3 border-b border-line-default px-12 tablet:px-6">
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <ClientLogo />
        <span className="bg-(image:--il-fill-brand) bg-clip-text text-22 font-700 tracking-(--il-hud-logo-tracking) text-transparent">{t('hud.logo')}</span>
        {logo?.image ? <img src={logo.image} alt="" className="h-8 w-auto" /> : logo?.text ? <span aria-hidden="true" className="flex size-8 items-center justify-center rounded-8 bg-surface-raised text-12 font-700">{logo.text}</span> : null}
      </div>
      {extra}
      <button type="button" onClick={onLogOut} className={QUIET_BUTTON}><LogOutIcon />{t('intro.logout')}</button>
    </header>
  );
}
