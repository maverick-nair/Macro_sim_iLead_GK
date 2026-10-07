import { describe, expect, it } from 'vitest';
import { wordAll as en } from '../../i18n/engineCopy';
import { parseStoryline, type StorylineInput } from '../config';
import salesElevator from '../storylines/sales-elevator.json';
import { createEngine, IntentError } from './engine';
import { neededStyles } from './policies';

/** The Week 0 practice conversation (spec, onboarding step 7; D16, D84). */
const config = (extra: Partial<StorylineInput> = {}) => {
  const r = parseStoryline({ ...(salesElevator as unknown as StorylineInput), ...extra });
  if (!r.ok) throw new Error(r.issues.join('\n'));
  return r.config;
};

describe('Week 0 practice', () => {
  it('is offered before week 1, talks like a conversation, and changes nothing', async () => {
    const e = createEngine(config(), { seed: 1 });
    const before = e.view();
    expect(before.practice).toEqual({ available: true, partner: before.members[0].id });
    const r = await e.dispatch({ type: 'startPractice' });
    const lv = en(e.view()).live!;
    expect(lv.practice).toBe(true);
    expect(lv.turnLimit).toBe(4);
    expect(lv.brief.goal).toMatch(/Nothing here is scored/);
    expect(lv.turns[0].by).toBe(before.members[0].id);
    await e.dispatch({ type: 'sendTurn', interactionId: r.interactionId!, text: 'Hi, how are you doing this week?' });
    const end = await e.dispatch({ type: 'endInteraction', interactionId: r.interactionId! });
    expect(en(end.hint)).toMatch(/open question/);
    const after = e.view();
    expect(after.live).toBeNull();
    expect(after.practice.available).toBe(false);
    // Nothing moved: no history, no live record, no cap used, the same people and score.
    expect(after.history).toEqual([]);
    expect(after.liveCap.used).toBe(0);
    expect(after.score).toEqual(before.score);
    expect(after.members.map(m => [m.id, m.mood])).toEqual(before.members.map(m => [m.id, m.mood]));
  });

  it('can be skipped, and is not offered once week 1 is under way', async () => {
    const e = createEngine(config(), { seed: 1 });
    await e.dispatch({ type: 'skipPractice' });
    expect(e.view().practice.available).toBe(false);
    await expect(e.dispatch({ type: 'startPractice' })).rejects.toBeInstanceOf(IntentError);
    const f = createEngine(config(), { seed: 1 });
    await f.dispatch({ type: 'confirmStyles', styles: await neededStyles(f) });
    expect(f.view().practice.available).toBe(false);
  });

  it('follows the storyline: off, another partner, chat, its own goal and length', async () => {
    expect(createEngine(config({ practice: { enabled: false } }), { seed: 1 }).view().practice.available).toBe(false);
    const e = createEngine(config({ practice: { with: 'beth', format: 'chat', goal: 'Say hello to Beth.', turnLimit: 2, minutes: 2 } }), { seed: 1 });
    await e.dispatch({ type: 'startPractice' });
    const lv = en(e.view()).live!;
    expect([lv.format, lv.speaker.id, lv.brief.goal, lv.turnLimit, lv.minutes]).toEqual(['chat', 'beth', 'Say hello to Beth.', 2, 2]);
    expect(parseStoryline({ ...(salesElevator as unknown as StorylineInput), practice: { with: 'nobody' } }).ok).toBe(false);
  });

  it('leaving it without a word just closes it', async () => {
    const e = createEngine(config(), { seed: 1 });
    const r = await e.dispatch({ type: 'startPractice' });
    await e.dispatch({ type: 'abandonInteraction', interactionId: r.interactionId! });
    expect(e.view().live).toBeNull();
    expect(e.view().history).toEqual([]);
  });
});
