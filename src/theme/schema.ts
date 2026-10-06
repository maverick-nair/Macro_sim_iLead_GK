/**
 * The GenieKreator theme config (Configuration Spec, "Branding, images and media": brand and theme),
 * as the participant app reads it. GenieKreator authors it (or extracts it from the client's brand
 * kit); the app loads it at runtime from `GET /theme` or the launch payload (src/theme/bootstrap.ts).
 *
 * Every field but `version` is optional: what a theme leaves out keeps the iLead default. A colour is
 * any CSS colour the loader can measure (oklch(), #hex, rgb()), either one value for both modes or
 * `{ light, dark }`. Colours are corrected for WCAG AA contrast after validation (correct.ts), so a
 * valid colour can still be adjusted; an invalid one falls back to the default.
 *
 * Fallback (parseTheme): a value that is not an object, or a `version` other than 1, rejects the
 * whole theme. Any other invalid field is dropped on its own, with an issue, and the rest applies.
 *
 * See README "Themes" for the field table and DECISIONS D71.
 */
import { z } from 'zod';
import { parseColor } from './color';

/** Fonts a theme may name: web fonts the app knows how to load, plus the device's own. */
export const FONTS = {
  Manrope: { stack: "'Manrope', system-ui, sans-serif", href: null },
  Inter: { stack: "'Inter', system-ui, sans-serif", href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap' },
  'IBM Plex Sans': { stack: "'IBM Plex Sans', system-ui, sans-serif", href: 'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&display=swap' },
  'Source Sans 3': { stack: "'Source Sans 3', system-ui, sans-serif", href: 'https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@400;500;600;700;800&display=swap' },
  'Nunito Sans': { stack: "'Nunito Sans', system-ui, sans-serif", href: 'https://fonts.googleapis.com/css2?family=Nunito+Sans:wght@400;500;600;700;800&display=swap' },
  'Work Sans': { stack: "'Work Sans', system-ui, sans-serif", href: 'https://fonts.googleapis.com/css2?family=Work+Sans:wght@400;500;600;700;800&display=swap' },
  Lato: { stack: "'Lato', system-ui, sans-serif", href: 'https://fonts.googleapis.com/css2?family=Lato:wght@400;700;900&display=swap' },
  'Open Sans': { stack: "'Open Sans', system-ui, sans-serif", href: 'https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;500;600;700;800&display=swap' },
  System: { stack: 'system-ui, sans-serif', href: null }
} as const satisfies Record<string, { stack: string; href: string | null }>;
export type FontName = keyof typeof FONTS;
const FONT_NAMES = Object.keys(FONTS) as [FontName, ...FontName[]];

/** One CSS colour the loader can measure: oklch(), #hex or rgb(). */
export const ColorValue = z.string().trim().max(80).refine(s => parseColor(s) !== null, 'not a colour the loader can read (use oklch(), #hex or rgb())');
/** A colour for both modes, or one per mode. */
export const ThemeColor = z.union([ColorValue, z.strictObject({ light: ColorValue, dark: ColorValue })]);
export type ThemeColor = z.infer<typeof ThemeColor>;

/** Logo image sources: https, a path on this site, or an inline raster or SVG image. */
const LogoSrc = z.string().trim().max(200_000).refine(
  s => /^https:\/\/[^\s"'<>]+$/i.test(s) || /^\/(?!\/)[^\s"'<>]*$/.test(s) || /^data:image\/(png|jpeg|webp|gif|svg\+xml);base64,[a-z0-9+/=]+$/i.test(s),
  'logo src must be https://, a root relative path or a data:image base64 URI'
);

/** Copy rules apply to theme text too: no dash punctuation, no emoji. */
const ThemeText = (max: number) => z.string().trim().min(1).max(max).refine(s => !/[‒-―]|\s-\s/.test(s), 'no dashes as punctuation')
  .refine(s => !/\p{Extended_Pictographic}/u.test(s), 'no emoji');

export const BrandGradient = z.strictObject({
  from: ThemeColor,
  to: ThemeColor,
  /** Degrees, as in linear-gradient(). Defaults to 135, the iLead brand angle. */
  angle: z.number().min(0).max(360).optional()
});

export const SurfaceColors = z.strictObject({
  /** Opaque surface: dialogs, the small screen notice, the print page, and the layer translucent surfaces sit on. */
  solid: ThemeColor.optional(),
  /** Cards over the background image. */
  card: ThemeColor.optional(),
  /** Insets, segmented control tracks, raised rows. */
  raised: ThemeColor.optional(),
  /** Translucent overlays and drawers. */
  material: ThemeColor.optional()
});

export const ThemeColors = z.strictObject({
  /** color.accent.default: bars, selected state, links. Needs 3:1 on surfaces and 4.5:1 under on accent text. */
  accent: ThemeColor.optional(),
  /** color.accent.secondary: eyebrows, text links, focus ring. Used as 12px text, so 4.5:1. */
  accentSecondary: ThemeColor.optional(),
  /** color.accent.soft: selected backgrounds, under primary text. */
  accentSoft: ThemeColor.optional(),
  /** fill.brand: the primary button, the wordmark, the on switch, progress dots. */
  brand: BrandGradient.optional(),
  surface: SurfaceColors.optional()
});

export const ThemeLogo = z.strictObject({
  /** Image shown next to the iLead wordmark, about 28px high. */
  src: LogoSrc.optional(),
  /** Alternative text for the image. Defaults to "<name> logo". */
  alt: ThemeText(80).optional(),
  /** A text mark instead of an image. */
  text: ThemeText(40).optional()
});

/** The whole config, strict. parseTheme validates field by field against these same schemas. */
export const ThemeConfigSchema = z.strictObject({
  version: z.literal(1),
  /** Stable id, for logs and caching. */
  id: z.string().regex(/^[a-z0-9][a-z0-9_.]{0,47}$/i).optional(),
  /** The client's name, as people read it ("Halden Group"). Names the logo. */
  name: ThemeText(60).optional(),
  /** Mode the app opens in. `system` follows the device. The `?theme=` launch parameter wins. */
  mode: z.enum(['dark', 'light', 'system']).optional(),
  colors: ThemeColors.optional(),
  logo: ThemeLogo.optional(),
  /** From the allowlist only (FONTS). Defaults to Manrope. */
  font: z.enum(FONT_NAMES).optional(),
  /** Multiplies every radius token: 0 is square, 1 is the iLead default, 2 is twice as round. */
  radiusScale: z.number().min(0).max(2).optional()
});
export type ThemeConfig = z.infer<typeof ThemeConfigSchema>;

export interface ParsedTheme { theme: ThemeConfig | null; issues: string[] }

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const first = (e: z.ZodError) => e.issues[0]?.message ?? 'invalid';

/**
 * Validates a theme field by field. Unknown fields and invalid values are dropped with an issue each;
 * the theme is rejected (null) only when it is not an object or its version is not 1.
 */
export function parseTheme(raw: unknown): ParsedTheme {
  const issues: string[] = [];
  if (!isObject(raw)) return { theme: null, issues: ['theme: not an object, the default theme applies'] };
  if (raw.version !== 1) return { theme: null, issues: [`version: expected 1, got ${JSON.stringify(raw.version)}; the default theme applies`] };

  /** Keeps the fields of `value` that pass their schema in `shape`, recursing into nested objects. */
  const pick = (value: unknown, shape: Record<string, z.ZodType>, nested: Record<string, Record<string, z.ZodType>>, at: string): Record<string, unknown> | undefined => {
    if (!isObject(value)) { issues.push(`${at}: not an object, ignored`); return undefined; }
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      const where = at ? `${at}.${k}` : k;
      if (k === '$description' || k === '$comment') continue;
      if (k in nested) {
        const inner = pick(v, nested[k], {}, where);
        if (inner && Object.keys(inner).length) out[k] = inner;
        continue;
      }
      const schema = shape[k];
      if (!schema) { issues.push(`${where}: unknown field, ignored`); continue; }
      const r = schema.safeParse(v);
      if (r.success) out[k] = r.data; else issues.push(`${where}: ${first(r.error)}; the default applies`);
    }
    return out;
  };

  const top: Record<string, unknown> = { version: 1 };
  for (const [k, v] of Object.entries(raw)) {
    if (k === 'version' || k === '$description' || k === '$comment') continue;
    if (k === 'colors' || k === 'logo') {
      const inner = k === 'colors' ? pick(v, ThemeColors.shape, { surface: SurfaceColors.shape }, k) : pick(v, ThemeLogo.shape, {}, k);
      if (inner && Object.keys(inner).length) top[k] = inner;
      continue;
    }
    const schema = (ThemeConfigSchema.shape as Record<string, z.ZodType>)[k];
    if (!schema) { issues.push(`${k}: unknown field, ignored`); continue; }
    const r = schema.safeParse(v);
    if (r.success) top[k] = r.data; else issues.push(`${k}: ${first(r.error)}; the default applies`);
  }
  const whole = ThemeConfigSchema.safeParse(top);
  if (!whole.success) return { theme: null, issues: [...issues, `theme: ${first(whole.error)}; the default theme applies`] };
  return { theme: whole.data, issues };
}
