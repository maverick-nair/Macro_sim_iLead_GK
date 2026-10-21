import type { Tab } from '../author/model/draft';

/**
 * Traceability (D180, docs/PRODUCT.md): every participant facing element of a storyline traces back to the GenieKreator
 * section and field it was created in, and every GenieKreator field to where the participant meets it. GenieKreator's
 * "Where it appears" panels read this registry forwards (a section's fields and their surfaces); the player preview's
 * "Show where this comes from" overlay reads it backwards (a surface's storyline paths and their sections).
 *
 * Paths are StorylineConfig paths, dot separated, with `[]` for the elements of a list (`members[].name`). An entry
 * covers its path and everything under it unless a more specific entry says otherwise. Paths the participant never
 * meets (ids, engine mechanics, author notes) and participant facing paths GenieKreator does not author yet (engine and
 * template defaults) are listed in `INTERNAL`, each with its reason; a test walks the schema so no path goes unlisted.
 *
 * Types only from the author model: the player can import this without GenieKreator's code.
 */

/** A GenieKreator workspace section: a tab id of src/author/ui/sections.ts. */
export type Section = Tab;

/** Where the participant meets storyline content, with what they see there, in their own terms. */
export const SURFACES = {
  'onboarding.sponsor': 'The sponsor\'s welcome letter: welcome, the product and your targets',
  'onboarding.screens': 'The intro screens before week 1, in order, with their titles',
  'onboarding.portfolio': 'The product portfolio scene: each product, its line, key specs and photo',
  'onboarding.team': 'Meet your team: each person\'s card and profile',
  'onboarding.lens': 'The tutorial: the leadership styles and what people need',
  'onboarding.practice': 'The Week 0 practice conversation',
  'onboarding.video': 'The sponsor\'s welcome video and its transcript',
  'onboarding.tour': 'The guided tour of the board',
  'theme.colors': 'The colours of bars, buttons, links and highlights',
  'theme.logo': 'The logo next to the iLead wordmark',
  'theme.font': 'The typeface of every screen',
  'theme.mode': 'Whether the simulation opens dark or light',
  'theme.backdrop': 'The office image behind every screen',
  'board.hud': 'The top bar: week and day, revenue against target, score',
  'board.team': 'The team on the board: name, photo, mood and stage',
  'board.profile': 'A person\'s profile: facts, stats, and their concern once they share it',
  'board.funnel': 'The work process: stages, people and what moves through',
  'board.actions': 'What you can do: each action, its days and when it opens',
  'board.variables': 'Business measures on the board, with what moved them',
  'board.stakeholders': 'People outside the team: your relationship and what you can do with them',
  'board.sponsor': 'The sponsor\'s confidence and notes',
  'board.events': 'Events as they arrive: cards, bulletins, chats, emails and calls',
  'board.choice': 'Decisions: what you know, the options, and what happened',
  'style.setting': 'Setting each person\'s style for the week',
  'live.brief': 'The conversation brief: its goal and what you know',
  'live.npc': 'What the characters say in conversation',
  'live.voice': 'How the characters sound',
  'live.interview': 'Interviews when hiring: each candidate\'s CV card and what they say',
  'live.outcome': 'What changed after an action or a conversation',
  'weekend.summary': 'The week end: stars, what changed and news for next week',
  'end.screen': 'The end screen: score, tier, badges and reflection',
  'leaderboard': 'The cohort leaderboard',
  'report.cover': 'The report\'s header',
  'report.summary': 'The report\'s summary and overall level',
  'report.skills': 'The report\'s skills and rating scale',
  'report.styles': 'The report\'s leadership styles sections',
  'report.business': 'The report\'s business results',
  'report.decisions': 'The report\'s decisions and moments',
  'report.stakeholders': 'The report\'s stakeholder relationships',
  'report.sections': 'Which sections the report has, in order',
  'lms.record': 'What the learning platform records: completion, pass and score'
} as const;
export type Surface = keyof typeof SURFACES;

export interface TraceEntry {
  /** The GenieKreator section the field is in. */
  section: Section;
  /** The field's name as the author reads it. */
  label: string;
  /** Where the participant meets it. */
  surfaces: Surface[];
}

const e = (section: Section, label: string, ...surfaces: Surface[]): TraceEntry => ({ section, label, surfaces });

/** Every authored storyline path, with its GenieKreator section and field, and where the participant meets it. */
export const TRACE: Record<string, TraceEntry> = {
  // Brief, and the simulation's title.
  'name': e('overview', 'Simulation title', 'report.cover'),
  'purpose': e('scoring', 'Purpose (development or assessment)', 'report.summary', 'report.sections', 'leaderboard'),
  'time.liveCap': e('brief', 'Run length', 'board.actions'),
  'money.locale': e('brief', 'Language', 'board.hud', 'report.business'),
  'money.currency': e('brief', 'Language and region', 'board.hud', 'report.business'),
  // Story and world.
  'organisation': e('story', 'Company name', 'onboarding.sponsor', 'report.cover'),
  'intro.welcome': e('story', 'Welcome letter', 'onboarding.sponsor'),
  'intro.product': e('story', 'About the product screen', 'onboarding.sponsor'),
  'intro.targets': e('story', 'Your targets screen', 'onboarding.sponsor'),
  'intro.screens[]': e('story', 'Intro screens, in order', 'onboarding.screens'),
  'intro.screens[].title': e('story', 'Screen title', 'onboarding.screens'),
  'world.about': e('story', 'What it does', 'live.npc'),
  'world.headquarters': e('story', 'Headquarters', 'live.npc'),
  'world.team': e('story', 'Your team', 'live.npc'),
  'world.product': e('story', 'Product name, line and selling points', 'live.npc'),
  'world.customers': e('story', 'Who the team sells to', 'live.npc'),
  'world.rivals[]': e('story', 'Rivals and how they compete', 'live.npc'),
  'world.sponsorVoice': e('story', 'Sponsor voice', 'live.npc', 'board.sponsor'),
  'world.office.image': e('story', 'Office image', 'theme.backdrop'),
  'world.office.description': e('story', 'Office image (described)', 'live.npc'),
  'world.logo': e('story', 'Logo', 'onboarding.sponsor', 'theme.logo'),
  'world.products[]': e('story', 'Product and product view', 'onboarding.portfolio'),
  'world.products[].image': e('story', 'Product photo', 'onboarding.portfolio'),
  'world.products[].view': e('story', 'Product view', 'onboarding.portfolio'),
  // The portfolio scene's words (D221).
  'world.products[].code': e('story', 'Short code', 'onboarding.portfolio'),
  'world.products[].kind': e('story', 'Kind of product', 'onboarding.portfolio'),
  'world.products[].tagline': e('story', 'Tagline', 'onboarding.portfolio'),
  'world.products[].audience': e('story', 'Who it is for', 'onboarding.portfolio'),
  'world.products[].dealValue': e('story', 'Average deal value', 'onboarding.portfolio'),
  'world.products[].imageAlt': e('story', 'Photo description', 'onboarding.portfolio'),
  'world.products[].features[]': e('story', 'Features', 'onboarding.portfolio'),
  'world.products[].features[].title': e('story', 'Feature title', 'onboarding.portfolio'),
  'world.products[].features[].text': e('story', 'Feature text', 'onboarding.portfolio'),
  'world.products[].features[].spot': e('story', 'Feature spot on the photo', 'onboarding.portfolio'),
  'money.valuePerConversion': e('story', 'Average deal value', 'board.funnel', 'board.hud', 'report.business'),
  // The sales unit (D227): what one deal is called, wherever conversions are counted.
  'money.unit': e('story', 'What one deal is called', 'onboarding.portfolio', 'onboarding.sponsor', 'weekend.summary', 'end.screen', 'report.business', 'live.brief'),
  'sponsor.name': e('story', 'Sponsor', 'onboarding.sponsor', 'board.sponsor', 'live.npc'),
  'sponsor.title': e('story', 'Sponsor title', 'onboarding.sponsor', 'board.sponsor'),
  // Work process.
  'stages[].name': e('process', 'Stage name', 'board.funnel', 'onboarding.sponsor', 'report.business'),
  'stages[].ideal': e('process', 'People in the stage', 'board.funnel'),
  'stages[].conversionRatio': e('process', 'Passes on', 'board.funnel', 'report.business'),
  'money.target': e('process', 'Revenue target', 'board.hud', 'onboarding.sponsor', 'weekend.summary', 'report.business'),
  'money.inputPerSubPeriod': e('process', 'Pacing, and events\' lead flow', 'board.funnel', 'board.hud'),
  'time.period.count': e('process', 'Weeks', 'board.hud', 'onboarding.sponsor', 'weekend.summary'),
  'time.subPeriod.perPeriod': e('process', 'Days per week', 'board.hud', 'board.actions'),
  'drift': e('process', 'Pacing', 'board.team', 'weekend.summary'),
  'gamification.sponsor.escalation': e('process', 'Pacing', 'board.sponsor'),
  'dynamics': e('process', 'People dynamics', 'board.team', 'weekend.summary'),
  // Real world costs (D171 to D178): the switch turns the block on with the engine's numbers.
  'realism': e('process', 'Real world costs', 'board.actions', 'board.team', 'board.sponsor', 'board.hud', 'weekend.summary', 'end.screen'),
  'variables[]': e('process', 'Business variables', 'board.variables', 'weekend.summary', 'report.business'),
  'variables[].shown': e('process', 'Shown on the board', 'board.variables'),
  'variables[].about': e('process', 'What it means', 'board.variables', 'report.business'),
  'maxPerStage': e('team', 'Team (people per stage)', 'board.actions'),
  'salesModel': e('team', 'How the team sells: one stage each, or everyone end to end (D243)', 'board.team', 'board.funnel'),
  // Team.
  'members[].name': e('team', 'First and last name', 'board.team', 'onboarding.team', 'live.npc', 'report.decisions'),
  'members[].title': e('team', 'Job title', 'board.team', 'board.profile', 'onboarding.team'),
  'members[].pronoun': e('team', 'Gender and pronouns', 'board.events', 'live.npc', 'report.decisions'),
  'members[].homeStage': e('team', 'Stage', 'board.team', 'board.funnel', 'onboarding.team'),
  'members[].target': e('team', 'Their own revenue target (full cycle, D243)', 'board.team', 'board.funnel'),
  'members[].start': e('team', 'Starting stats', 'board.profile', 'board.team'),
  'members[].byStage': e('team', 'Best stage', 'board.profile', 'board.actions'),
  'members[].profile.previous': e('team', 'Previous company', 'board.profile', 'onboarding.team'),
  'members[].profile.tenure': e('team', 'Time on this team', 'board.profile', 'onboarding.team'),
  'members[].profile.experience': e('team', 'Experience', 'board.profile', 'onboarding.team'),
  'members[].profile.remarks': e('team', 'Persona', 'board.profile', 'onboarding.team', 'live.brief'),
  'members[].profile.relations': e('team', 'Relationships', 'board.profile'),
  'members[].profile.attitude': e('team', 'Communication style', 'board.profile'),
  'members[].profile.awareness': e('team', 'Self awareness', 'board.profile'),
  'members[].profile.responsibilities': e('team', 'Responsibilities', 'board.profile'),
  'members[].hiddenConcern': e('team', 'Hidden concern', 'board.profile', 'live.npc', 'live.brief'),
  'members[].concernLine': e('team', 'What they say when it comes out', 'live.npc'),
  'members[].careerGoal': e('team', 'Career goal', 'board.profile'),
  'members[].portrait': e('team', 'Photo', 'board.team', 'board.profile', 'onboarding.team', 'live.npc', 'live.outcome'),
  'members[].voice': e('team', 'Voice', 'live.voice'),
  'members[].npc': e('team', 'Persona, motivations, reactions and topics to avoid', 'live.npc'),
  'members[].npc.speech': e('team', 'Voice: language, accent, pace, warmth, formality, reply length', 'live.npc', 'live.voice'),
  // Hire candidates (D228): Team, Hiring.
  'candidates[]': e('team', 'Hire candidates', 'live.interview'),
  'candidates[].name': e('team', 'Candidate name', 'live.interview', 'board.team'),
  'candidates[].title': e('team', 'Candidate job title', 'live.interview', 'board.team'),
  'candidates[].pronoun': e('team', 'Candidate gender and pronouns', 'live.interview', 'live.npc'),
  'candidates[].homeStage': e('team', 'Stage they would start in', 'board.team', 'board.funnel'),
  'candidates[].portrait': e('team', 'Candidate photo', 'live.interview', 'board.team'),
  'candidates[].profile.previous': e('team', 'Background', 'live.interview'),
  'candidates[].profile.experience': e('team', 'Experience', 'live.interview', 'board.profile'),
  'candidates[].profile.skills': e('team', 'Strengths', 'live.interview', 'board.profile'),
  'candidates[].profile.remarks': e('team', 'Remarks', 'live.interview', 'live.npc', 'board.profile'),
  'stakeholders[]': e('team', 'Stakeholders', 'board.stakeholders', 'report.stakeholders'),
  'stakeholders[].portrait': e('team', 'Stakeholder photo', 'board.stakeholders', 'live.npc'),
  'stakeholders[].about': e('team', 'What the participant knows about them', 'board.stakeholders', 'live.brief'),
  'stakeholders[].hiddenConcern': e('team', 'Hidden concern', 'board.stakeholders', 'live.npc'),
  'stakeholders[].concernLine': e('team', 'What they say when it comes out', 'live.npc'),
  'stakeholders[].npc': e('team', 'Persona, motivations, voice and topics to avoid', 'live.npc', 'live.voice'),
  'stakeholders[].interactions': e('team', 'Interactions: meet, present, negotiate, email', 'board.stakeholders', 'live.brief', 'live.npc', 'live.outcome'),
  // Leadership lens.
  'lens.id': e('lens', 'Leadership lens', 'onboarding.lens', 'style.setting', 'report.styles'),
  'lens.title': e('lens', 'Leadership lens', 'onboarding.lens', 'report.styles'),
  'lens.styles[]': e('lens', 'Styles: letter, name, line and description', 'onboarding.lens', 'style.setting', 'live.brief', 'report.styles'),
  // The tag (D230): the author's, or the name's first letter when left empty.
  'lens.styles[].letter': e('lens', 'Tag letter', 'board.team', 'style.setting', 'onboarding.lens', 'report.styles'),
  'lens.needs': e('lens', 'What people need', 'onboarding.lens', 'style.setting', 'report.styles'),
  'lens.fit': e('lens', 'Fit rules', 'style.setting', 'live.outcome', 'weekend.summary', 'report.styles'),
  'lens.secondary': e('lens', 'Secondary lens', 'report.skills'),
  // Actions and conversations.
  'actions[].name': e('actions', 'Action name', 'board.actions', 'live.brief', 'report.decisions'),
  'actions[].description': e('actions', 'What it does', 'board.actions'),
  'actions[].kind': e('actions', 'Plays as (decision, conversation or both)', 'board.actions', 'live.brief'),
  'actions[].cost': e('actions', 'Days it takes', 'board.actions', 'board.hud'),
  'actions[].cooldownDays': e('actions', 'Again after', 'board.actions'),
  'actions[].unlockPeriod': e('actions', 'Available from week', 'board.actions'),
  'actions[].live.goal': e('actions', 'Conversation goal', 'live.brief'),
  'actions[].live.opening': e('actions', 'Who starts', 'live.npc'),
  // The rubric behind the scoring samples (D229): what each dimension looks for, and phrases that count as evidence.
  'actions[].live.rubric': e('scoring', 'Rubric: what a conversation is rated on', 'live.outcome', 'report.skills'),
  'actions[].options[].label': e('actions', 'Option label', 'board.actions'),
  'actions[].options[].style': e('actions', 'Option style', 'board.actions', 'live.outcome', 'report.styles'),
  'actions[].options[].effects': e('actions', 'Impact by style, if it fits and if it misses', 'live.outcome', 'board.team'),
  'actions[].options[].away': e('actions', 'Days away', 'board.team', 'board.actions'),
  'report.linkage': e('actions', 'Scored on', 'report.skills'),
  // Events.
  'events[].title': e('events', 'Event title', 'board.events', 'weekend.summary', 'report.decisions'),
  'events[].body': e('events', 'What participants read', 'board.events'),
  'events[].card': e('events', 'Kind', 'board.events'),
  'events[].period': e('events', 'Week', 'board.events'),
  'events[].subPeriod': e('events', 'Day', 'board.events'),
  'events[].window': e('events', 'Some time in these weeks', 'board.events'),
  'events[].when': e('events', 'When something happens', 'board.events'),
  'events[].if': e('events', 'Plays only if', 'board.events'),
  'events[].impact': e('events', 'Skill, morale and result impact', 'live.outcome', 'board.team', 'board.events'),
  'events[].target': e('events', 'Who it hits', 'board.events', 'board.team'),
  'events[].delivery': e('events', 'How it arrives', 'board.events', 'weekend.summary'),
  'events[].response': e('events', 'What counts as a response, and the days to respond', 'board.events', 'board.team'),
  'events[].escalation': e('events', 'If ignored', 'board.sponsor', 'board.events'),
  'events[].choice': e('events', 'Decision: what is known, options, deadline and default', 'board.choice', 'weekend.summary', 'report.decisions'),
  'events[].business': e('events', 'What it does to stakeholders', 'board.stakeholders', 'board.variables'),
  'events[].stakeholder': e('events', 'From a stakeholder', 'board.events', 'board.stakeholders'),
  'events[].request': e('events', 'What the stakeholder asks for, by when', 'board.events', 'board.stakeholders'),
  // Scoring and report.
  'report.skills[]': e('scoring', 'Skills framework', 'report.skills', 'live.outcome', 'board.choice'),
  'report.scale[]': e('scoring', 'Rating scale levels', 'report.skills', 'report.summary', 'end.screen'),
  'report.sections': e('scoring', 'Report sections', 'report.sections'),
  // Brand and theme.
  'brand.name': e('brand', 'Brand name', 'theme.logo'),
  'brand.colors': e('brand', 'Main and second colour', 'theme.colors'),
  'brand.logo': e('brand', 'Logo', 'theme.logo'),
  'brand.font': e('brand', 'Font', 'theme.font'),
  'brand.mode': e('brand', 'Look', 'theme.mode'),
  // Review and publish.
  'lms.completion': e('publish', 'Completion rule', 'lms.record'),
  'lms.pass': e('publish', 'Pass rule', 'lms.record'),
  'lms.score': e('publish', 'Score reported', 'lms.record'),
  'lms.package': e('publish', 'SCORM version', 'lms.record'),
  'lms.connected': e('publish', 'Connected mode', 'lms.record')
};

/**
 * Paths the registry does not trace, each with why: `id` (a key the participant never reads), `mechanics` (engine
 * rules and numbers, never shown as such), `author` (read by the author or the AI only), `default` (participant facing,
 * but from the engine's or the template's defaults: GenieKreator does not author it yet, a traceability gap PRODUCT.md lists).
 */
export const INTERNAL: Record<string, { kind: 'id' | 'mechanics' | 'author' | 'default'; reason: string }> = {
  'id': { kind: 'id', reason: 'The storyline\'s id, set when it is published' },
  'locale': { kind: 'default', reason: 'The language the authored copy is written in; one storyline per language, the engine default (en)' },
  'use': { kind: 'mechanics', reason: 'Kept as an alias of purpose for storylines written before it' },
  'calibrated': { kind: 'mechanics', reason: 'Set by synthetic calibration, never shown' },
  'performanceThreshold': { kind: 'mechanics', reason: 'The funnel buffer calibration sets' },
  'thresholds': { kind: 'mechanics', reason: 'Engine bands for high, amber and low values' },
  'trustRules': { kind: 'mechanics', reason: 'Trust rules (D30): engine numbers' },
  'weeklyStyle': { kind: 'mechanics', reason: 'Weekly style setting effects: the template\'s calibrated mechanics' },
  'time.period.unit': { kind: 'mechanics', reason: 'GenieKreator plays weeks' },
  'time.subPeriod.unit': { kind: 'mechanics', reason: 'GenieKreator plays days' },
  'time.costStep': { kind: 'mechanics', reason: 'Smallest action cost: whole days' },
  'money.display': { kind: 'default', reason: 'How money is written (symbol): the engine default' },
  'lens.description': { kind: 'author', reason: 'Author facing description of the lens' },
  'lens.basedOn': { kind: 'author', reason: 'Author only: the lens\'s original source, never rendered' },
  'lens.styles[].key': { kind: 'id', reason: 'Style key, matched by the engine and never shown' },
  'lens.examples[]': { kind: 'default', reason: 'Tutorial worked examples: worded from the needs and styles when not authored' },
  'world.office': { kind: 'author', reason: 'Container; its image and description are traced' },
  'world.products[].name': { kind: 'author', reason: 'Traced with the product (world.products[])' },
  'stages[].key': { kind: 'id', reason: 'Stage key, matched by the engine and never shown' },
  'stages[].about': { kind: 'default', reason: 'Stage info popover: from the template, not authored in Work process yet' },
  'stages[].suits': { kind: 'default', reason: 'Which skills suit a stage: from the template, not authored yet' },
  'sponsor.portrait': { kind: 'default', reason: 'The sponsor\'s portrait: from the template; GenieKreator has no sponsor photo yet' },
  'sponsor.briefings': { kind: 'default', reason: 'Sponsor briefing weeks: the mid point and the last week' },
  'sponsor.styleLine': { kind: 'default', reason: 'The line over weekly style setting: the engine default' },
  'members[].id': { kind: 'id', reason: 'Person id, matched by the engine and never shown' },
  'members[].portraits': { kind: 'default', reason: 'Portraits by mood come with the library portrait' },
  'members[].profile.skills': { kind: 'default', reason: 'Profile skills line: from the template, not authored yet' },
  'candidates[].id': { kind: 'id', reason: 'Candidate id, matched by the engine and never shown' },
  'candidates[].start': { kind: 'mechanics', reason: 'A candidate\'s starting numbers: the drafted ones by position (D228)' },
  'candidates[].byStage': { kind: 'mechanics', reason: 'A candidate\'s numbers by stage: the drafted ones by position (D228)' },
  'candidates[].profile.tenure': { kind: 'default', reason: 'A hired candidate\'s time on the team: New joiner' },
  'candidates[].profile.relations': { kind: 'default', reason: 'A hired candidate has no relationships yet: empty' },
  'stakeholders[].key': { kind: 'id', reason: 'Stakeholder key, matched by the engine and never shown' },
  'actions[].key': { kind: 'id', reason: 'Action key, matched by the engine and never shown' },
  'actions[].scope': { kind: 'mechanics', reason: 'From the action\'s template' },
  'actions[].rule': { kind: 'mechanics', reason: 'From the action\'s template' },
  'actions[].format': { kind: 'mechanics', reason: 'From the action\'s template' },
  'actions[].targets': { kind: 'mechanics', reason: 'From the action\'s template' },
  'actions[].prerequisite': { kind: 'mechanics', reason: 'From the action\'s template' },
  'actions[].live': { kind: 'default', reason: 'Rubric, turn limit, minutes, hints and interview questions: the format\'s defaults' },
  'actions[].options[]': { kind: 'mechanics', reason: 'Option mechanics from the template (key, intent, cost, targets, stage moves, business effects)' },
  'actions[].realism': { kind: 'mechanics', reason: 'Per action overrides of the real world costs (D171): not authored, the storyline block applies' },
  'events[].key': { kind: 'id', reason: 'Event key, matched by the engine and never shown' },
  'events[].away': { kind: 'default', reason: 'Days away an event causes: from the template' },
  'events[].impactText': { kind: 'default', reason: 'A bulletin\'s See impact line: from the template' },
  'events[].label': { kind: 'default', reason: 'A card label: from the template' },
  'triggers[]': { kind: 'default', reason: 'People triggers (leave, resignation, requests) and their messages: from the template' },
  'gamification': { kind: 'default', reason: 'Stars, streaks, tiers, badges, sponsor rules, unlocks and the leaderboard: the iLead 2.0 defaults' },
  'report': { kind: 'default', reason: 'The report\'s narrative bank, evidence rules, development plan and group report: the iLead 2.0 defaults by purpose' },
  'practice': { kind: 'default', reason: 'The Week 0 practice: on, with the first team member' },
  'video': { kind: 'default', reason: 'The welcome video: none authored yet' },
  'tour': { kind: 'default', reason: 'The guided tour\'s steps: the engine\'s wording' },
  'demo': { kind: 'mechanics', reason: 'The demo round: on when the storyline has an instant action with one person' },
  'milestones': { kind: 'default', reason: 'Progress milestones: the engine defaults' },
  'lms': { kind: 'mechanics', reason: 'Container; each rule is traced' }
};

/** A concrete path (`members.1.name`) or a pattern (`members[].name`) as the registry's pattern. */
export const patternOf = (path: string) => path.replace(/\.(\d+)(?=\.|$)/g, '[]').replace(/\[\d+\]/g, '[]');

/** The ancestors of a pattern, itself first: `a[].b.c`, `a[].b`, `a[]`, `a`. */
export function ancestors(pattern: string): string[] {
  const out: string[] = [];
  let p = pattern;
  while (p) {
    out.push(p);
    p = p.endsWith('[]') ? p.slice(0, -2) : p.includes('.') ? p.slice(0, p.lastIndexOf('.')) : '';
  }
  return out;
}

/** The trace of a storyline path: its own entry or its closest traced ancestor's, with the matched path. Null when it is internal or unknown. */
export function traceOf(path: string): (TraceEntry & { path: string }) | null {
  for (const p of ancestors(patternOf(path))) {
    if (TRACE[p]) return { ...TRACE[p], path: p };
    if (INTERNAL[p]) return null;
  }
  return null;
}

/** Every participant surface a GenieKreator section reaches: its "Where it appears" panel. */
export function surfacesFor(section: Section): Surface[] {
  return [...new Set(Object.values(TRACE).filter(t => t.section === section).flatMap(t => t.surfaces))];
}

/** Every storyline path a participant surface shows: what "Show where this comes from" lists, each with its section. */
export function pathsFor(surface: Surface): string[] {
  return Object.entries(TRACE).filter(([, t]) => t.surfaces.includes(surface)).map(([p]) => p);
}
