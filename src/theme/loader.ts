/**
 * The theme loader (M7, D71). Lazy: only the bootstrap (bootstrap.ts) is in the first load; this
 * module, the schema, the contrast tables and the correction maths load on demand.
 *
 * resolveTheme turns a raw GenieKreator theme config into the custom properties the semantic token
 * layer reads (`--il-theme-<token>`, see `themable` in tokens/semantic), plus radius and font
 * primitives, after validating it (schema.ts, per field fallback) and correcting its contrast
 * (correct.ts). It never throws: anything it cannot use falls back to the iLead default.
 */
import { formatOklch, parseColor, toOklch } from './color';
import { correctContrast, type Slot } from './correct';
import { themeVar, type Mode } from './paint';
import { FONTS, parseTheme, type ThemeColor, type ThemeConfig } from './schema';
import { NODES, PAIRS, RADII } from './tokens.generated';
import type { AppliedTheme, Brand } from './types';

export { parseTheme } from './schema';
export type { ThemeConfig } from './schema';

const BRAND_ANGLE = 135;
const MODES: Mode[] = ['light', 'dark'];

const perMode = (c: ThemeColor): Record<Mode, string> => (typeof c === 'string' ? { light: c, dark: c } : c);

function slotFor(token: string, mode: Mode, stop: number, source: string): Slot {
  const parsed = parseColor(source);
  if (!parsed) throw new Error(`unreadable colour ${source}`); // the schema already refused these
  return { token, mode, stop, source: source.trim(), color: toOklch(parsed), corrected: false };
}

/** The theme's colours as slots, by semantic token. Exported for tests. */
export function slotsOf(theme: ThemeConfig): { slots: Map<string, Record<Mode, Slot[]>>; angle: number } {
  const slots = new Map<string, Record<Mode, Slot[]>>();
  const c = theme.colors ?? {};
  const one = (token: string, color: ThemeColor | undefined) => {
    if (!color) return;
    const v = perMode(color);
    slots.set(token, { light: [slotFor(token, 'light', 0, v.light)], dark: [slotFor(token, 'dark', 0, v.dark)] });
  };
  one('color.accent.default', c.accent);
  one('color.accent.secondary', c.accentSecondary);
  one('color.accent.soft', c.accentSoft);
  for (const k of ['solid', 'card', 'raised', 'material'] as const) one(`color.surface.${k}`, c.surface?.[k]);
  if (c.brand) {
    const from = perMode(c.brand.from), to = perMode(c.brand.to);
    slots.set('fill.brand', Object.fromEntries(MODES.map(m => [m, [slotFor('fill.brand', m, 0, from[m]), slotFor('fill.brand', m, 1, to[m])]])) as Record<Mode, Slot[]>);
  }
  return { slots, angle: c.brand?.angle ?? BRAND_ANGLE };
}

const text = (s: Slot) => (s.corrected ? formatOklch(s.color) : s.source);
/** One colour for both modes when they agree, light-dark() otherwise (color-scheme on the app root picks). */
const both = (l: Slot, d: Slot) => (text(l) === text(d) ? text(l) : `light-dark(${text(l)}, ${text(d)})`);

function brandOf(theme: ThemeConfig): Brand | null {
  const name = theme.name ?? null;
  const logo = theme.logo;
  if (logo?.src) return { name, logo: { kind: 'image', src: logo.src, alt: logo.alt ?? null } };
  if (logo?.text) return { name, logo: { kind: 'text', text: logo.text } };
  return name ? { name, logo: { kind: 'placeholder', name } } : null;
}

/** Validates, corrects and turns a raw theme config into what the app applies. Null when nothing of it is usable. */
export function resolveTheme(raw: unknown): AppliedTheme | null {
  const { theme, issues } = parseTheme(raw);
  if (!theme) return report({ id: 'default', brand: null, mode: null, vars: {}, fontHref: null, corrections: [], issues }, true);

  const vars: Record<string, string> = {};
  const { slots, angle } = slotsOf(theme);
  const { corrections, dropped } = correctContrast({ pairs: PAIRS, nodes: NODES }, slots);
  for (const token of dropped) issues.push(`${token}: no lightness passes every contrast pair; the default applies`);
  for (const [token, modes] of slots) {
    if (token === 'fill.brand') {
      const stops = modes.light.map((l, i) => both(l, modes.dark[i]));
      vars[themeVar(token)] = `linear-gradient(${angle}deg, ${stops.join(', ')})`;
    } else {
      vars[themeVar(token)] = both(modes.light[0], modes.dark[0]);
    }
  }
  if (theme.radiusScale !== undefined && theme.radiusScale !== 1) {
    for (const [v, px] of Object.entries(RADII)) vars[v] = `${Math.round(px * theme.radiusScale * 100) / 100}px`;
  }
  const font = theme.font ? FONTS[theme.font] : null;
  if (font && theme.font !== 'Manrope') vars['--il-font-family-sans'] = font.stack;

  return report({
    id: theme.id ?? 'client', brand: brandOf(theme), mode: theme.mode ?? null, vars,
    fontHref: font?.href ?? null, corrections, issues
  });
}

/** Dev builds say what the loader changed or ignored. */
function report(t: AppliedTheme, rejected = false): AppliedTheme | null {
  if (import.meta.env?.DEV && (t.corrections.length || t.issues.length)) {
    const lines = [
      ...t.corrections.map(c => `  ${c.token}${c.token === 'fill.brand' ? ` stop ${c.stop + 1}` : ''} (${c.mode}): ${c.from} -> ${c.to}, for ${c.because}`),
      ...t.issues.map(i => `  ${i}`)
    ];
    console.warn(`iLead theme "${t.id}": ${t.corrections.length} contrast correction(s), ${t.issues.length} issue(s)\n${lines.join('\n')}`);
  }
  return rejected ? null : t;
}

/**
 * Loads the theme for this launch: the launch payload's inline theme when there is one, otherwise the
 * API's (`getTheme`, null when there is none). Any failure means the default theme.
 */
export async function loadTheme(source: { inline?: unknown; fetch: () => Promise<unknown> }): Promise<AppliedTheme | null> {
  let raw: unknown = source.inline;
  if (raw === undefined) {
    try {
      raw = await source.fetch();
    } catch (e) {
      if (import.meta.env?.DEV) console.warn('iLead theme: could not load the theme, the default applies', e);
      return null;
    }
  }
  if (raw === null || raw === undefined) return null;
  return resolveTheme(raw);
}
