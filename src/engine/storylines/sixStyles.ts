import type { StorylineInput } from '../config';
import { lensView, type Lens } from '../lens';
import { DEFAULT_DEVELOPMENT, DEFAULT_LINKAGE, DEFAULT_METHODOLOGY, DEFAULT_NARRATIVES, DEFAULT_RECOGNITION, DEFAULT_SCALE, DEFAULT_SKILLS } from '../report/defaults';

/**
 * A test lens that proves the engine and the UI follow the storyline's lens (D70): Six Leadership
 * Styles, with KNOLSKAPE names. The source model's Pacesetting and Commanding are merged into one style,
 * Drive (D104: every lens has 4 or 5 styles), so it plays five styles over the four needs, with Inspire
 * and Deliver as the secondary lens, whose two skills are report only. `withSixStyles` turns any
 * storyline (Sales Elevator in the tests, the mock's `?lens=six_styles`) into one that plays with it.
 */
export const SIX_STYLES_LENS: Lens = {
  id: 'six_styles',
  title: 'Six Leadership Styles',
  description: 'Score how participants lead in every email, meeting and conversation, and show the impact on team climate.',
  basedOn: 'Goleman, Leadership That Gets Results',
  styles: [
    { key: 'vision', letter: 'VS', name: 'Vision Setter', short: 'You paint the destination and let them find the route.', description: 'You share where the team is heading and why it matters, then let people choose how to get there.' },
    { key: 'coach', letter: 'CO', name: 'Coach', short: 'You build their strengths for the long run.', description: 'You link their goals to the work and help them grow, one conversation at a time.' },
    { key: 'harmony', letter: 'HA', name: 'Harmonizer', short: 'You put feelings first and mend relationships.', description: 'You build harmony and heal rifts, so people feel valued and safe.' },
    { key: 'collab', letter: 'CL', name: 'Collaborator', short: 'You ask for ideas and decide together.', description: 'You invite views and build agreement before you commit.' },
    { key: 'drive', letter: 'DR', name: 'Drive', short: 'You set a high bar and take charge when speed matters.', description: 'You set a high bar and take charge when speed matters. It steadies a crisis and wears people down when there is none.' }
  ],
  needs: {
    lowSkill_lowMorale: { label: 'New and unsure', short: 'Low skill, low morale' },
    lowSkill_highMorale: { label: 'Eager to grow', short: 'Low skill, high morale' },
    highSkill_lowMorale: { label: 'Capable but drained', short: 'High skill, low morale' },
    highSkill_highMorale: { label: 'Ready to stretch', short: 'High skill, high morale' }
  },
  fit: {
    // Drive keeps Commanding's fit where people are new and unsure (clear direction helps), a partial
    // miss for the eager and the ready (a high bar stretches them, orders do not), and a clear miss for
    // the capable but drained, who need relief rather than more pressure.
    lowSkill_lowMorale: { vision: 1, coach: 1, harmony: 1, collab: 2, drive: 0 },
    lowSkill_highMorale: { vision: 1, coach: 0, harmony: 2, collab: 1, drive: 1 },
    highSkill_lowMorale: { vision: 1, coach: 1, harmony: 0, collab: 0, drive: 2 },
    highSkill_highMorale: { vision: 0, coach: 1, harmony: 1, collab: 1, drive: 1 }
  },
  secondary: { id: 'inspire_deliver', title: 'Inspire and Deliver' }
};

/** The participant facing Six Leadership Styles lens (five styles), for stories. */
export const SIX_STYLES_VIEW = lensView(SIX_STYLES_LENS);

/** Readiness Based option tags mapped to the lens's styles. */
const TAG: Record<string, string> = { D: 'drive', G: 'coach', P: 'collab', E: 'vision' };

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
          drive: 'You lean on {style}. It steadies a crisis and speeds the work, and wears people down when there is none.'
        }
      },
      development: DEFAULT_DEVELOPMENT,
      recognitionPhrases: DEFAULT_RECOGNITION,
      methodology: DEFAULT_METHODOLOGY
    }
  };
}
