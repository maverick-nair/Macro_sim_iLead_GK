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
    'Recognizes no one, or seems to play favourites.',
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
  coaching_for_growth: { practice: 'Practise a coaching conversation that asks three questions before offering any fix.', onTheJob: 'In every 1:1 this week, ask one open question before you give an answer.' },
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
