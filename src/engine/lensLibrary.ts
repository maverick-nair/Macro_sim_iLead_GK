import { READINESS_NEEDS, READINESS_STYLES, type Lens } from './lens';

/**
 * Lenses as authored (engine and authoring only, never the participant bundle): Readiness Based
 * Leadership, the default and the Sales Elevator storyline. Each style has a home quadrant (Directing
 * low skill and low morale, Guiding low skill and high morale, Partnering high skill and low morale,
 * Entrusting both high); its difference to a need is the number of ranges that do not match, which is
 * exactly the rule in docs/SIMULATION.md section 2.
 */
export const DEFAULT_LENS: Lens = {
  id: 'readiness_based',
  title: 'Readiness Based Leadership',
  description: 'Build a team whose members need different leadership at different moments. Participants win by reading each person and adapting.',
  basedOn: 'Situational leadership research, Hersey and Blanchard',
  styles: READINESS_STYLES,
  needs: READINESS_NEEDS,
  fit: {
    lowSkill_lowMorale: { D: 0, G: 1, P: 1, E: 2 },
    lowSkill_highMorale: { D: 1, G: 0, P: 2, E: 1 },
    highSkill_lowMorale: { D: 1, G: 2, P: 0, E: 1 },
    highSkill_highMorale: { D: 2, G: 1, P: 1, E: 0 }
  }
};
