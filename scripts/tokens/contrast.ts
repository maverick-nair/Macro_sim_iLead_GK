/**
 * WCAG contrast checks for the token build.
 *
 * Any token (primitive, semantic or component) can be checked against any other. Values are
 * resolved through references, `light-dark()`, `{ ref, alpha }` and gradients (every stop is
 * checked, the worst one counts). Translucent backgrounds are composited over `over` (by default
 * `color.surface.solid`, the opaque fallback of every layer, or white when there is none), and
 * translucent foregrounds over the result, in sRGB as the browser does.
 *
 * Client themes (tokens/themes/*.json) replace the brand variables that `overridableBy` names.
 * A pair is checked again under a client theme only when that theme changes one of its colours.
 */
import { converter, parse, wcagContrast, type Rgb } from 'culori';
import { TokenError, type Leaf } from './pipeline';

export type Mode = 'light' | 'dark';

/** A client theme: brand variable name (without `--`) to its light and dark values, or one value. */
export type ClientTheme = Record<string, { light: string; dark: string } | { value: string }>;

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

export interface ContrastResult { token: string; mode: string; against: string; ratio: number; min: number; pass: boolean; why?: string }

interface Paint { stops: Rgb[]; themed: boolean }

const toRgb = converter('rgb');
const DEFAULT_OVER = 'color.surface.solid';

/** Splits on commas outside parentheses and braces. */
function splitTop(s: string): string[] {
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

function composite(top: Rgb, under: Rgb): Rgb {
  const a = top.alpha ?? 1;
  if (a >= 1) return { mode: 'rgb', r: top.r, g: top.g, b: top.b };
  const ua = under.alpha ?? 1;
  const out = a + ua * (1 - a);
  const mix = (t: number, u: number) => (t * a + u * ua * (1 - a)) / out;
  return { mode: 'rgb', r: mix(top.r, under.r), g: mix(top.g, under.g), b: mix(top.b, under.b), alpha: out };
}

export function contrastChecks(
  pairs: ContrastPair[],
  layers: { prim: Leaf[]; sem: Leaf[]; comp: Leaf[] },
  themes: Record<string, ClientTheme> = {}
): ContrastResult[] {
  const byPath = new Map<string, { node: Record<string, unknown>; primitive: boolean }>();
  for (const l of layers.prim) byPath.set(l.path, { node: l.node, primitive: true });
  for (const l of [...layers.sem, ...layers.comp]) byPath.set(l.path, { node: l.node, primitive: false });

  const paintString = (v: string, mode: Mode, theme: ClientTheme | null, where: string, seen: string[]): Paint => {
    const s = v.trim();
    const ref = /^\{([a-z0-9.-]+)\}$/i.exec(s);
    if (ref) return paint(ref[1], mode, theme, seen);
    const ld = /^light-dark\((.*)\)$/s.exec(s);
    if (ld) {
      const [l, d] = splitTop(ld[1]);
      return paintString(mode === 'light' ? l : d, mode, theme, where, seen);
    }
    const grad = /^(?:repeating-)?(?:linear|radial|conic)-gradient\((.*)\)$/s.exec(s);
    if (grad) {
      const args = splitTop(grad[1]);
      if (/^(to |from |at |circle|ellipse|-?[\d.]+(deg|turn|rad))/.test(args[0])) args.shift();
      const parts = args.map(a => stopColor(a)).filter(c => c !== 'transparent').map(c => paintString(c, mode, theme, where, seen));
      return { stops: parts.flatMap(p => p.stops), themed: parts.some(p => p.themed) };
    }
    const c = parse(s);
    if (!c) throw new TokenError(`${where}: cannot read "${s}" as a colour for a contrast check`);
    return { stops: [toRgb(c)], themed: false };
  };

  const paint = (path: string, mode: Mode, theme: ClientTheme | null, seen: string[] = []): Paint => {
    if (seen.includes(path)) throw new TokenError(`contrast: circular reference ${[...seen, path].join(' -> ')}`);
    const next = [...seen, path];
    const hit = byPath.get(path);
    if (!hit) throw new TokenError(`contrast: unknown token ${path}`);
    const { node, primitive } = hit;
    if (primitive) return paintString(node.$value as string, mode, theme, path, next);
    const brand = typeof node.overridableBy === 'string' ? theme?.[node.overridableBy] : undefined;
    if (brand) {
      const p = paintString('value' in brand ? brand.value : brand[mode], mode, theme, `${path} (client ${node.overridableBy})`, next);
      return { stops: p.stops, themed: true };
    }
    if ('light' in node) {
      const v = node[mode] as string | { ref: string; alpha: number };
      if (typeof v === 'string') return paintString(v, mode, theme, `${path}.${mode}`, next);
      const p = paint(v.ref, mode, theme, next);
      return { stops: p.stops.map(c => ({ ...c, alpha: (c.alpha ?? 1) * v.alpha })), themed: p.themed };
    }
    if (typeof node.value !== 'string') throw new TokenError(`contrast: ${path} has no colour value`);
    return paintString(node.value, mode, theme, path, next);
  };

  const out: ContrastResult[] = [];
  const themeList: Array<[string | null, ClientTheme | null]> = [[null, null], ...Object.entries(themes)];
  for (const pair of pairs) {
    for (const against of Array.isArray(pair.bg) ? pair.bg : [pair.bg]) {
      for (const [name, theme] of themeList) {
        for (const mode of pair.modes ?? (['light', 'dark'] as const)) {
          const fg = paint(pair.fg, mode, theme);
          const bg = paint(against, mode, theme);
          const white: Rgb = { mode: 'rgb', r: 1, g: 1, b: 1 };
          const overPath = pair.over ?? (byPath.has(DEFAULT_OVER) ? DEFAULT_OVER : null);
          const base: Paint = overPath ? paint(overPath, mode, theme) : { stops: [white], themed: false };
          if (name && !fg.themed && !bg.themed && !base.themed) continue;
          let worst = Infinity;
          for (const u of base.stops) for (const b of bg.stops) for (const f of fg.stops) {
            const under = composite(b, composite(u, white));
            worst = Math.min(worst, wcagContrast(composite(f, under), under));
          }
          const ratio = Math.round(worst * 100) / 100;
          out.push({ token: pair.fg, mode: name ? `${name} ${mode}` : mode, against, ratio, min: pair.min, pass: ratio >= pair.min, ...(pair.why ? { why: pair.why } : null) });
        }
      }
    }
  }
  return out;
}
