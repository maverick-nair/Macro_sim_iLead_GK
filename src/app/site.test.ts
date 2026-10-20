import { describe, expect, it } from 'vitest';
import { siteOf, siteRedirect } from './site';

describe('one product per link (D238)', () => {
  it('reads the build setting, and anything else serves both', () => {
    expect([siteOf('simulation'), siteOf('geniekreator'), siteOf(undefined), siteOf('author')]).toEqual(['simulation', 'geniekreator', 'both', 'both']);
  });

  it('opens GenieKreator at its site\'s bare root and leaves every other address alone', () => {
    expect(siteRedirect('geniekreator', '/', '')).toBe('/author');
    expect(siteRedirect('geniekreator', '', '')).toBe('/author');
    // Preview plays the draft on the participant routes.
    expect(siteRedirect('geniekreator', '/', '?storyline=draft&start=board')).toBeNull();
    expect(siteRedirect('geniekreator', '/author/workspace', '')).toBeNull();
  });

  it('keeps authors out of the simulation\'s site, and changes nothing where both are served', () => {
    expect(siteRedirect('simulation', '/author', '')).toBe('/');
    expect(siteRedirect('simulation', '/author/library/', '')).toBe('/');
    expect(siteRedirect('simulation', '/authority', '')).toBeNull();
    expect(siteRedirect('simulation', '/', '')).toBeNull();
    expect(siteRedirect('both', '/', '')).toBeNull();
    expect(siteRedirect('both', '/author', '')).toBeNull();
  });
});
