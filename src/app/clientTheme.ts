/**
 * The Halden Group sample client theme (`?client=halden`, frame b15). In production a client theme is
 * GenieKreator configuration (brand colours, checked for contrast), loaded with the storyline. The
 * client brand colour maps only to the accent tokens, which read these variables first.
 */
export const HALDEN_THEME: Record<string, string> = {
  '--client-acc': 'light-dark(oklch(0.5 0.17 0), oklch(0.72 0.17 0))',
  '--client-acc-2': 'light-dark(oklch(0.58 0.15 30), oklch(0.8 0.12 30))',
  '--client-acc-soft': 'light-dark(oklch(0.95 0.025 0), oklch(0.6 0.18 0 / 0.18))',
  '--client-grad': 'linear-gradient(135deg, oklch(0.66 0.19 2), oklch(0.78 0.13 30))'
};
