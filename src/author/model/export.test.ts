import { describe, expect, it } from 'vitest';
import { Brief } from '../../api/author';
import { parseStoryline } from '../../engine/config';
import { changeLens } from '../ui/workspace/tabs/Lens';
import type { AuthorDraft } from './draft';
import { toStoryline } from './export';
import { fitRun, mapWeek } from './run';
import { remapReads } from './choices';
import { createEngine } from '../../engine/sim/engine';
import { neededStyles } from '../../engine/sim/policies';
import { emptyChat, PORTRAITS, pronounsOf, seedDraft } from './seed';
import { blankEffect, newStakeholder } from './stakeholders';

/**
 * The principle (D128): every field the author sees reaches the simulation, or is an author note
 * documented as one. Each row changes one draft field the way its control does and names where the
 * exported storyline changes. A completeness check walks every field of a draft, so a new field fails
 * here until it is wired or listed as a note, as internal state, or as a known gap.
 */

const BRIEF = Brief.parse({
  roleLevel: 'First time sales managers', industry: 'Manufacturing', challenge: 'Deals stall at negotiation and new reps burn out in the first quarter.',
  client: 'Ascent Lifts', teamSize: 10, process: ['Leads', 'Qualify', 'Proposal', 'Negotiation', 'Close'], duration: 'standard', region: 'india', language: 'English, India', framework: null, tone: 'professional'
});

function fixture(): AuthorDraft {
  const d = seedDraft({ ...emptyChat(), brief: BRIEF, asked: ['role_level', 'industry', 'challenge'], answers: { role_level: BRIEF.roleLevel!, industry: 'Manufacturing', challenge: BRIEF.challenge! }, primary: 'readiness_based' } as AuthorDraft['chat']);
  d.story.product.dealValue = 30000;
  const c = d.team[1];
  c.hiddenConcern = 'Worried the role is a dead end.';
  c.concernLine = 'I am not sure where this job goes.';
  c.relationships = [{ with: d.team[2].id, kind: 'Works closely with' }];
  // A stakeholder outside the team (D163): a meeting with business effects, a negotiation as a decision, a request, and a choice that moves them.
  const s = newStakeholder(d, { name: 'Helen Brandt', role: 'CFO' });
  Object.assign(s, { about: 'Owns the budget.', persona: 'Precise and brief.', motivatedBy: 'Clean numbers', noTopics: 'Salaries', hiddenConcern: 'The board wants cuts.', concernLine: 'The board is pushing me.', photo: PORTRAITS[3] });
  const meet = s.interactions.find(i => i.type === 'meet')!;
  Object.assign(meet, { enabled: true, good: blankEffect({ trust: 6, satisfaction: 6, variables: { budget: 1000 }, set: ['cfo_on_side'], outcome: 'Helen backs you.' }) });
  const neg = s.interactions.find(i => i.type === 'negotiate')!;
  Object.assign(neg, { plays: 'static', options: [
    { key: 'ask', label: 'Ask for budget', detail: 'She says yes to teams she trusts.', effect: blankEffect({ satisfaction: -3, variables: { budget: 5000 }, people: [0, 2, 1] }), needsTrust: 55, refusal: 'Not this quarter.', read: [{ skill: d.scoring.skills.filter(k => !k.reportOnly)[0].name, band: 'strong' }] },
    { key: 'wait', label: 'Wait for better numbers', detail: '', effect: blankEffect({ satisfaction: 2 }), needsTrust: 0, refusal: '', read: [] }
  ] });
  d.stakeholders.push(s);
  d.events.push({ key: 'cfo_asks', title: 'Helen asks to meet', kind: 'sponsor', week: 2, day: 2, timing: 'fixed', who: 'team', arrives: 'email', body: 'Helen wants your plan by Thursday.', skill: 0, morale: 0, result: 0, leadFlow: 0,
    respondWith: [], within: 2, onTime: [0, 2, 0], ifIgnored: { sponsor: true, followUp: null }, stakeholder: s.key,
    request: { kind: 'meeting', interaction: 'meet', within: 2, onTime: { trust: 3, satisfaction: 3 }, ifIgnored: { trust: -6, satisfaction: -8 } }, moves: { [s.key]: { trust: 0, satisfaction: -2 } }, origin: 'yours' });
  d.events.find(e => e.key === DISCOUNT)!.choice!.options[0].stakeholders = { [s.key]: { trust: -2, satisfaction: 3 } };
  return d;
}

/** Reads a dotted path; a segment `key=value` picks the array element with that key. */
function at(v: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((o, k) => {
    if (o === null || o === undefined) return undefined;
    const m = k.match(/^(\w+)=(.+)$/);
    if (m && Array.isArray(o)) return o.find(x => (x as Record<string, unknown>)[m[1]] === m[2]);
    return (o as Record<string, unknown>)[k];
  }, v);
}

const ev = (d: AuthorDraft, key: string) => d.events.find(e => e.key === key)!;
const act = (d: AuthorDraft, key: string) => d.actions.find(a => a.key === key)!;
const member = (d: AuthorDraft) => d.team[1];
const DISCOUNT = 'discount_decision';
const opt = (d: AuthorDraft, i = 0) => ev(d, DISCOUNT).choice!.options[i];
const CH = `events.key=${DISCOUNT}.choice`;
const M = 'members.1';
const sh = (d: AuthorDraft) => d.stakeholders[0];
const ix = (d: AuthorDraft, type: string) => sh(d).interactions.find(i => i.type === type)!;
const SH = 'stakeholders.0';
const MEET = `${SH}.interactions.key=meet`, NEG = `${SH}.interactions.key=negotiate`;
const ASK = 'events.key=cfo_asks';
const EFFECT_FIELDS = ['trust', 'satisfaction', 'sponsor', 'revenue', 'variables', 'set', 'people', 'who', 'outcome'] as const;
/** Changes one field of a stakeholder effect as its control does. */
function changeEffect(d: AuthorDraft, e: ReturnType<typeof blankEffect>, f: (typeof EFFECT_FIELDS)[number]) {
  if (f === 'variables') e.variables = { budget: 2500 };
  else if (f === 'set') e.set = ['changed_flag'];
  else if (f === 'people') e.people = [1, -2, 3];
  else if (f === 'who') e.who = `stage:${d.process.stages[0].key}`;
  else if (f === 'outcome') e.outcome = 'Something happened.';
  else e[f] = 9;
}

/** [draft field, change it as its control does, where the storyline changes]. */
const WIRED: Array<[string, (d: AuthorDraft) => void, string]> = [
  ['title', d => { d.title = 'Leading the Close Team'; }, 'name'],
  ['brief.purpose', d => { d.brief.purpose = 'assessment'; }, 'purpose'],
  ['brief.run', d => { d.brief.run = 'full'; fitRun(d, 8); }, 'time.liveCap'],
  ['brief.language', d => { d.brief.language = 'English, United Kingdom'; }, 'money.locale'],
  ['story.company.name', d => { d.story.company.name = 'Summit Lifts'; }, 'organisation'],
  ['story.company.hq', d => { d.story.company.hq = 'Leeds'; }, 'world.headquarters'],
  ['story.company.about', d => { d.story.company.about = 'Lifts for hospitals.'; }, 'world.about'],
  ['story.company.team', d => { d.story.company.team = 'The closing desk'; }, 'world.team'],
  ['story.product.name', d => { d.story.product.name = 'Ascent Quiet'; }, 'world.product.name'],
  ['story.product.dealValue', d => { d.story.product.dealValue = 41000; }, 'money.valuePerConversion'],
  ['story.product.oneLine', d => { d.story.product.oneLine = 'Quiet lifts.'; }, 'world.product.line'],
  ['story.product.points', d => { d.story.product.points.push('Ten year warranty'); }, 'world.product.points'],
  ['story.market.customers', d => { d.story.market.customers = 'Hospital groups'; }, 'world.customers'],
  ['story.market.rivals[].name', d => { d.story.market.rivals[0].name = 'Beta Lifts'; }, 'world.rivals'],
  ['story.market.rivals[].angle', d => { d.story.market.rivals[0].angle = 'Cheaper'; }, 'world.rivals'],
  ['story.sponsor.name', d => { d.story.sponsor.name = 'Maya Iyer'; }, 'sponsor.name'],
  ['story.sponsor.title', d => { d.story.sponsor.title = 'Chief Revenue Officer'; }, 'sponsor.title'],
  ['story.sponsor.voice', d => { d.story.sponsor.voice = 'Brisk and dry'; }, 'world.sponsorVoice'],
  ['story.screens[].body', d => { d.story.screens.find(s => s.key === 'welcome')!.body = 'Welcome aboard.'; }, 'intro.welcome'],
  ['process.stages[].name', d => { d.process.stages[0].name = 'Prospects'; }, 'stages.0.name'],
  ['process.stages[].people', d => { d.process.stages[0].people = 3; }, 'stages.0.ideal'],
  ['process.stages[].passesOn', d => { d.process.stages[1].passesOn = 35; }, 'stages.1.conversionRatio'],
  ['process.revenue', d => { d.process.revenue = 999000; }, 'money.target'],
  ['process.weeks', d => { fitRun(d, 6); }, 'time.period.count'],
  ['process.daysPerWeek', d => { fitRun(d, d.process.weeks, 4); }, 'time.subPeriod.perPeriod'],
  ['process.pacing', d => { d.process.pacing = 'demanding'; }, 'money.inputPerSubPeriod'],
  ['team[].first', d => { member(d).first = 'Kenneth'; }, `${M}.name`],
  ['team[].last', d => { member(d).last = 'Okoye'; }, `${M}.name`],
  ['team[].gender', d => { member(d).gender = 'nonbinary'; member(d).pronouns = pronounsOf('nonbinary'); }, `${M}.pronoun`],
  ['team[].pronouns', d => { member(d).pronouns = 'they, them'; }, `${M}.pronoun`],
  ['team[].ageRange', d => { member(d).ageRange = '55 and over'; }, `${M}.npc.age`],
  ['team[].title', d => { member(d).title = 'Senior Closer'; }, `${M}.title`],
  ['team[].stage', d => { member(d).stage = d.process.stages.find(s => s.key !== member(d).stage)!.key; }, `${M}.homeStage`],
  ['team[].photo', d => { member(d).photo = PORTRAITS.find(p => p !== member(d).photo)!; }, `${M}.portrait`],
  ['team[].voice.id', d => { member(d).voice.id = 'calm_low_m'; }, `${M}.voice`],
  ['team[].voice.language', d => { member(d).voice.language = 'Hindi'; }, `${M}.npc.speech.language`],
  ['team[].voice.accent', d => { member(d).voice.accent = 'Singapore English'; }, `${M}.npc.speech.accent`],
  ['team[].voice.pace', d => { member(d).voice.pace = 12; }, `${M}.npc.speech.pace`],
  ['team[].voice.warmth', d => { member(d).voice.warmth = 12; }, `${M}.npc.speech.warmth`],
  ['team[].voice.formality', d => { member(d).voice.formality = 12; }, `${M}.npc.speech.formality`],
  ['team[].voice.replyLength', d => { member(d).voice.replyLength = 'long'; }, `${M}.npc.speech.replyLength`],
  ['team[].persona', d => { member(d).persona = 'Quiet, careful, proud of the numbers.'; }, `${M}.profile.remarks`],
  ['team[].hiddenConcern', d => { member(d).hiddenConcern = 'Thinks a rival will poach the team.'; }, `${M}.hiddenConcern`],
  ['team[].concernLine', d => { member(d).concernLine = 'Honestly, I am tired.'; }, `${M}.concernLine`],
  ['team[].commStyles', d => { member(d).commStyles = ['Talkative']; }, `${M}.profile.attitude`],
  ['team[].motivatedBy', d => { member(d).motivatedBy = 'A say in pricing.'; }, `${M}.npc.motivatedBy`],
  ['team[].reactions', d => { member(d).reactions[d.lens.styles[0].key] = 'Bristles, then complies.'; }, `${M}.npc.reactions`],
  ['team[].relationships[].with', d => { member(d).relationships[0].with = d.team[3].id; }, `${M}.profile.relations`],
  ['team[].relationships[].kind', d => { member(d).relationships[0].kind = 'Mentors'; }, `${M}.profile.relations`],
  ['team[].noTopics', d => { member(d).noTopics = 'Salary'; }, `${M}.npc.avoid`],
  ['team[].stats.skill', d => { member(d).stats.skill = 5; }, `${M}.start`],
  ['team[].stats.morale', d => { member(d).stats.morale = 5; }, `${M}.start`],
  ['team[].stats.result', d => { member(d).stats.result = 5; }, `${M}.start`],
  ['team[].stats.trust', d => { member(d).stats.trust = 5; }, `${M}.start`],
  ['team[].bestStage', d => { member(d).bestStage = d.process.stages.find(s => s.key !== member(d).stage)!.key; }, `${M}.byStage`],
  ['team[].experience', d => { member(d).experience = '11 years'; }, `${M}.profile.experience`],
  ['team[].tenure', d => { member(d).tenure = '2 months'; }, `${M}.profile.tenure`],
  ['team[].previousCompany', d => { member(d).previousCompany = 'Beta Lifts'; }, `${M}.npc.notes`],
  ['team[].careerGoal', d => { member(d).careerGoal = 'Run the region.'; }, `${M}.careerGoal`],
  ['team[].shown.experience', d => { member(d).shown.experience = false; }, `${M}.profile.experience`],
  ['team[].shown.tenure', d => { member(d).shown.tenure = false; }, `${M}.profile.tenure`],
  ['team[].shown.previousCompany', d => { member(d).shown.previousCompany = true; member(d).previousCompany ||= 'Beta Lifts'; }, `${M}.profile.previous`],
  ['team[].shown.careerGoal', d => { member(d).shown.careerGoal = false; }, `${M}.careerGoal`],
  ['team[].custom', d => { member(d).custom.push({ label: 'Hobby', value: 'Cycling' }); }, `${M}.npc.notes`],
  ['lens.id', d => { changeLens(d, 'six_styles'); }, 'lens.id'],
  ['lens.secondary', d => { d.lens.secondary = 'servant'; }, 'lens.secondary'],
  ['lens.styles[].letter', d => { d.lens.styles[0].letter = 'X'; }, 'lens.styles'],
  ['lens.styles[].name', d => { d.lens.styles[0].name = 'Instruct'; }, 'lens.styles'],
  ['lens.styles[].short', d => { d.lens.styles[0].short = 'Show how'; }, 'lens.styles'],
  ['lens.styles[].description', d => { d.lens.styles[0].description = 'You show how.'; }, 'lens.styles'],
  ['lens.fit', d => { d.lens.fit.highSkill_highMorale[d.lens.styles[0].key] = 0; }, 'lens.fit'],
  ['actions[].name', d => { act(d, 'f2f').name = 'One to one'; }, 'actions.key=f2f.name'],
  ['actions[].description', d => { act(d, 'f2f').description = 'Talk alone.'; }, 'actions.key=f2f.description'],
  ['actions[].enabled', d => { act(d, 'email').enabled = false; }, 'actions'],
  ['actions[].plays', d => { act(d, 'reward').plays = 'static'; }, 'actions.key=reward.kind'],
  ['actions[].cost', d => { act(d, 'f2f').cost = 2; }, 'actions.key=f2f.cost'],
  ['actions[].againAfter', d => { act(d, 'f2f').againAfter = 5; }, 'actions.key=f2f.cooldownDays'],
  ['actions[].availableFrom', d => { act(d, 'f2f').availableFrom = 3; }, 'actions.key=f2f.unlockPeriod'],
  ['actions[].starts', d => { act(d, 'f2f').starts = 'participant'; }, 'actions.key=f2f.live.opening'],
  ['actions[].goal', d => { act(d, 'f2f').goal = 'Find out what is in the way.'; }, 'actions.key=f2f.live.goal'],
  ['actions[].impact', d => { const a = act(d, 'f2f'); const k = Object.keys(a.impact)[0]; a.impact[k] = { ...a.impact[k], fit: 'Skill +9' }; }, 'actions.key=f2f.options'],
  ['actions[].options[].label', d => { act(d, 'energize').options[0].label = 'Pizza'; }, 'actions.key=energize.options'],
  ['actions[].options[].style', d => { const o = act(d, 'energize').options[0]; o.style = d.lens.styles.find(s => s.key !== o.style)!.key; }, 'actions.key=energize.options'],
  ['actions[].options[].away', d => { act(d, 'energize').options[0].away = 3; }, 'actions.key=energize.options'],
  ['actions[].options[].fits', d => { act(d, 'energize').options[0].fits = 'Morale +9'; }, 'actions.key=energize.options'],
  ['actions[].options[].misses', d => { act(d, 'energize').options[0].misses = 'Morale −9'; }, 'actions.key=energize.options'],
  ['actions[].scoredOn', d => { act(d, 'f2f').scoredOn = [d.scoring.skills[d.scoring.skills.length - 1].name]; }, 'report.linkage.f2f'],
  ['events[].title', d => { ev(d, 'challenge_kickoff').title = 'Targets up'; }, 'events.key=challenge_kickoff.title'],
  ['events[].kind', d => { ev(d, 'challenge_kickoff').kind = 'opportunity'; }, 'events.key=challenge_kickoff.card'],
  ['events[].week', d => { ev(d, 'challenge_kickoff').week = 2; }, 'events.key=challenge_kickoff.period'],
  ['events[].day', d => { ev(d, 'challenge_kickoff').day = 3; }, 'events.key=challenge_kickoff.subPeriod'],
  ['events[].timing', d => { Object.assign(ev(d, 'challenge_kickoff'), { timing: 'condition', week: null, condition: { kind: 'teamTrustBelow', value: 35, weeks: 2 } }); }, 'events.key=challenge_kickoff.when'],
  ['events[].window.from', d => { const e = ev(d, 'big_referral'); e.window = { ...e.window!, from: 2 }; }, 'events.key=big_referral.window'],
  ['events[].window.to', d => { const e = ev(d, 'big_referral'); e.window = { ...e.window!, to: 4 }; }, 'events.key=big_referral.window'],
  ['events[].window.chance', d => { const e = ev(d, 'big_referral'); e.window = { ...e.window!, chance: 25 }; }, 'events.key=big_referral.window'],
  ['events[].condition.kind', d => { const e = ev(d, 'morale_alarm'); e.condition = { ...e.condition!, kind: 'behindPace' }; }, 'events.key=morale_alarm.when'],
  ['events[].condition.value', d => { const e = ev(d, 'morale_alarm'); e.condition = { ...e.condition!, value: 55 }; }, 'events.key=morale_alarm.when'],
  ['events[].condition.weeks', d => { const e = ev(d, 'morale_alarm'); e.condition = { ...e.condition!, weeks: 3 }; }, 'events.key=morale_alarm.when'],
  ['events[].who', d => { ev(d, 'challenge_kickoff').who = `stage:${d.process.stages[0].key}`; }, 'events.key=challenge_kickoff.target'],
  ['events[].arrives', d => { ev(d, 'challenge_kickoff').arrives = 'bulletin'; }, 'events.key=challenge_kickoff.delivery'],
  ['events[].body', d => { ev(d, 'challenge_kickoff').body = 'The target goes up.'; }, 'events.key=challenge_kickoff.body'],
  ['events[].skill', d => { ev(d, 'challenge_kickoff').skill = -4; }, 'events.key=challenge_kickoff.impact'],
  ['events[].morale', d => { ev(d, 'challenge_kickoff').morale = -9; }, 'events.key=challenge_kickoff.impact'],
  ['events[].result', d => { ev(d, 'challenge_kickoff').result = 4; }, 'events.key=challenge_kickoff.impact'],
  ['events[].leadFlow', d => { ev(d, 'challenge_kickoff').leadFlow = -30; }, 'money.inputPerSubPeriod'],
  ['events[].respondWith', d => { ev(d, 'challenge_kickoff').respondWith = ['meet']; }, 'events.key=challenge_kickoff.response'],
  ['events[].within', d => { ev(d, 'lens_moment').within = 4; }, 'events.key=lens_moment.response'],
  ['events[].onTime', d => { ev(d, 'lens_moment').onTime = [1, 5, 1]; }, 'events.key=lens_moment.response'],
  ['events[].ifIgnored.sponsor', d => { ev(d, 'lens_moment').ifIgnored.sponsor = false; }, 'events.key=lens_moment.escalation'],
  ['events[].ifIgnored.followUp', d => { ev(d, 'lens_moment').ifIgnored.followUp = 'public_complaint'; }, 'events.key=lens_moment.escalation'],
  ['scoring.framework', d => { d.scoring.framework = { file: 'ours.md', pages: 1, step: 3, confirmed: true, rows: [{ skill: 'Listening', behaviors: 'Asks open questions', levels: 5, page: 1, include: true }, { skill: 'Clarity', behaviors: 'Sets one next step', levels: 5, page: 1, include: true }] }; d.scoring.skills = [{ key: 'listening', name: 'Listening', reportOnly: false }, { key: 'clarity', name: 'Clarity', reportOnly: false }]; d.actions.forEach(a => { a.scoredOn = ['Listening', 'Clarity']; }); remapReads(d); }, 'report.skills'],
  ['scoring.levels', d => { d.scoring.levels = ['Starting', 'Growing', 'Strong']; }, 'report.scale'],
  // People dynamics and business variables (D135, D136).
  ['process.dynamics', d => { d.process.dynamics = false; }, 'dynamics'],
  ['variables[].key', d => { d.variables[1].key = 'trust_index'; for (const e of d.events) for (const o of e.choice?.options ?? []) { if (o.variables.customer_trust !== undefined) { o.variables.trust_index = o.variables.customer_trust; delete o.variables.customer_trust; } } }, 'variables.1.key'],
  ['variables[].name', d => { d.variables[0].name = 'Spend'; }, 'variables.0.name'],
  ['variables[].format', d => { d.variables[0].format = 'points'; }, 'variables.0.format'],
  ['variables[].start', d => { d.variables[1].start = 55; }, 'variables.1.start'],
  ['variables[].min', d => { d.variables[1].min = 10; }, 'variables.1.min'],
  ['variables[].max', d => { d.variables[1].max = 90; }, 'variables.1.max'],
  ['variables[].drift', d => { d.variables[1].drift = -2; }, 'variables.1.drift'],
  ['variables[].shown', d => { d.variables[1].shown = false; }, 'variables.1.shown'],
  ['variables[].weight', d => { d.variables[1].weight = 40; }, 'variables.1.weight'],
  ['variables[].higherIsBetter', d => { d.variables[1].higherIsBetter = false; }, 'variables.1.higherIsBetter'],
  ['variables[].about', d => { d.variables[1].about = 'What customers say.'; }, 'variables.1.about'],
  // Conditions, choices and delayed follow ups (D137, D138).
  ['events[].conditions', d => { ev(d, 'public_complaint').conditions = [{ kind: 'flag', flag: 'discounted', is: true }]; }, 'events.key=public_complaint.if'],
  ['events[].ifIgnored.afterDays', d => { ev(d, 'lens_moment').ifIgnored = { sponsor: true, followUp: 'public_complaint', afterDays: 3 }; }, 'events.key=lens_moment.escalation'],
  ['events[].choice.known', d => { ev(d, DISCOUNT).choice!.known = 'Only this.'; }, `${CH}.known`],
  ['events[].choice.within', d => { ev(d, DISCOUNT).choice!.within = 4; }, `${CH}.within`],
  ['events[].choice.default', d => { ev(d, DISCOUNT).choice!.default = 'value'; }, `${CH}.default`],
  ['events[].choice.options[].key', d => { opt(d).key = 'take'; ev(d, DISCOUNT).choice!.default = 'take'; }, `${CH}.options.0.key`],
  ['events[].choice.options[].label', d => { opt(d).label = 'Say yes'; }, `${CH}.options.0.label`],
  ['events[].choice.options[].detail', d => { opt(d).detail = 'Fast money.'; }, `${CH}.options.0.detail`],
  ['events[].choice.options[].outcome', d => { opt(d).outcome = 'It closes.'; }, `${CH}.options.0.outcome`],
  ['events[].choice.options[].who', d => { opt(d).who = 'team'; }, `${CH}.options.0.who`],
  ['events[].choice.options[].skill', d => { opt(d).skill = 2; }, `${CH}.options.0.people`],
  ['events[].choice.options[].morale', d => { opt(d).morale = -5; }, `${CH}.options.0.people`],
  ['events[].choice.options[].result', d => { opt(d).result = 9; }, `${CH}.options.0.people`],
  ['events[].choice.options[].trust', d => { opt(d).trust = -4; }, `${CH}.options.0.trust`],
  ['events[].choice.options[].revenue', d => { opt(d).revenue = 5000; }, `${CH}.options.0.business.revenue`],
  ['events[].choice.options[].sponsor', d => { opt(d).sponsor = 6; }, `${CH}.options.0.business.sponsor`],
  ['events[].choice.options[].variables', d => { opt(d).variables.budget = 1000; }, `${CH}.options.0.business.variables`],
  ['events[].choice.options[].set', d => { opt(d).set = ['rushed']; }, `${CH}.options.0.business.set`],
  ['events[].choice.options[].clear', d => { opt(d).clear = ['rushed']; }, `${CH}.options.0.business.clear`],
  ['events[].choice.options[].followUp', d => { opt(d).followUp = { event: 'public_complaint', days: 2, weeks: 1 }; }, `${CH}.options.0.business.followUps`],
  ['events[].choice.options[].read[].skill', d => { opt(d).read[0].skill = d.scoring.skills.filter(k => !k.reportOnly).at(-1)!.name; }, `${CH}.options.0.read`],
  ['events[].choice.options[].read[].band', d => { opt(d).read[0].band = 'harmful'; }, `${CH}.options.0.read`],
  ['scoring.reportSections', d => { d.scoring.reportSections = ['about', 'summary', 'skills']; }, 'report.sections'],
  // Stakeholders outside the team (D160 to D163).
  ['stakeholders[].name', d => { sh(d).name = 'Helen Price'; }, `${SH}.name`],
  ['stakeholders[].role', d => { sh(d).role = 'Finance Director'; }, `${SH}.role`],
  ['stakeholders[].kind', d => { sh(d).kind = 'manager'; }, `${SH}.kind`],
  ['stakeholders[].gender', d => { sh(d).gender = 'man'; sh(d).pronouns = pronounsOf('man'); }, `${SH}.pronoun`],
  ['stakeholders[].pronouns', d => { sh(d).pronouns = 'she, her'; }, `${SH}.pronoun`],
  ['stakeholders[].photo', d => { sh(d).photo = PORTRAITS[4]; }, `${SH}.portrait`],
  ['stakeholders[].about', d => { sh(d).about = 'Runs finance.'; }, `${SH}.about`],
  ['stakeholders[].persona', d => { sh(d).persona = 'Warm once she trusts you.'; }, `${SH}.npc.notes`],
  ['stakeholders[].motivatedBy', d => { sh(d).motivatedBy = 'A clean audit'; }, `${SH}.npc.motivatedBy`],
  ['stakeholders[].noTopics', d => { sh(d).noTopics = 'Other budgets'; }, `${SH}.npc.avoid`],
  ['stakeholders[].hiddenConcern', d => { sh(d).hiddenConcern = 'Her job is at risk.'; }, `${SH}.hiddenConcern`],
  ['stakeholders[].concernLine', d => { sh(d).concernLine = 'Honestly, I might not be here next year.'; }, `${SH}.concernLine`],
  ['stakeholders[].voice.pace', d => { sh(d).voice.pace = 90; }, `${SH}.npc.speech`],
  ['stakeholders[].voice.warmth', d => { sh(d).voice.warmth = 90; }, `${SH}.npc.speech`],
  ['stakeholders[].voice.formality', d => { sh(d).voice.formality = 5; }, `${SH}.npc.speech`],
  ['stakeholders[].voice.replyLength', d => { sh(d).voice.replyLength = 'long'; }, `${SH}.npc.speech`],
  ['stakeholders[].start.trust', d => { sh(d).start.trust = 70; }, `${SH}.start`],
  ['stakeholders[].start.satisfaction', d => { sh(d).start.satisfaction = 20; }, `${SH}.start`],
  ['stakeholders[].drift', d => { sh(d).drift = 6; }, `${SH}.drift`],
  ['stakeholders[].interactions[].enabled', d => { ix(d, 'email').enabled = true; }, `${SH}.interactions`],
  ['stakeholders[].interactions[].label', d => { ix(d, 'meet').label = 'Coffee with Helen'; }, `${MEET}.label`],
  ['stakeholders[].interactions[].goal', d => { ix(d, 'meet').goal = 'Win her over.'; }, `${MEET}.goal`],
  ['stakeholders[].interactions[].plays', d => { ix(d, 'negotiate').plays = 'live'; }, `${NEG}.kind`],
  ['stakeholders[].interactions[].cost', d => { ix(d, 'meet').cost = 2; }, `${MEET}.cost`],
  ['stakeholders[].interactions[].from', d => { ix(d, 'meet').from = 2; }, `${MEET}.from`],
  ['stakeholders[].interactions[].scoredOn', d => { ix(d, 'meet').scoredOn = [d.scoring.skills.filter(k => !k.reportOnly).at(-1)!.name]; }, `${MEET}.skills`],
  ...EFFECT_FIELDS.flatMap(f => (['good', 'bad'] as const).map((g): [string, (d: AuthorDraft) => void, string] => [
    `stakeholders[].interactions[].${g}.${f}`, d => changeEffect(d, ix(d, 'meet')[g], f), `${MEET}.consequences.${g === 'good' ? 'strong' : 'weak'}`
  ])),
  ['stakeholders[].interactions[].options[].label', d => { ix(d, 'negotiate').options[0].label = 'Ask for more'; }, `${NEG}.options`],
  ['stakeholders[].interactions[].options[].detail', d => { ix(d, 'negotiate').options[0].detail = 'Bold.'; }, `${NEG}.options`],
  ['stakeholders[].interactions[].options[].needsTrust', d => { ix(d, 'negotiate').options[0].needsTrust = 70; }, `${NEG}.options`],
  ['stakeholders[].interactions[].options[].refusal', d => { ix(d, 'negotiate').options[0].refusal = 'No.'; }, `${NEG}.options`],
  ['stakeholders[].interactions[].options[].read[].skill', d => { ix(d, 'negotiate').options[0].read[0].skill = d.scoring.skills.filter(k => !k.reportOnly).at(-1)!.name; }, `${NEG}.options`],
  ['stakeholders[].interactions[].options[].read[].band', d => { ix(d, 'negotiate').options[0].read[0].band = 'weak'; }, `${NEG}.options`],
  ...EFFECT_FIELDS.map((f): [string, (d: AuthorDraft) => void, string] => [`stakeholders[].interactions[].options[].effect.${f}`, d => changeEffect(d, ix(d, 'negotiate').options[0].effect, f), `${NEG}.options`]),
  ['events[].stakeholder', d => { const e = ev(d, 'cfo_asks'); Object.assign(e, { stakeholder: null, request: null, arrives: 'modal', ifIgnored: { sponsor: false, followUp: null } }); }, `${ASK}.stakeholder`],
  ['events[].request.kind', d => { ev(d, 'cfo_asks').request!.kind = 'message'; }, `${ASK}.request`],
  ['events[].request.interaction', d => { ev(d, 'cfo_asks').request!.interaction = 'present'; }, `${ASK}.request`],
  ['events[].request.within', d => { ev(d, 'cfo_asks').request!.within = 4; }, `${ASK}.request`],
  ['events[].request.onTime.trust', d => { ev(d, 'cfo_asks').request!.onTime.trust = 9; }, `${ASK}.request`],
  ['events[].request.onTime.satisfaction', d => { ev(d, 'cfo_asks').request!.onTime.satisfaction = 9; }, `${ASK}.request`],
  ['events[].request.ifIgnored.trust', d => { ev(d, 'cfo_asks').request!.ifIgnored.trust = -12; }, `${ASK}.request`],
  ['events[].request.ifIgnored.satisfaction', d => { ev(d, 'cfo_asks').request!.ifIgnored.satisfaction = -12; }, `${ASK}.request`],
  ['events[].moves', d => { ev(d, 'cfo_asks').moves = { [sh(d).key]: { trust: -4, satisfaction: -2 } }; }, `${ASK}.business`],
  ['events[].choice.options[].stakeholders', d => { opt(d).stakeholders = { [sh(d).key]: { trust: 5, satisfaction: 5 } }; }, `${CH}.options.0.business.stakeholders`]
];

/** Author notes (D128): shown to the author, read by Kora or Review and publish, never by the simulation; the screen says so. */
const AUTHOR_NOTES: Record<string, string> = {
  'brief.participants': 'Brief for Kora: the Brief tab says Kora drafted the other tabs from it',
  'brief.industry': 'Brief for Kora',
  'brief.client': 'Brief for Kora',
  'brief.challenge': 'Brief for Kora; changing it offers to redraft the events and characters',
  'brief.tones': 'Brief for Kora: labelled "Tone, for Kora\'s drafting"',
  'brief.documents': 'Brief for Kora: "Documents you shared with Kora"',
  'process.pressure': 'Kora leans events and characters on it when drafting',
  'scoring.samples[].call': 'The author\'s check that scoring matches their judgment; Review and publish reads it',
  'publish.cohort': 'The publishing record',
  'publish.notes': 'The publishing record',
  'publish.skipTest': 'Publish without testing (D132): Review and publish reads it, the simulation never does'
};

/** Internal state, ids, and values the screen derives or shows read only. */
const INTERNAL = new Set([
  'v', 'stage', 'savedAt', 'chat', 'marks', 'suggestions[].id', 'suggestions[].tab', 'suggestions[].text', 'suggestions[].action', 'suggestions[].done', 'calibration',
  // No longer shown (D128): nothing played them. Kept so drafts saved earlier read back.
  'brief.conversationBy', 'brief.minutesPerWeek', 'brief.targetSkills', 'brief.saveAndResume',
  'story.screens[].key', 'process.stages[].key', 'process.stages[].perWeek', 'team[].id',
  'lens.title', 'lens.needs', 'lens.styles[].key', 'lens.library[].key', 'lens.library[].letter', 'lens.library[].name', 'lens.library[].short', 'lens.library[].description',
  'actions[].key', 'actions[].template', 'actions[].group', 'actions[].core', 'actions[].canPlay', 'actions[].forWhom', 'actions[].format', 'actions[].decides', 'actions[].origin', 'actions[].options[].key',
  'events[].key', 'events[].origin',
  'stakeholders[].key', 'stakeholders[].interactions[].type', 'stakeholders[].interactions[].options[].key',
  'scoring.skills[].key', 'scoring.skills[].name', 'scoring.skills[].reportOnly', 'scoring.samples[].id', 'scoring.samples[].with', 'scoring.samples[].answer', 'scoring.samples[].scored',
  'publish.version', 'publish.played'
]);

/**
 * Known gaps, outside this change (reported in D128): the client theme is not exported yet (Brand and
 * theme), and the Story tab's visuals and extra intro screens have no engine field.
 */
const KNOWN_GAPS = new Set([
  'brand.from', 'brand.name', 'brand.logo', 'brand.main', 'brand.second', 'brand.font', 'brand.look', 'brand.preview',
  'story.company.office', 'story.company.logo', 'story.product.view', 'story.screens[].title'
]);

const RECORDS = new Set(['chat', 'marks', 'lens.fit', 'lens.needs', 'team[].reactions', 'actions[].impact', 'scoring.framework', 'calibration', 'events[].onTime', 'events[].choice.options[].variables',
  'events[].moves', 'events[].choice.options[].stakeholders', 'stakeholders[].interactions[].good.variables', 'stakeholders[].interactions[].bad.variables', 'stakeholders[].interactions[].options[].effect.variables']);
/** Every field path of a draft: arrays as `[]` over all their elements, records as one field. */
function fieldsOf(v: unknown, path = '', out = new Set<string>()): Set<string> {
  if (RECORDS.has(path)) out.add(path);
  else if (Array.isArray(v)) {
    const objects = v.filter(x => x && typeof x === 'object' && !Array.isArray(x));
    if (objects.length) for (const x of objects) fieldsOf(x, `${path}[]`, out); else out.add(path);
  } else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) fieldsOf(x, path ? `${path}.${k}` : k, out);
  else out.add(path);
  return out;
}

describe('every field the author sees reaches the storyline (D128)', () => {
  const base = fixture();
  const before = toStoryline(base);

  it('the fixture exports cleanly', () => {
    expect(before.issues).toEqual([]);
  });

  it.each(WIRED)('%s changes %s', (_field, change, path) => {
    const d = structuredClone(base);
    change(d);
    const after = toStoryline(d);
    expect(after.issues).toEqual([]);
    expect(JSON.stringify(at(after.storyline, path))).not.toEqual(JSON.stringify(at(before.storyline, path)));
  });

  it('lists every field of the draft: wired, an author note, internal, or a known gap', () => {
    const listed = new Set([...WIRED.map(([f]) => f), ...Object.keys(AUTHOR_NOTES), ...INTERNAL, ...KNOWN_GAPS]);
    const all = fieldsOf(base);
    // An empty list of objects in one element shows as a leaf; its fields come from the others.
    const fields = new Set([...all].filter(f => ![...all].some(g => g.startsWith(`${f}[]`))));
    expect([...fields].filter(f => !listed.has(f))).toEqual([]);
    expect([...listed].filter(f => !fields.has(f))).toEqual([]);
  });
});

describe('pacing, days and lead flow (D129)', () => {
  it('gives each pacing and days per week combination its own storyline', () => {
    const seen = new Set<string>();
    for (const pacing of ['forgiving', 'balanced', 'demanding'] as const) for (const days of [3, 5, 7]) {
      const d = fixture();
      d.process.pacing = pacing;
      fitRun(d, d.process.weeks, days);
      const out = toStoryline(d);
      expect(out.issues, `${pacing} ${days}`).toEqual([]);
      seen.add(JSON.stringify(out.storyline));
    }
    expect(seen.size).toBe(9);
  });

  it('keeps balanced at five days as drafted, and a week\'s leads the same whatever the days', () => {
    const d = fixture();
    const sl = toStoryline(d).storyline;
    expect(sl.money.inputPerSubPeriod).toHaveLength(1);
    expect(sl.drift).toBeUndefined();
    fitRun(d, d.process.weeks, 4);
    const four = toStoryline(d).storyline;
    expect(four.money.inputPerSubPeriod[0] * 4).toBeCloseTo(sl.money.inputPerSubPeriod[0] * 5, 1);
  });

  it('moves leads in the week of a fixed event with lead flow only', () => {
    const d = fixture();
    const e = d.events.find(x => x.timing === 'fixed' && x.week === 2)!;
    e.leadFlow = 50;
    const leads = toStoryline(d).storyline.money.inputPerSubPeriod;
    expect(leads).toHaveLength(d.process.weeks);
    expect(leads[1]).toBeCloseTo(leads[0] * 1.5, 1);
    e.timing = 'random';
    expect(toStoryline(d).issues.join()).toMatch(/lead flow, which needs a fixed week/);
  });
});

describe('events export as authored (D128)', () => {
  it('a conditional event authored in /author keeps its condition, never week 1', () => {
    const d = fixture();
    d.events.push({ key: 'mine', title: 'Trust wobbles', kind: 'people', week: null, day: 1, timing: 'condition', condition: { kind: 'teamTrustBelow', value: 40, weeks: 2 }, who: 'team', arrives: 'modal', body: 'Trust is low.', skill: 0, morale: -2, result: 0, leadFlow: 0, respondWith: ['meet'], within: 3, onTime: [0, 3, 0], ifIgnored: { sponsor: true, followUp: 'public_complaint' }, origin: 'yours' });
    const out = toStoryline(d);
    expect(out.issues).toEqual([]);
    const e = out.storyline.events!.find(x => x.key === 'mine')!;
    expect(e.period).toBeUndefined();
    expect(e.when).toEqual({ condition: 'teamTrustBelow', value: 40, periods: 2 });
    expect(e.response).toEqual({ actions: ['meet'], within: 3, onTime: [0, 3, 0] });
    expect(e.escalation).toEqual({ sponsor: true, event: 'public_complaint' });
    expect(parseStoryline(out.storyline).ok).toBe(true);
  });

  it('names a missing person, stage, action or follow up instead of retargeting it', () => {
    const d = fixture();
    const email = d.events.find(e => e.arrives === 'email')!;
    d.team = d.team.filter(c => c.id !== email.who);
    const stageEvent = d.events.find(e => e.key === 'lens_challenge')!;
    stageEvent.who = 'stage:gone';
    const offer = d.events.find(e => e.key === 'offer_elsewhere')!;
    act(d, 'reward').enabled = false;
    offer.ifIgnored.followUp = 'nope';
    const out = toStoryline(d);
    expect(out.issues.join('\n')).toMatch(new RegExp(`Event "${email.title}": it is about a person who is no longer on the team`));
    expect(out.issues.join('\n')).toMatch(/it hits a stage that is no longer in the work process/);
    expect(out.issues.join('\n')).toMatch(/counts Reward member as the response, but that action is not in this simulation/);
    expect(out.issues.join('\n')).toMatch(/leads to an event that no longer exists \(nope\)/);
    expect(out.storyline.events!.find(e => e.key === email.key)!.target).toBe(email.who);
    expect(out.issues.filter(i => /^events\.\d+\.target/.test(i))).toEqual([]);
  });

  it('refuses an email to the whole team rather than turning it into a card', () => {
    const d = fixture();
    const email = d.events.find(e => e.arrives === 'email')!;
    email.who = 'team';
    const out = toStoryline(d);
    expect(out.storyline.events!.find(e => e.key === email.key)!.delivery).toBe('email');
    expect(out.issues.join()).toMatch(/it arrives as an email, which comes from one person, but it hits the whole team/);
  });

  it('a duplicate option key from remove then add fails the engine schema, so the editor makes fresh ones', () => {
    const d = fixture();
    const a = act(d, 'energize');
    a.options.push({ ...a.options[0] });
    expect(toStoryline(d).issues.join()).toMatch(/Duplicate option/);
  });
});

describe('the run stays inside its length (D128)', () => {
  it('maps weeks proportionally, keeping the first and the last', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8].map(w => mapWeek(w, 8, 4))).toEqual([1, 1, 2, 2, 3, 3, 4, 4]);
    expect([1, 2, 3, 4].map(w => mapWeek(w, 4, 8))).toEqual([1, 3, 6, 8]);
  });

  it('switching to Lite moves every event, window and action into the four weeks, and says what moved', () => {
    const d = fixture();
    d.brief.run = 'lite';
    const moved = fitRun(d, 4);
    expect(moved.length).toBeGreaterThan(0);
    expect(d.events.every(e => (e.week ?? 1) <= 4 && (e.window?.to ?? 1) <= 4)).toBe(true);
    expect(d.actions.every(a => a.availableFrom <= 4)).toBe(true);
    const out = toStoryline(d);
    expect(out.issues).toEqual([]);
    const weeks = out.storyline.events!.flatMap(e => (e.period ? [e.period] : []));
    expect(new Set(weeks).size).toBeGreaterThan(2);
  });

  it('keeps the draft inside the engine\'s bounds: 2 to 10 weeks, 6 to 12 people', async () => {
    const { AuthorDraft } = await import('./draft');
    const d = fixture();
    const raw = JSON.parse(JSON.stringify(d)) as Record<string, Record<string, unknown>>;
    raw.process.weeks = 12;
    expect(AuthorDraft.parse(raw).process.weeks).toBe(10);
    expect(AuthorDraft.safeParse({ ...d, team: d.team.slice(0, 5) }).success).toBe(false);
    fitRun(d, 12);
    expect(d.process.weeks).toBe(10);
    expect(toStoryline(d).issues).toEqual([]);
  });

  it('reads an event saved before D128 back as structure', async () => {
    const { AuthorDraft } = await import('./draft');
    const d = JSON.parse(JSON.stringify(fixture())) as { events: Array<Record<string, unknown>> };
    const e = d.events.find(x => x.key === 'lens_moment')!;
    delete e.respondWith; delete e.ifIgnored;
    Object.assign(e, { response: 'f2f, coach, feedback', ignored: 'The sponsor hears about it' });
    const back = AuthorDraft.parse(d).events.find(x => x.key === 'lens_moment')!;
    expect(back.respondWith).toEqual(['f2f', 'coach', 'feedback']);
    expect(back.ifIgnored).toEqual({ sponsor: true, followUp: null });
  });
});

describe('choices, conditions and business variables export as authored (D135 to D138)', () => {
  it('a new draft plays with dynamics, two business variables and two choice events whose reads are the report\'s skill keys', () => {
    const out = toStoryline(fixture());
    expect(out.issues).toEqual([]);
    const p = parseStoryline(out.storyline);
    if (!p.ok) throw new Error(p.issues.join('\n'));
    expect(p.config.dynamics).toBeDefined();
    expect(p.config.variables.map(v => [v.key, v.format, v.weight])).toEqual([['budget', 'money', 0], ['customer_trust', 'percent', 0.2]]);
    const choices = p.config.events.filter(e => e.choice);
    expect(choices.map(e => e.key)).toEqual(['discount_decision', 'budget_decision']);
    const keys = new Set(p.config.report.skills.map(k => k.key));
    expect(choices.flatMap(e => e.choice!.options.flatMap(o => o.read.map(r => r.skill))).every(k => keys.has(k))).toBe(true);
    expect(choices[0].choice!.known).toEqual(['The customer\'s budget closes on Friday.', 'Your sponsor wants this quarter\'s number.']);
  });

  it('cutting the training budget in week 2 brings "Two people ask for the training you cut" in week 4, when morale is low, through the export', async () => {
    const d = fixture();
    const cut = ev(d, 'budget_decision');
    cut.week = 2;
    d.events.push({ key: 'training_ask', title: 'Two people ask for the training you cut', kind: 'people', week: 4, day: 1, timing: 'fixed', who: 'team', arrives: 'modal',
      body: 'Two of your team ask when the training will be back.', skill: 0, morale: -3, result: 0, leadFlow: 0, respondWith: [], within: 2, onTime: [0, 2, 0],
      ifIgnored: { sponsor: false, followUp: null }, conditions: [{ kind: 'flag', flag: 'budget_cut', is: true }, { kind: 'metric', metric: 'teamMorale', op: 'below', value: 60 }], origin: 'yours' });
    const out = toStoryline(d);
    expect(out.issues).toEqual([]);
    const p = parseStoryline(out.storyline);
    if (!p.ok) throw new Error(p.issues.join('\n'));
    for (const option of ['cut', 'keep']) {
      const e = createEngine(p.config, { seed: 3 });
      let played = false;
      while (e.view().clock.period <= 4 && e.view().phase !== 'ended') {
        if (e.view().phase === 'style') await e.dispatch({ type: 'confirmStyles', styles: await neededStyles(e, p.config.thresholds.high, p.config.lens) });
        // Spend the week a day at a time (assess costs a day and changes nobody), deciding as soon as the choice is open.
        while (e.view().clock.capacityLeft >= 1) {
          const v = e.view();
          const open = v.openChoices.find(c => c.eventKey === 'budget_decision');
          if (open) await e.dispatch({ type: 'decide', choiceId: open.id, option });
          for (const c of e.view().openChoices) if (c.eventKey !== 'budget_decision') await e.dispatch({ type: 'decide', choiceId: c.id, option: p.config.events.find(x => x.key === c.eventKey)!.choice!.options[1].key });
          const m = v.members.find(x => !v.actions.find(a => a.key === 'assess')!.blockedFor[x.id]);
          if (!m) break;
          await e.dispatch({ type: 'planAction', action: 'assess', memberIds: [m.id], stage: v.funnel.find(st => st.key !== m.stage)!.key });
        }
        played ||= e.view().history.some(l => l.title === 'Two people ask for the training you cut');
        await e.dispatch({ type: 'endPeriod' });
        if (e.view().pendingReward) await e.dispatch({ type: 'chooseReward', reward: e.view().pendingReward![0] });
        if (e.view().phase === 'periodEnd') await e.dispatch({ type: 'startNextPeriod' });
      }
      expect(played, option).toBe(option === 'cut');
    }
  });

  it('names a variable, follow up or skill a choice refers to that is not there, and a choice set to expect a response', () => {
    const d = fixture();
    const o = opt(d);
    o.variables.nps = 3;
    o.followUp = { event: 'nope', days: 0, weeks: 1 };
    o.read = [{ skill: 'Juggling', band: 'strong' }];
    ev(d, DISCOUNT).respondWith = ['meet'];
    const text = toStoryline(d).issues.join('\n');
    expect(text).toMatch(/changes nps, which is not one of the business variables/);
    expect(text).toMatch(/leads to an event that no longer exists \(nope\)/);
    expect(text).toMatch(/shows Juggling, which is not one of the skills/);
    expect(text).toMatch(/it is a decision, so it is answered by choosing/);
  });

  it('an event timed only by "Plays only if" exports with no other timing; a follow up after the deadline waits its days', () => {
    const d = fixture();
    const e = ev(d, 'public_complaint');
    Object.assign(e, { timing: 'condition', week: null, condition: undefined, conditions: [{ kind: 'variable', variable: 'customer_trust', op: 'below', value: 60 }] });
    ev(d, 'lens_moment').ifIgnored = { sponsor: true, followUp: 'public_complaint', afterDays: 3 };
    const out = toStoryline(d);
    expect(out.issues).toEqual([]);
    const x = out.storyline.events!.find(y => y.key === 'public_complaint')!;
    expect([x.period, x.window, x.when, x.if]).toEqual([undefined, undefined, undefined, [{ kind: 'variable', variable: 'customer_trust', op: 'below', value: 60 }]]);
    expect(out.storyline.events!.find(y => y.key === 'lens_moment')!.escalation).toEqual({ sponsor: true, event: 'public_complaint', delay: { days: 3, weeks: 0 } });
  });
});
