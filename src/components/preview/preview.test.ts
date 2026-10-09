import { describe, expect, it } from 'vitest';
import { isPreview, PREVIEW_META_KEY, previewUrl, readMeta, screenFor } from './mode';
import { getTrace, setTraceLookup } from './trace';

const memory = (init: Record<string, string> = {}) => ({ getItem: (k: string) => init[k] ?? null });

describe('preview mode (D191 to D197)', () => {
  it('is on only with ?preview=1, and builds the preview address', () => {
    expect(isPreview('?preview=1&jump=board:2')).toBe(true);
    expect(isPreview('?storyline=draft')).toBe(false);
    const u = new URL(previewUrl({ target: 'board:2', light: true, previewId: 'pabc' }), 'http://x');
    expect(Object.fromEntries(u.searchParams)).toEqual({ preview: '1', storyline: 'draft', participant: 'preview', jump: 'board:2', previewId: 'pabc', theme: 'light' });
    expect(screenFor('onboarding')).toBeUndefined();
    expect(screenFor(null)).toBeUndefined();
    expect(screenFor('report')).toBe('board');
  });

  it('reads the meta GenieKreator leaves, and nothing else', () => {
    expect(readMeta(memory())).toBeNull();
    expect(readMeta(memory({ [PREVIEW_META_KEY]: 'not json' }))).toBeNull();
    expect(readMeta(memory({ [PREVIEW_META_KEY]: JSON.stringify({ rev: 3, version: 2, savedAt: 5, title: 'T' }) }))).toEqual({ rev: 3, version: 2, savedAt: 5, title: 'T', previewId: null });
  });

  it('labels a config path with its GenieKreator section, through one lookup that can be rewired', () => {
    expect(getTrace('members.kent')).toEqual({ section: 'Team', label: 'Character' });
    expect(getTrace('lens.styles')).toEqual({ section: 'Leadership lens', label: 'Styles' });
    expect(getTrace('actions.coach')?.section).toBe('Actions and conversations');
    expect(getTrace('nothing.here')).toBeNull();
    expect(getTrace('')).toBeNull();
    const prev = setTraceLookup(p => (p === 'x' ? { section: 'S', label: 'L' } : null));
    expect(getTrace('x')).toEqual({ section: 'S', label: 'L' });
    setTraceLookup(prev);
    expect(getTrace('events.a')?.section).toBe('Events');
  });
});
