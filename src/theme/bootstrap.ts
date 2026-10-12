/**
 * Theme bootstrap: the only theme code in the first load (D72). It starts the lazy loader
 * (loader.ts), writes what it returns on :root, and tells React when the theme has settled.
 * Until then, and whenever anything fails, the default iLead theme shows.
 */
import { useSyncExternalStore } from 'react';
import type { StorylineLookInput, StorylineTheme } from './storyline';
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
/** The server's theme once settled (null: none), undefined until then; and the running storyline's look (D181). */
let server: AppliedTheme | null | undefined;
let story: StorylineTheme | null = null;
let offered = '';
let published = 0;

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
  // The request goes out with the loader's chunk, not after it (D78).
  const raw = inline === undefined ? fetch() : null;
  raw?.catch(() => undefined);
  import('./loader')
    .then(m => m.loadTheme({ inline, fetch: () => raw ?? fetch() }))
    .catch(() => null)
    .then(theme => {
      server = theme;
      publish();
    });
}

/** Applies the server's theme, or the storyline's when the server has none, with the storyline's office backdrop (D181, D182). */
function publish() {
  if (server === undefined) return;
  const turn = ++published;
  const load = story ? import('./storyline').then(m => m.combineThemes(server ?? null, story)) : Promise.resolve(server);
  void load.catch(() => server ?? null).then(theme => {
    if (turn !== published) return;
    let applied = theme ?? null;
    try { applyTheme(applied); } catch { applied = null; applyTheme(null); }
    set({ status: 'ready', theme: applied });
  });
}

/**
 * The running storyline's look, from the engine view (D181, D182): its brand applies when the server provides no theme,
 * and its office image goes behind the screens. Only on pages that started the theme (the participant app), never in
 * GenieKreator or a gallery. The same look offered again changes nothing.
 */
export function offerStorylineTheme(look: StorylineLookInput | null): void {
  if (!started) return;
  // Embedded images are long: a fingerprint of each keeps the comparison cheap on every view.
  const fp = (v: string | null | undefined) => (v && v.length > 256 ? `${v.length}:${v.slice(0, 96)}:${v.slice(-96)}` : v ?? null);
  const key = look && (look.brand || look.office || look.logo?.image)
    ? JSON.stringify([look.organisation ?? null, look.brand && { ...look.brand, logo: fp(look.brand.logo) }, fp(look.logo?.image), fp(look.office)]) : '';
  if (key === offered) return;
  offered = key;
  if (!key) { story = null; publish(); return; }
  void import('./storyline').then(m => {
    if (offered !== key) return;
    story = m.resolveStorylineTheme(look!);
    publish();
  }).catch(() => undefined);
}

export function useThemeState(): ThemeState {
  return useSyncExternalStore(l => { listeners.add(l); return () => listeners.delete(l); }, () => state, () => state);
}
