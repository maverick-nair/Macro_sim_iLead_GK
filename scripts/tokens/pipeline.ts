/**
 * Design token pipeline.
 *
 * tokens/*.json (primitive -> semantic -> component, plus migration aliases)
 * become CSS custom properties, a Tailwind v4 theme that only exposes tokens,
 * and a typed TypeScript manifest. Pure functions, so tests can drive them.
 */
import { wcagContrast } from 'culori';

export interface TokenSources {
  primitive: Record<string, unknown>;
  semantic: Record<string, unknown>;
  component: Record<string, unknown>;
  legacy: { root: Record<string, string>; theme: Record<string, string> };
}

export interface Leaf { path: string; node: Record<string, unknown> }
export interface ContrastResult { token: string; mode: 'light' | 'dark'; against: string; ratio: number; min: number; pass: boolean }
export interface BuildOutput { tokensCss: string; tailwindCss: string; manifestTs: string; contrast: ContrastResult[] }

const PREFIX = '--il-';
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

/** Literal color for contrast maths. Returns null for translucent values. */
function modeLiteral(v: ModeValue, reg: Registry, semantic: Map<string, Leaf>, mode: 'light' | 'dark', where: string): string | null {
  if (typeof v !== 'string') return null;
  const m = /^\{([a-z0-9.-]+)\}$/i.exec(v.trim());
  if (!m) return null;
  const ref = m[1];
  if (reg.primitives.has(ref)) return reg.primitives.get(ref)!;
  const s = semantic.get(ref);
  if (s) return modeLiteral(s.node[mode] as ModeValue, reg, semantic, mode, where);
  throw new TokenError(`${where}: cannot resolve {${ref}} to a color`);
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
  const semByPath = new Map(sem.map(l => [l.path, l]));

  const rootLines: string[] = [];
  for (const { path, node } of prim) rootLines.push(`  ${cssVar(path)}: ${node.$value};`);

  const themeLines: string[] = [];
  const contrast: ContrastResult[] = [];
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
    if (typeof node.overridableBy === 'string') css = `var(--${node.overridableBy}, ${css})`;
    themeLines.push(`  ${cssVar(path)}: ${css};`);

    const c = node.contrast as { against: string; min: number } | undefined;
    if (c) {
      const bg = semByPath.get(c.against);
      if (!bg) throw new TokenError(`${path}: contrast target ${c.against} is not a semantic token`);
      for (const mode of ['light', 'dark'] as const) {
        const fg = modeLiteral(node[mode] as ModeValue, reg, semByPath, mode, path);
        const b = modeLiteral(bg.node[mode] as ModeValue, reg, semByPath, mode, c.against);
        if (!fg || !b) throw new TokenError(`${path}: contrast pairs must be opaque references`);
        const ratio = Math.round(wcagContrast(fg, b) * 100) / 100;
        contrast.push({ token: path, mode, against: c.against, ratio, min: c.min, pass: ratio >= c.min });
      }
    }
  }
  for (const { path, node } of comp) {
    if (typeof node.value !== 'string') throw new TokenError(`${path}: component tokens need a string value`);
    themeLines.push(`  ${cssVar(path)}: ${interpolate(node.value, reg, path)};`);
  }

  const alias = (scope: Record<string, string>, where: string) =>
    Object.entries(scope).map(([name, v]) => `  --${name}: ${interpolate(v, reg, `legacy.${where}.${name}`)};`);

  const header = '/* GENERATED by scripts/tokens/build.ts from tokens/*.json. Do not edit. Run `npm run tokens`. */\n';
  const tokensCss = `${header}
/* Primitive layer, plus Genie design system names the ported screens still read. */
:root {
${rootLines.join('\n')}
${alias(src.legacy.root, 'root').join('\n')}
}

/* Semantic and component layers. Scoped to the app root so a client theme set on an ancestor
   (--client-acc and friends) is visible when var() fallbacks resolve, and so color-scheme
   on the root picks the light-dark() branch. */
.il-theme {
${themeLines.join('\n')}
  /* Migration aliases, removed as screens move to utilities. */
${alias(src.legacy.theme, 'theme').join('\n')}
}
`;

  // Tailwind exposes tokens only: every default color, size, radius and shadow is reset.
  const tw: string[] = ['  --color-*: initial;', '  --text-*: initial;', '  --radius-*: initial;', '  --shadow-*: initial;', '  --font-*: initial;', '  --ease-*: initial;'];
  for (const { path } of sem) if (path.startsWith('color.')) tw.push(`  --color-${path.slice(6).replace(/\./g, '-')}: var(${cssVar(path)});`);
  for (const { path } of sem) if (path.startsWith('fill.')) tw.push(`  --fill-${path.slice(5).replace(/\./g, '-')}: var(${cssVar(path)});`);
  for (const { path } of prim) {
    if (path.startsWith('color.brand.')) tw.push(`  --color-brand-${path.slice(12)}: var(${cssVar(path)});`);
    else if (path.startsWith('font.size.')) tw.push(`  --text-${path.slice(10)}: var(${cssVar(path)});`);
    else if (path.startsWith('font.family.')) tw.push(`  --font-${path.slice(12)}: var(${cssVar(path)});`);
    else if (path.startsWith('font.weight.')) tw.push(`  --font-weight-${path.slice(12)}: var(${cssVar(path)});`);
    else if (path.startsWith('radius.')) tw.push(`  --radius-${path.slice(7)}: var(${cssVar(path)});`);
    else if (path.startsWith('shadow.')) tw.push(`  --shadow-${path.slice(7)}: var(${cssVar(path)});`);
    else if (path.startsWith('easing.')) tw.push(`  --ease-${path.slice(7)}: var(${cssVar(path)});`);
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

  return { tokensCss, tailwindCss, manifestTs, contrast };
}
