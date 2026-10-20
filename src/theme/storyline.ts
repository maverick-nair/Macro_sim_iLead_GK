/**
 * The storyline's own look in the player (D181, D182): the client brand authored in GenieKreator's Brand and theme tab,
 * turned into a theme through the same loader as a server theme (validated and contrast corrected, D72), and the office
 * image authored in Story and world, behind the player's screens in place of the default backdrop. Lazy, like the loader.
 *
 * Precedence: a theme the server provides (`GET /theme`, or the launch payload's) wins over the storyline brand as a
 * whole (colours, logo, font, mode). The office image is storyline content, not theme, so it applies either way.
 */
import { resolveTheme } from './loader';
import type { ThemeConfig } from './schema';
import type { AppliedTheme, Brand } from './types';

/** What the player reads from the view for its look (`EngineView['storyline']`, D181 to D183). */
export interface StorylineLookInput {
  organisation?: string | null;
  brand: { name: string | null; colors: { main: string; second: string } | null; logo: string | null; font: string | null; mode: 'dark' | 'light' | 'system' | null } | null;
  logo: { image: string | null; text: string | null } | null;
  office: string | null;
}

/** The storyline's theme and its office backdrop, kept apart so a server theme can replace the one and keep the other. */
export interface StorylineTheme { theme: AppliedTheme | null; backdrop: Record<string, string> }

/** The library backdrops (src/author/model/seed.ts OFFICES) are dark art made for the player: they need no veil. */
const LIBRARY_BACKDROP = /^\/assets\/bg-\d+\.webp$/;
/** The dark theme's ground (tokens/primitive/app.json backdrop.office) and the light theme's. */
const NIGHT = '#0A081B';
const DAY = 'oklch(0.97 0.012 270)';

/** The custom properties that put the office image behind the screens, in both modes: a veil keeps text on it readable. */
export function backdropVars(src: string | null): Record<string, string> {
  if (!src) return {};
  const img = `url("${src}") center / cover no-repeat`;
  if (LIBRARY_BACKDROP.test(src)) return { '--il-backdrop-office': `${NIGHT} ${img}` };
  return {
    '--il-backdrop-office': `linear-gradient(oklch(0.13 0.03 285 / 0.74), oklch(0.13 0.03 285 / 0.74)), ${NIGHT} ${img}`,
    '--il-backdrop-daylight': `linear-gradient(oklch(0.97 0.012 270 / 0.88), oklch(0.97 0.012 270 / 0.88)), ${DAY} ${img}`
  };
}

/** The storyline brand as a theme config the loader reads: main colour for accents and the button, second for links and the gradient's end. */
export function themeConfigOf(brand: NonNullable<StorylineLookInput['brand']>): ThemeConfig {
  const c = brand.colors;
  return {
    version: 1, id: 'storyline',
    ...(brand.name ? { name: brand.name } : null),
    ...(brand.mode ? { mode: brand.mode } : null),
    ...(brand.font ? { font: brand.font as ThemeConfig['font'] } : null),
    ...(c ? { colors: { accent: c.main, accentSecondary: c.second, brand: { from: c.main, to: c.second } } } : null)
  };
}

/**
 * The brand mark next to the iLead wordmark: the brand's logo, else the company's uploaded logo. A storyline without
 * an image shows no mark (never the design review's dashed placeholder).
 */
function markOf(look: StorylineLookInput): Brand | null {
  const src = look.brand?.logo ?? look.logo?.image ?? null;
  if (!src) return null;
  return { name: look.brand?.name ?? look.organisation ?? null, logo: { kind: 'image', src, alt: null } };
}

/** The storyline's look as what the app applies. Never throws: anything it cannot use keeps the default. */
export function resolveStorylineTheme(look: StorylineLookInput): StorylineTheme {
  const backdrop = backdropVars(look.office);
  const mark = markOf(look);
  let theme: AppliedTheme | null = null;
  try {
    theme = look.brand ? resolveTheme(themeConfigOf(look.brand)) : null;
  } catch {
    theme = null;
  }
  if (theme) theme = { ...theme, brand: mark };
  else if (mark) theme = { id: 'storyline', brand: mark, mode: null, vars: {}, fontHref: null, corrections: [], issues: [] };
  return { theme, backdrop };
}

/**
 * What applies: the server's theme when there is one, else the storyline's, with the storyline's office backdrop under
 * either. Null when neither has anything, so the default theme shows exactly as before.
 */
export function combineThemes(server: AppliedTheme | null, story: StorylineTheme | null): AppliedTheme | null {
  const brand = server ?? story?.theme ?? null;
  const backdrop = story?.backdrop ?? {};
  if (!Object.keys(backdrop).length) return brand;
  const vars = { ...backdrop, ...(brand?.vars ?? {}) };
  return brand ? { ...brand, vars } : { id: 'storyline', brand: null, mode: null, vars, fontHref: null, corrections: [], issues: [] };
}
