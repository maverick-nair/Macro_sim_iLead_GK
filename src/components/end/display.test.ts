import { describe, expect, it } from 'vitest';
import { createI18n } from '../../i18n';
import { copyViolations } from '../../i18n/copy';
import { answersFor, around, pickMoments, portraitOf, reflectionKey, saveState, sharePercent, tierBarHeight, tierBars, tiersAscending, toneOf } from './display';

const TIERS = [{ key: 'bronze', name: 'Bronze' }, { key: 'silver', name: 'Silver' }, { key: 'gold', name: 'Gold' }, { key: 'platinum', name: 'Platinum' }];

describe('end screen display mappings', () => {
  it('fills the tier bars up to the tier reached, each a step taller (the design: 20, 30, 40 and 50)', () => {
    expect(tierBars(TIERS, 'gold').map(b => b.filled)).toEqual([true, true, true, false]);
    expect(tierBars(TIERS, 'bronze').map(b => b.filled)).toEqual([true, false, false, false]);
    expect(tierBars(TIERS, 'unknown').every(b => !b.filled)).toBe(true);
    expect(tierBars(TIERS, 'gold').map(b => tierBarHeight(b.step) * 4)).toEqual([20, 30, 40, 50]);
  });

  it('orders the engine tiers lowest first', () => {
    expect(tiersAscending([{ key: 'p', min: 850 }, { key: 'g', min: 700 }, { key: 's', min: 500 }, { key: 'b', min: 0 }]).map(x => x.key)).toEqual(['b', 's', 'g', 'p']);
  });

  it('turns the revenue share into a bar length, 0 to 100', () => {
    expect(sharePercent(0.9433)).toBe(94);
    expect(sharePercent(1.12)).toBe(100);
    expect(sharePercent(-0.1)).toBe(0);
    expect(sharePercent(Number.NaN)).toBe(0);
  });

  it('colours a change by its sign', () => {
    expect([toneOf(3), toneOf(-1), toneOf(0)]).toEqual(['gain', 'decline', 'neutral']);
  });

  it('shows up to four moments in the engine order, with something to revisit when the run has one', () => {
    const m = (id: string, kind: 'best' | 'revisit') => ({ id, kind });
    const three = [m('a', 'best'), m('b', 'revisit'), m('c', 'best')];
    expect(pickMoments(three)).toEqual(three);
    const mixed = [m('a', 'best'), m('b', 'revisit'), m('c', 'best'), m('d', 'best'), m('e', 'revisit')];
    expect(pickMoments(mixed).map(x => x.id)).toEqual(['a', 'b', 'c', 'd']);
    const allBest = [m('a', 'best'), m('b', 'best'), m('c', 'best'), m('d', 'best'), m('e', 'best'), m('f', 'revisit')];
    expect(pickMoments(allBest).map(x => x.id)).toEqual(['a', 'b', 'c', 'f']);
    const onlyBest = [m('a', 'best'), m('b', 'best'), m('c', 'best'), m('d', 'best'), m('e', 'best')];
    expect(pickMoments(onlyBest).map(x => x.id)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('finds a portrait on the team, then among people who left, else the placeholder', () => {
    const members = [{ id: 'kent', img: '/k.png' }, { id: 'beth', img: null }];
    const people = [{ memberId: 'kent', img: '/old.png' }, { memberId: 'ruth', img: '/r.png' }];
    expect(portraitOf('kent', members, people, '/p.svg')).toBe('/k.png');
    expect(portraitOf('ruth', members, people, '/p.svg')).toBe('/r.png');
    expect(portraitOf('beth', members, people, '/p.svg')).toBe('/p.svg');
    expect(portraitOf(null, members, people, '/p.svg')).toBe('/p.svg');
  });

  it('keeps one answer per question and compares reflections as they would be sent', () => {
    expect(answersFor(['q1', 'q2'], ['a1'])).toEqual(['a1', '']);
    expect(answersFor(['q1'], undefined)).toEqual(['']);
    expect(reflectionKey(['a '], 3)).toBe(reflectionKey(['a'], 3));
    expect(reflectionKey(['a'], 3)).not.toBe(reflectionKey(['a'], 4));
  });

  it('words the save state: saving, then a failure, then unsaved changes, then saved', () => {
    expect(saveState(true, true, 'saved')).toBe('saving');
    expect(saveState(true, false, 'error')).toBe('error');
    expect(saveState(true, false, 'saved')).toBe('dirty');
    expect(saveState(false, false, 'saved')).toBe('saved');
    expect(saveState(false, false, 'none')).toBe('idle');
  });

  it('splits the headline around the tier name', () => {
    expect(around('You finished at \u0001.', '\u0001')).toEqual(['You finished at ', '.']);
    expect(around('No mark', '\u0001')).toEqual(['No mark', '']);
  });

  it('words the eyebrow and headings from the run, as the design does', () => {
    const { t } = createI18n();
    expect(t('end.eyebrow', { periods: 8, unit: 'week', people: 10 })).toBe('Eight weeks, ten people, one team');
    expect(t('end.eyebrow', { periods: 1, unit: 'month', people: 14 })).toBe('One month, 14 people, one team');
    expect(t('end.moments.title', { periods: 8, unit: 'week' })).toBe('Moments from your eight weeks');
    expect(t('end.moments.when', { unit: 'week', n: 2, kind: 'revisit' })).toBe('Week 2 · Worth revisiting');
    expect(t('end.reflect.title', { count: 2 })).toBe('Reflect, two questions');
    expect(t('end.reflect.title', { count: 0 })).toBe('Reflect');
    for (const s of [t('end.eyebrow', { periods: 3, unit: 'day', people: 2 }), t('end.results.conversionsNote', { same: 'false', delta: '−2' })]) expect(copyViolations(s)).toEqual([]);
  });
});
