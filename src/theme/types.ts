/**
 * What the theme loader hands the app. Types only, so the first load can name them without pulling
 * in the loader, the schema or the contrast tables.
 */

/** The client's brand mark next to the iLead wordmark (HUD, onboarding, small screen notice, report). */
export interface Brand {
  name: string | null;
  /** An image, a text mark, or the design's dashed placeholder naming the client. */
  logo: { kind: 'image'; src: string; /** Null: "<name> logo" from the catalog. */ alt: string | null } | { kind: 'text'; text: string } | { kind: 'placeholder'; name: string };
}

export interface ThemeCorrection { token: string; mode: 'light' | 'dark'; stop: number; from: string; to: string; because: string }

export interface AppliedTheme {
  id: string;
  brand: Brand | null;
  /** The theme's preferred mode; the `?theme=` launch parameter wins over it. */
  mode: 'dark' | 'light' | 'system' | null;
  /** Custom properties to set on :root (or on an ancestor of the app root, for a scoped preview). */
  vars: Record<string, string>;
  /** A web font stylesheet to load, for an allowlisted font. */
  fontHref: string | null;
  /** Contrast corrections the loader made, reported in a dev console warning. */
  corrections: ThemeCorrection[];
  /** Fields that fell back to the default, and why. */
  issues: string[];
}
