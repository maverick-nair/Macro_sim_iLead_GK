import type { Heard } from './syntheticListen';

/**
 * What the offline synthetic players say (D151): banks of phrasings, written the way managers at each level
 * talk, and never built from the evaluator's cue lists. Whether the evaluator reads each line the way it was
 * meant is measured (evaluator agreement in the results), not assumed. `{name}` is the person's first name.
 *
 * Levels: 0 Beginner (blunt, closed, tells), 1 Developing (polite, generic), 2 Proficient (acknowledges,
 * asks, shows the style, agrees a step), 3 Expert (listens first, asks what is on their mind, adapts,
 * invites ideas, agrees a dated step, keeps a promise small).
 */

type ByLevel = [string[], string[], string[], string[]];

/** Readiness Based Leadership's styles, by name: a full line and a blunt one, several ways each. */
export const STYLE_LINES: Record<string, { full: string[]; blunt: string[] }> = {
  Directing: {
    full: [
      'Here is the plan, step by step: first the call list, then the follow ups.',
      'I need you to send me the call list by tomorrow, and I will check in with you daily.',
      'First, three calls before noon. Then the two proposals. I will check how it went each afternoon.',
      'I will tell you exactly what to do this week: the follow ups first, then the new leads, and I will look in on you every day.',
      'Let me be specific: five qualified calls a day, logged before you leave, and I will review the log with you each morning.',
      'Do the three overdue follow ups today, then send me a note. I need to see each one done.',
      'Here is my plan for you this week, in order: the call list, then the demos, then the proposals.',
      'I will set the tasks for this week and check in with you every day until they are done.'
    ],
    blunt: ['I need you to do better this week.', 'Just do what I tell you this week.', 'Get the call list done. That is it.', 'Do the follow ups, and do them today.', 'You need to hit your numbers. Do it.']
  },
  Guiding: {
    full: [
      'Let me explain why this matters for the funnel, and the reason behind each step.',
      'I will coach you on the next two calls. Does that make sense?',
      'The reason we follow up within a day is that leads go cold fast. I will show you how I do it.',
      'Before your next call, rehearse the opening with me and I will explain what works and why.',
      'I will sit in on your next demo and coach you afterwards, so you can see the difference it makes.',
      'Here is the thinking behind the new process, so it makes sense before you try it.',
      'Try the new opening on your next call, and afterwards I will walk you through what went well and why.',
      'I want you to understand why proposals stall at this stage, so let me take you through an example and then you practise one.'
    ],
    blunt: ['Let me explain how it works, just follow it.', 'Watch how I do it and copy that.', 'I will show you once, then you do it.', 'There is a right way to do this. Learn it.']
  },
  Partnering: {
    full: [
      "Let's work this out together. What do you think we should change?",
      'How can I help this week? Your ideas matter here.',
      'I would like us to decide this together, so tell me what you would try first.',
      'You know these accounts well. What do you think the plan should be?',
      'We can share this one: you lead the calls, I take the pricing, and we agree the next step together.',
      'I want your view before we decide anything. What would you suggest?',
      "Let's look at the options side by side and pick one we both believe in.",
      'This is a shared plan, so tell me where you would start and I will back it.'
    ],
    blunt: ["Let's just get on with it.", 'We will figure it out somehow.', 'We are in this together, so get going.', "Let's see how it goes."]
  },
  Entrusting: {
    full: [
      'I trust you with this, and it is your call how you run the account.',
      'You decide the next step, and I will step back.',
      'The goal is yours. Run it the way you think best, and come to me only if you need me.',
      'I trust you to lead this. I will stay out of the way.',
      'Own this account from here. Tell me the outcome, not the steps.',
      'You know what good looks like, so it is up to you how you get there.',
      'Pick the approach you believe in. It is your call, and I will not second guess it.',
      'This is yours to run. I am here if you want a sounding board.'
    ],
    blunt: ['It is up to you, sort it out.', 'Do whatever you think, I am busy.', 'You handle it. I do not need the details.', 'Not my problem, you deal with it.']
  }
};

/** Frames for a lens style without written lines: the style's own words in the first person. */
export const STYLE_FRAMES = ['{line}', 'This week, {lower}', 'Here is how I want to handle it: {lower}', 'For now, {lower}', 'With this one, {lower}'];

export const GREET: ByLevel = [
  [],
  ['Thanks, {name}.', 'Hi {name}, thanks for this.', 'Thanks for the update, {name}.', 'Good to catch you, {name}.', 'Okay {name}, thanks.', 'Morning, {name}.'],
  ['Thanks for making time, {name}.', 'Thanks for coming in, {name}.', 'Good to see you, {name}, thanks for the time.', 'Thanks for sitting down with me, {name}.', 'Glad we found a moment, {name}.', 'Thanks for fitting this in, {name}.'],
  ['Thanks for making time, {name}, I appreciate it.', 'Thank you for coming in, {name}, I appreciate it.', 'Good to see you, {name}. I am glad we have some time.', 'Thanks for sitting down with me, {name}. I have been looking forward to this.', 'Thanks for fitting this in, {name}. I know your week is full.', 'I appreciate you making the time, {name}.']
];

/** Answering the person's opening question ("What is it about?"). */
export const ANSWER_OPENING: ByLevel = [
  ['It is about your numbers.', 'Your results, mainly.', 'Just the numbers.', 'We need to talk about output.', 'It is about this week.'],
  ['Just a quick check in on how things are going.', 'Nothing big, a catch up on the week.', 'I wanted a quick word about the pipeline.', 'A short catch up, that is all.'],
  ['Nothing is wrong, I wanted a proper check in on how you are doing.', 'Nothing serious. I wanted to hear how the week is going for you.', 'All fine, I just wanted some time with you on the work.', 'No problem at all, a check in on how things are going.'],
  ['Everything is fine. I wanted to hear how things are for you, and see what would help.', 'Nothing is wrong at all. I wanted to make sure you have what you need.', 'All good. I wanted some time to listen, more than to talk.', 'Nothing to worry about. I wanted to understand how things look from where you sit.']
];

/** Answering an opening that carries a feeling or a worry ("Honestly, it has been a rough week."). */
export const MEET_FEELING: ByLevel = [
  ['We all have those weeks.', 'Everyone is busy.', ''],
  ['Okay.', 'Right, okay.', 'I see.'],
  ['I am sorry to hear that.', 'I hear you, that does not sound easy.', 'Thanks for saying so.'],
  ['I am sorry it has been a rough one, and I am glad you said so.', 'Thank you for being straight with me about it.', 'That matters, and I want to hear more about it.']
];

export const OPEN_QUESTION = ['How are things going with your work this week?', 'How is your week going so far?', 'What is going well, and what is getting in the way?', 'How are you finding the work at the moment?', 'What has been taking most of your time lately?', 'How do you feel the last few weeks have gone?'];

export const CONCERN_QUESTION = ['What is on your mind this week?', 'What is really going on for you at the moment?', 'How are you feeling about the work right now?', 'What has been on your mind lately?', 'How are you doing, honestly?', 'Before anything else, how are you feeling about things?'];

/** An Expert who heard only an update from someone who looks worried looks a little deeper. */
export const DEEPER = ['And how are you feeling about it all?', 'Is anything else on your mind?', 'What is really going on underneath that?', 'How are you doing with it, honestly?'];

/** Coming back to a worry the person shared before. */
export const FOLLOW_CONCERN = ['Last time you told me what was worrying you. Is that still on your mind?', 'I have been thinking about what you shared with me. How are you feeling about it now?', 'You mentioned something was weighing on you. How is that going?'];

/** What the player says to what it just heard, by level. */
export const REACT: Record<Exclude<Heard, 'none'>, ByLevel> = {
  concern: [
    ['Okay.', 'Right.', 'Fine.'],
    ['Okay, I see.', 'Right, understood.', 'Okay, that is useful to know.'],
    ['I understand, that is a lot to carry.', 'I hear you. Thanks for telling me.', 'That makes sense, and I am glad you said it.', 'I see why that is hard.'],
    ['Thank you for telling me, that sounds hard.', 'I am glad you told me. That is a real worry, and it makes sense.', 'So what I am hearing is that this has been weighing on you. Thank you for trusting me with it.', 'That is not easy, and I appreciate you being open about it.']
  ],
  emotional: [
    ['Okay.', 'Right.', 'Fine.'],
    ['Okay, I see.', 'Right, thanks.', 'Good to know.'],
    ['I hear you.', 'Thanks for being honest about it.', 'I understand.'],
    ['Thank you for being honest with me about how it feels.', 'I can hear that, and it matters to me.', 'That makes sense, given the week you have had.']
  ],
  agreement: [
    ['Good.', 'Fine.', 'Right.'],
    ['Good, thanks.', 'Great.', 'Okay, good.'],
    ['Good, thank you.', 'Great, that works.', 'Good, that helps.', 'Perfect.'],
    ['Good, I appreciate that.', 'Thanks, that is a good place to start.', 'Great, that gives us something to build on.', 'Perfect, thank you.']
  ],
  pushback: [
    ['Just do it.', 'That is how it is.', 'No excuses.'],
    ['Give it a try anyway.', 'I know, but it is worth a go.', 'Okay, but we need to move on it.'],
    ['I hear you. What would make it work for you?', 'Fair enough. What would you change?', 'That is a fair point. What would help?'],
    ['Fair challenge, and I want to get this right. What would you do differently?', 'You may be right. Tell me what is missing.', 'I would rather hear that now than later. What would work better for you?']
  ],
  question: [
    ['Because I said so.', 'You know why.', 'It does not matter.'],
    ['Good question.', 'Fair question.', 'Okay, let me answer that.'],
    ['Fair question, let me answer it.', 'Good question, here is my thinking.', 'Happy to explain.'],
    ['Good question, and thanks for asking it.', 'I am glad you asked.', 'Fair question, and you deserve a straight answer.']
  ],
  update: [
    ['Okay.', 'Right.', 'Fine.'],
    ['Okay, thanks.', 'Right, thanks for that.', 'Good to hear.'],
    ['Thanks, that helps me see where things are.', 'Thanks for the update.', 'That is useful, thank you.'],
    ['Thanks, that is useful to know.', 'That helps me understand where things are.', 'Thanks for walking me through that.']
  ]
};

/** An Expert tying its approach to what it heard. */
export const ADAPT = ['Given where you are right now, here is my approach.', 'From what you have said, here is how I would like to handle it.', 'With that in mind, here is what I suggest.', 'Based on where you are, this is how I would like us to go about it.', 'For now, here is my approach.'];

/** A specific, kind observation, by what the person's numbers show. */
export const OBSERVE: Record<'result' | 'morale' | 'strong', string[]> = {
  result: ['I noticed the follow ups slipped last week, because the calls ran long.', 'I noticed two calls slipped last week, because the day ran long.', 'I saw that two proposals waited three days, because the pricing came back late.'],
  morale: ['I noticed you have been quieter in team meetings lately, and I wanted to check in.', 'I noticed you stayed late most of last week, because the follow ups piled up.', 'I saw the last two deals fell through, and I know that stings.'],
  strong: ['I noticed how well the last client call went, because you prepared the numbers early.', 'I saw that you closed two follow ups ahead of time last week, and it showed.', 'I noticed the team leaned on you last week, because you know the accounts best.']
};

export const REFLECT = ['What would you change so that you can learn from it?', 'What would you change next time, so that it gets easier?', 'What would make the biggest difference for you?', 'What do you need from me to make this work?', 'How would you approach it yourself?'];

export const INVITE = ['What would help you most?', 'What would make the biggest difference for you?', 'What support do you need from me?', 'What would you add to that?', 'What would make this easier for you?'];

export const NEXT_STEP: ByLevel = [
  [],
  ['Keep going and let me know how it goes this week.', 'Keep me posted this week.', 'Let me know how you get on.', 'Carry on and update me on Friday.', 'Send me a quick note at the end of the week.'],
  ['Can we agree the next step by Friday?', 'Let us agree one next step by Friday.', 'Shall we pick the next step and a date, say Thursday?', 'Can we settle on one thing to do by Friday?'],
  ['Can we agree the next step by Friday?', 'Let us agree one clear next step and a date: Friday?', 'Can we write down the next step now, and when it is due? Thursday works for me.', 'Shall we name one thing for this week, due by Friday?']
];

export const START = ['How would you like to start?', 'How would you like to begin?', 'What will you do first?', 'Where would you like to begin?'];

export const PROMISE: ByLevel = [
  ['I will look into it this week.', 'I will sort something out this week.'],
  ['I will follow up with you by Friday.', 'I will check in with you by Friday.', 'I will get back to you by Thursday.'],
  ['I will check in with you by Friday.', 'I will follow up with you by Friday.', 'I will send you the numbers by tomorrow.'],
  ['I will check in with you by Friday.', 'I will follow up with you by Thursday.', 'I will send you the account notes by tomorrow.']
];

export const THANKS = ['Thanks for your time.', 'Thanks for talking it through with me.', 'Thanks, I appreciate you being so open.', 'Thanks for today.'];

export const SLIP = ['Honestly, this is your fault. Fix it.', 'This is all your fault, and you need to fix it.', 'You always mess up the follow ups.', 'It is your fault the numbers are down.'];

// ------------------------------------------------------------------------------------------------ team meeting

export const MEETING_OPEN: ByLevel = [
  ['Team, we need better numbers this week. That is all.', 'Right, everyone. Numbers are down. Fix them.', 'Listen up. This week has to be better.'],
  ['Thanks for coming, everyone.', 'Morning, all. Thanks for being here.', 'Thanks for joining, everyone.'],
  ['Thanks for coming, everyone. Today we have three things: the pipeline, the risks and the next steps.', 'Thanks, all. Three things today: where the pipeline stands, what is at risk, and what we do next.', 'Morning, everyone. On the agenda: the pipeline first, then the risks, then the next steps.'],
  ['Thanks for coming, everyone, I appreciate it. Today we have three things: the pipeline, the risks and the next steps. The goal is to protect the target.', 'Thanks for being here, all of you. Three things today, the pipeline, the risks and our next steps, and the goal is to leave with a plan we all own.', 'Morning, everyone, and thanks. The agenda is short: the pipeline, then the risks, then next steps, so we protect the target.']
];
export const MEETING_FLOOR = ['{name}, what is the pipeline looking like from where you sit?', '{name}, what are you seeing on your accounts this week?', '{name}, can you start us off: what is working and what is stuck?'];
export const MEETING_INVITE = ['What do you all think?', 'Does anyone see it differently?', 'What would you add, anyone?', 'What are we missing?'];
export const MEETING_CLOSE: ByLevel = [
  [],
  ['Let me know how it goes this week.', 'Keep me posted, everyone.', 'Okay, back to it.'],
  ['What do you all think? Can we agree the next steps by Friday?', 'Can we agree who does what by Friday?', 'Let us agree the next steps and owners by Friday.'],
  ['Can we agree the next steps by Friday? Thanks, everyone, for your time.', 'Let us agree owners and dates now, by Friday at the latest. Thank you, everyone.', 'Before we close, can we agree each next step and who owns it, by Friday? Thanks, all.']
];

// ------------------------------------------------------------------------------------------------ sponsor

export const SPONSOR: ByLevel = [
  ['Things are fine. The team just needs to work harder.', 'We are okay. The team needs a push, that is all.', 'All under control. People just need to try harder.'],
  ['We are a bit behind, but I will push the team this week.', 'Not quite where we want to be, but I think we will get there.', 'It is a bit slow, but the team is working on it.'],
  ['Honestly, we are at {share}% of target and behind on {behind} stages.', 'To be straight with you, we are at {share}% of target, with {behind} stages behind where they should be.', 'We are at {share}% of target. {behind} stages are behind, and I have a plan for them.'],
  ['Honestly, we are at {share}% of target with {run}% of the run gone, and I own that.', 'To be direct: {share}% of target, {run}% of the time gone. That is on me, and here is what I am doing.', 'We are at {share}% of target with {run}% of the run behind us. I take responsibility for the gap.']
];
export const SPONSOR_RISK: ByLevel = [
  ['There is no big risk.', 'Nothing major.'],
  ['The pipeline is slow, I think.', 'Probably the later stages.'],
  ['The biggest risk is {risk}. I will coach the team, and here is the plan: first the call lists, then the demos by Friday.', 'The risk I see is {risk}. The plan is to clear the call lists first, then book the demos by Friday.'],
  ['The biggest risk is {risk}. Here is the plan: first the call lists, then the demos by Friday, and I will track it daily.', 'The risk is {risk}. I have a plan: clear the call lists first, then the demos by Friday, tracked every day.']
];
export const SPONSOR_NEED: ByLevel = [
  ['Nothing, we are fine.', 'Just more leads.'],
  ['Maybe some support later.', 'I will let you know.'],
  ['What I need from you is support with two key accounts.', 'From you, I need help opening doors with two key accounts.'],
  ['What I need from you is support with two key accounts.', 'I need your help with two key accounts, and a quick decision on pricing.']
];
export const SPONSOR_PEOPLE: ByLevel = [
  ['Nobody in particular.', 'The usual people.'],
  ['A couple of people are struggling.', 'One or two, but they will be fine.'],
  ['I am most worried about the people with the lowest results, and I am meeting each of them this week.', 'Two people are struggling. I am coaching both of them this week.'],
  ['I am most worried about the two people furthest behind. I meet each of them weekly, and we agreed dated steps.', 'Two people, and I know why each one is stuck. I see them weekly, and I will update you by Friday.']
];
export const SPONSOR_CLOSE: ByLevel = [
  ['That is it.', 'Okay.'],
  ['I think we will get there.', 'We will keep at it.'],
  ['I will update you on progress by Friday.', 'I will keep you posted by Friday.'],
  ['I will update you by Friday.', 'I will send you an update by Friday.']
];

// ------------------------------------------------------------------------------------------------ interview

export const INTERVIEW: ByLevel = [
  ['So, why do you want this job?', 'Why should we hire you?', 'What makes you think you fit here?'],
  ['Tell me about your experience.', 'What are you good at?', 'What did you do in your last role?', 'Why do you want to join us?'],
  ['Thanks for coming in. Tell me about your background.', 'Tell me about a time you won a difficult deal. What happened next?', 'Why do you want to join this team?', 'How do you handle a week when nothing closes?'],
  ['Thanks for coming in, I appreciate it. Walk me through your background.', 'Tell me about a time you won back a lost client. What happened next, and what did you learn?', 'Give me an example of a time you missed a target. How did you respond?', 'Next question: what do you need from a manager to do your best work?', 'Tell me about a time you disagreed with a manager. How did you handle it?']
];
export const INTERVIEW_REACT = ['Thanks, that is helpful.', 'That is useful, thank you.', 'Thanks, I like how you put that.', 'Good, thanks for the detail.'];

// ------------------------------------------------------------------------------------------------ email

export const EMAIL_WARN: ByLevel = [
  ['Your numbers are not acceptable. You need to improve.', 'These results are not good enough. Improve them.', 'Your numbers are down. Fix it.'],
  ['Hi {name}, I am concerned about your results this week.', 'Hi {name}, your results dipped this week and I am a little concerned.', 'Hi {name}, the numbers this week are below where we need them.'],
  ['Hi {name}, thank you for your effort. I am concerned that your results fell this week, because two deals slipped.', 'Hi {name}, thanks for the work this week. I am concerned your results dropped, because two proposals stalled.'],
  ['Hi {name}, thank you for your effort this week, I appreciate it. I am concerned that your results fell, because 2 deals slipped at the proposal stage. For example, the follow ups waited three days.', 'Hi {name}, thanks for everything this week. I am concerned about your results: 2 proposals stalled, because the follow ups waited three days.']
];
export const EMAIL_WELL: ByLevel = [
  ['Well done. Keep it up.', 'Good work. More of that.', 'Nice. Keep going.'],
  ['Hi {name}, thank you for your work this week. Well done, keep it up.', 'Hi {name}, good week. Thanks for the effort.', 'Hi {name}, nice work this week, thank you.'],
  ['Hi {name}, thank you for your work this week. Well done on the progress in your stage, because the pipeline moved.', 'Hi {name}, great work this week. The pipeline moved because you kept the follow ups going.'],
  ['Hi {name}, thank you for your work this week. Well done: specifically, the 3 follow ups you closed moved the whole team forward, because the proposal stage was stuck.', 'Hi {name}, thank you for a strong week. Specifically, the 2 proposals you sent early unblocked the team, because they were waiting on them.']
];
export const EMAIL_CLOSE: ByLevel = [
  [],
  ['You need to improve by Friday.', 'Keep me posted.', ''],
  ['Can we agree the next step by Friday?', 'Let me know what would help by Friday.'],
  ['Can we agree the next step by Friday? I will check in with you by Friday.', 'Let me know what would help by Friday.']
];

// ------------------------------------------------------------------------------------------------ written plan

export const PLAN_LINES: ByLevel = [
  ['Here are your goals.', 'These are your targets.', 'Your goals for the week.'],
  ['Here is the plan for this week.', 'This is what I would like you to do this week.', 'The plan for the week is attached.'],
  ['Here is the plan we talked about.', 'Here is the plan we discussed.', 'This is the plan from our conversation.'],
  ['Here is the plan we talked about.', 'Here is the plan we shaped in our last talk.', 'This is the plan we agreed on.']
];
export const PLAN_CHECK: ByLevel = [
  [],
  ['Let me know how it goes.', 'Keep me posted on it.'],
  ['What would you change in this plan?', 'Is anything missing from this plan?'],
  ['What would you change in this plan?', 'Is anything missing from this plan?', 'What would make this plan easier to hit?']
];
export const PLAN_FIX = ['Good point. Let us make it specific: three proposals by Friday.', 'Fair. Let us put a number on it: 3 proposals sent by Friday.', 'You are right. Let us make it measurable: 2 follow up calls and 3 proposals by Friday.'];
