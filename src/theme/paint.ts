/**
 * Resolves design tokens to the colours they paint, and measures contrast pairs. Shared by the token
 * build (which checks every pair against WCAG at build time) and the theme loader (which corrects a
 * client theme at runtime), so both measure the same way.
 *
 * Values resolve through references, `light-dark()`, `{ ref, alpha }` and gradients (every stop
 * counts, the worst one wins). Translucent backgrounds are composited over `over` (by default
 * `color.surface.solid`, the opaque fallback of every layer, or white when there is none), and
 * translucent foregrounds over the result, in sRGB as the browser does.
 */
import { composite, contrastRatio, parseColor, toRgb, type Rgb } from './color';

export type Mode = 'light' | 'dark';
export const MODES: readonly Mode[] = ['light', 'dark'];

/** A token as the build reads it: primitive (`$value`), semantic (`light`/`dark` or `value`) or component (`value`). */
export interface TokenNode {
  $value?: string;
  value?: string;
  light?: ModeValue;
  dark?: ModeValue;
  /** A client theme may set this token (the theme loader writes `--il-theme-<path>`). */
  themable?: boolean;
}
export type ModeValue = string | { ref: string; alpha: number };

export interface ContrastPair {
  fg: string;
  bg: string | string[];
  min: number;
  /** Opaque layer under a translucent background. Defaults to color.surface.solid. */
  over?: string;
  /** Limit the check to these modes, when the other mode draws the control differently. */
  modes?: Mode[];
  why?: string;
}

/** One colour a token paints. `slot` names the client theme colour it came from, if any. */
export interface Stop { rgb: Rgb; slot?: string }

/** Client theme colours by token path: the stops each mode paints (one for a colour, several for a gradient). */
export type Overrides = (path: string, mode: Mode) => Stop[] | undefined;

export class PaintError extends Error {}

export const DEFAULT_OVER = 'color.surface.solid';
/** The custom property a theme writes for a themable token: `color.accent.default` is `--il-theme-color-accent-default`. */
export const themeVar = (path: string) => `--il-theme-${path.replace(/\./g, '-')}`;
const WHITE: Rgb = { r: 1, g: 1, b: 1, alpha: 1 };

/** Splits on commas outside parentheses and braces. */
export function splitTop(s: string): string[] {
  const out: string[] = [];
  let depth = 0, cur = '';
  for (const ch of s) {
    if (ch === '(' || ch === '{') depth++;
    if (ch === ')' || ch === '}') depth--;
    if (ch === ',' && depth === 0) { out.push(cur.trim()); cur = ''; } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

/** The colour part of a gradient stop: `{ref} 40%`, `oklch(...) 60%`, `#fff`. */
function stopColor(stop: string): string {
  if (stop.startsWith('{')) return stop.slice(0, stop.indexOf('}') + 1);
  const fn = /^[a-z-]+\(/i.exec(stop);
  if (fn) {
    let depth = 0;
    for (let i = 0; i < stop.length; i++) {
      if (stop[i] === '(') depth++;
      if (stop[i] === ')' && --depth === 0) return stop.slice(0, i + 1);
    }
  }
  return stop.split(/\s+/)[0];
}

export interface Painter {
  /** Every colour the token paints in `mode`. */
  paint(path: string, mode: Mode): Stop[];
  has(path: string): boolean;
}

/** A painter over a token table. `overrides` replaces themable tokens with a client theme's colours. */
export function createPainter(nodes: (path: string) => TokenNode | undefined, overrides?: Overrides): Painter {
  const paintString = (v: string, mode: Mode, where: string, seen: string[]): Stop[] => {
    const s = v.trim();
    const ref = /^\{([a-z0-9.-]+)\}$/i.exec(s);
    if (ref) return paint(ref[1], mode, seen);
    const ld = /^light-dark\((.*)\)$/s.exec(s);
    if (ld) {
      const [l, d] = splitTop(ld[1]);
      return paintString(mode === 'light' ? l : d, mode, where, seen);
    }
    const grad = /^(?:repeating-)?(?:linear|radial|conic)-gradient\((.*)\)$/s.exec(s);
    if (grad) {
      const args = splitTop(grad[1]);
      if (/^(to |from |at |circle|ellipse|-?[\d.]+(deg|turn|rad))/.test(args[0])) args.shift();
      return args.map(a => stopColor(a)).filter(c => c !== 'transparent').flatMap(c => paintString(c, mode, where, seen));
    }
    const c = parseColor(s);
    if (!c) throw new PaintError(`${where}: cannot read "${s}" as a colour for a contrast check`);
    return [{ rgb: toRgb(c) }];
  };

  const paint = (path: string, mode: Mode, seen: string[] = []): Stop[] => {
    if (seen.includes(path)) throw new PaintError(`contrast: circular reference ${[...seen, path].join(' -> ')}`);
    const next = [...seen, path];
    const node = nodes(path);
    if (!node) throw new PaintError(`contrast: unknown token ${path}`);
    if (typeof node.$value === 'string') return paintString(node.$value, mode, path, next);
    const themed = node.themable ? overrides?.(path, mode) : undefined;
    if (themed) return themed;
    if (node.light !== undefined && node.dark !== undefined) {
      const v = node[mode]!;
      if (typeof v === 'string') return paintString(v, mode, `${path}.${mode}`, next);
      return paint(v.ref, mode, next).map(st => ({ ...st, rgb: { ...st.rgb, alpha: st.rgb.alpha * v.alpha } }));
    }
    if (typeof node.value !== 'string') throw new PaintError(`contrast: ${path} has no colour value`);
    return paintString(node.value, mode, path, next);
  };

  return { paint: (p, m) => paint(p, m), has: p => nodes(p) !== undefined };
}

/** One measured combination: a foreground stop on a background stop over a base stop. */
export interface Combo { fg: Stop; bg: Stop; base: Stop; ratio: number }

/** Every stop combination of `fg` on `against` in `mode`, with its contrast ratio. */
export function measure(painter: Painter, pair: ContrastPair, against: string, mode: Mode): Combo[] {
  const overPath = pair.over ?? (painter.has(DEFAULT_OVER) ? DEFAULT_OVER : null);
  const fg = painter.paint(pair.fg, mode);
  const bg = painter.paint(against, mode);
  const base: Stop[] = overPath ? painter.paint(overPath, mode) : [{ rgb: WHITE }];
  const out: Combo[] = [];
  for (const u of base) for (const b of bg) for (const f of fg) {
    const under = composite(b.rgb, composite(u.rgb, WHITE));
    out.push({ fg: f, bg: b, base: u, ratio: contrastRatio(composite(f.rgb, under), under) });
  }
  return out;
}

export const worst = (combos: Combo[]) => combos.reduce((m, c) => Math.min(m, c.ratio), Infinity);
export const round2 = (n: number) => Math.round(n * 100) / 100;
export const pairModes = (pair: ContrastPair) => pair.modes ?? MODES;
export const pairTargets = (pair: ContrastPair) => (Array.isArray(pair.bg) ? pair.bg : [pair.bg]);
