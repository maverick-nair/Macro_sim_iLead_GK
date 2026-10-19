import { describe, expect, it } from 'vitest';
import { styleIntent } from './useStyleDraft';

describe('the style setting draft', () => {
  it('confirms the styles with only the notes that say something', () => {
    const draft = { kent: 'coaching' as const, beth: 'directing' as const };
    expect(styleIntent(draft, { kent: ' Needs a push. ', beth: '  ' })).toEqual({ type: 'confirmStyles', styles: draft, notes: { kent: ' Needs a push. ' } });
    expect(styleIntent(draft, { kent: '' })).toEqual({ type: 'confirmStyles', styles: draft, notes: undefined });
  });
});
