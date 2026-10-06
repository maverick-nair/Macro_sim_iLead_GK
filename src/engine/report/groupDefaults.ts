/**
 * The group report's narrative bank (D75, D77): authored copy GenieKreator can replace as a whole
 * (`report.group.copy`). The group report is for the organization, so it speaks about the group, never
 * about one participant. Adapted from the intent of the 1.0 group report and rewritten in iLead's copy
 * style: "skills", no dashes, no emojis, US spelling.
 *
 * Placeholders: {diff} ("1 point", "0.6 points"), {n} participants, {completed}, {min}, {pct}, {share}, {unit}, {count} (periods),
 * {skill}, {style}, {styles}, {needs}, {action}, {best}, {actual}, {ideal}, {diff}, {met}, {total}.
 * Level lists (`skill`) are read in proportion to the rating scale, lowest level first.
 */
export const DEFAULT_GROUP_COPY = {
  about: [
    'In this simulation each participant led a sales team as its manager, with a target to reach. Every {unit} they chose how to lead each person, took actions and held conversations, and the team\'s skill, morale and results moved with what they did.',
    'This report brings together the results of {n} participants from your organization. It shows how the group led, where it is strong and where it can grow.'
  ],
  howToRead: [
    'Group: the average of the participants from your organization who completed the simulation. Participants who stopped part way count only in the completion rate.',
    'Each section shows what the group did, then asks questions to discuss with your leaders. Key takeaways at the end gather those questions by section.',
    'Look for patterns and ask what causes them: the answers often say more about the organization than about any one leader.',
    'Every chart has a table version: use Show as table to read the numbers.'
  ],
  benchmark: 'Benchmark: the average of everyone who has played this simulation so far ({n} participants).',
  confidentiality: {
    development: 'This report is confidential to your organization. It shows group results only: no participant is named or ranked, and results are withheld for groups of fewer than {min} participants.',
    assessment: 'This report is confidential. It names participants and their verdicts, so share it only with the people your organization has authorized to see assessment results.'
  },
  withheld: 'Group results are withheld for now. {completed} of {n} participants completed the simulation, and this report needs at least {min} to keep individual results private. The results appear once at least {min} participants have completed the simulation.',
  completion: '{completed} of {n} participants completed the simulation ({pct}%).',
  skill: [
    'The group is at an early stage in {skill}. Most participants rarely showed it, or showed it in ways that did not help the person. This is the place to start.',
    'The group shows the beginnings of {skill}, used inconsistently. Participants need practice using it every time, not only when it is easy.',
    'The group uses {skill} consistently, as the role expects. The next step is to use it earlier, before a problem forces it.',
    'The group uses {skill} consistently and early, including under pressure. Look at what makes it work, so others can learn it.',
    'The group uses {skill} to a standard others can learn from. Ask these leaders to help others grow it.'
  ],
  skillNone: 'Too few participants showed {skill} for a group level.',
  compare: {
    above: 'The group is {diff} above the benchmark.',
    level: 'The group is in line with the benchmark.',
    below: 'The group is {diff} below the benchmark.'
  },
  business: {
    below: 'On average the group reached {share} of the target. Revenue follows people: the gap usually starts with team members whose skill or morale held a stage of the funnel back.',
    near: 'On average the group came close, at {share} of the target. The gap is usually a few people in one stage of the funnel.',
    met: 'On average the group reached {share} of the target.'
  },
  adaptability: {
    low: 'On average {pct}% of the group\'s style choices fit what people needed. Reading each person\'s skill and morale before choosing how to lead them is the biggest lever for this group.',
    mid: 'On average {pct}% of the group\'s style choices fit what people needed. Participants often read people well, but did not always change how they led as people changed.',
    high: 'On average {pct}% of the group\'s style choices fit what people needed. The group reads people well and adapts as their needs change.'
  },
  preferred: '{styles} was the style the group preferred: the most used style for {pct}% of participants.',
  style: {
    unused: 'The group did not use {style}. It suits people who are {needs}.',
    low: 'When the group used {style}, it seldom fit what people needed. It suits people who are {needs}.',
    mid: 'When the group used {style}, it fit what people needed about half the time. It suits people who are {needs}.',
    high: 'When the group used {style}, it mostly fit what people needed.',
    under: 'People needed {style} more often than the group used it.',
    over: 'The group used {style} more often than people needed it.'
  },
  consistency: {
    neededUsed: {
      low: 'What the group did in conversations mostly matched what people needed.',
      mid: 'What the group did in conversations matched what people needed about half the time.',
      high: 'What the group did in conversations often missed what people needed.'
    },
    intendedUsed: {
      low: 'The group mostly led people the way it planned to.',
      mid: 'The group led people the way it planned to about half the time.',
      high: 'How the group led people in conversations often differed from its plan. When plans and words differ, people get mixed signals.'
    },
    neededIntended: {
      low: 'The group\'s plans mostly matched what people needed: it reads skill and morale well.',
      mid: 'The group\'s plans matched what people needed about half the time.',
      high: 'The group\'s plans often missed what people needed. Reading skill and morale separately before planning would help.'
    }
  },
  funnel: 'Over {count} {unit}s the group averaged {actual} conversions against an ideal of {ideal}: {pct}% of what was possible.',
  actions: 'The action the group used most was {action}. The action that did the most for the people it reached was {best}.',
  attention: {
    top: 'The group spent most of its one to one time with top performers.',
    average: 'The group spent most of its one to one time with average performers.',
    bottom: 'The group spent most of its one to one time with bottom performers.',
    even: 'The group spread its one to one time evenly across top, average and bottom performers.'
  },
  verdicts: '{met} of {total} participants met or exceeded the bar.',
  prompts: {
    skills: [
      'Is there a level where the group gathers, across skills? Is there a skill where most of the group sits at the lower or the higher levels?',
      'Does this reflect your organization\'s culture, or is there another reason?'
    ],
    business: [
      'Compare conversions and revenue with skill, morale and result. Do they move together, for the group and for the benchmark?'
    ],
    styles: [
      'Reading people and knowing how they want to be led has the most impact on choosing the right style. What would help the group read people better?'
    ],
    funnel: [
      'Look at the gap between the two lines: how well did the group use the opportunities it had?',
      'Note when most conversions happened. A line that rises week by week shows the group learning from what it did.'
    ],
    actions: [
      'Why were some actions taken often and others rarely?',
      'Group the actions by what they build: skill, morale or direction. Does the group have a preferred way of driving results?',
      'How did the actions taken move skill, morale and result?'
    ],
    attention: [
      'Is how the group spent its time a reflection of your organization\'s or team\'s culture?',
      'Link this with the results: how does time with each group of performers affect conversions and revenue?'
    ]
  },
  takeaways: [
    { key: 'skills', title: 'Skills', questions: [
      'What in your organization helps some skills show more strongly than others?',
      'Does your culture help people develop the skills they find hardest?'
    ] },
    { key: 'leadership', title: 'Leadership approach', questions: [
      'What does the group\'s preferred style say about your culture, or about how people are managed?',
      'What messages and assumptions about managing people pass through the levels of your organization? What do your managers assume?',
      'Does the preferred style point to a subculture in a function, a leader or a location?'
    ] },
    { key: 'results', title: 'Driving results', questions: [
      'Does your organization use all the tools it has for driving results?',
      'Are there ways for people to keep learning on the job, and to use what they learn to correct course?',
      'Are all the chances to reach results being explored and used?',
      'Are people making full use of what your organization offers to build skill and motivation?'
    ] },
    { key: 'styles', title: 'Leadership styles', questions: [
      'Can managers get to know their people continuously, and build their skill and motivation in ways that suit them?',
      'Do you check whether what you do to build skill and motivation works?',
      'Are managers choosing how to lead each person on purpose?'
    ] },
    { key: 'actions', title: 'Actions that drive results', questions: [
      'Does your organization focus mostly on building skills and moving people up?',
      'Does it prefer to build morale and push people to succeed that way, or to inspire people and lead them to success?',
      'Do the ways your managers lead people get the results you need?'
    ] },
    { key: 'attention', title: 'Management style', questions: [
      'Does your organization nurture its bottom performers, building their skill and morale so they can succeed? Or does it work mostly with top performers and push them further?'
    ] }
  ]
};

export type GroupCopy = typeof DEFAULT_GROUP_COPY;

/** The group report's settings (D77): withheld below `minimumCohort` participants in development; aggregates read runs at `completeAt`% or more. */
export const DEFAULT_GROUP = { minimumCohort: 5, completeAt: 100 };
