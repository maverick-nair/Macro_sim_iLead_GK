import type { StorylineInput } from '../config';
import { lensView, type Lens } from '../lens';
import { DEFAULT_DEVELOPMENT, DEFAULT_LINKAGE, DEFAULT_METHODOLOGY, DEFAULT_NARRATIVES, DEFAULT_RECOGNITION, DEFAULT_SCALE, DEFAULT_SKILLS } from '../report/defaults';

/**
 * A test lens that proves the engine and the UI follow the storyline's lens (D70): Six Leadership
 * Styles, with KNOLSKAPE names, six styles over the four needs, and Inspire and Deliver as the secondary
 * lens, whose two skills are report only. `withSixStyles` turns any storyline (Sales Elevator in the tests,
 * the mock's `?lens=six_styles`) into one that plays with it.
 */
export const SIX_STYLES_LENS: Lens = {
  id: 'six_styles',
  title: 'Six Leadership Styles',
  description: 'Score how participants lead in every email, meeting and conversation, and show the impact on team climate.',
  basedOn: 'Goleman, Leadership That Gets Results',
  styles: [
    { key: 'vision', letter: 'VS', name: 'Vision Setter', short: 'You paint the destination and let them find the route.', description: 'You share where the team is heading and why it matters, then let people choose how to get there.' },
    { key: 'coach', letter: 'CO', name: 'Coach', short: 'You build their strengths for the long run.', description: 'You link their goals to the work and help them grow, one conversation at a time.' },
    { key: 'harmony', letter: 'HA', name: 'Harmoniser', short: 'You put feelings first and mend relationships.', description: 'You build harmony and heal rifts, so people feel valued and safe.' },
    { key: 'collab', letter: 'CL', name: 'Collaborator', short: 'You ask for ideas and decide together.', description: 'You invite views and build agreement before you commit.' },
    { key: 'pace', letter: 'PS', name: 'Pace Setter', short: 'You set a high bar and model it yourself.', description: 'You set demanding standards, lead by example and expect people to keep up.' },
    { key: 'command', letter: 'CM', name: 'Commander', short: 'You give clear orders and expect them followed.', description: 'You take charge and give firm direction. It helps most in a crisis.' }
  ],
  needs: {
    lowSkill_lowMorale: { label: 'New and unsure', short: 'Low skill, low morale' },
    lowSkill_highMorale: { label: 'Eager to grow', short: 'Low skill, high morale' },
    highSkill_lowMorale: { label: 'Capable but drained', short: 'High skill, low morale' },
    highSkill_highMorale: { label: 'Ready to stretch', short: 'High skill, high morale' }
  },
  fit: {
    lowSkill_lowMorale: { vision: 1, coach: 1, harmony: 1, collab: 2, pace: 2, command: 0 },
    lowSkill_highMorale: { vision: 1, coach: 0, harmony: 2, collab: 1, pace: 2, command: 1 },
    highSkill_lowMorale: { vision: 1, coach: 1, harmony: 0, collab: 0, pace: 2, command: 2 },
    highSkill_highMorale: { vision: 0, coach: 1, harmony: 1, collab: 1, pace: 0, command: 2 }
  },
  secondary: { id: 'inspire_deliver', title: 'Inspire and Deliver' }
};

/** The participant facing six style lens, for stories. */
export const SIX_STYLES_VIEW = lensView(SIX_STYLES_LENS);

/** Readiness Based option tags mapped to the six styles. */
const TAG: Record<string, string> = { D: 'command', G: 'coach', P: 'collab', E: 'vision' };

/** The secondary lens's dimensions: report only (D70). */
const REPORT_ONLY = [
  { key: 'team_engagement', name: 'Team engagement', reportOnly: true, anchors: [
    'Leaves people unsure why their work matters.',
    'Mentions the bigger picture, but rarely connects it to the person.',
    'Connects the work to what each person cares about.',
    'Keeps people engaged through pressure, and notices when they drift.',
    'Builds a team that wants to go further together.'] },
  { key: 'delivery_performance', name: 'Delivery performance', reportOnly: true, anchors: [
    'Lets targets slide without a plan.',
    'Talks about targets, but without clear actions.',
    'Agrees clear actions against the target.',
    'Tracks delivery and corrects course early.',
    'Delivers consistently and lifts the team with it.'] }
];

export function withSixStyles(input: StorylineInput): StorylineInput {
  const linkage = { ...DEFAULT_LINKAGE };
  for (const k of ['f2f', 'coach', 'goals', 'meet']) linkage[k] = [...linkage[k], k === 'goals' ? 'delivery_performance' : 'team_engagement'];
  return {
    ...input,
    id: `${input.id}-six-styles`,
    lens: structuredClone(SIX_STYLES_LENS),
    actions: input.actions.map(a => ({ ...a, options: a.options.map(o => (o.style ? { ...o, style: TAG[o.style] ?? o.style } : o)) })),
    report: {
      skills: [...DEFAULT_SKILLS.map(s => ({ ...s, anchors: [...s.anchors] })), ...REPORT_ONLY],
      linkage,
      scale: DEFAULT_SCALE,
      narratives: {
        overall: DEFAULT_NARRATIVES.overall,
        capability: DEFAULT_NARRATIVES.capability,
        dominant: {
          vision: 'You lean on setting the vision. People know where they are going; check that the newest know how.',
          command: 'You lean on commanding. It steadies a crisis, and wears people down when there is none.'
        }
      },
      development: DEFAULT_DEVELOPMENT,
      recognitionPhrases: DEFAULT_RECOGNITION,
      methodology: DEFAULT_METHODOLOGY
    }
  };
}
