import { createContext, useContext, type ReactNode } from 'react';
import { DEFAULT_LENS_VIEW, type LensStyle, type LensView } from '../../engine/lens';

/**
 * The storyline's leadership lens for the UI (D70): its 2 to 6 styles (key, letter, name, short line,
 * description) and the names of the four needs. Engine screens provide the view's `lens`; design
 * fixtures and stories fall back to Readiness Based Leadership. No component hard codes style names.
 */
const LensContext = createContext<LensView>(DEFAULT_LENS_VIEW);

export function LensProvider({ lens, children }: { lens: LensView | null | undefined; children: ReactNode }) {
  return <LensContext.Provider value={lens ?? DEFAULT_LENS_VIEW}>{children}</LensContext.Provider>;
}

export const useLens = () => useContext(LensContext);

/** A style of the lens by key. An unknown key reads as itself, so nothing renders blank. */
export function styleOf(lens: LensView, key: string): LensStyle {
  return lens.styles.find(s => s.key === key) ?? { key, letter: key.slice(0, 2), name: key, short: '', description: '' };
}

/** Name lookup for the current lens. */
export function useStyleName() {
  const lens = useLens();
  return (key: string) => styleOf(lens, key).name;
}
