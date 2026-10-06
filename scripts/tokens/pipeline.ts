/**
 * Design token pipeline.
 *
 * tokens/*.json (primitive -> semantic -> component)
 * become CSS custom properties, a Tailwind v4 theme that only exposes tokens,
 * and a typed TypeScript manifest. Pure functions, so tests can drive them.
 */
import { contrastChecks, type ContrastPair, type ContrastResult } from './contrast';
import { DEFAULT_OVER, themeVar, type TokenNode } from '../../src/theme/paint';

export type { ContrastPair, ContrastResult };

export interface TokenSources {
  primitive: Record<string, unknown>;
  semantic: Record<string, unknown>;
  component: Record<string, unknown>;
  /** Extra contrast pairs (tokens/contrast.json), on top of the `contrast` declared on semantic tokens. */
  contrast?: ContrastPair[];
}

export interface Leaf { path: string; node: Record<string, unknown> }
export interface BuildOutput { tokensCss: string; tailwindCss: string; manifestTs: string; themeTs: string; contrast: ContrastResult[] }

const PREFIX = '--il-';
/** Set on the app root from the text size setting (1, 1.25, 1.5, 2). */
export const TEXT_SCALE = '--il-text-scale';
const REF = /\{([a-z0-9.-]+)\}/gi;

export class TokenError extends Error {}

export const cssVar = (path: string) => PREFIX + path.replace(/\./g, '-');

/** Walks a token tree. A leaf is any object with `$value`, `value`, `light` or `ref`. */
export function leaves(tree: Record<string, unknown>, base = ''): Leaf[] {
  const out: Leaf[] = [];
  for (const [k, v] of Object.entries(tree)) {
    if (k.startsWith('$') || v === null || typeof v !== 'object') continue;
    const path = base ? `${base}.${k}` : k;
    const node = v as Record<string, unknown>;
    if ('$value' in node || 'value' in node || 'light' in node) out.push({ path, node });
    else out.push(...leaves(node, path));
  }
  return out;
}

interface Registry {
  /** Literal value of each primitive, by path. */
  primitives: Map<string, string>;
  /** Every path that may be referenced (primitive, semantic or component). */
  known: Set<string>;
}

/** Replaces `{a.b}` references with `var(--il-a-b)`. Unknown references throw. */
export function interpolate(value: string, reg: Registry, where: string): string {
  return value.replace(REF, (_, ref: string) => {
    if (!reg.known.has(ref)) throw new TokenError(`${where}: unknown reference {${ref}}`);
    return `var(${cssVar(ref)})`;
  });
}

/** Resolves a reference to its literal primitive value, following semantic aliases for contrast checks. */
function literalOf(ref: string, reg: Registry, where: string): string {
  const v = reg.primitives.get(ref);
  if (v === undefined) throw new TokenError(`${where}: {${ref}} is not a primitive`);
  return v;
}

/** `{ ref, alpha }` on an OKLCH primitive becomes a literal `oklch(l c h / alpha)`. */
function withAlpha(ref: string, alpha: number, reg: Registry, where: string): string {
  const lit = literalOf(ref, reg, where);
  const m = /^oklch\(([^)/]+)\)$/.exec(lit.trim());
  if (!m) throw new TokenError(`${where}: alpha needs an opaque oklch() primitive, {${ref}} is ${lit}`);
  if (!(alpha > 0 && alpha <= 1)) throw new TokenError(`${where}: alpha ${alpha} must be in (0, 1]`);
  return `oklch(${m[1].trim()} / ${alpha})`;
}

type ModeValue = string | { ref: string; alpha: number };

function modeCss(v: ModeValue, reg: Registry, where: string): string {
  if (typeof v === 'string') return interpolate(v, reg, where);
  return withAlpha(v.ref, v.alpha, reg, where);
}

export function build(src: TokenSources): BuildOutput {
  const prim = leaves(src.primitive);
  const sem = leaves(src.semantic);
  const comp = leaves(src.component);
  const reg: Registry = { primitives: new Map(), known: new Set() };

  for (const { path, node } of prim) {
    if (typeof node.$value !== 'string') throw new TokenError(`${path}: primitives need a string $value`);
    if (REF.test(node.$value)) throw new TokenError(`${path}: primitives cannot reference other tokens`);
    REF.lastIndex = 0;
    reg.primitives.set(path, node.$value);
    reg.known.add(path);
  }
  for (const l of [...sem, ...comp]) {
    if (reg.known.has(l.path)) throw new TokenError(`${l.path}: defined twice`);
    reg.known.add(l.path);
  }

  const rootLines: string[] = [];
  for (const { path, node } of prim) rootLines.push(`  ${cssVar(path)}: ${node.$value};`);

  const themeLines: string[] = [];
  const pairs: ContrastPair[] = [];
  // Text size setting: font sizes are redeclared inside the app root, scaled by --il-text-scale
  // (1 by default, 2 at 200%). Declared here, not on :root, so the root's value is the one that
  // resolves; every utility and component token that reads a font size grows, layout does not.
  for (const { path, node } of prim) if (path.startsWith('font.size.')) themeLines.push(`  ${cssVar(path)}: calc(${node.$value as string} * var(${TEXT_SCALE}, 1));`);
  for (const { path, node } of sem) {
    let css: string;
    if ('light' in node) {
      if (!('dark' in node)) throw new TokenError(`${path}: has light but no dark value`);
      const light = modeCss(node.light as ModeValue, reg, path + '.light');
      const dark = modeCss(node.dark as ModeValue, reg, path + '.dark');
      css = `light-dark(${light}, ${dark})`;
    } else {
      if (typeof node.value !== 'string') throw new TokenError(`${path}: needs light and dark, or value`);
      css = interpolate(node.value, reg, path);
    }
    if ('overridableBy' in node) throw new TokenError(`${path}: overridableBy is gone, mark the token "themable": true (D72)`);
    // A GenieKreator theme may set this token at runtime (src/theme): it writes --il-theme-<path> on
    // :root (or on an ancestor of the app root), which this declaration reads first.
    if (node.themable === true) css = `var(${themeVar(path)}, ${css})`;
    themeLines.push(`  ${cssVar(path)}: ${css};`);

    // `contrast` on a semantic token: one pair or a list, against other tokens.
    type Declared = Omit<ContrastPair, 'fg' | 'bg'> & { against: string | string[] };
    const declared = node.contrast as Declared | Declared[] | undefined;
    for (const c of declared ? (Array.isArray(declared) ? declared : [declared]) : []) {
      const { against, ...rest } = c;
      for (const bg of Array.isArray(against) ? against : [against]) {
        if (!reg.known.has(bg)) throw new TokenError(`${path}: contrast target ${bg} is not a token`);
      }
      pairs.push({ ...rest, fg: path, bg: against });
    }
  }
  for (const { path, node } of comp) {
    if (typeof node.value !== 'string') throw new TokenError(`${path}: component tokens need a string value`);
    themeLines.push(`  ${cssVar(path)}: ${interpolate(node.value, reg, path)};`);
  }

  for (const [i, pr] of (src.contrast ?? []).entries()) {
    for (const t of [pr.fg, ...(Array.isArray(pr.bg) ? pr.bg : [pr.bg]), ...(pr.over ? [pr.over] : [])]) {
      if (!reg.known.has(t)) throw new TokenError(`contrast pair ${i + 1} (${pr.fg}): unknown token ${t}`);
    }
    pairs.push(pr);
  }
  const contrast = contrastChecks(pairs, { prim, sem, comp });

  const header = '/* GENERATED by scripts/tokens/build.ts from tokens/*.json. Do not edit. Run `npm run tokens`. */\n';
  const tokensCss = `${header}
/* Primitive layer. */
:root {
${rootLines.join('\n')}
}

/* Semantic and component layers. Scoped to the app root so a client theme set on :root or another
   ancestor (--il-theme-*, written by src/theme) is visible when var() fallbacks resolve, and so
   color-scheme on the root picks the light-dark() branch. */
.il-theme {
${themeLines.join('\n')}
}
`;

  // Tailwind exposes tokens only: every default color, size, radius and shadow is reset.
  const tw: string[] = ['  --color-*: initial;', '  --text-*: initial;', '  --radius-*: initial;', '  --shadow-*: initial;', '  --font-*: initial;', '  --ease-*: initial;', '  --blur-*: initial;'];
  for (const { path } of sem) if (path.startsWith('color.')) tw.push(`  --color-${path.slice(6).replace(/\./g, '-')}: var(${cssVar(path)});`);
  for (const { path } of sem) if (path.startsWith('fill.')) tw.push(`  --background-image-${path.slice(5).replace(/\./g, '-')}: var(${cssVar(path)});`);
  for (const { path } of prim) {
    if (path.startsWith('color.brand.')) tw.push(`  --color-brand-${path.slice(12)}: var(${cssVar(path)});`);
    else if (path.startsWith('font.size.')) tw.push(`  --text-${path.slice(10)}: var(${cssVar(path)});`);
    else if (path.startsWith('font.family.')) tw.push(`  --font-${path.slice(12)}: var(${cssVar(path)});`);
    else if (path.startsWith('font.weight.')) tw.push(`  --font-weight-${path.slice(12)}: var(${cssVar(path)});`);
    else if (path.startsWith('radius.')) tw.push(`  --radius-${path.slice(7)}: var(${cssVar(path)});`);
    else if (path.startsWith('shadow.')) tw.push(`  --shadow-${path.slice(7)}: var(${cssVar(path)});`);
    else if (path.startsWith('easing.')) tw.push(`  --ease-${path.slice(7)}: var(${cssVar(path)});`);
    else if (path.startsWith('blur.')) tw.push(`  --blur-${path.slice(5)}: var(${cssVar(path)});`);
    else if (path === 'space.unit') tw.push(`  --spacing: var(${cssVar(path)});`);
  }
  const tailwindCss = `${header}@theme inline {\n${tw.join('\n')}\n}\n`;

  const manifest = {
    primitive: Object.fromEntries(prim.map(l => [l.path, l.node.$value as string])),
    semantic: sem.map(l => l.path),
    component: comp.map(l => l.path)
  };
  const manifestTs = `// GENERATED by scripts/tokens/build.ts. Do not edit.
export const tokens = ${JSON.stringify(manifest, null, 2)} as const;

export type PrimitiveToken = keyof typeof tokens.primitive;
export type SemanticToken = (typeof tokens.semantic)[number];
export type ComponentToken = (typeof tokens.component)[number];
export type Token = PrimitiveToken | SemanticToken | ComponentToken;

/** CSS variable for a token, for the rare inline style that cannot use a utility. */
export const tokenVar = (t: Token) => \`var(--il-\${t.replace(/\\./g, '-')})\`;
`;

  const themeTs = runtimeTable(pairs, { prim, sem, comp });

  return { tokensCss, tailwindCss, manifestTs, themeTs, contrast };
}

/**
 * The table the runtime theme loader corrects against (src/theme/tokens.generated.ts): every contrast
 * pair, the tokens they reach (so the loader resolves them with the same painter as this build), the
 * themable tokens, and the radius scale. Only the loader's lazy chunk imports it.
 */
function runtimeTable(pairs: ContrastPair[], layers: { prim: Leaf[]; sem: Leaf[]; comp: Leaf[] }): string {
  const byPath = new Map<string, Record<string, unknown>>();
  for (const l of [...layers.prim, ...layers.sem, ...layers.comp]) byPath.set(l.path, l.node);
  const themable = layers.sem.filter(l => l.node.themable === true).map(l => l.path);
  const keep = new Map<string, TokenNode>();
  const visit = (path: string) => {
    if (keep.has(path)) return;
    const node = byPath.get(path);
    if (!node) throw new TokenError(`theme table: unknown token ${path}`);
    const slim: TokenNode = {};
    const refs: string[] = [];
    const take = (v: unknown) => {
      if (typeof v === 'string') for (const m of v.matchAll(REF)) refs.push(m[1]);
      else if (v && typeof v === 'object' && typeof (v as { ref?: unknown }).ref === 'string') refs.push((v as { ref: string }).ref);
    };
    for (const k of ['$value', 'value', 'light', 'dark'] as const) if (node[k] !== undefined) { (slim as Record<string, unknown>)[k] = node[k]; take(node[k]); }
    if (node.themable === true) slim.themable = true;
    keep.set(path, slim);
    refs.forEach(visit);
  };
  for (const p of pairs) [p.fg, ...(Array.isArray(p.bg) ? p.bg : [p.bg]), ...(p.over ? [p.over] : [])].forEach(visit);
  themable.forEach(visit);
  if (byPath.has(DEFAULT_OVER)) visit(DEFAULT_OVER);
  // Pills stay pills: only the numbered steps scale.
  const radii = Object.fromEntries(layers.prim.filter(l => /^radius\.\d+$/.test(l.path) && /^\d+(\.\d+)?px$/.test(String(l.node.$value)))
    .map(l => [cssVar(l.path), parseFloat(String(l.node.$value))]));
  const nodes = Object.fromEntries([...keep.entries()].sort(([a], [b]) => a.localeCompare(b)));
  return `// GENERATED by scripts/tokens/build.ts from tokens/*.json. Do not edit. Run \`npm run tokens\`.
// Read by the theme loader (src/theme/loader.ts) only, so it stays out of the first load.
import type { ContrastPair, TokenNode } from './paint';

/** Semantic tokens a GenieKreator theme may set (\`"themable": true\` in tokens/semantic). */
export const THEMABLE = ${JSON.stringify(themable)} as const;

/** Every WCAG pair the token build checks: the ones declared on semantic tokens and tokens/contrast.json. */
export const PAIRS: ContrastPair[] = ${JSON.stringify(pairs, null, 1)};

/** The tokens those pairs reach, as the build reads them. */
export const NODES: Record<string, TokenNode> = ${JSON.stringify(nodes, null, 1)};

/** Radius primitives in px, scaled by a theme's radiusScale. */
export const RADII: Record<string, number> = ${JSON.stringify(radii, null, 1)};
`;
}
