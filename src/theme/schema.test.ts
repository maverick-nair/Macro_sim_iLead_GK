import { describe, expect, it } from 'vitest';
import brightwater from './samples/brightwater.json';
import halden from './samples/halden.json';
import { parseTheme, ThemeConfigSchema } from './schema';

describe('theme config schema', () => {
  it('accepts both sample themes as they are', () => {
    for (const sample of [halden, brightwater]) {
      const { theme, issues } = parseTheme(sample);
      expect(issues).toEqual([]);
      expect(ThemeConfigSchema.safeParse(theme).success).toBe(true);
    }
    expect(parseTheme(halden).theme?.colors?.accent).toEqual({ light: 'oklch(0.5 0.17 0)', dark: 'oklch(0.72 0.17 0)' });
  });

  it('needs nothing but the version: an empty theme is the default theme', () => {
    expect(parseTheme({ version: 1 })).toEqual({ theme: { version: 1 }, issues: [] });
  });

  it('rejects the whole theme only when it is not an object or not version 1', () => {
    for (const raw of [null, 'halden', 42, [], { name: 'No version' }, { version: 2, name: 'Future' }]) {
      const { theme, issues } = parseTheme(raw);
      expect(theme, JSON.stringify(raw)).toBeNull();
      expect(issues[0]).toMatch(/default theme applies/);
    }
  });

  it('drops an invalid field on its own and keeps the rest', () => {
    const { theme, issues } = parseTheme({
      version: 1, name: 'Acme',
      colors: { accent: 'not a colour', accentSecondary: '#0a5', accentSoft: { light: '#eef', dark: 'var(--x)' }, brand: { from: '#123456' }, surface: { raised: '#f4f4f4', glass: '#fff' } },
      font: 'Comic Sans MS', radiusScale: 5, mode: 'sepia',
      logo: { src: 'javascript:alert(1)', text: 'Acme' },
      sparkle: true
    });
    expect(theme).toEqual({ version: 1, name: 'Acme', colors: { accentSecondary: '#0a5', surface: { raised: '#f4f4f4' } }, logo: { text: 'Acme' } });
    expect(issues).toEqual(expect.arrayContaining([
      expect.stringMatching(/^colors\.accent: not a colour/),
      expect.stringMatching(/^colors\.accentSoft: /),
      expect.stringMatching(/^colors\.brand: /),
      'colors.surface.glass: unknown field, ignored',
      expect.stringMatching(/^font: /),
      expect.stringMatching(/^radiusScale: /),
      expect.stringMatching(/^mode: /),
      expect.stringMatching(/^logo\.src: logo src must be/),
      'sparkle: unknown field, ignored'
    ]));
    expect(issues).toHaveLength(9);
  });

  it('allows https, site paths and inline images as logos, nothing else', () => {
    const ok = (src: string) => parseTheme({ version: 1, logo: { src } }).theme?.logo?.src === src;
    expect(ok('https://cdn.example.com/acme.svg')).toBe(true);
    expect(ok('/brand/acme.png')).toBe(true);
    expect(ok('data:image/png;base64,iVBORw0KGgo=')).toBe(true);
    for (const src of ['http://example.com/a.png', '//evil.example/a.png', 'data:text/html;base64,PGI+', 'https://x.example/a.png" onerror="x']) expect(ok(src), src).toBe(false);
  });

  it('holds theme text to the copy rules: no dashes as punctuation, no emoji', () => {
    expect(parseTheme({ version: 1, name: 'Acme — Global' }).theme?.name).toBeUndefined();
    expect(parseTheme({ version: 1, name: 'Acme - Global' }).theme?.name).toBeUndefined();
    expect(parseTheme({ version: 1, logo: { text: 'Acme \u{1F680}' } }).theme?.logo).toBeUndefined();
    expect(parseTheme({ version: 1, name: 'Coca-Cola Europacific' }).theme?.name).toBe('Coca-Cola Europacific');
  });

  it('takes fonts from the allowlist only', () => {
    expect(parseTheme({ version: 1, font: 'Inter' }).theme?.font).toBe('Inter');
    expect(parseTheme({ version: 1, font: 'Papyrus' }).theme?.font).toBeUndefined();
  });
});
