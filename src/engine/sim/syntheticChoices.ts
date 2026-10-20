import type { ChoiceOption, StorylineConfig } from '../config';
import type { Rng } from './rng';

/**
 * How synthetic players weigh a choice event's options (D137, D140, D152). Every player decides through the
 * policy's `choose` hook (`./syntheticPolicy`); without one, the level's rule below applies. These read the
 * authored options, as the players read event responses: calibration, not a participant.
 *
 *   business  the option's short term business value: revenue against a period's target, each variable's
 *             move across its range (against it when less is better), sponsor confidence and the result
 *   people    what it does for the people it lands on: skill, morale, half the result, and trust
 *   lead      the mean band score of its leadership read (50 when it has none)
 *   size      how much it moves at all, business and people together (a bold option moves a lot)
 */

export type ChoiceEvent = StorylineConfig['events'][number] & { choice: NonNullable<StorylineConfig['events'][number]['choice']> };
export type { ChoiceOption };

const BAND_SCORE = { strong: 100, adequate: 70, weak: 35, harmful: 0 } as const;
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/** An option's short term business value, in points. */
export function choiceBusiness(config: StorylineConfig, o: ChoiceOption): number {
  const perPeriod = config.money.target / config.time.period.count;
  const vars = Object.entries(o.business.variables).reduce((a, [k, d]) => {
    const v = config.variables.find(x => x.key === k);
    return v ? a + (100 * d / (v.max - v.min)) * (v.higherIsBetter ? 1 : -1) : a;
  }, 0);
  return 100 * o.business.revenue / perPeriod + vars + o.business.sponsor / 2 + o.people[2];
}

/** What an option does for the people it lands on. */
export const choicePeople = (o: ChoiceOption) => o.people[0] + o.people[1] + o.people[2] / 2 + 1.5 * o.trust;

/** The mean band score of an option's leadership read, 50 without one. */
export const choiceLead = (o: ChoiceOption) => (o.read.length ? mean(o.read.map(r => BAND_SCORE[r.band])) : 50);

/** How much an option moves at all: a bold option moves business and people a lot, either way. */
export const choiceSize = (config: StorylineConfig, o: ChoiceOption) => Math.abs(choiceBusiness(config, o)) + Math.abs(choicePeople(o)) + Math.abs(o.business.sponsor);

/** The option with the highest value, ties to the earlier option. */
export function bestBy(options: ChoiceOption[], value: (o: ChoiceOption) => number): ChoiceOption {
  return options.reduce((best, o) => (value(o) > value(best) ? o : best), options[0]);
}

/**
 * The level's rule (D140): decide at all with `decide` (otherwise the default applies); weigh people and
 * leadership beside business with `weigh`, otherwise take the option best for business in the short term.
 * Returns the option, or null to leave it to the default. Draws only on the choice stream.
 */
export function levelChoice(config: StorylineConfig, rng: Rng, traits: { decide: number; weigh: number }, options: ChoiceOption[]): ChoiceOption | null {
  if (!options.length || !rng.chance(traits.decide)) return null;
  const weigh = rng.chance(traits.weigh);
  return weigh
    ? bestBy(options, o => choiceLead(o) + 3 * choicePeople(o) + 0.5 * choiceBusiness(config, o))
    : bestBy(options, o => choiceBusiness(config, o));
}
