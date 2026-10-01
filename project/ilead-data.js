window.ILEAD = {
  stages: [
    { k: 'lead', n: 'Lead generation', count: 42, ideal: 40 },
    { k: 'qual', n: 'Qualification', count: 18, ideal: 24 },
    { k: 'demo', n: 'Solution demo', count: 9, ideal: 14 },
    { k: 'prop', n: 'Proposal', count: 6, ideal: 8 },
    { k: 'close', n: 'Closing', count: 3, ideal: 5 }
  ],
  styles: [
    { k: 'D', n: 'Directing', d: 'You set the task, explain how, and check in closely.' },
    { k: 'G', n: 'Guiding', d: 'You explain the why and coach while they practise.' },
    { k: 'P', n: 'Partnering', d: 'You decide together and share ownership of the work.' },
    { k: 'E', n: 'Entrusting', d: 'You hand over the goal and step back.' }
  ],
  moods: {
    happy: { n: 'Upbeat', c: '#00F2AD' }, neutral: { n: 'Steady', c: '#DEE9FF' }, thinking: { n: 'Thinking', c: '#43D6E8' },
    concerned: { n: 'Concerned', c: 'oklch(0.84 0.14 78)' }, frustrated: { n: 'Frustrated', c: 'oklch(0.78 0.13 25)' }
  },
  sponsor: { name: 'Priya Nair', title: 'Regional Sales Director', initials: 'PN' },
  members: [
    { id: 'kent', name: 'Kent Goldberg', pron: 'him', stage: 0, title: 'Senior Sales Development Rep', skill: 35, morale: 9, result: 37, trust: 30, style: 'D', last: 'D', lastReact: 'neg', mood: 'frustrated', unread: true,
      prev: 'Brightline Media', tenure: '6 years', exp: '9 years in sales', skills: 'Cold calling, territory knowledge', remarks: 'Top prospector two years running. CRM updates lag.',
      relations: 'Mentored Derick early on. Tension with Beth over lead routing.', shared: '', goal: '' },
    { id: 'beth', name: 'Beth Killiney', pron: 'her', stage: 0, title: 'Sales Development Rep', skill: 25, morale: 57, result: 32, trust: 48, style: 'D', last: 'D', lastReact: 'pos', mood: 'happy', tags: ['New hire'],
      prev: 'Retail banking', tenure: '3 weeks', exp: '1 year in sales', skills: 'Rapport, persistence', remarks: 'Eager, still unsure of the call script.', relations: 'Derick helps her informally.' },
    { id: 'mandy', name: 'Mandy Lobert', pron: 'her', stage: 1, title: 'Account Qualifier', skill: 50, morale: 61, result: 53, trust: 55, style: 'G', last: 'G', lastReact: 'pos', mood: 'neutral',
      prev: 'Northpass Logistics', tenure: '2 years', exp: '4 years in sales', skills: 'Discovery questions', remarks: 'Qualifies well, overcommits on timelines.', relations: 'Works closely with Lowe.' },
    { id: 'peter', name: 'Peter Higgins', pron: 'him', stage: 1, title: 'Account Qualifier', skill: 19, morale: 20, result: 26, trust: 24, style: 'D', last: 'D', lastReact: 'neg', mood: 'concerned', tags: ['Training'], away: true,
      prev: 'Graduate programme', tenure: '5 months', exp: 'First sales role', skills: 'Research, data entry', remarks: 'Asked for help once, then went quiet.', relations: 'Keeps to himself.' },
    { id: 'green', name: 'Green Bell', pron: 'him', stage: 2, title: 'Solutions Consultant', skill: 89, morale: 63, result: 78, trust: 70, style: 'P', last: 'P', lastReact: 'pos', mood: 'happy', promise: 'Career talk due Friday',
      prev: 'Cobalt Systems', tenure: '4 years', exp: '8 years in presales', skills: 'Demos, objection handling', remarks: 'Your strongest demo lead.', relations: 'Respected by the whole team.' },
    { id: 'lowe', name: 'Lowe Rex', pron: 'him', stage: 2, title: 'Solutions Consultant', skill: 80, morale: 45, result: 77, trust: 52, style: 'P', last: 'P', lastReact: 'neg', mood: 'concerned',
      prev: 'Quill Analytics', tenure: '3 years', exp: '7 years in presales', skills: 'Technical depth', remarks: 'Demos run long. Lost a big deal in week 1.', relations: 'Works closely with Mandy.' },
    { id: 'ruth', name: 'Ruth Ether', pron: 'her', stage: 3, title: 'Proposal Manager', skill: 80, morale: 59, result: 83, trust: 64, style: 'P', last: 'E', lastReact: 'pos', mood: 'thinking',
      prev: 'Harbor Consulting', tenure: '5 years', exp: '10 years in bids', skills: 'Writing, pricing', remarks: 'Quiet in meetings, strong on paper.', relations: 'Reviews Justin\u2019s drafts.' },
    { id: 'justin', name: 'Justin Keel', pron: 'him', stage: 3, title: 'Proposal Writer', skill: 26, morale: 84, result: 37, trust: 60, style: 'E', last: 'E', lastReact: 'pos', mood: 'happy',
      prev: 'Marketing agency', tenure: '8 months', exp: '2 years in sales', skills: 'Storytelling', remarks: 'Upbeat. Proposals often need rework.', relations: 'Ruth reviews his work.' },
    { id: 'jack', name: 'Jack Holt', pron: 'him', stage: 4, title: 'Account Executive', skill: 92, morale: 83, result: 83, trust: 82, style: 'E', last: 'E', lastReact: 'pos', mood: 'happy', rewarded: true,
      prev: 'Vantage Telecom', tenure: '7 years', exp: '12 years in sales', skills: 'Closing, negotiation', remarks: 'Closes reliably. Dislikes being checked on.', relations: 'Informal leader of the closers.' },
    { id: 'derick', name: 'Derick Kaynes', pron: 'him', stage: 4, title: 'Account Executive', skill: 70, morale: 85, result: 81, trust: 77, style: 'E', last: 'P', lastReact: 'pos', mood: 'happy',
      prev: 'Brightline Media', tenure: '3 years', exp: '5 years in sales', skills: 'Relationship building', remarks: 'Energetic. Mentors Beth informally.', relations: 'Was mentored by Kent.' }
  ],
  teamActions: [
    { k: 'meet', n: 'Meet the team', c: 1, kind: 'live', format: 'meeting', desc: 'Bring everyone together for a 20 minute team meeting.' },
    { k: 'energize', n: 'Energize the team', c: 0.5, kind: 'static', desc: 'A short moment to lift the team.', options: [{ n: 'Team lunch', d: 'Informal lunch, everyone together.' }, { n: 'Team building', d: 'Half day activity away from desks.' }] },
    { k: 'email', n: 'Send email', c: 0, kind: 'live', format: 'email', desc: 'Write to one person or many. Replies arrive in your inbox.' },
    { k: 'training', n: 'Send for training', c: 2, kind: 'static', desc: 'Build skill away from the desk.', limit: 'Up to 3 people', select: [1, 3], options: [{ n: '1 day workshop', d: 'Skill +2 to +4. Away 1 day.' }, { n: '1 week workshop', d: 'Larger skill gain. Away 5 days.' }] },
    { k: 'swap', n: 'Swap roles', c: 1, kind: 'hybrid', format: 'roleplay', desc: 'Move two people between stages, then explain the decision.', limit: 'Needs 2 people in different stages', select: [2, 2], prereq: true },
    { k: 'hire', n: 'Hire member', c: 1, kind: 'live', format: 'interview', desc: 'Interview candidates for an open seat.', lock: 'Unlocks in week 3' }
  ],
  memberActions: [
    { k: 'f2f', n: 'Meet face to face', c: 0.5, kind: 'live', format: 'roleplay', dur: 'About 6 minutes' },
    { k: 'coach', n: 'Coach member', c: 1, kind: 'live', format: 'roleplay', dur: 'About 10 minutes' },
    { k: 'feedback', n: 'Give feedback', c: 0.5, kind: 'live', format: 'chat', dur: 'About 4 minutes' },
    { k: 'goals', n: 'Set goals', c: 0.5, kind: 'live', format: 'plan', dur: 'About 5 minutes' },
    { k: 'assess', n: 'Assess member', c: 1, kind: 'static' },
    { k: 'reward', n: 'Reward member', c: 0.5, kind: 'hybrid', cooldown: 'Cooldown: 6 days left' },
    { k: 'fire', n: 'Let go', c: 1, kind: 'hybrid' }
  ],
  inbox: [
    { id: 'i1', type: 'chat', from: 'kent', title: 'Do you have 15 minutes today?', preview: 'Something has been bothering me.', meta: 'Day 2, 16:40', due: 'Reply by Day 3', urgent: true },
    { id: 'i2', type: 'sponsor', from: 'sponsor', title: 'Pipeline review moved to Friday', preview: 'Bring a view of demo conversions, please.', meta: 'Day 3, 9:10' },
    { id: 'i3', type: 'news', from: 'news', title: 'Ashcroft asks for 12% off to sign this week', preview: 'Impact event. See impact.', meta: 'Day 3, 8:30' },
    { id: 'i4', type: 'email', from: 'ruth', title: 'Leave request, Thursday and Friday', preview: 'Family matter. I can hand over the Brightwell draft.', meta: 'Day 3, 10:02' }
  ],
  events: {
    impact: { tag: 'Impact', title: 'Ashcroft asks for 12% off to sign this week', body: 'Their procurement team has a competing quote. Green thinks the account is still winnable at list price.', impact: ['Revenue at stake: $8,400', 'Green and Jack are involved'], cta: 'See impact' },
    signal: { tag: 'Signal', title: 'Lowe skipped the Monday stand up', body: 'Mandy mentions he seemed off after the team meeting.', impact: ['Something may be changing with Lowe'], cta: 'Noted' },
    capacity: { tag: 'Capacity', title: 'Ruth asks for leave on Thursday and Friday', body: 'A family matter. She offers to hand the Brightwell proposal to Justin.', impact: ['Proposal stage drops to one person for 2 days'], cta: 'Respond' },
    diagnostic: { tag: 'Diagnostic', title: 'New data: Peter\u2019s qualification notes', body: 'Six of his last ten leads were missing a budget owner.', impact: ['A clue about where Peter is stuck'], cta: 'Noted' }
  },
  outcome: {
    who: 'kent', headline: 'Kent opened up about what is bothering him',
    reply: 'Okay. That would actually help. I can bring Beth up to speed on the old accounts.',
    affected: ['kent', 'beth', 'jack'],
    reactions: { kent: 'Feels heard for the first time in weeks.', beth: 'A little unsure about sharing accounts.', jack: 'Noticed you made time for Kent.' },
    moves: [{ id: 'kent', k: 'morale', d: 8 }, { id: 'kent', k: 'trust', d: 6 }, { id: 'beth', k: 'morale', d: -2 }],
    ripple: 'Jack noticed you made time for Kent.',
    changed: ['Kent\u2019s old accounts will flow to Beth again, with Kent as her guide.', 'Kent will update the CRM daily this week.'],
    why: { cause: 'You apologised, listened, and asked for Kent\u2019s help instead of telling him what to do.', rule: 'A 1:1 that acknowledges a missed request and invites contribution lifts Morale 6 to 10 and Trust 4 to 8.', ev: 'I\u2019m sorry I missed it yesterday. I want to hear what\u2019s on your mind, take your time.', evBy: 'You, 1:1 with Kent, Week 2 Day 3' }
  },
  badges: [
    { n: 'First word', d: 'Held your first live conversation', on: true },
    { n: 'Listener', d: 'Asked three open questions in one 1:1', on: true, isNew: true },
    { n: 'Pipeline builder', d: 'Hint: push one stage past ideal', on: false },
    { n: 'Steady hand', d: 'Hint: keep everyone above 40', on: false },
    { n: 'Turnaround', d: 'Hint: help someone bounce back', on: false },
    { n: 'Clear voice', d: 'Hint: a whole week in voice', on: false }
  ]
};
