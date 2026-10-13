/**
 * Which mode the player opens in (D227). The launch's `?theme=light|dark` wins, then the theme's own mode (a client theme or
 * the storyline's brand, `system` following the device), else the default: the approved canvas's paper, light. In both
 * modes the header stays navy and the screens the canvas draws on navy stay navy (`il-scheme-dark`, src/styles/global.css).
 */
export type Mode = 'light' | 'dark';

export const DEFAULT_MODE: Mode = 'light';

export function pickMode(param: string | null | undefined, preferred: 'dark' | 'light' | 'system' | null | undefined, systemLight: boolean): Mode {
  if (param === 'light' || param === 'dark') return param;
  if (preferred === 'system') return systemLight ? 'light' : 'dark';
  return preferred ?? DEFAULT_MODE;
}
