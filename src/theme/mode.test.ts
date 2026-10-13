import { describe, expect, it } from 'vitest';
import { DEFAULT_MODE, pickMode } from './mode';

describe('the mode the player opens in (D232)', () => {
  it('is the canvas paper by default', () => {
    expect(DEFAULT_MODE).toBe('light');
    expect(pickMode(null, null, false)).toBe('light');
    expect(pickMode('sepia', undefined, true)).toBe('light');
  });

  it('follows the launch, then the theme, then the device for a system theme', () => {
    expect(pickMode('dark', 'light', true)).toBe('dark');
    expect(pickMode('light', 'dark', false)).toBe('light');
    expect(pickMode(null, 'dark', true)).toBe('dark');
    expect(pickMode(null, 'system', false)).toBe('dark');
    expect(pickMode(null, 'system', true)).toBe('light');
  });
});
