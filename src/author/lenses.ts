import { LENS_IDS, NEEDS, READINESS_NEEDS, type Fit, type LensId, type LensNeed, type NeedKey } from '../engine/lens';
import { DEFAULT_LENS } from '../engine/lensLibrary';
import { SIX_STYLES_LENS } from '../engine/storylines/sixStyles';

/**
 * The Leadership Lens library as GenieKreator authors see it (docs/genie/leadership-lens-module.md,
 * D70). Authoring only: this module never reaches the participant bundle. Titles are KNOLSKAPE titles;
 * original sources appear only in `basedOn`. Style sets carry the module's source tags renamed into
 * KNOLSKAPE names, with the tone variants and context aware lines the mock drafter fills in.
 */

/** A style as the library holds it, before the drafter fits it to the brief. */
export interface LibraryStyle {
  key: string;
  letter: string;
  /** The module's action classification tag this style comes from (author facing). */
  source: string;
  /** The need this style fits best; its difference to another need is the number of ranges that differ (SIMULATION 2). */
  home: NeedKey;
  /** Name per tone. `professional` is the KNOLSKAPE name. */
  names: Record<Tone, string>;
  /** Short line; `{work}` is the team's unit of work (a deal, a case, a release). */
  short: string;
  description: string;
}

export const TONES = ['professional', 'warm', 'direct'] as const;
export type Tone = (typeof TONES)[number];

export interface Dimension {
  key: string;
  name: string;
  /** What the skill looks like, as a phrase that fits "Shows ___". */
  focus: string;
  practice: string;
  onTheJob: string;
}

export interface LibraryLens {
  id: LensId;
  title: string;
  description: string;
  bestFor: string;
  /** Author only. */
  basedOn: string;
  worksWith: LensId;
  npcDesign: string;
  eventDesign: string;
  actionClassification: string[];
  dimensions: Dimension[];
  /** Null for the Client Leadership Model: its styles come from the confirmed framework. */
  styles: LibraryStyle[] | null;
  needs: Record<NeedKey, LensNeed>;
  /** A fit table that is not the home rule (Six Leadership Styles keeps the engine's tested table). */
  fit?: Record<NeedKey, Record<string, Fit>>;
  /** The sponsor's line over weekly style setting. */
  styleLine: string;
  /** Two event ideas from the lens's event design, worded with `{company}`, `{work}`, `{customers}`. */
  events: Array<{ title: string; body: string; card: 'impact' | 'signal' | 'capacity' | 'diagnostic' | 'opportunity' | 'crisis'; label?: string }>;
}

const dim = (key: string, name: string, focus: string, practice: string, onTheJob: string): Dimension => ({ key, name, focus, practice, onTheJob });
const style = (key: string, letter: string, source: string, home: NeedKey, names: [string, string, string], short: string, description: string): LibraryStyle =>
  ({ key, letter, source, home, names: { professional: names[0], warm: names[1], direct: names[2] }, short, description });

const needs = (ll: string, lh: string, hl: string, hh: string): Record<NeedKey, LensNeed> => ({
  lowSkill_lowMorale: { label: ll, short: READINESS_NEEDS.lowSkill_lowMorale.short },
  lowSkill_highMorale: { label: lh, short: READINESS_NEEDS.lowSkill_highMorale.short },
  highSkill_lowMorale: { label: hl, short: READINESS_NEEDS.highSkill_lowMorale.short },
  highSkill_highMorale: { label: hh, short: READINESS_NEEDS.highSkill_highMorale.short }
});

export const LENS_LIBRARY: LibraryLens[] = [
  {
    id: 'readiness_based', title: 'Readiness Based Leadership',
    description: DEFAULT_LENS.description,
    bestFor: 'First time and mid level managers', basedOn: DEFAULT_LENS.basedOn!, worksWith: 'six_styles',
    npcDesign: 'Each member has a skill level and a will level per task; levels shift week by week with the participant\'s actions.',
    eventDesign: 'Task assignments, performance dips, confidence drops, new joiners, stretch projects.',
    actionClassification: ['High direction', 'Direction with support', 'Shared decisions', 'High autonomy'],
    dimensions: [
      dim('diagnosing_readiness', 'Diagnosing readiness', 'an accurate read of each person\'s skill and confidence', 'Write one line per person: their skill, their confidence, and what tells you so.', 'Before each 1:1 this week, note what the person needs from you and check it with them.'),
      dim('style_fit', 'Style fit', 'a style that matches what each person needs', 'Replay one conversation from the simulation and choose the style the person needed.', 'Pick one person a day and match your approach to their readiness on purpose.'),
      dim('style_flexibility', 'Style flexibility', 'a change of approach as people\'s needs change', 'List the styles you used last week and the one you avoided.', 'Use your least used style once this week where it fits.'),
      dim('team_development', 'Team development progress', 'steps that move people toward working on their own', 'Map who could take on more in a month, and what they need first.', 'Hand one task to someone who is ready, with a clear check in.')
    ],
    styles: [
      style('D', 'D', 'High direction', 'lowSkill_lowMorale', ['Directing', 'Show the Way', 'Directing'], 'You set the task and check in closely.', 'You set the task, explain how, and check in closely on each {work}.'),
      style('G', 'G', 'Direction with support', 'lowSkill_highMorale', ['Guiding', 'Coach Along', 'Guiding'], 'You explain the why and coach as they practise.', 'You explain the why and coach while they practise on real {work}s.'),
      style('P', 'P', 'Shared decisions', 'highSkill_lowMorale', ['Partnering', 'Work Together', 'Partnering'], 'You decide together and share the work.', 'You decide together and share ownership of the work.'),
      style('E', 'E', 'High autonomy', 'highSkill_highMorale', ['Entrusting', 'Hand Over', 'Entrusting'], 'You hand over the goal and step back.', 'You hand over the goal and step back.')
    ],
    needs: READINESS_NEEDS,
    styleLine: 'To each their own. Your people need different things from you this week.',
    events: [
      { title: 'A stretch {work}', body: 'A large {work} lands that would stretch {name}. Handled well, it builds real confidence.', card: 'opportunity' },
      { title: 'Confidence dips', body: '{name} has gone quiet after a setback on a {work} and doubts whether they are cut out for it.', card: 'diagnostic' }
    ]
  },
  {
    id: 'six_styles', title: 'Six Leadership Styles',
    description: SIX_STYLES_LENS.description,
    bestFor: 'Managers who default to one style', basedOn: 'Goleman, "Leadership That Gets Results"', worksWith: 'readiness_based',
    npcDesign: 'Members react to the style used and carry that reaction into later interactions.',
    eventDesign: 'Crises, strategy shifts, conflict, low morale, tight deadlines, idea generation moments.',
    actionClassification: ['Visionary', 'Coaching', 'Affiliative', 'Democratic', 'Pacesetting', 'Commanding'],
    dimensions: [
      dim('style_range', 'Style range', 'a range of styles, chosen on purpose', 'List the six styles and the last time you used each.', 'Use one style you rarely use, in a moment where it fits, this week.'),
      dim('contextual_fit', 'Contextual fit', 'a style that suits the moment and the person', 'Replay a crisis and a calm moment from the simulation and name the style each needed.', 'Before each meeting, name the moment and the style it needs.'),
      dim('team_climate', 'Team climate impact', 'choices that lift how the team feels about its work', 'Ask two people what made last week easier or harder.', 'Hold back on pushing pace outside a real crisis for one week and notice the team.')
    ],
    styles: SIX_STYLES_LENS.styles.map((s, i) => ({
      ...s, source: ['Visionary', 'Coaching', 'Affiliative', 'Democratic', 'Pacesetting', 'Commanding'][i],
      home: (['highSkill_highMorale', 'lowSkill_highMorale', 'highSkill_lowMorale', 'highSkill_lowMorale', 'highSkill_highMorale', 'lowSkill_lowMorale'] as NeedKey[])[i],
      names: { professional: s.name, warm: ['Vision Sharer', 'Coach', 'Bridge Builder', 'Collaborator', 'Bar Raiser', 'Steady Hand'][i], direct: s.name }
    })),
    needs: SIX_STYLES_LENS.needs,
    fit: SIX_STYLES_LENS.fit,
    styleLine: 'Every moment calls for a different style. Choose the one this week needs.',
    events: [
      { title: 'A sudden crisis', body: 'A major {customers} complaint about {product} escalates overnight and the team looks to you for direction.', card: 'crisis' },
      { title: 'Ideas wanted', body: '{company} asks every team for ideas to win back slow {work}s. Your team has views but is waiting to be asked.', card: 'opportunity' }
    ]
  },
  {
    id: 'inspire_deliver', title: 'Inspire and Deliver',
    description: 'Balance people engagement against hitting targets, and see the tradeoffs play out week by week.',
    bestFor: 'Leaders owning both delivery and morale', basedOn: 'Transformational and Transactional Leadership, Burns and Bass', worksWith: 'adaptive',
    npcDesign: 'Each member has an engagement level and an output level.',
    eventDesign: 'Target pressure, recognition moments, underperformance, career conversations, vision setting.',
    actionClassification: ['Inspiring vision', 'Intellectual challenge', 'Individual attention', 'Role modelling', 'Goal setting', 'Outcome based recognition', 'Corrective action'],
    dimensions: [
      dim('team_engagement', 'Team engagement', 'a link between the work and what each person cares about', 'Write what each person cares about most at work, and how this quarter connects to it.', 'Open one 1:1 this week with the person\'s goals before the numbers.'),
      dim('delivery_performance', 'Delivery performance', 'clear actions against the target, followed through', 'Rewrite this week\'s plan as three actions with owners and dates.', 'Check progress on one target midweek, not at the end.'),
      dim('balance_index', 'Balance index', 'pressure on results without losing the team', 'Look back at last week: where did you push, and where did you support?', 'Pair every push for results this week with one moment of recognition.')
    ],
    styles: [
      style('goals', 'SG', 'Goal setting', 'lowSkill_lowMorale', ['Set Clear Goals', 'Plan It Together', 'Set Clear Goals'], 'You agree the target and the steps to it.', 'You agree a clear target for each {work} and the steps that get there.'),
      style('correct', 'CC', 'Corrective action', 'lowSkill_highMorale', ['Correct Course', 'Fix It Together', 'Correct Course'], 'You give direct feedback and fix the approach.', 'You give direct, specific feedback and fix the approach while they learn.'),
      style('attend', 'PA', 'Individual attention', 'highSkill_lowMorale', ['Personal Attention', 'Check In', 'Personal Attention'], 'You give time to the person, not only the task.', 'You give time to the person and what they need, not only the task.'),
      style('recognise', 'RR', 'Outcome based recognition', 'highSkill_lowMorale', ['Recognise Results', 'Celebrate Wins', 'Recognise Results'], 'You name what they achieved, specifically.', 'You recognise specific results, so effort feels seen.'),
      style('inspire', 'IV', 'Inspiring vision', 'highSkill_highMorale', ['Inspire the Vision', 'Share the Why', 'Inspire the Vision'], 'You connect the work to a bigger purpose.', 'You connect each {work} to where {company} is heading and why it matters.'),
      style('challenge', 'CT', 'Intellectual challenge', 'highSkill_highMorale', ['Challenge Thinking', 'Spark Ideas', 'Challenge Thinking'], 'You ask them to rethink how it is done.', 'You question the usual way and ask them to find a better one.')
    ],
    needs: needs('Unsure and slipping', 'Willing but untested', 'Delivering but flat', 'Engaged and delivering'),
    styleLine: 'Hit the number and keep the team with you. This week, choose how you lead each person.',
    events: [
      { title: 'Target pressure', body: '{company} raises the quarter\'s target. The team hears about it before you have a plan.', card: 'impact' },
      { title: 'A win nobody noticed', body: '{name} closed a difficult {work} last week. Nobody has said anything yet.', card: 'signal' }
    ]
  },
  {
    id: 'servant', title: 'Servant Leadership',
    description: 'Reward participants who remove blockers and grow their team instead of doing the work themselves.',
    bestFor: 'Agile, product and service teams', basedOn: 'Greenleaf', worksWith: 'team_amplifier',
    npcDesign: 'Members raise blockers, development needs and requests for support.',
    eventDesign: 'Dependencies, resource gaps, escalations, growth conversations, moments where taking over is tempting.',
    actionClassification: ['Listening', 'Removing blockers', 'Developing others', 'Empowering', 'Taking over'],
    dimensions: [
      dim('enablement', 'Enablement', 'blockers removed so others can do their best work', 'List the three blockers your team named most last month.', 'Remove one blocker this week and tell the team it is gone.'),
      dim('team_growth', 'Team growth', 'chances for people to grow instead of taking the work over', 'Note one task you did yourself last week that someone else could learn.', 'Hand that task over this week with support, not instructions.'),
      dim('trust', 'Trust', 'listening first and keeping promises', 'Recall one conversation where you spoke more than you listened.', 'In your next three conversations, ask before you suggest.')
    ],
    styles: [
      style('takeover', 'T', 'Taking over', 'lowSkill_lowMorale', ['Step In', 'Step In', 'Take Over'], 'You step in and do it with them.', 'You step in on the {work} yourself. It rescues the moment and slows their growth.'),
      style('develop', 'D', 'Developing others', 'lowSkill_highMorale', ['Develop', 'Grow Together', 'Develop'], 'You teach the skill they are missing.', 'You build the skill they are missing on a real {work}.'),
      style('listen', 'L', 'Listening', 'highSkill_lowMorale', ['Listen', 'Hear Them Out', 'Listen'], 'You listen first and understand what is in the way.', 'You listen first, so you understand what is really in the way.'),
      style('unblock', 'U', 'Removing blockers', 'highSkill_lowMorale', ['Unblock', 'Clear the Path', 'Unblock'], 'You clear what stops them.', 'You clear the dependency, approval or resource that stops them.'),
      style('empower', 'E', 'Empowering', 'highSkill_highMorale', ['Empower', 'Trust Them', 'Empower'], 'You hand over the decision and back them.', 'You hand over the decision and back them in front of others.')
    ],
    needs: needs('Stuck and unsure', 'Keen to grow', 'Capable but blocked', 'Ready to own it'),
    styleLine: 'Your job this week is to make their work easier. Choose how you serve each person.',
    events: [
      { title: 'Blocked by another team', body: '{name} is waiting on another team to finish their part. Three {work}s are stuck.', card: 'diagnostic', label: 'Blocker' },
      { title: 'Tempting to take over', body: 'A key {work} is going slowly and it would be quicker to do it yourself.', card: 'signal' }
    ]
  },
  {
    id: 'five_practices', title: 'Five Leadership Practices',
    description: 'Assess leadership through vision, role modelling, challenging the status quo, enabling others and recognition.',
    bestFor: 'Senior leaders and high potentials', basedOn: 'Kouzes and Posner', worksWith: 'inspire_deliver',
    npcDesign: 'Members respond to consistency between what the participant says and does.',
    eventDesign: 'Every week has at least one opportunity for each practice.',
    actionClassification: ['Model the way', 'Inspire a shared vision', 'Challenge the process', 'Enable others to act', 'Encourage the heart'],
    dimensions: [
      dim('set_example', 'Setting the example', 'actions that match what they ask of others', 'Write down the values you ask of your team and one time you lived each.', 'Do one visible thing this week that shows the standard you expect.'),
      dim('shared_vision', 'Sharing the vision', 'a future the team can picture and wants', 'Describe where your team will be in a year in three sentences.', 'Share that picture in your next team meeting and ask what it means to them.'),
      dim('question_process', 'Questioning the process', 'small experiments that improve how work gets done', 'List one process your team complains about and one experiment to try.', 'Run that experiment for a week and share what you learned.'),
      dim('enable_others', 'Enabling others', 'trust and room for others to act', 'Name one decision you could hand to the team.', 'Hand it over this week and support, without taking it back.'),
      dim('encourage', 'Encouraging the heart', 'recognition that is specific and sincere', 'List what each person contributed last month.', 'Recognise one person specifically, in front of the team, this week.')
    ],
    styles: [
      style('example', 'SE', 'Model the way', 'lowSkill_lowMorale', ['Set the Example', 'Show by Doing', 'Set the Example'], 'You show the standard by doing it yourself.', 'You show the standard on a real {work} and ask them to follow.'),
      style('enable', 'EO', 'Enable others to act', 'lowSkill_highMorale', ['Enable Others', 'Build Them Up', 'Enable Others'], 'You build their skill and trust them to act.', 'You build their skill and confidence so they can act on their own.'),
      style('encourage', 'EH', 'Encourage the heart', 'highSkill_lowMorale', ['Encourage', 'Lift Spirits', 'Encourage'], 'You recognise effort and lift their spirits.', 'You recognise their contribution and lift their spirits.'),
      style('vision', 'SV', 'Inspire a shared vision', 'highSkill_highMorale', ['Share the Vision', 'Paint the Picture', 'Share the Vision'], 'You paint a future they want to build.', 'You paint a future for {company} that they want to help build.'),
      style('question', 'QP', 'Challenge the process', 'highSkill_highMorale', ['Question the Process', 'Try Something New', 'Question the Process'], 'You invite them to change how it is done.', 'You invite them to test a better way of handling each {work}.')
    ],
    needs: needs('Looking for a lead', 'Eager to contribute', 'Capable but discouraged', 'Ready to shape the future'),
    styleLine: 'People watch what you do more than what you say. Choose how you lead each person this week.',
    events: [
      { title: 'Say and do', body: 'You asked the team to put {customers} first. This week a shortcut would help your own numbers.', card: 'signal' },
      { title: 'An old process', body: '{name} suggests a better way to handle {work}s, but it means changing a process {company} has used for years.', card: 'opportunity' }
    ]
  },
  {
    id: 'adaptive', title: 'Adaptive Leadership',
    description: 'Mix clear cut problems with change challenges, and test whether participants can tell the difference.',
    bestFor: 'Leaders driving transformation or change', basedOn: 'Heifetz', worksWith: 'inspire_deliver',
    npcDesign: 'Members show resistance, anxiety or loss when asked to change how they work.',
    eventDesign: 'Every event is tagged Technical (known fix) or Adaptive (people must change beliefs or behaviours).',
    actionClassification: ['Fixing directly', 'Stepping back to diagnose', 'Managing pressure', 'Giving the work back to the team'],
    dimensions: [
      dim('problem_diagnosis', 'Problem diagnosis', 'telling a known fix apart from a change people must make', 'Sort last month\'s problems into known fixes and changes in how people work.', 'Before you solve the next problem, ask whether it needs a fix or a change.'),
      dim('managing_pressure', 'Managing pressure', 'enough pressure to move, without overwhelming people', 'Note when the team felt too much pressure last month, and too little.', 'Name one change this week and pace it so people can keep up.'),
      dim('mobilising_change', 'Mobilising change', 'the work of change handed back to the people who must change', 'Write the change your team is facing and who needs to do what differently.', 'Ask the team to own one part of the change, and stay close.')
    ],
    styles: [
      style('fix', 'F', 'Fixing directly', 'lowSkill_lowMorale', ['Fix It', 'Sort It Out', 'Fix It'], 'You solve the problem with a known fix.', 'You solve it with a known fix, quickly and clearly.'),
      style('diagnose', 'D', 'Stepping back to diagnose', 'lowSkill_highMorale', ['Diagnose', 'Look Closer', 'Diagnose'], 'You step back and find what is really going on.', 'You step back from the {work} and find what is really going on.'),
      style('steady', 'S', 'Managing pressure', 'highSkill_lowMorale', ['Steady the Pressure', 'Ease the Load', 'Steady the Pressure'], 'You keep the pressure useful, not overwhelming.', 'You pace the change so the pressure stays useful, not overwhelming.'),
      style('giveback', 'G', 'Giving the work back to the team', 'highSkill_highMorale', ['Give It Back', 'Let Them Lead', 'Give It Back'], 'You hand the change to the people who must make it.', 'You hand the change back to the people who must make it.')
    ],
    needs: needs('Lost in the change', 'Open to change', 'Resisting the change', 'Ready to lead the change'),
    styleLine: 'Some problems need a fix and some need people to change. Choose how you lead each person this week.',
    events: [
      { title: 'A system outage', body: 'A system fault stops work on {work}s for half a day. The fix is known.', card: 'impact', label: 'Technical' },
      { title: 'A new way of working', body: '{company} changes how {work}s are handled. Some of the team feel their experience no longer counts.', card: 'signal', label: 'Adaptive' }
    ]
  },
  {
    id: 'team_amplifier', title: 'Team Amplifier Leadership',
    description: 'Track whether participants unlock their team\'s thinking or become the bottleneck.',
    bestFor: 'Strong individual contributors moving into leadership', basedOn: 'Wiseman', worksWith: 'servant',
    npcDesign: 'Each member has untapped capability that rises or falls with how much the participant stretches them.',
    eventDesign: 'Decisions, problem solving moments, stretch opportunities, debates.',
    actionClassification: ['Asking versus telling', 'Stretching people', 'Debating before deciding', 'Handing over ownership', 'Rescuing'],
    dimensions: [
      dim('talent_use', 'Talent utilisation', 'use of each person\'s full ability', 'Write each person\'s strongest ability and how much of it the work uses.', 'Give one person a task that uses an ability they rarely get to use.'),
      dim('decision_quality', 'Decision quality', 'debate before decisions, with the team\'s best thinking', 'Recall a recent decision you made alone and who could have improved it.', 'Bring the next real decision to the team as a question, then decide.'),
      dim('ownership_transfer', 'Ownership transfer', 'ownership handed over and left with the person', 'List the problems people bring you that they could own.', 'When someone brings you a problem this week, ask what they propose.')
    ],
    styles: [
      style('rescue', 'R', 'Rescuing', 'lowSkill_lowMorale', ['Rescue', 'Step In', 'Rescue'], 'You step in and solve it for them.', 'You step in and solve the {work} for them. It helps today and holds them back.'),
      style('stretch', 'S', 'Stretching people', 'lowSkill_highMorale', ['Stretch', 'Stretch Them', 'Stretch'], 'You give them a challenge just beyond what they can do.', 'You give them a {work} just beyond what they can do today.'),
      style('ask', 'A', 'Asking versus telling', 'highSkill_lowMorale', ['Ask', 'Ask First', 'Ask'], 'You ask for their thinking before you give yours.', 'You ask for their thinking before you give yours.'),
      style('debate', 'D', 'Debating before deciding', 'highSkill_lowMorale', ['Debate', 'Talk It Through', 'Debate'], 'You open the question up before deciding.', 'You open the question to debate and decide once the best thinking is in.'),
      style('handover', 'H', 'Handing over ownership', 'highSkill_highMorale', ['Hand Over', 'Let Them Own It', 'Hand Over'], 'You give them the problem and the credit.', 'You give them the whole problem, and the credit when it works.')
    ],
    needs: needs('Waiting to be told', 'Ready to be stretched', 'Holding back ideas', 'Ready to own it'),
    styleLine: 'Your team knows more than you think. Choose how you draw it out of each person this week.',
    events: [
      { title: 'A decision to make', body: 'A pricing decision on a large {work} needs an answer by Friday. You know what you would do.', card: 'opportunity' },
      { title: 'The bottleneck', body: 'Three {work}s are waiting for your sign off. The team has stopped deciding without you.', card: 'diagnostic' }
    ]
  },
  {
    id: 'client_model', title: 'Client Leadership Model',
    description: 'Upload your organisation\'s leadership framework. AI maps it into team behaviour, scoring and the report.',
    bestFor: 'Client specific builds', basedOn: 'Client provided framework', worksWith: 'readiness_based',
    npcDesign: 'Generated from the confirmed client framework.',
    eventDesign: 'Generated.', actionClassification: [], dimensions: [], styles: null,
    needs: READINESS_NEEDS,
    styleLine: 'Lead the way {company} leads. Your people need different things from you this week.',
    events: []
  }
];

export const LENS_BY_ID = Object.fromEntries(LENS_LIBRARY.map(l => [l.id, l])) as Record<LensId, LibraryLens>;

/** The KNOLSKAPE titles, the only titles a lens may carry (guardrail 1). */
export const LENS_TITLES: readonly string[] = LENS_LIBRARY.map(l => l.title);

/** Difference between a style's home need and a need: the number of ranges (skill, morale) that differ. */
export function homeFit(home: NeedKey, need: NeedKey): Fit {
  const [hs, hm] = [home.startsWith('high'), home.endsWith('highMorale')];
  const [ns, nm] = [need.startsWith('high'), need.endsWith('highMorale')];
  return ((hs !== ns ? 1 : 0) + (hm !== nm ? 1 : 0)) as Fit;
}

/** The fit table a library lens plays with. */
export function fitTable(lens: Pick<LibraryLens, 'fit'>, styles: Array<Pick<LibraryStyle, 'key' | 'home'>>): Record<NeedKey, Record<string, Fit>> {
  if (lens.fit) return structuredClone(lens.fit);
  return Object.fromEntries(NEEDS.map(n => [n, Object.fromEntries(styles.map(s => [s.key, homeFit(s.home, n)]))])) as Record<NeedKey, Record<string, Fit>>;
}

export { LENS_IDS };
