import { describe, expect, it } from 'vitest';
import { BRAND_FONTS } from '../engine/config';
import { FONTS } from './schema';
import { backdropVars, combineThemes, resolveStorylineTheme, themeConfigOf } from './storyline';
import type { AppliedTheme } from './types';

const PIXEL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const BRAND = { name: 'Halden Group', colors: { main: '#D6336C', second: '#F08C00' }, logo: PIXEL, font: 'Inter', mode: 'light' as const };
const SERVER: AppliedTheme = { id: 'halden', brand: { name: 'Server Co', logo: { kind: 'text', text: 'SC' } }, mode: 'dark', vars: { '--il-theme-color-accent-default': 'red' }, fontHref: null, corrections: [], issues: [] };

describe('the storyline\'s look in the player (D181, D182)', () => {
  it('names the theme loader\'s fonts, no more and no fewer', () => {
    expect([...BRAND_FONTS]).toEqual(Object.keys(FONTS));
  });

  it('turns the brand into a contrast corrected theme with its logo, font and mode', () => {
    const { theme, backdrop } = resolveStorylineTheme({ organisation: 'Halden', brand: BRAND, logo: null, office: null });
    expect(backdrop).toEqual({});
    expect(theme!.mode).toBe('light');
    expect(theme!.fontHref).toMatch(/family=Inter/);
    expect(Object.keys(theme!.vars)).toEqual(expect.arrayContaining(['--il-theme-color-accent-default', '--il-theme-color-accent-secondary', '--il-theme-fill-brand', '--il-font-family-sans']));
    expect(theme!.brand).toEqual({ name: 'Halden Group', logo: { kind: 'image', src: PIXEL, alt: null } });
    expect(themeConfigOf(BRAND).colors).toEqual({ accent: '#D6336C', accentSecondary: '#F08C00', brand: { from: '#D6336C', to: '#F08C00' } });
  });

  it('shows the company\'s uploaded logo when the brand has none, and never a placeholder', () => {
    expect(resolveStorylineTheme({ organisation: 'Ascent', brand: null, logo: { image: PIXEL, text: 'AL' }, office: null }).theme!.brand).toEqual({ name: 'Ascent', logo: { kind: 'image', src: PIXEL, alt: null } });
    expect(resolveStorylineTheme({ organisation: 'Ascent', brand: { ...BRAND, logo: null }, logo: { image: null, text: 'AL' }, office: null }).theme!.brand).toBeNull();
  });

  it('puts an uploaded office behind a veil in both modes, and a library backdrop as it is', () => {
    expect(backdropVars('/assets/bg-2.webp')).toEqual({ '--il-backdrop-office': '#0A081B url("/assets/bg-2.webp") center / cover no-repeat' });
    const up = backdropVars(PIXEL);
    expect(up['--il-backdrop-office']).toMatch(/^linear-gradient\(.+\), #0A081B url\("data:image\/png;base64,/);
    expect(up['--il-backdrop-daylight']).toMatch(/^linear-gradient\(.+\), oklch\(0\.97 0\.012 270\) url\("data:image/);
    expect(backdropVars(null)).toEqual({});
  });

  it('lets a server theme win over the brand and keeps the office under it', () => {
    const story = resolveStorylineTheme({ organisation: 'Halden', brand: BRAND, logo: null, office: '/assets/bg-2.webp' });
    const both = combineThemes(SERVER, story)!;
    expect(both.id).toBe('halden');
    expect(both.brand).toEqual(SERVER.brand);
    expect(both.mode).toBe('dark');
    expect(both.vars).toEqual({ ...SERVER.vars, '--il-backdrop-office': '#0A081B url("/assets/bg-2.webp") center / cover no-repeat' });
    expect(combineThemes(null, story)!.vars['--il-theme-fill-brand']).toBeDefined();
    expect(combineThemes(null, { theme: null, backdrop: {} })).toBeNull();
    expect(combineThemes(SERVER, null)).toBe(SERVER);
    expect(combineThemes(null, { theme: null, backdrop: { '--il-backdrop-office': 'x' } })!.brand).toBeNull();
  });
});
