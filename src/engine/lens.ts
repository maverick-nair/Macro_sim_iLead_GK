/**
 * The leadership lens (DECISIONS D70, docs/genie/leadership-lens-module.md): the styles a participant
 * leads with, the four needs a member can have, and how well each style fits each need. Plain data and
 * pure functions, so the engine, the config schema and the participant UI share them without the schema.
 *
 * A member's need comes from their skill and morale (docs/SIMULATION.md section 2): one of four quadrants.
 * The lens names the needs and gives the fit table: for each need, each style's difference (0, 1 or 2).
 */

/** The KNOLSKAPE lens library (leadership-lens-module.md, Lens library). */
export const LENS_IDS = ['readiness_based', 'six_styles', 'inspire_deliver', 'servant', 'five_practices', 'adaptive', 'team_amplifier', 'client_model'] as const;
export type LensId = (typeof LENS_IDS)[number];

/** The four skill and morale quadrants, in the order the report's grid lists them. */
export const NEEDS = ['lowSkill_lowMorale', 'lowSkill_highMorale', 'highSkill_lowMorale', 'highSkill_highMorale'] as const;
export type NeedKey = (typeof NEEDS)[number];

export const MIN_STYLES = 2;
export const MAX_STYLES = 6;

export type Fit = 0 | 1 | 2;

export interface LensStyle {
  /** Short id the engine and intents use, for example "D". */
  key: string;
  /** One or two characters on the segmented control. */
  letter: string;
  name: string;
  /** One line, for the live brief ("You set the task and check in closely."). */
  short: string;
  /** The longer line on the style cards and tooltips. */
  description: string;
}

export interface LensNeed { label: string; short: string }

export interface Lens {
  id: LensId;
  title: string;
  /** Author facing. */
  description: string;
  /** Author only: the original source. Never sent to participants. */
  basedOn?: string;
  styles: LensStyle[];
  needs: Record<NeedKey, LensNeed>;
  fit: Record<NeedKey, Record<string, Fit>>;
  /** A secondary lens adds report only skills (D70). */
  secondary?: { id: LensId; title: string };
}

/** What the participant may see of the lens (the view's `lens`). */
export interface LensView {
  id: string;
  title: string;
  styles: LensStyle[];
  needs: Array<{ key: NeedKey } & LensNeed>;
}

/**
 * Readiness Based Leadership, the default and the Sales Elevator storyline. Each style has a home
 * quadrant (Directing low skill and low morale, Guiding low skill and high morale, Partnering high
 * skill and low morale, Entrusting both high); its difference to a need is the number of ranges that
 * do not match, which is exactly the rule in docs/SIMULATION.md section 2.
 */
export const DEFAULT_LENS: Lens = {
  id: 'readiness_based',
  title: 'Readiness Based Leadership',
  description: 'Build a team whose members need different leadership at different moments. Participants win by reading each person and adapting.',
  basedOn: 'Situational leadership research, Hersey and Blanchard',
  styles: [
    { key: 'D', letter: 'D', name: 'Directing', short: 'You set the task and check in closely.', description: 'You set the task, explain how, and check in closely.' },
    { key: 'G', letter: 'G', name: 'Guiding', short: 'You explain the why and coach as they practise.', description: 'You explain the why and coach while they practise.' },
    { key: 'P', letter: 'P', name: 'Partnering', short: 'You decide together and share the work.', description: 'You decide together and share ownership of the work.' },
    { key: 'E', letter: 'E', name: 'Entrusting', short: 'You hand over the goal and step back.', description: 'You hand over the goal and step back.' }
  ],
  needs: {
    lowSkill_lowMorale: { label: 'Learning and unsure', short: 'Low skill, low morale' },
    lowSkill_highMorale: { label: 'Keen to learn', short: 'Low skill, high morale' },
    highSkill_lowMorale: { label: 'Capable but cautious', short: 'High skill, low morale' },
    highSkill_highMorale: { label: 'Ready to run with it', short: 'High skill, high morale' }
  },
  fit: {
    lowSkill_lowMorale: { D: 0, G: 1, P: 1, E: 2 },
    lowSkill_highMorale: { D: 1, G: 0, P: 2, E: 1 },
    highSkill_lowMorale: { D: 1, G: 2, P: 0, E: 1 },
    highSkill_highMorale: { D: 2, G: 1, P: 1, E: 0 }
  }
};

/** A member's need: High at or above `high` (Model doc, sections 4 and 5). */
export function needOf(s: { skill: number; morale: number }, high = 70): NeedKey {
  const hs = s.skill >= high, hm = s.morale >= high;
  return !hs && !hm ? 'lowSkill_lowMorale' : !hs ? 'lowSkill_highMorale' : !hm ? 'highSkill_lowMorale' : 'highSkill_highMorale';
}

/** The style difference for a need: 0 fits, 1 is a partial miss, 2 a clear miss. A style the lens does not know is a clear miss. */
export function fitOf(lens: Pick<Lens, 'fit'>, style: string, need: NeedKey): Fit {
  return lens.fit[need][style] ?? 2;
}

/** The first style, in lens order, that fits a need. Every need has one (the schema checks). */
export function bestStyle(lens: Pick<Lens, 'fit' | 'styles'>, need: NeedKey): string {
  return lens.styles.find(s => fitOf(lens, s.key, need) === 0)?.key ?? lens.styles[0].key;
}

/** The participant facing part of a lens: no author description, no source. */
export function lensView(lens: Lens): LensView {
  return {
    id: lens.id, title: lens.title,
    styles: lens.styles.map(s => ({ key: s.key, letter: s.letter, name: s.name, short: s.short, description: s.description })),
    needs: NEEDS.map(key => ({ key, label: lens.needs[key].label, short: lens.needs[key].short }))
  };
}

/** The default lens as the participant sees it: what design fixtures and stories render with. */
export const DEFAULT_LENS_VIEW: LensView = lensView(DEFAULT_LENS);
