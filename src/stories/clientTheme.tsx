import type { Decorator } from '@storybook/react-vite';
import { BrandContext } from '../theme/brand';
import { resolveTheme } from '../theme/loader';
import brightwater from '../theme/samples/brightwater.json';
import halden from '../theme/samples/halden.json';
import type { AppliedTheme } from '../theme/types';

/** The sample client themes, through the theme loader (D72). */
export const HALDEN = resolveTheme(halden)!;
export const BRIGHTWATER = resolveTheme(brightwater)!;

/**
 * Puts one story in a client theme whatever the toolbar says: its brand mark, and its colours on a
 * nested theme root (semantic tokens resolve where `.il-theme` is declared, so the vars sit on it).
 */
export const withClientTheme = (theme: AppliedTheme = HALDEN): Decorator => Story => (
  <BrandContext.Provider value={theme.brand}>
    <div className="il-theme text-fg-primary" style={theme.vars}>
      <Story />
    </div>
  </BrandContext.Provider>
);
