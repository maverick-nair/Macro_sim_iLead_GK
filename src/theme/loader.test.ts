import { describe, expect, it, vi } from 'vitest';
import { createHttpApi, createMockApi } from '../api';
import { readLaunchTheme } from './bootstrap';
import { parseColor, toOklch } from './color';
import { auditTheme, correctContrast } from './correct';
import { loadTheme, resolveTheme, slotsOf } from './loader';
import brightwater from './samples/brightwater.json';
import halden from './samples/halden.json';
import { parseTheme } from './schema';
import { NODES, PAIRS } from './tokens.generated';

const TABLE = { pairs: PAIRS, nodes: NODES };
const quiet = () => vi.spyOn(console, 'warn').mockImplementation(() => undefined);

describe('theme loader', () => {
  it('applies Halden exactly as the build time theme did, with no corrections (the client baselines hold)', () => {
    const t = resolveTheme(halden)!;
    expect(t.corrections).toEqual([]);
    expect(t.issues).toEqual([]);
    expect(t.vars).toEqual({
      '--il-theme-color-accent-default': 'light-dark(oklch(0.5 0.17 0), oklch(0.72 0.17 0))',
      '--il-theme-color-accent-secondary': 'light-dark(oklch(0.54 0.15 30), oklch(0.8 0.12 30))',
      '--il-theme-color-accent-soft': 'light-dark(oklch(0.95 0.025 0), oklch(0.6 0.18 0 / 0.18))',
      '--il-theme-fill-brand': 'linear-gradient(135deg, oklch(0.66 0.19 2), oklch(0.78 0.13 30))'
    });
    expect(t.brand).toEqual({ name: 'Halden Group', logo: { kind: 'placeholder', name: 'Halden Group' } });
    expect(t.mode).toBeNull();
  });

  it('writes radius, font and brand from the config', () => {
    const warn = quiet();
    const t = resolveTheme(brightwater)!;
    expect(t.vars['--il-radius-6']).toBe('3px');
    expect(t.vars['--il-radius-pill']).toBeUndefined();
    expect(t.vars['--il-font-family-sans']).toBe('system-ui, sans-serif');
    expect(t.fontHref).toBeNull();
    expect(t.brand).toEqual({ name: 'Brightwater Energy', logo: { kind: 'text', text: 'Brightwater' } });
    expect(resolveTheme({ version: 1, font: 'Inter' })!.fontHref).toMatch(/^https:\/\/fonts\.googleapis\.com\/css2\?family=Inter/);
    expect(resolveTheme({ version: 1, name: 'Acme', logo: { src: '/acme.svg' } })!.brand).toEqual({ name: 'Acme', logo: { kind: 'image', src: '/acme.svg', alt: null } });
    warn.mockRestore();
  });

  it('falls back per field: a bad colour keeps the default, the rest applies', () => {
    const warn = quiet();
    const t = resolveTheme({ version: 1, name: 'Acme', colors: { accent: 'chartreuse-ish', accentSecondary: { light: 'oklch(0.5 0.15 150)', dark: 'oklch(0.8 0.15 150)' } } })!;
    expect(t.vars['--il-theme-color-accent-default']).toBeUndefined();
    expect(t.vars['--il-theme-color-accent-secondary']).toBe('light-dark(oklch(0.5 0.15 150), oklch(0.8 0.15 150))');
    expect(t.issues).toEqual([expect.stringMatching(/^colors\.accent: /)]);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('falls back to the default theme when nothing is usable, and never throws', () => {
    const warn = quiet();
    expect(resolveTheme({ version: 3 })).toBeNull();
    expect(resolveTheme('<svg/>')).toBeNull();
    const junk = [undefined, true, { version: 1, colors: 7 }, { version: 1, colors: { brand: { from: '#fff', to: [] } } }, { version: 1, radiusScale: 'big' }, { version: 1, logo: { src: 9 } }];
    for (const raw of junk) expect(() => resolveTheme(raw)).not.toThrow();
    warn.mockRestore();
  });

  it('reports corrections in a dev console warning', () => {
    const warn = quiet();
    resolveTheme(brightwater);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toMatch(/^iLead theme "brightwater": \d+ contrast correction\(s\), 0 issue\(s\)\n {2}color\.accent\.default \(light\): #FFD23F -> oklch\(/);
    warn.mockRestore();
  });

  it('loads the launch payload theme first, then the API, and treats any failure as the default', async () => {
    const warn = quiet();
    const fetch = vi.fn(async () => halden);
    expect((await loadTheme({ inline: { version: 1, name: 'Inline' }, fetch }))?.brand?.name).toBe('Inline');
    expect(fetch).not.toHaveBeenCalled();
    expect((await loadTheme({ fetch }))?.id).toBe('halden');
    expect(await loadTheme({ fetch: async () => null })).toBeNull();
    expect(await loadTheme({ fetch: async () => { throw new Error('offline'); } })).toBeNull();
    expect(await loadTheme({ inline: null, fetch })).toBeNull();
    warn.mockRestore();
  });

  it('reads the inline theme from the launch payload script, ignoring broken JSON', () => {
    const doc = (text: string | null) => ({ getElementById: (id: string) => (id === 'il-launch' && text !== null ? { textContent: text } : null) }) as unknown as Document;
    expect(readLaunchTheme(doc('{"participant":"p1","theme":{"version":1,"name":"Acme"}}'))).toEqual({ version: 1, name: 'Acme' });
    expect(readLaunchTheme(doc('{"participant":"p1"}'))).toBeUndefined();
    expect(readLaunchTheme(doc('{not json'))).toBeUndefined();
    expect(readLaunchTheme(doc(null))).toBeUndefined();
  });

  it('is served by the mock API for ?client=halden, and by GET /theme over HTTP (404 is no theme)', async () => {
    expect(await createMockApi({ latencyMs: 0 }).getTheme()).toBeNull();
    expect(await createMockApi({ latencyMs: 0, client: 'halden' }).getTheme()).toMatchObject({ id: 'halden', version: 1 });
    const calls: string[] = [];
    const stub = vi.spyOn(globalThis, 'fetch').mockImplementation(async input => {
      calls.push(String(input));
      return new Response(null, { status: 404 });
    });
    expect(await createHttpApi('https://api.example/v1/').getTheme()).toBeNull();
    expect(calls).toEqual(['https://api.example/v1/theme']);
    stub.mockRestore();
  });
});

describe('contrast correction', () => {
  const slotsFor = (raw: unknown) => slotsOf(parseTheme(raw).theme!).slots;

  it('makes a deliberately bad palette pass every pair the token build checks, in light and dark', () => {
    const slots = slotsFor(brightwater);
    const before = auditTheme(TABLE, slots).filter(r => !r.pass);
    expect(before.length).toBeGreaterThan(5);
    const { corrections, dropped } = correctContrast(TABLE, slots);
    expect(dropped).toEqual([]);
    expect(corrections.length).toBeGreaterThanOrEqual(4);
    expect(auditTheme(TABLE, slots).filter(r => !r.pass)).toEqual([]);
  });

  it('changes lightness only: hue stays, chroma stays unless the gamut needs less', () => {
    const slots = slotsFor(brightwater);
    const { corrections } = correctContrast(TABLE, slots);
    for (const c of corrections) {
      const from = toOklch(parseColor(c.from)!), to = toOklch(parseColor(c.to)!);
      expect(to.alpha).toBeCloseTo(from.alpha, 6);
      if (from.c > 0.02 && to.c > 0.02) expect(Math.abs(to.h - from.h), `${c.token} ${c.mode}`).toBeLessThan(0.01);
      expect(to.c).toBeLessThanOrEqual(from.c + 1e-4);
    }
    // The yellow accent in light mode keeps its hue and goes darker, the least change that passes.
    const accent = corrections.find(c => c.token === 'color.accent.default' && c.mode === 'light')!;
    expect(toOklch(parseColor(accent.to)!).l).toBeLessThan(toOklch(parseColor(accent.from)!).l);
    expect(accent.because).toMatch(/needs (3|4\.5):1$/);
  });

  it('leaves passing colours untouched, so the written CSS is the author’s own', () => {
    const slots = slotsFor(halden);
    expect(correctContrast(TABLE, slots)).toEqual({ corrections: [], dropped: [] });
    expect([...slots.values()].flatMap(m => [...m.light, ...m.dark]).every(s => !s.corrected)).toBe(true);
  });

  it('moves a themed surface when the text on it is not themed', () => {
    const slots = slotsFor({ version: 1, colors: { surface: { solid: { light: 'oklch(0.7 0.05 250)', dark: 'oklch(0.55 0.05 250)' } } } });
    const { corrections } = correctContrast(TABLE, slots);
    const light = corrections.find(c => c.token === 'color.surface.solid' && c.mode === 'light');
    const dark = corrections.find(c => c.token === 'color.surface.solid' && c.mode === 'dark');
    expect(toOklch(parseColor(light!.to)!).l).toBeGreaterThan(0.7);
    expect(toOklch(parseColor(dark!.to)!).l).toBeLessThan(0.55);
    expect(auditTheme(TABLE, slots).filter(r => !r.pass)).toEqual([]);
  });

  it('corrects each stop of the brand gradient on its own', () => {
    const slots = slotsFor({ version: 1, colors: { brand: { from: '#ffffff', to: '#101010' } } });
    correctContrast(TABLE, slots);
    expect(auditTheme(TABLE, slots).filter(r => !r.pass)).toEqual([]);
    const t = resolveTheme({ version: 1, colors: { brand: { from: '#ffffff', to: '#101010', angle: 90 } } });
    expect(t?.vars['--il-theme-fill-brand']).toMatch(/^linear-gradient\(90deg, /);
  });
});
