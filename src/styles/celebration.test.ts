import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The celebration level (Configuration Spec, Celebrations) maps `data-celebration` onto token swaps.
 * Subtle is the design: no rule for it. None and full only reassign component tokens to the
 * celebration tokens, and the full burst is drawn only when motion is allowed.
 */
const css = fs.readFileSync(path.join(import.meta.dirname, 'celebration.css'), 'utf8');
const tokens = fs.readFileSync(path.join(import.meta.dirname, 'tokens.generated.css'), 'utf8');
const declared = new Set([...tokens.matchAll(/^\s*(--il-[a-z0-9-]+):/gm)].map(m => m[1]));
const block = (level: string) => {
  const m = new RegExp(`\\[data-celebration='${level}'\\] \\{([^}]*)\\}`).exec(css);
  return Object.fromEntries([...(m?.[1] ?? '').matchAll(/(--il-[a-z0-9-]+):\s*var\((--il-[a-z0-9-]+)\)/g)].map(x => [x[1], x[2]]));
};
/** Every token the celebration level gates: motion, glow, the tier word and the reward card lift. */
const GATED = ['--il-gamification-star-enter', '--il-gamification-badge-award-enter', '--il-gamification-badge-award-shadow', '--il-weekend-glow-fill',
  '--il-end-glow-fill', '--il-weekend-reward-lift', '--il-weekend-reward-transition'];

describe('celebration level', () => {
  it('has no rule for subtle: the design look', () => {
    expect(css).not.toContain("'subtle'");
  });

  for (const level of ['none', 'full']) {
    it(`${level} swaps every gated token for a celebration token`, () => {
      const swaps = block(level);
      for (const g of GATED) expect(swaps[g], g).toMatch(new RegExp(`^--il-celebration-${level}-`));
      for (const [from, to] of Object.entries(swaps)) {
        expect(declared.has(from), from).toBe(true);
        expect(declared.has(to), to).toBe(true);
      }
    });
  }

  it('none has no motion and no glow', () => {
    for (const [from, to] of Object.entries(block('none'))) {
      const value = new RegExp(`${to}:\\s*([^;]+);`).exec(tokens)?.[1];
      if (from === '--il-end-tier-fill') expect(value).not.toMatch(/spectrum/);
      else expect(value, from).toBe('none');
    }
  });

  it('full stays on the duration scale (D24)', () => {
    for (const to of [...Object.values(block('full')), '--il-celebration-burst-motion']) {
      const value = new RegExp(`${to}:\\s*([^;]+);`).exec(tokens)?.[1] ?? '';
      expect(value, to).not.toMatch(/\d+m?s\b/);
    }
  });

  it('draws the full burst only when motion is allowed, and not under the in-app setting', () => {
    const allowed = css.indexOf('@media (prefers-reduced-motion: no-preference)');
    expect(allowed).toBeGreaterThan(-1);
    expect(css.indexOf('.il-burst::before')).toBeGreaterThan(allowed);
    expect(css).toMatch(/\.il-reduced-motion \[data-celebration='full'\] \.il-burst::before \{ content: none; \}/);
  });
});
