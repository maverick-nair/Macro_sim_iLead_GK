/**
 * Theme bootstrap: the only theme code in the first load (D71). It starts the lazy loader
 * (loader.ts), writes what it returns on :root, and tells React when the theme has settled.
 * Until then, and whenever anything fails, the default iLead theme shows.
 */
import { useSyncExternalStore } from 'react';
import type { AppliedTheme } from './types';

export interface ThemeState {
  /** `loading` until the theme is applied or known to be absent. */
  status: 'loading' | 'ready';
  theme: AppliedTheme | null;
}

let state: ThemeState = { status: 'loading', theme: null };
const listeners = new Set<() => void>();
const set = (next: ThemeState) => { state = next; listeners.forEach(l => l()); };
let started = false;
let written: string[] = [];

/** The launch payload's inline theme (`<script type="application/json" id="il-launch">{"theme": …}</script>`), if the host page has one. */
export function readLaunchTheme(doc: Document = document): unknown {
  const el = doc.getElementById('il-launch');
  if (!el?.textContent) return undefined;
  try {
    const launch = JSON.parse(el.textContent) as { theme?: unknown };
    return launch && typeof launch === 'object' ? launch.theme : undefined;
  } catch {
    return undefined;
  }
}

/** Writes a theme's custom properties on an element (default :root) and loads its web font. Replaces what it wrote before. */
export function applyTheme(theme: AppliedTheme | null, el: HTMLElement = document.documentElement) {
  for (const k of written) el.style.removeProperty(k);
  written = [];
  if (theme) {
    for (const [k, v] of Object.entries(theme.vars)) el.style.setProperty(k, v);
    written = Object.keys(theme.vars);
    if (theme.fontHref && !document.querySelector(`link[data-il-font="${CSS.escape(theme.fontHref)}"]`)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = theme.fontHref;
      link.dataset.ilFont = theme.fontHref;
      document.head.appendChild(link);
    }
  }
  // A hook for tests and the host page: which theme is on, once it has settled.
  el.dataset.ilTheme = theme?.id ?? 'default';
}

/**
 * Loads and applies the theme once per page. `fetch` is the API's getTheme; an inline launch theme
 * wins over it.
 */
export function startTheme(fetch: () => Promise<unknown>, inline: unknown = readLaunchTheme()): void {
  if (started) return;
  started = true;
  import('./loader')
    .then(m => m.loadTheme({ inline, fetch }))
    .catch(() => null)
    .then(theme => {
      let applied = theme;
      try { applyTheme(theme); } catch { applied = null; applyTheme(null); }
      set({ status: 'ready', theme: applied });
    });
}

export function useThemeState(): ThemeState {
  return useSyncExternalStore(l => { listeners.add(l); return () => listeners.delete(l); }, () => state, () => state);
}
