import { useEffect, useId, useRef, useState } from 'react';
import { Button } from '../../ds/Button';
import { useI18n } from '../../i18n';
import { copyText } from '../../lib/clipboard';

export interface SmallScreenNoticeProps {
  /** The address to open on a bigger screen: the page's own link, participant and all. */
  link: string;
  /** Copies the link; resolves false when it could not. Defaults to the clipboard. */
  copy?: (text: string) => Promise<boolean>;
  /** Shows the client logo placeholder next to the iLead mark, as the HUD does in the client theme. */
  clientLogo?: boolean;
  /** Moves focus to the heading when the notice appears, so it is read out. Defaults to true. */
  focusOnOpen?: boolean;
}

/** A laptop and a phone, in line: what to switch from and to. */
function DevicesIcon() {
  return (
    <svg width="64" height="48" viewBox="0 0 32 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-accent-secondary">
      <rect x="4" y="4" width="18" height="12" rx="1.5" />
      <path d="M1.5 19.5h23" />
      <rect x="24" y="9" width="6.5" height="12" rx="1.25" />
      <path d="M26.5 18.75h1.5" />
    </svg>
  );
}

/**
 * Covers the simulation on a screen too small to play on (D69): the brand mark, why, and the link
 * to copy and open on a laptop, desktop or tablet. Full screen, it scrolls on its own when short
 * (a phone held sideways) and keeps clear of notches and the home indicator.
 */
export function SmallScreenNotice({ link, copy = copyText, clientLogo = false, focusOnOpen = true }: SmallScreenNoticeProps) {
  const { t } = useI18n();
  const titleId = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const [copied, setCopied] = useState<'idle' | 'done' | 'failed'>('idle');
  useEffect(() => { if (focusOnOpen) heading.current?.focus({ preventScroll: true }); }, [focusOnOpen]);
  const onCopy = async () => setCopied((await copy(link)) ? 'done' : 'failed');

  return (
    <div className="fixed inset-0 z-70 flex overflow-y-auto overscroll-contain bg-surface-solid bg-(image:--il-smallscreen-glow) pt-(--il-app-safe-top) pr-(--il-app-safe-right) pb-(--il-app-safe-bottom) pl-(--il-app-safe-left) text-fg-primary">
      <main aria-labelledby={titleId} className="m-auto flex w-full max-w-110 flex-col items-center gap-5 px-6 py-10 text-center">
        <div className="flex items-center gap-3">
          {clientLogo && <span className="flex min-h-7 items-center rounded-6 border border-dashed border-line-strong px-2.5 text-12 text-fg-secondary">{t('hud.clientLogo')}</span>}
          <span className="bg-(image:--il-fill-brand) bg-clip-text text-28 font-700 tracking-(--il-app-logo-tracking) text-transparent">{t('hud.logo')}</span>
        </div>
        <DevicesIcon />
        <h1 ref={heading} id={titleId} tabIndex={-1} className="m-0 text-24 leading-(--il-smallscreen-title-leading) font-700 text-balance outline-none">{t('smallscreen.title')}</h1>
        <p className="m-0 text-15 text-pretty text-fg-secondary">{t('smallscreen.body')}</p>
        <Button variant="primary" size="lg" onClick={() => void onCopy()}>{t('smallscreen.copy')}</Button>
        <span role="status" className={`min-h-5 text-13 font-600 ${copied === 'failed' ? 'text-fg-secondary' : 'text-status-gain'}`}>
          {copied === 'done' ? t('smallscreen.copied') : copied === 'failed' ? t('smallscreen.copyFailed') : ''}
        </span>
        <p className="m-0 text-13 text-fg-secondary">{t('smallscreen.tablets')}</p>
      </main>
    </div>
  );
}
