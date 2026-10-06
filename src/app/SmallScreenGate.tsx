import { useEffect, useLayoutEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { SmallScreenNotice } from '../components/shell/SmallScreenNotice';
import { I18nProvider } from '../i18n';
import { SMALL_SCREEN, useMediaQuery } from '../lib/useMediaQuery';
import { BrandContext } from '../theme/brand';
import type { AppliedTheme } from '../theme/types';

/** The app while the notice covers it: still mounted, out of sight, and the page does not scroll behind the notice. */
const COVERED: CSSProperties = { visibility: 'hidden', height: '100vh', overflow: 'hidden' };

export interface SmallScreenGateProps {
  theme: 'dark' | 'light';
  /** The client theme, for the brand mark (its colours are on :root already). */
  clientTheme: AppliedTheme | null;
  /** The app. `covered` is true while the notice is up, so the app can hold its clocks. */
  children: (covered: boolean) => ReactNode;
}

/**
 * Laptops, desktops and tablets only (D69). On a screen too small to play on, the small screen
 * notice covers the app. The app stays mounted underneath, inert and hidden, so turning a tablet or
 * widening a window brings it back exactly where it was, with focus where it was.
 */
export function SmallScreenGate({ theme, clientTheme, children }: SmallScreenGateProps) {
  const covered = useMediaQuery(SMALL_SCREEN);
  const lastFocus = useRef<HTMLElement | null>(null);
  // Remember what had focus as the notice comes up (layout effect: before the notice takes focus).
  useLayoutEffect(() => {
    if (covered && document.activeElement instanceof HTMLElement && document.activeElement !== document.body) lastFocus.current = document.activeElement;
  }, [covered]);
  // And put it back when the app returns.
  useEffect(() => {
    if (covered) return;
    const el = lastFocus.current;
    lastFocus.current = null;
    if (el?.isConnected) el.focus({ preventScroll: true });
  }, [covered]);

  return (
    <>
      <div inert={covered} aria-hidden={covered || undefined} style={covered ? COVERED : undefined}>{children(covered)}</div>
      {covered && (
        <I18nProvider>
          <BrandContext.Provider value={clientTheme?.brand ?? null}>
            <div className="il-theme font-sans text-14 leading-(--il-app-leading)" style={{ colorScheme: theme, ...clientTheme?.vars }}>
              <SmallScreenNotice link={location.href} />
            </div>
          </BrandContext.Provider>
        </I18nProvider>
      )}
    </>
  );
}
