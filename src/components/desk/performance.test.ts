import { describe, expect, it } from 'vitest';
import { performanceBand, performanceMove } from './performance';

describe('the performance line on a card (D241)', () => {
  it('bands the result', () => {
    expect([90, 75, 74, 55, 54, 40, 39, 0].map(performanceBand)).toEqual(['strong', 'strong', 'steady', 'steady', 'below', 'below', 'struggling', 'struggling']);
  });

  it('reads the move since this period started, holding under 2 either way', () => {
    expect(performanceMove(undefined)).toBeNull();
    expect(performanceMove([49])).toBeNull();
    expect(performanceMove([40, 49, null])).toBeNull();
    expect(performanceMove([40, 49, 55])).toBe(6);
    expect(performanceMove([49, 45])).toBe(-4);
    expect(performanceMove([49, 50.4])).toBe(0);
  });
});
