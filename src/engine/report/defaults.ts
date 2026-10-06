/**
 * Report 2.0 defaults (docs/genie/scoring-and-report.md 5 and 7). Everything here is authored copy or
 * authored numbers that GenieKreator lets an author replace; the engine only fills in facts.
 */

/** The leadership skills framework, with one behavioural anchor per level (5.4). */
export const DEFAULT_SKILLS = [
  { key: 'situational_flexibility', name: 'Situational flexibility', anchors: [
    'Uses one approach with everyone, whatever they need.',
    'Notices that people need different things, but adjusts late or not at all.',
    'Reads most people correctly and adjusts the approach to fit.',
    'Reads people early and changes approach as their needs change.',
    'Adapts naturally to each person and moment, and explains why.'] },
  { key: 'coaching_for_growth', name: 'Coaching for growth', anchors: [
    'Tells people what to do instead of helping them learn.',
    'Offers help, but mostly gives the answer.',
    'Asks questions and helps people find their next step.',
    'Builds skill deliberately, with practice and follow up.',
    'Grows people so they need less help over time.'] },
  { key: 'difficult_conversations', name: 'Handling difficult conversations', anchors: [
    'Avoids hard topics or makes them harder.',
    'Raises hard topics, but without care for how they land.',
    'Raises hard topics clearly and listens to the reply.',
    'Stays calm and fair, and moves the conversation to a next step.',
    'Turns hard conversations into trust.'] },
  { key: 'goal_setting', name: 'Goal setting and accountability', anchors: [
    'Leaves goals vague and does not follow up.',
    'Sets goals, but not specific or measurable ones.',
    'Agrees clear goals with a date.',
    'Agrees measurable goals and checks progress.',
    'Builds shared ownership of goals and holds the line fairly.'] },
  { key: 'giving_feedback', name: 'Giving feedback', anchors: [
    'Gives no feedback, or feedback that hurts.',
    'Gives general feedback without examples.',
    'Gives specific feedback with an example.',
    'Gives specific, timely feedback and agrees what changes.',
    'Makes feedback a regular, welcome part of the work.'] },
  { key: 'recognition_fairness', name: 'Recognition and fairness', anchors: [
    'Recognizes no one, or seems to play favorites.',
    'Recognizes people, but unevenly or vaguely.',
    'Recognizes specific work and treats people evenly.',
    'Recognizes the right people for the right reasons, visibly.',
    'Builds a team where people feel seen and treated fairly.'] },
  { key: 'communicating_change', name: 'Communicating change', anchors: [
    'Announces change without the why.',
    'Explains what changes, but not why or what it means for people.',
    'Explains what, why and what it means for people.',
    'Explains change clearly and invites questions and ideas.',
    'Brings people with them through change.'] },
  { key: 'results_ownership', name: 'Results ownership', anchors: [
    'Blames others for results.',
    'Talks about results without owning them.',
    'Owns the numbers and names the risks.',
    'Owns the numbers and acts on the risks early.',
    'Owns results openly and makes the team stronger for it.'] }
] as const;

/**
 * Which skills each interaction rates (5.2). Keys are action keys, plus `sponsor` (briefing), `reply`
 * (replies to messages). Static actions never create observations.
 */
export const DEFAULT_LINKAGE: Record<string, string[]> = {
  f2f: ['situational_flexibility', 'coaching_for_growth', 'difficult_conversations'],
  coach: ['situational_flexibility', 'coaching_for_growth', 'goal_setting'],
  feedback: ['situational_flexibility', 'giving_feedback', 'recognition_fairness', 'difficult_conversations'],
  email: ['giving_feedback', 'recognition_fairness', 'communicating_change'],
  meet: ['situational_flexibility', 'recognition_fairness', 'communicating_change'],
  goals: ['situational_flexibility', 'goal_setting', 'results_ownership'],
  swap: ['giving_feedback', 'communicating_change', 'difficult_conversations'],
  fire: ['giving_feedback', 'communicating_change', 'difficult_conversations'],
  sponsor: ['goal_setting', 'results_ownership'],
  reward: ['recognition_fairness', 'giving_feedback'],
  hire: ['recognition_fairness', 'results_ownership'],
  reply: ['situational_flexibility', 'difficult_conversations']
};

/** The rating scale (5.3): names and lower thresholds of the skill score. */
export const DEFAULT_SCALE = [
  { name: 'Novice', min: 0 }, { name: 'Developing', min: 40 }, { name: 'Proficient', min: 60 }, { name: 'Advanced', min: 75 }, { name: 'Role Model', min: 90 }
];

/** Narrative bank (7, Narratives): by overall level (1 to 5), capability band, and dominant style. */
export const DEFAULT_NARRATIVES = {
  overall: [
    'You are at the start of this journey. The conversations you had show where to begin: one skill at a time, with real people next week.',
    'You have the foundations. The next step is to use them every time, not only when it is easy.',
    'You lead with care and clarity most of the time. Your development is about doing it earlier and more consistently.',
    'You lead people well and adapt to what they need. Your next step is to make it look effortless under pressure.',
    'You lead the way the best leaders do: you read people, adapt, and bring the numbers with you.'
  ],
  capability: {
    low: 'Most of your style choices did not match what people needed. Start each week by asking what each person needs most: direction, guidance, partnership or room.',
    mid: 'You matched what people needed a good part of the time. The misses cluster around a few people; look at them first.',
    high: 'You matched what people needed most of the time, and corrected course when you did not.'
  },
  dominant: {
    D: 'You lean on Directing. It helps people who are new or stuck, and holds back people who are ready for more.',
    G: 'You lean on Guiding. Explaining the why builds commitment; watch for people who need you to step back.',
    P: 'You lean on Partnering. People feel heard; make sure decisions still get made and owned.',
    E: 'You lean on Entrusting. Capable people thrive; people who are still learning can feel left alone.'
  }
};

/** Development plan copy per skill (7, section 9): a practice activity and an on the job action. */
export const DEFAULT_DEVELOPMENT: Record<string, { practice: string; onTheJob: string }> = {
  situational_flexibility: { practice: 'Replay one 1:1 from the simulation and choose a different style on purpose.', onTheJob: 'On Monday, write one line per person: what they need from you this week, and why.' },
  coaching_for_growth: { practice: 'Practice a coaching conversation that asks three questions before offering any fix.', onTheJob: 'In every 1:1 this week, ask one open question before you give an answer.' },
  difficult_conversations: { practice: 'Rehearse one hard conversation out loud: the issue, its impact, and the question you will ask.', onTheJob: 'Have the conversation you have been putting off, within a week, in private.' },
  goal_setting: { practice: 'Rewrite three of your team goals so each has a number and a date.', onTheJob: 'Agree one measurable goal with each person and put the check in on the calendar.' },
  giving_feedback: { practice: 'Write feedback for one person with a specific example and the change you want.', onTheJob: 'Give one piece of specific feedback a day, within a day of what happened.' },
  recognition_fairness: { practice: 'List what each person did well last week, specifically, and who you have not recognized lately.', onTheJob: 'Recognize one specific piece of work in front of the team this week.' },
  communicating_change: { practice: 'Draft how you would explain a change: what, why, what it means for each person, and what you need from them.', onTheJob: 'Before the next change lands, tell your team the why first and ask for their questions.' },
  results_ownership: { practice: 'Prepare a three point update for your manager: where you stand, the biggest risk, what you need.', onTheJob: 'Send that update to your manager this week, before they ask.' }
};

/** Recognition phrases for conversation analytics (7, section 8), per language. */
export const DEFAULT_RECOGNITION = ['thank you', 'thanks', 'well done', 'great work', 'great job', 'appreciate', 'proud of', 'nice work', 'good work'];

/** Methodology (7, section 10): template copy; the engine adds the facts. */
export const DEFAULT_METHODOLOGY = [
  'This report comes from what you said and did in the simulation. Every number traces to an event in your run.',
  'An AI model read your words in each live conversation and judged each skill against an authored rubric. It never wrote this report: the text comes from an authored bank, filled with your results.',
  'A skill shows a level only with at least two observations from two different conversations. A conversation that went badly caps the skills it rated at Developing.',
  'Your game score (stars, streaks, badges) never changes a skill rating.'
];

// ---------------------------------------------------------------- Report 3.0 (D75, D76)

/** One line per skill: what it means, beside its level (the 1.0 report's skill definitions). Keyed by skill key. */
export const DEFAULT_SKILL_DESCRIPTIONS: Record<string, string> = {
  situational_flexibility: 'Reading what each person needs and adapting how you lead them.',
  coaching_for_growth: 'Helping people build skill through questions, practice and follow up.',
  difficult_conversations: 'Raising hard topics clearly and fairly, and moving to a next step.',
  goal_setting: 'Agreeing clear, measurable goals and following them through.',
  giving_feedback: 'Giving specific, timely feedback that people can act on.',
  recognition_fairness: 'Recognizing the right work for the right reasons, evenly across the team.',
  communicating_change: 'Explaining what changes, why, and what it means for each person.',
  results_ownership: 'Owning the numbers, naming the risks and acting on them early.'
};

/**
 * What each action is for, as the summary of actions opens each row (the 1.0 report's action lines).
 * Keyed by action key; an action without a line shows its data alone.
 */
export const DEFAULT_ACTION_COPY: Record<string, string> = {
  meet: 'Team meetings share updates, decide things together and set the tone for the whole team. Plan and time them so they help everyone.',
  energize: 'Team activities lift morale and bring people together, when the team needs it.',
  email: 'An email in the right tone recognizes progress or flags a problem, and opens a two way conversation.',
  training: 'Training builds skill and shows you invest in people, when it matches what they need to learn.',
  swap: 'Moving people to roles that suit them can lift results, when you assess them first.',
  hire: 'Hiring adds capacity, and a good interview starts the relationship well.',
  fire: 'Letting someone go affects everyone who stays. How you handle it matters.',
  f2f: 'A one to one in the style the person needs builds the relationship and opens up what is really going on.',
  assess: 'Assessing someone before you move them shows where they will do well.',
  reward: 'Rewarding the right person at the right time recognizes performance and lifts morale.',
  goals: 'Clear priorities help people focus on what matters. Set them in the way the person needs.',
  coach: 'Coaching builds skill and results, when you choose the right person and the right style.',
  feedback: 'The right feedback at the right time keeps morale up and performance on track.'
};

/**
 * Narrative banks by purpose (D75). Development copy frames every finding as the next step and how to
 * use it at work, and never uses verdict words; assessment copy states the finding in neutral, evidence
 * based words. Placeholders: {skill}, {style}, {styles}, {needs}, {action}, {share}, {pct}, {unit}, {bar}.
 * Level lists (`overall`, `skill`) are read in proportion to the rating scale, lowest level first. Without
 * `overall`, a purpose uses `narratives.overall` (development does).
 */
export const DEFAULT_PURPOSE_COPY = {
  development: {
    about: [
      'In this simulation you led a sales team as its manager, with a target to reach. Every {unit} you chose how to lead each person, took actions and talked with your people, and their skill, morale and results moved with what you did.',
      'This report is for you. It shows what worked, what to try next, and how to take it into your real job.'
    ],
    howToRead: [
      'Each section starts with what happened in your run, then gives you the next step.',
      'The numbers come from your run. The words come from an authored bank, filled in with your results.',
      'Every chart has a table version: use Show as table to read the numbers.'
    ],
    confidentiality: 'This report is confidential. It is for you, and for the people your program names. Please do not share it more widely.',
    skill: [
      '{skill} is the place to start. Pick one conversation this week where it matters, and plan what you will say before you go in.',
      '{skill} is beginning to show. The next step is to use it every time, not only when it is easy: try it in your next three conversations.',
      '{skill} is a solid part of how you lead. To grow it, use it earlier, before a problem forces it.',
      '{skill} is one of your best skills. Keep it sharp under pressure, and help someone on your team learn it from you.',
      '{skill} is a model for others. Show your team how you do it, so they can do it without you.'
    ],
    skillNone: '{skill} did not come up often enough to rate. Look for a chance to use it in your next conversations at work.',
    objectives: {
      below: 'Your team reached {share} of the target. Revenue follows people: find who was furthest from what they needed, and start there next time.',
      near: 'Your team came close, at {share} of the target. The gap is usually a few people in one stage: find the stage that held you back and plan how you would lead its people differently.',
      met: 'Your team reached {share} of the target. Notice what you did that made it happen, so you can repeat it with your real team.'
    },
    adaptability: {
      low: '{pct}% of your style choices fit what people needed. Next time, read each person first: how able they are and how keen they are, then choose how to lead them.',
      mid: '{pct}% of your style choices fit what people needed. The next step is to notice when someone changes, and change how you lead them with it.',
      high: '{pct}% of your style choices fit what people needed, and you changed course as people changed. Keep doing this at work: check what each person needs every week, not once.'
    },
    style: {
      unused: 'You did not use {style}. It suits people who are {needs}: when you meet someone like that at work, try it.',
      low: '{style} rarely fit when you used it. Keep it for people who are {needs}, and hold back with others.',
      mid: '{style} fit about half the times you used it. Keep it for people who are {needs}.',
      high: '{style} fit most of the times you used it. You read when it was needed: keep doing that.',
      under: 'People needed {style} more often than you used it.',
      over: 'You used {style} more often than people needed it.'
    },
    preferred: 'Your preferred style is {styles}: you used it most. Notice when you reach for it out of habit, and check it is what the person needs.',
    consistency: {
      neededUsed: {
        low: 'What you did with people mostly matched what they needed. Keep checking before each conversation.',
        mid: 'What you did with people matched what they needed about half the time. Before each conversation, decide which style the person needs, then hold to it.',
        high: 'What you did with people often missed what they needed. Before each conversation, look at the person\'s skill and morale and pick the style that fits them, not the one that comes naturally.'
      },
      intendedUsed: {
        low: 'You mostly led people the way you planned to. Your team can predict you, and that builds trust.',
        mid: 'You led people the way you planned to about half the time. Write down your plan for each person and check it before you talk to them.',
        high: 'How you led people in conversations often differed from what you planned. When plans and words differ, people get mixed signals: decide on purpose, then follow through.'
      },
      neededIntended: {
        low: 'Your plans mostly matched what people needed: you read people well.',
        mid: 'Your plans matched what people needed about half the time. Look at skill and morale separately before you plan.',
        high: 'Your plans often missed what people needed. Start each week by reading each person\'s skill and morale, then plan.'
      }
    },
    actions: {
      unused: 'You did not use {action}. Think about who on your team could have needed it, and when.',
      none: '{action} made no visible difference to your people. Use it when it gives someone what they need.',
      veryLow: '{action} set people back more than it helped. Next time, check what the person needs before you choose it, and use the approach that fits.',
      low: '{action} did little for your people. Time it better and fit it to the person, so it lands.',
      moderate: '{action} helped your people. Look at what made it work and do it more often, with the people who need it.',
      high: '{action} made a real difference to your people. Keep using it, and notice who has not had it yet.'
    }
  },
  assessment: {
    about: [
      'In this simulation the participant led a sales team as its manager, with a target to reach. Every {unit} they chose how to lead each person, took actions and held conversations, and the team\'s skill, morale and results moved with what they did.',
      'This report sets out the evidence from the run against the bar set for this assessment.'
    ],
    howToRead: [
      'The overall verdict compares the results with the bar: {bar}.',
      'Each verdict lists the conversations it rests on, and whether an assessor reviewed them.',
      'A skill shows a level only with at least two observations from two different conversations.',
      'Every chart has a table version: use Show as table to read the numbers.'
    ],
    confidentiality: 'This report is confidential. It is for the participant and for the people the organization has authorized to see assessment results.',
    overall: [
      'Overall, the evidence shows the skills at an early stage.',
      'Overall, the evidence shows the foundations of the skills, used inconsistently.',
      'Overall, the evidence shows the skills used consistently, as the role expects.',
      'Overall, the evidence shows the skills used consistently and early, including under pressure.',
      'Overall, the evidence shows the skills used to a standard others can learn from.'
    ],
    skill: [
      '{skill}: the evidence shows this rarely, or in ways that did not help the person.',
      '{skill}: the evidence shows this at times, without consistency.',
      '{skill}: the evidence shows this consistently, as the role expects.',
      '{skill}: the evidence shows this consistently and early, including under pressure.',
      '{skill}: the evidence shows this in every relevant conversation, to a standard others can learn from.'
    ],
    skillNone: '{skill}: there was not enough evidence to rate this.',
    objectives: {
      below: 'The team reached {share} of the target, well short of it.',
      near: 'The team reached {share} of the target, short of it.',
      met: 'The team reached {share} of the target.'
    },
    adaptability: {
      low: '{pct}% of style choices fit what people needed. Adaptability was low.',
      mid: '{pct}% of style choices fit what people needed. Adaptability was moderate.',
      high: '{pct}% of style choices fit what people needed. Adaptability was high, and choices followed changes in people\'s needs.'
    },
    style: {
      unused: '{style} was not used.',
      low: 'When used, {style} seldom fit what people needed.',
      mid: 'When used, {style} fit what people needed about half the time.',
      high: 'When used, {style} mostly fit what people needed.',
      under: '{style} was used less often than people needed it.',
      over: '{style} was used more often than people needed it.'
    },
    preferred: 'The preferred style was {styles}, used in {pct}% of style choices.',
    consistency: {
      neededUsed: {
        low: 'Styles used in conversations mostly matched what people needed.',
        mid: 'Styles used in conversations matched what people needed about half the time.',
        high: 'Styles used in conversations often did not match what people needed.'
      },
      intendedUsed: {
        low: 'Styles used in conversations mostly matched the styles planned.',
        mid: 'Styles used in conversations matched the styles planned about half the time.',
        high: 'Styles used in conversations often differed from the styles planned.'
      },
      neededIntended: {
        low: 'Planned styles mostly matched what people needed.',
        mid: 'Planned styles matched what people needed about half the time.',
        high: 'Planned styles often did not match what people needed.'
      }
    },
    actions: {
      unused: '{action} was not used.',
      none: '{action} produced no change in skill, morale or result.',
      veryLow: '{action} lowered skill, morale or result on balance.',
      low: '{action} had little effect on skill, morale or result.',
      moderate: '{action} raised skill, morale or result moderately.',
      high: '{action} raised skill, morale or result strongly.'
    }
  }
};

/** Food for thought: reflective questions, each with a guiding line (the 1.0 report's closing questions). */
export const DEFAULT_THOUGHT = [
  { question: 'Did you give time to every person on your team? Why did some get more of your attention than others?', guide: 'Regular time with every person is how you keep results on track.' },
  { question: 'Could an unconscious bias have shaped who you spent time with, or how you treated them?', guide: 'People notice bias, even when it is unconscious, and it lowers morale.' },
  { question: 'Which actions did you reach for most, and why those?', guide: 'The way you manage often mirrors the way you like to be managed. Your people may need something else.' },
  { question: 'Why did the same action help one person and set another back?', guide: 'Impact depends on the person and the moment. Keep reading people, checking and adapting.' }
];

/** Key takeaways (the 1.0 report's closing points). */
export const DEFAULT_TAKEAWAYS = [
  'Results come through people: skill and morale together drive performance.',
  'Keep talking with your people and get to know them. It shows you what each one needs.',
  'Assess people regularly, and build their skills when they need it.',
  'Give specific feedback and coach when it helps. The right attention lifts morale.',
  'Stretch people, support them and recognize their wins, so good performance lasts.',
  'Choose how you lead each person from their skill and morale, and change it as they change.'
];

/** The development plan's 30, 60 and 90 day path. {skills} is the skills to develop. */
export const DEFAULT_PATH = {
  day30: 'Days 1 to 30: practice {skills} in your one to ones. After each, note what you said and how the person responded.',
  day60: 'Days 31 to 60: ask two people on your team how you lead them, what helps and what does not, and adjust.',
  day90: 'Days 61 to 90: review your notes with your manager or a coach, and choose the next skill to work on.'
};

/**
 * Assessment (D75): the bar, as positions on the rating scale (0 is the lowest level), and the verdict
 * labels. The default bar is an overall level of Proficient (2) with no skill below Developing (1).
 */
export const DEFAULT_ASSESSMENT = {
  bar: { overall: 2, floor: 1 },
  labels: { exceeds: 'Exceeds the bar', meets: 'Meets the bar', approaching: 'Approaching the bar', below: 'Below the bar', insufficient: 'Not enough evidence for a verdict' },
  skillLabels: { strength: 'Strength', meets: 'Meets', development: 'Development need' }
};

/**
 * Impact bands for the summary of actions and the distribution matrix (D76), from the mean net change
 * in skill + morale + result an action made per person it reached: under `low` is very low (it set
 * people back), from `moderate` moderate, from `high` high, and in between low. An action never used,
 * or one that changed nothing, has no impact.
 */
export const DEFAULT_IMPACT = { low: -2, moderate: 3, high: 10 };

/** The 1.0 report's consistency actions (Meet the Team, Meet Face to Face, Set Goals, Coach Member, Give Feedback) as action keys. */
export const DEFAULT_CONSISTENCY_ACTIONS = ['meet', 'f2f', 'goals', 'coach', 'feedback'];
