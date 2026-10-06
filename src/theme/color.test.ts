import { converter, parse, wcagContrast } from 'culori';
import { describe, expect, it } from 'vitest';
import { composite, contrastRatio, formatOklch, inGamut, isOklch, oklchToRgbRaw, parseColor, rgbToOklch, toGamut, toOklch, toRgb, type Rgb } from './color';

const rgbOf = (s: string) => toRgb(parseColor(s)!);

describe('shared colour maths', () => {
  it('reads oklch(), hex, rgb() and the keywords the tokens use, and nothing else', () => {
    expect(parseColor('oklch(0.5 0.17 0)')).toEqual({ l: 0.5, c: 0.17, h: 0, alpha: 1 });
    expect(parseColor('oklch(60% 0.1 250deg / 0.18)')).toEqual({ l: 0.6, c: 0.1, h: 250, alpha: 0.18 });
    expect(parseColor('#249DFF')).toMatchObject({ r: 0x24 / 255, g: 0x9d / 255, b: 1, alpha: 1 });
    expect(parseColor('#fff8')).toMatchObject({ r: 1, alpha: 0x88 / 255 });
    expect(parseColor('rgb(255 0 0 / 50%)')).toEqual({ r: 1, g: 0, b: 0, alpha: 0.5 });
    expect(parseColor('rgba(0, 128, 255, 0.4)')).toMatchObject({ g: 128 / 255, alpha: 0.4 });
    expect(parseColor('transparent')).toMatchObject({ alpha: 0 });
    for (const bad of ['red', 'var(--x)', 'linear-gradient(red, blue)', 'oklch(2 0 0)', '#12', 'javascript:alert(1)', '']) expect(parseColor(bad), bad).toBeNull();
  });

  it('converts OKLCH to sRGB and back as culori does', () => {
    const toCuloriRgb = converter('rgb');
    for (const s of ['oklch(0.5 0.17 0)', 'oklch(0.72 0.17 0)', 'oklch(0.95 0.025 0)', 'oklch(0.3 0.05 250)', '#249DFF', '#43D6E8']) {
      const ours = toRgb(parseColor(s)!);
      const theirs = toCuloriRgb(parse(s)!)!;
      expect(ours.r).toBeCloseTo(theirs.r, 6);
      expect(ours.g).toBeCloseTo(theirs.g, 6);
      expect(ours.b).toBeCloseTo(theirs.b, 6);
      const back = rgbToOklch(ours);
      expect(toRgb(back).r).toBeCloseTo(ours.r, 6);
    }
  });

  it('measures WCAG contrast as culori does', () => {
    expect(contrastRatio(rgbOf('#fff'), rgbOf('#000'))).toBeCloseTo(21, 6);
    for (const [a, b] of [['#249DFF', '#ffffff'], ['oklch(0.5 0.17 0)', 'oklch(0.97 0.012 270)'], ['#767676', '#fff']]) {
      expect(contrastRatio(rgbOf(a), rgbOf(b))).toBeCloseTo(wcagContrast(a, b), 4);
    }
  });

  it('gamut maps by chroma only: lightness and hue stay', () => {
    const wild = { l: 0.9, c: 0.35, h: 140, alpha: 1 };
    expect(inGamut(oklchToRgbRaw(wild))).toBe(false);
    const mapped = toGamut(wild);
    expect(inGamut(oklchToRgbRaw(mapped))).toBe(true);
    expect(mapped.l).toBe(0.9);
    expect(mapped.h).toBe(140);
    expect(mapped.c).toBeLessThan(0.35);
    expect(mapped.c).toBeGreaterThan(0.1);
    const fine = { l: 0.5, c: 0.1, h: 30, alpha: 1 };
    expect(toGamut(fine)).toBe(fine);
  });

  it('composites a translucent colour over another in sRGB', () => {
    const half: Rgb = { r: 0, g: 0, b: 0, alpha: 0.5 };
    expect(composite(half, { r: 1, g: 1, b: 1, alpha: 1 })).toEqual({ r: 0.5, g: 0.5, b: 0.5, alpha: 1 });
  });

  it('writes OKLCH back as CSS, rounded to 4 decimals', () => {
    expect(formatOklch({ l: 0.123456, c: 0.1, h: 250, alpha: 1 })).toBe('oklch(0.1235 0.1 250)');
    expect(formatOklch({ l: 0.5, c: 0, h: 0, alpha: 0.18 })).toBe('oklch(0.5 0 0 / 0.18)');
    const c = toOklch(parseColor('#249DFF')!);
    expect(isOklch(c)).toBe(true);
  });
});
