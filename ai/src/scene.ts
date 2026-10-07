import type { StorylineConfig } from '../../src/engine/config';
import type { Turn } from '../../src/engine/sim/types';
import type { HistoryTurn, NpcScene } from './types';

/**
 * Small helpers for the server: the scene and history an NPC turn needs, from engine state it already has.
 */

/** The run's locale: the storyline's locale (`money.locale`, for example `en-US`). */
export const localeOf = (config: Pick<StorylineConfig, 'money'>) => config.money.locale;

/** The scene parts that come from the storyline: the locale and the workplace. */
export function sceneFromStoryline(config: StorylineConfig): Pick<NpcScene, 'locale' | 'story'> {
  return {
    locale: localeOf(config),
    story: { name: config.name, organisation: config.organisation, sponsor: { name: config.sponsor.name, title: config.sponsor.title }, product: config.name.split(',')[0]?.trim() }
  };
}

/** An interaction's turns as history, with each speaker's name. Drop the last turn when it is the one being answered. */
export function historyFromTurns(turns: readonly Turn[], nameOf: (id: string) => string): HistoryTurn[] {
  return turns.map(t => ({ by: t.by, ...(t.by === 'you' ? {} : { name: nameOf(t.by) }), text: t.text, ...(t.interrupted ? { interrupted: true } : {}) }));
}
