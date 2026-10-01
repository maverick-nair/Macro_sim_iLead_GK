import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { build, cssVar, leaves, TokenError, type TokenSources } from './pipeline';
import { loadSources, mergeTrees } from './sources';

const root = path.resolve(import.meta.dirname, '../..');
const real = (): TokenSources => loadSources(root);

const tiny = (over: Partial<TokenSources> = {}): TokenSources => ({
  primitive: { color: { ink: { '200': { $value: 'oklch(0.2 0.03 280)' } }, white: { $value: 'oklch(1 0 0)' } } },
  semantic: { color: { fg: { light: '{color.ink.200}', dark: '{color.white}' }, bg: { light: '{color.white}', dark: '{color.ink.200}' } } },
  component: {},
  legacy: { root: {}, theme: {} },
  ...over
});

describe('token pipeline', () => {
  it('names CSS variables from token paths', () => {
    expect(cssVar('color.fg.primary')).toBe('--il-color-fg-primary');
  });

  it('finds leaves at any depth and skips $ metadata', () => {
    expect(leaves({ $description: 'x', a: { b: { $value: '1' } }, c: { light: 'x', dark: 'y' } }).map(l => l.path)).toEqual(['a.b', 'c']);
  });

  it('emits semantic colors as light-dark() over primitive variables', () => {
    const { tokensCss } = build(tiny());
    expect(tokensCss).toContain('--il-color-ink-200: oklch(0.2 0.03 280);');
    expect(tokensCss).toContain('--il-color-fg: light-dark(var(--il-color-ink-200), var(--il-color-white));');
  });

  it('turns { ref, alpha } into a literal translucent oklch()', () => {
    const src = tiny({ semantic: { color: { line: { light: '{color.ink.200}', dark: { ref: 'color.white', alpha: 0.1 } } } } });
    expect(build(src).tokensCss).toContain('light-dark(var(--il-color-ink-200), oklch(1 0 0 / 0.1))');
  });

  it('wraps brand overridable tokens in a var() fallback', () => {
    const src = tiny({ semantic: { color: { accent: { light: '{color.ink.200}', dark: '{color.white}', overridableBy: 'client-acc' } } } });
    expect(build(src).tokensCss).toContain('--il-color-accent: var(--client-acc, light-dark(');
  });

  it('rejects unknown references, missing dark values and references inside primitives', () => {
    expect(() => build(tiny({ semantic: { color: { x: { light: '{color.nope}', dark: '{color.white}' } } } }))).toThrow(TokenError);
    expect(() => build(tiny({ semantic: { color: { x: { light: '{color.white}' } } } }))).toThrow(/no dark value/);
    expect(() => build(tiny({ primitive: { a: { $value: '#fff' }, b: { $value: '{a}' } } }))).toThrow(/cannot reference/);
  });

  it('rejects alpha on a non oklch primitive', () => {
    const src = tiny({ primitive: { hex: { $value: '#fff' }, color: { white: { $value: 'oklch(1 0 0)' } } }, semantic: { color: { x: { light: { ref: 'hex', alpha: 0.5 }, dark: '{color.white}' } } } });
    expect(() => build(src)).toThrow(/opaque oklch/);
  });

  it('checks declared contrast pairs in both modes', () => {
    const src = tiny({ semantic: { color: {
      bg: { light: '{color.white}', dark: '{color.ink.200}' },
      fg: { light: '{color.ink.200}', dark: '{color.white}', contrast: { against: 'color.bg', min: 4.5 } },
      faint: { light: '{color.white}', dark: '{color.ink.200}', contrast: { against: 'color.bg', min: 4.5 } }
    } } });
    const res = build(src).contrast;
    expect(res.filter(r => r.token === 'color.fg').every(r => r.pass)).toBe(true);
    expect(res.filter(r => r.token === 'color.faint').every(r => !r.pass && r.ratio === 1)).toBe(true);
  });

  it('merges per component files and rejects a path defined twice', () => {
    const merged = mergeTrees([{ file: 'a.json', tree: { button: { h: { value: '1' } } } }, { file: 'b.json', tree: { button: { w: { value: '2' } } } }]);
    expect(Object.keys(merged.button as object)).toEqual(['h', 'w']);
    expect(() => mergeTrees([{ file: 'a.json', tree: { x: { value: '1' } } }, { file: 'b.json', tree: { x: { value: '2' } } }])).toThrow(/a.json and b.json/);
  });

  it('exposes only tokens to Tailwind', () => {
    const { tailwindCss } = build(real());
    expect(tailwindCss).toContain('--color-*: initial;');
    expect(tailwindCss).toContain('--color-fg-primary: var(--il-color-fg-primary);');
    expect(tailwindCss).toContain('--spacing: var(--il-space-unit);');
  });

  describe('real token files', () => {
    const out = build(real());

    it('meet every declared WCAG minimum', () => {
      expect(out.contrast.filter(c => !c.pass)).toEqual([]);
    });

    it('reproduce the values the design renders', () => {
      // From the prototype's iLeadApp root.
      expect(out.tokensCss).toContain('--il-color-ink-200: oklch(0.2 0.03 280);');
      expect(out.tokensCss).toContain('--il-color-surface-card: light-dark(var(--il-color-white), oklch(0.17 0.035 283 / 0.82));');
      expect(out.tokensCss).toContain('--il-color-accent-default: var(--client-acc, light-dark(var(--il-color-blue-530), var(--il-color-brand-electric-blue)));');
    });

    it('match the committed generated files', () => {
      expect(fs.readFileSync(path.join(root, 'src/styles/tokens.generated.css'), 'utf8')).toBe(out.tokensCss);
      expect(fs.readFileSync(path.join(root, 'src/styles/tailwind-theme.generated.css'), 'utf8')).toBe(out.tailwindCss);
    });
  });
});
