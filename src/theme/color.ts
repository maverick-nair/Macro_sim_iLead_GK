/**
 * Colour maths shared by the token build (scripts/tokens) and the runtime theme loader (src/theme).
 *
 * One implementation, so a theme corrected in the browser meets exactly the bar the build checks:
 * CSS colour parsing (oklch, hex, rgb, a few keywords), OKLCH and sRGB conversion (Björn Ottosson's
 * matrices, as culori and the CSS Color 4 spec use them), sRGB gamut mapping by chroma reduction,
 * alpha compositing in sRGB (what the browser does) and the WCAG 2.2 contrast ratio.
 * No dependencies, no DOM: it runs in Node, Vitest and the browser.
 */

/** Gamma encoded sRGB, channels 0 to 1, alpha 0 to 1. */
export interface Rgb { r: number; g: number; b: number; alpha: number }
/** OKLCH: lightness 0 to 1, chroma 0 to about 0.4, hue in degrees, alpha 0 to 1. */
export interface Oklch { l: number; c: number; h: number; alpha: number }

const KEYWORDS: Record<string, Rgb> = {
  white: { r: 1, g: 1, b: 1, alpha: 1 },
  black: { r: 0, g: 0, b: 0, alpha: 1 },
  transparent: { r: 0, g: 0, b: 0, alpha: 0 }
};

const NUM = String.raw`[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?`;
const OKLCH_RE = new RegExp(String.raw`^oklch\(\s*(${NUM})(%?)\s+(${NUM})(%?)\s+(${NUM})(deg)?\s*(?:\/\s*(${NUM})(%?)\s*)?\)$`, 'i');
const RGB_RE = new RegExp(String.raw`^rgba?\(\s*(${NUM})(%?)\s*[,\s]\s*(${NUM})(%?)\s*[,\s]\s*(${NUM})(%?)\s*(?:[,/]\s*(${NUM})(%?)\s*)?\)$`, 'i');

const alphaOf = (v: string | undefined, pct: string | undefined) => (v === undefined ? 1 : Math.min(1, Math.max(0, pct ? Number(v) / 100 : Number(v))));

/** Parses one CSS colour. Returns null for anything it does not read (gradients, var(), named colours other than white, black and transparent). */
export function parseColor(input: string): Rgb | Oklch | null {
  const s = input.trim().toLowerCase();
  if (s in KEYWORDS) return { ...KEYWORDS[s] };
  const hex = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/.exec(s);
  if (hex) {
    let h = hex[1];
    if (h.length <= 4) h = [...h].map(ch => ch + ch).join('');
    const n = (i: number) => parseInt(h.slice(i, i + 2), 16) / 255;
    return { r: n(0), g: n(2), b: n(4), alpha: h.length === 8 ? n(6) : 1 };
  }
  const ok = OKLCH_RE.exec(s);
  if (ok) {
    const l = ok[2] ? Number(ok[1]) / 100 : Number(ok[1]);
    const c = ok[4] ? (Number(ok[3]) / 100) * 0.4 : Number(ok[3]);
    if (!(l >= 0 && l <= 1) || !(c >= 0)) return null;
    return { l, c, h: ((Number(ok[5]) % 360) + 360) % 360, alpha: alphaOf(ok[7], ok[8]) };
  }
  const rgb = RGB_RE.exec(s);
  if (rgb) {
    const ch = (v: string, pct: string) => Math.min(1, Math.max(0, pct ? Number(v) / 100 : Number(v) / 255));
    return { r: ch(rgb[1], rgb[2]), g: ch(rgb[3], rgb[4]), b: ch(rgb[5], rgb[6]), alpha: alphaOf(rgb[7], rgb[8]) };
  }
  return null;
}

export const isOklch = (c: Rgb | Oklch): c is Oklch => 'l' in c;

const toLinear = (c: number) => {
  const a = Math.abs(c);
  return a <= 0.04045 ? c / 12.92 : (Math.sign(c) || 1) * Math.pow((a + 0.055) / 1.055, 2.4);
};
const toGamma = (c: number) => {
  const a = Math.abs(c);
  return a > 0.0031308 ? (Math.sign(c) || 1) * (1.055 * Math.pow(a, 1 / 2.4) - 0.055) : c * 12.92;
};

/** OKLCH to sRGB, not clipped: channels outside 0 to 1 mean the colour is out of the sRGB gamut. */
export function oklchToRgbRaw({ l, c, h, alpha }: Oklch): Rgb {
  const hr = (h * Math.PI) / 180;
  const a = c * Math.cos(hr), b = c * Math.sin(hr);
  const L = Math.pow(l + 0.3963377773761749 * a + 0.2158037573099136 * b, 3);
  const M = Math.pow(l - 0.1055613458156586 * a - 0.0638541728258133 * b, 3);
  const S = Math.pow(l - 0.0894841775298119 * a - 1.2914855480194092 * b, 3);
  return {
    r: toGamma(4.0767416360759574 * L - 3.3077115392580616 * M + 0.2309699031821044 * S),
    g: toGamma(-1.2684379732850317 * L + 2.6097573492876887 * M - 0.3413193760026573 * S),
    b: toGamma(-0.0041960761386756 * L - 0.7034186179359362 * M + 1.7076146940746117 * S),
    alpha
  };
}

export function rgbToOklch({ r, g, b, alpha }: Rgb): Oklch {
  const lr = toLinear(r), lg = toLinear(g), lb = toLinear(b);
  const L = Math.cbrt(0.412221469470763 * lr + 0.5363325372617348 * lg + 0.0514459932675022 * lb);
  const M = Math.cbrt(0.2119034958178252 * lr + 0.6806995506452344 * lg + 0.1073969535369406 * lb);
  const S = Math.cbrt(0.0883024591900564 * lr + 0.2817188391361215 * lg + 0.6299787016738222 * lb);
  const l = 0.210454268309314 * L + 0.7936177747023054 * M - 0.0040720430116193 * S;
  const a = 1.9779985324311684 * L - 2.4285922420485799 * M + 0.450593709617411 * S;
  const bb = 0.0259040424655478 * L + 0.7827717124575296 * M - 0.8086757549230774 * S;
  const c = Math.sqrt(a * a + bb * bb);
  const h = c < 1e-6 ? 0 : (((Math.atan2(bb, a) * 180) / Math.PI) + 360) % 360;
  return { l, c, h, alpha };
}

const EPS = 1e-4;
export const inGamut = (c: Rgb) => [c.r, c.g, c.b].every(v => v >= -EPS && v <= 1 + EPS);
const clip = (c: Rgb): Rgb => ({ r: Math.min(1, Math.max(0, c.r)), g: Math.min(1, Math.max(0, c.g)), b: Math.min(1, Math.max(0, c.b)), alpha: c.alpha });

/**
 * Brings an OKLCH colour into sRGB by lowering its chroma only (lightness and hue stay), the way
 * CSS Color 4 gamut maps. Returns the colour unchanged when it is already in gamut.
 */
export function toGamut(c: Oklch): Oklch {
  if (inGamut(oklchToRgbRaw(c))) return c;
  let lo = 0, hi = c.c;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (inGamut(oklchToRgbRaw({ ...c, c: mid }))) lo = mid; else hi = mid;
  }
  return { ...c, c: lo };
}

/**
 * Any parsed colour as displayable sRGB: OKLCH is gamut mapped by chroma (CSS Color 4), then rounding
 * error is clipped. Mapping, not per channel clipping, matches the ratios axe measured for the light
 * theme (D8); colours the loader writes are already in gamut, so for them the two agree.
 */
export function toRgb(c: Rgb | Oklch): Rgb {
  return clip(isOklch(c) ? oklchToRgbRaw(toGamut(c)) : c);
}

export function toOklch(c: Rgb | Oklch): Oklch {
  return isOklch(c) ? c : rgbToOklch(c);
}

/** Paints `top` over `under` in sRGB, as the browser blends. */
export function composite(top: Rgb, under: Rgb): Rgb {
  const a = top.alpha;
  if (a >= 1) return { r: top.r, g: top.g, b: top.b, alpha: 1 };
  const ua = under.alpha;
  const out = a + ua * (1 - a);
  if (out <= 0) return { r: 0, g: 0, b: 0, alpha: 0 };
  const mix = (t: number, u: number) => (t * a + u * ua * (1 - a)) / out;
  return { r: mix(top.r, under.r), g: mix(top.g, under.g), b: mix(top.b, under.b), alpha: out };
}

/** WCAG relative luminance of an opaque sRGB colour. */
export function luminance(c: Rgb): number {
  return 0.2126 * toLinear(c.r) + 0.7152 * toLinear(c.g) + 0.0722 * toLinear(c.b);
}

/** WCAG 2.2 contrast ratio, 1 to 21. */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = luminance(a), lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

const r4 = (n: number) => String(Math.round(n * 10000) / 10000);
/** CSS text for an OKLCH colour, rounded to 4 decimals. */
export function formatOklch(c: Oklch): string {
  return `oklch(${r4(c.l)} ${r4(c.c)} ${r4(c.h)}${c.alpha < 1 ? ` / ${r4(c.alpha)}` : ''})`;
}
