import { describe, expect, it } from 'vitest';
import { Brief } from '../../../api/author';
import { parseStoryline, type StorylineConfig } from '../../../engine/config';
import { wordEnglish } from '../../../i18n/engineCopyEn';
import { toStoryline } from '../../model/export';
import { emptyChat, seedDraft } from '../../model/seed';
import type { AuthorDraft } from '../../model/draft';
import { reachMode, reachOf, REACH_LIMITS } from './reach';
import { runCalibration } from './run';

/**
 * What a run can make (D227): the funnel's capacity from the process, and each level's typical share of it. The HUL
 * trial's case: a general trade draft in India with a 2 crore target, first with a 3 lakh deal value (Experts made 19%
 * of the target in the synthetic test), then with 20 lakh (131%).
 */
const BRIEF = Brief.parse({ roleLevel: 'Area sales managers', industry: 'Retail and consumer goods', challenge: 'Secondary sales are flat.', client: 'Kaveri Consumer Products', teamSize: 10, process: ['Beat plan', 'Outlet visit', 'Order booking', 'Distributor billing', 'Secondary sales'], duration: 'standard', region: 'india', language: 'English, India', framework: null, tone: 'warm' });
const draft = (deal: number, target = 20000000): AuthorDraft => {
  const d = seedDraft({ ...emptyChat(), brief: BRIEF, primary: 'readiness_based' } as AuthorDraft['chat']);
  d.story.product.dealValue = deal;
  d.process.revenue = target;
  return d;
};
const config = (d: AuthorDraft): StorylineConfig => { const p = parseStoryline(toStoryline(d).storyline); if (!p.ok) throw new Error(p.issues.join('\n')); return p.config; };

describe('what a run can make (D227)', () => {
  it('says the trial\'s first target was out of reach, and the second one fits', () => {
    const first = reachOf(config(draft(300000)));
    expect(first.verdict).toBe('unreachable');
    expect(first.levels.expert.share).toBeLessThan(REACH_LIMITS.expertHard);
    const second = reachOf(config(draft(2000000)));
    expect(second.verdict).toBe('fits');
    expect(second.levels.proficient.share).toBeGreaterThanOrEqual(REACH_LIMITS.proficientLow);
    // Revenue is linear in the deal value: a run makes twenty thirds as much.
    expect(second.capacity / first.capacity).toBeCloseTo(20 / 3, 5);
  });

  it('calls a target even a Beginner reaches too easy, and suggests targets and deal values that fit', () => {
    const easy = reachOf(config(draft(2000000, 2000000)));
    expect(easy.verdict).toBe('easy');
    for (const r of [easy, reachOf(config(draft(300000)))]) {
      expect(reachOf(config(draft(r.value, r.suggest.target))).verdict).toBe('fits');
    }
    const low = reachOf(config(draft(300000)));
    expect(reachOf(config(draft(low.suggest.value))).verdict).toBe('fits');
  });

  it('reads the run mode from the run length and the live conversations a week', () => {
    expect(reachMode({ time: { period: { unit: 'week', count: 8 }, liveCap: 1 } } as StorylineConfig)).toBe('standard');
    expect(reachMode({ time: { period: { unit: 'week', count: 4 }, liveCap: 1 } } as StorylineConfig)).toBe('lite');
    expect(reachMode({ time: { period: { unit: 'week', count: 8 }, liveCap: 2 } } as StorylineConfig)).toBe('full');
  });

  it('estimates what Proficient players make within a third of what the synthetic test measures', async () => {
    const d = draft(2000000);
    const c = config(d);
    const r = reachOf(c);
    const { results } = await runCalibration(toStoryline(d).storyline, { personas: { beginner: 0, developing: 0, proficient: 4, expert: 0 }, seed: 3, probes: false }, { ranOn: 'cli', word: wordEnglish, yieldEvery: async () => undefined });
    const measured = results.personas.find(p => p.persona === 'proficient')!.share.mean;
    expect(Math.abs(r.levels.proficient.share - measured) / measured).toBeLessThan(1 / 3);
  }, 60000);
});
