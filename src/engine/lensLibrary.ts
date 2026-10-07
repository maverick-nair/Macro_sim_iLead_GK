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
  },
  // The Tutorial's worked examples (D91), one per need, as 1.0's transcript taught the model. Archetypes, never team members.
  examples: [
    { need: 'lowSkill_lowMorale', style: 'D', person: 'Tom moved into a new stage this week. He does not know the process yet and worries he will get it wrong.', why: 'He needs clear steps more than freedom. Directing sets the task, explains how and checks in closely until he finds his feet.' },
    { need: 'lowSkill_highMorale', style: 'G', person: 'Asha joined last month. She is eager and asks lots of questions, but has never qualified a lead on her own.', why: 'She has the drive but not yet the skill. Guiding explains the why and coaches her while she practices, so her energy turns into skill.' },
    { need: 'highSkill_lowMorale', style: 'P', person: 'Ravi is your most experienced negotiator, but a lost deal has shaken him and he has gone quiet in meetings.', why: 'He has the skill, but his confidence is down. Partnering decides with him and shares the work, which rebuilds his confidence without telling him what he already knows.' },
    { need: 'highSkill_highMorale', style: 'E', person: 'Mei has closed more deals than anyone this quarter and wants to run her own accounts.', why: 'She is skilled and confident. Entrusting hands over the goal and steps back; checking in closely would feel like being watched.' }
  ]
};
