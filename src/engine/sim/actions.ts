import { blank, UNTAGGED } from './live';
import type { StorylineConfig } from '../config';
import type { Rng } from './rng';
import { mismatchType, styleDifference, trainingMismatch, type Mismatch, type Style, type Triple } from './rules';
import { respond } from './events';
import { checkBadges } from './score';
import {
  addMessage, capacityLeft, effectChanges, firstName, misread, keepPromises, log, member, needed, nextId, person, record, spend, sponsorChange,
  STYLE_NAMES, stageName, trustChange
} from './sim';
import type { Band, Change, Evaluation, Interaction, LiveRecord, MemberSim, Outcome, Reason, Sim } from './types';

/** Actions and live interactions (docs/SIMULATION.md sections 4 and 5). */

type Action = StorylineConfig['actions'][number];
type Option = Action['options'][number];

export class IntentError extends Error {
  constructor(message: string, readonly code: string) { super(message); this.name = 'IntentError'; }
}

const action = (sim: Sim, key: string) => {
  const a = sim.config.actions.find(x => x.key === key);
  if (!a) throw new IntentError(`Unknown action ${key}`, 'unknownAction');
  return a;
};
const effectFor = (o: Option, mt: Mismatch): Triple => (mt === 0 ? o.effects.m0 : mt === 1 ? o.effects.m1 : o.effects.m2 ?? o.effects.m1);
const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0');
const triple = (t: Triple) => `skill ${signed(t[0])}, morale ${signed(t[1])}, result ${signed(t[2])}`;

/** Plain words for an effect table, used as the reason's rule text. */
function ruleText(a: Action, o: Option) {
  const name = a.options.length > 1 ? `${a.name} (${o.label.length > 40 ? STYLE_NAMES[o.style as Style] ?? o.label : o.label})` : a.name;
  return `${name}: a fitting approach gives ${triple(o.effects.m0)}; a partial miss ${triple(o.effects.m1)}${o.effects.m2 ? `; a clear miss ${triple(o.effects.m2)}` : ''}.`;
}

// ---------------------------------------------------------------- weekly styles (4.4)

export function confirmStyles(sim: Sim, rng: Rng, styles: Record<string, Style>, notes: Record<string, string> = {}): Change[] {
  if (sim.phase !== 'style') throw new IntentError('Styles are set at the start of a period', 'wrongPhase');
  const missing = sim.members.filter(m => !styles[m.id]);
  if (missing.length) throw new IntentError(`Set a style for ${missing.map(m => m.id).join(', ')}`, 'missingStyles');
  const changes: Change[] = [];
  const w = sim.config.weeklyStyle;
  for (const [memberId, text] of Object.entries(notes)) if (text.trim()) sim.styleNotes.push({ period: sim.period, memberId, text: text.trim() });
  for (const m of sim.members) {
    const chosen = styles[m.id];
    const wasNeeded = m.neededAtStart;
    // Changing someone's style when what they need has not changed feels erratic (3.1).
    if (sim.period > 1 && m.lastStyle && chosen !== m.lastStyle && m.neededPrevStart !== null && wasNeeded === m.neededPrevStart && m.lastStyle === wasNeeded) {
      changes.push(...trustChange(m, sim.config.trustRules.erraticStyleChange, { label: 'Style changed', cause: `You changed how you lead ${firstName(sim, m.id)}, though what ${pr(sim, m.id)} ${pr(sim, m.id) === 'they' ? 'need' : 'needs'} had not changed.`, rule: `Changing someone’s style without a reason lowers trust by ${-sim.config.trustRules.erraticStyleChange}.`, evidence: [{ quote: `${m.lastStyle ? STYLE_NAMES[m.lastStyle] : ''} to ${STYLE_NAMES[chosen]} for ${firstName(sim, m.id)}`, by: 'You', judgedByAI: false }] }));
    }
    m.lastStyle = m.style ?? chosen;
    m.style = chosen;
    const diff = record(sim, m, chosen, 'weeklyStyle');
    const mt = mismatchType(diff, rng, misread(sim, m));
    const reason: Reason = {
      evidence: [{ quote: `${STYLE_NAMES[chosen]} for ${firstName(sim, m.id)}${notes[m.id] ? `: ${notes[m.id]}` : ''}`, by: 'You', judgedByAI: false }],
      label: mt === 0 ? 'Style fits' : 'Style missed',
      // Never name the needed style: working it out is the game (D54).
      cause: `You chose ${STYLE_NAMES[chosen]} for ${firstName(sim, m.id)}, and it ${mt === 0 ? 'fit what they needed this week' : mt === 1 ? 'was not quite what they needed' : 'was far from what they needed'}.`,
      rule: `The weekly style lands as ${mt === 0 ? 'a fit' : mt === 1 ? 'a partial miss' : 'a clear miss'}: fits give ${triple(w.m0)}, partial misses ${triple(w.m1)}, clear misses ${triple(w.m2 ?? w.m1)}.`
    };
    changes.push(...effectChanges(sim, rng, m, mt === 0 ? w.m0 : mt === 1 ? w.m1 : w.m2 ?? w.m1, reason));
    changes.push(...trustChange(m, mt === 0 ? 2 : mt === 2 ? -3 : 0, { ...reason, label: mt === 0 ? 'Led the right way' : 'Led the wrong way', rule: 'Being led the way you need builds trust: +2 for a fit, −3 for a clear miss.' }));
  }
  sim.phase = 'board';
  log(sim, { kind: 'style', title: 'Styles set for the period', memberIds: sim.members.map(m => m.id), changes });
  // The sponsor's team message, with each person's reaction (spec, weekly style setting: Result).
  const affected = [...new Set(changes.map(c => c.subject))];
  const net = (id: string) => changes.filter(c => c.subject === id).reduce((s, c) => s + c.delta, 0);
  const upbeat = affected.filter(id => net(id) > 0).length;
  sim.outcome = {
    id: nextId(sim, 'o'), actionKey: 'styles', speaker: 'sponsor',
    headline: `Styles are set for ${sim.config.time.period.unit} ${sim.period}`,
    reply: `Thanks for setting the tone. ${sim.config.sponsor.name.split(' ')[0]} will be watching how the team responds.`,
    affected,
    reactions: Object.fromEntries(affected.map(id => [id, net(id) > 0 ? 'Feels led the way they need.' : net(id) < 0 ? 'Does not feel led the way they need.' : 'Taking it in.'])),
    changes,
    ripple: null,
    // Team feedback by share of matches (Configuration Spec, Leadership model).
    changed: [`${upbeat === sim.members.length ? 'The whole team' : upbeat * 2 > sim.members.length ? 'Most of the team' : upbeat * 2 === sim.members.length ? 'Half the team' : 'Fewer than half the team'} responded well to how you plan to lead them.`]
  };
  return changes;
}

const pr = (sim: Sim, id: string) => { const p = person(sim, id).pronoun; return p === 'she' ? 'she' : p === 'they' ? 'they' : 'he'; };

// ---------------------------------------------------------------- availability

/**
 * Why an action is unavailable, as data. The UI words it from the catalog in the storyline's units;
 * `blockedText` words it for engine errors and logs.
 */
export type Block =
  | { reason: 'locked'; period: number }
  | { reason: 'capacity'; need: number; have: number }
  | { reason: 'cooldown'; in: number }
  | { reason: 'away'; kind: 'training' | 'leave'; for: number }
  | { reason: 'rewarded'; in: number }
  | { reason: 'gone' }
  | { reason: 'lastInStage'; stage: string }
  | { reason: 'noCover'; stage: string }
  | { reason: 'teamFull' }
  | { reason: 'liveCap'; cap: number };

export function blockedReason(sim: Sim, a: Action, memberId: string | null, optionKey?: string): Block | null {
  const budget = a.rule === 'hire' && sim.hireBudget;
  if (sim.period < a.unlockPeriod && !budget) return { reason: 'locked', period: a.unlockPeriod };
  const cost = budget ? 0 : (optionKey ? a.options.find(o => o.key === optionKey)?.cost : undefined) ?? a.cost;
  if (cost > capacityLeft(sim)) return { reason: 'capacity', need: cost, have: capacityLeft(sim) };
  // Role coverage (Teardown hidden rule 6): a full team hires nobody.
  // Extra hire budget (an unlock) allows one seat past a full team.
  if (a.rule === 'hire' && (sim.members.length >= sim.config.stages.length * sim.config.maxPerStage + (budget ? 1 : 0) || interviewees(sim).length === 0)) return { reason: 'teamFull' };
  // Live interaction cap per period (Configuration Spec, Time and pacing).
  if (a.kind !== 'static' && (sim.liveTaken[sim.period] ?? 0) >= sim.config.time.liveCap) return { reason: 'liveCap', cap: sim.config.time.liveCap };
  if (memberId) {
    const m = member(sim, memberId);
    if (!m) return { reason: 'gone' };
    if (m.away > 0 && a.key !== 'email' && a.key !== 'feedback') return { reason: 'away', kind: m.awayReason ?? 'leave', for: m.away };
    const rewarded = sim.availableAt[`${a.key}@${m.id}`] ?? 0;
    if (a.rule === 'reward' && rewarded > sim.absSub) return { reason: 'rewarded', in: rewarded - sim.absSub };
    // Role coverage: someone stays in every stage, and training needs a peer to cover the role.
    const peers = sim.members.filter(x => x.id !== m.id && x.stage === m.stage);
    if (a.rule === 'fire' && peers.length === 0) return { reason: 'lastInStage', stage: m.stage };
    if (a.rule === 'training' && !peers.some(x => x.away === 0)) return { reason: 'noCover', stage: m.stage };
  }
  const keys = [a.key, optionKey ? `${a.key}:${optionKey}` : null, memberId ? `${a.key}@${memberId}` : null].filter(Boolean) as string[];
  // A team activity without cooldown (an unlock) skips the wait once.
  const until = freeActivity(sim, a) ? 0 : Math.max(...keys.map(k => sim.availableAt[k] ?? 0));
  if (until > sim.absSub) return { reason: 'cooldown', in: until - sim.absSub };
  return null;
}

export function blockedText(b: Block): string {
  switch (b.reason) {
    case 'locked': return `Unlocks in period ${b.period}`;
    case 'capacity': return 'Not enough time left';
    case 'cooldown': return `Available again in ${b.in}`;
    case 'away': return b.kind === 'training' ? 'Away in training' : 'On leave';
    case 'rewarded': return 'Recently rewarded';
    case 'gone': return 'No longer on the team';
    case 'lastInStage': return 'The only person left in this stage';
    case 'noCover': return 'Nobody else in this stage can cover the role';
    case 'teamFull': return 'The team is full';
    case 'liveCap': return `You have had ${b.cap} live conversations this period`;
  }
}

/** Working days per sub-period, to turn the Model doc's repeat limits in days into the storyline's unit. */
const DAYS_PER_SUB: Record<string, number> = { hour: 1 / 8, day: 1, week: 5, month: 21, quarter: 63 };

/** Team activities are static team wide actions, such as Energize the team. */
export const freeActivity = (sim: Sim, a: Action) => sim.freeTeamActivity && a.scope === 'team' && a.kind === 'static';

function setCooldown(sim: Sim, a: Action, o: Option | undefined, memberIds: string[]) {
  if (freeActivity(sim, a)) { sim.freeTeamActivity = false; return; }
  const raw = o?.cooldownDays ?? a.cooldownDays;
  if (!raw) return;
  const days = Math.max(1, Math.ceil(raw / (DAYS_PER_SUB[sim.config.time.subPeriod.unit] ?? 1)));
  if (a.rule === 'reward') for (const id of memberIds) sim.availableAt[`${a.key}@${id}`] = sim.absSub + days;
  else sim.availableAt[o?.cooldownDays !== undefined ? `${a.key}:${o.key}` : a.key] = sim.absSub + days;
}

function validate(sim: Sim, a: Action, memberIds: string[], optionKey?: string, stage?: string): Option {
  if (sim.phase !== 'board') throw new IntentError('Actions are taken on the board', 'wrongPhase');
  const o = optionKey ? a.options.find(x => x.key === optionKey) : a.options[0];
  if (!o) throw new IntentError(`Unknown option ${optionKey}`, 'unknownOption');
  const [min, max] = o.targets ?? a.targets;
  if (memberIds.length < min || memberIds.length > max) throw new IntentError(`${a.name} needs ${min === max ? min : `${min} to ${max}`} people`, 'targets');
  const picked = memberIds.map(id => member(sim, id)).filter(Boolean) as MemberSim[];
  if (o.distinctStages && new Set(picked.map(m => m.stage)).size !== picked.length) throw new IntentError('Pick people from different stages', 'sameStage');
  if (o.pickStage && (!stage || !sim.config.stages.some(st => st.key === stage) || picked.some(m => m.stage === stage))) throw new IntentError('Pick a stage', 'stage');
  // Training needs cover: after everyone picked leaves, each of their stages keeps someone available.
  if (a.rule === 'training') {
    for (const st of new Set(picked.map(m => m.stage))) {
      if (!sim.members.some(x => x.stage === st && x.away === 0 && !memberIds.includes(x.id))) throw new IntentError('Nobody would be left to cover the role', 'noCover');
    }
  }
  if (o.pickStage && stage && a.rule === 'swap') {
    if (sim.members.filter(m => m.stage === stage).length >= sim.config.maxPerStage) throw new IntentError('That stage is full', 'stageFull');
    if (picked.some(m => sim.members.filter(x => x.stage === m.stage).length <= 1)) throw new IntentError('Someone has to stay in every stage', 'lastInStage');
  }
  for (const id of memberIds.length ? memberIds : [null]) {
    const why = blockedReason(sim, a, id, o.key);
    if (why) throw new IntentError(blockedText(why), why.reason === 'capacity' ? 'noCapacity' : 'blocked');
  }
  return o;
}

// ---------------------------------------------------------------- static and hybrid decisions

export interface PlanResult { changes: Change[]; interactionId: string | null; summary: string }

/**
 * Commits an action. Static actions resolve now; live and hybrid ones open an interaction that
 * `submitInteraction` resolves with the participant's words. Days are spent on commit.
 */
export function planAction(sim: Sim, rng: Rng, input: { action: string; option?: string; memberIds: string[]; stage?: string }): PlanResult {
  const a = action(sim, input.action);
  const o = validate(sim, a, input.memberIds, input.option, input.stage);
  const targets = input.memberIds.map(id => member(sim, id)!);
  const changes: Change[] = [];

  switch (a.rule) {
    case 'weeklyStyle':
      for (const m of sim.members.filter(x => x.away === 0)) {
        const mt = mismatchType(styleDifference(m.style ?? m.neededAtStart, m.neededAtStart), rng, misread(sim, m));
        changes.push(...effectChanges(sim, rng, m, effectFor(o, mt), { label: o.label, cause: `${o.label} with the team. ${firstName(sim, m.id)} is being led ${m.style ? STYLE_NAMES[m.style] : 'without a set style'} this period, which ${mt === 0 ? 'fits' : 'does not fit'} what they need.`, rule: ruleText(a, o), evidence: [] }));
      }
      break;
    case 'training':
      for (const m of targets) {
        const mt = trainingMismatch(styleDifference(m.style ?? m.neededAtStart, m.neededAtStart), rng);
        changes.push(...effectChanges(sim, rng, m, effectFor(o, mt), { label: 'Training', cause: `${firstName(sim, m.id)} went to the ${o.label.toLowerCase()}.`, rule: ruleText(a, o), evidence: [] }));
        m.away = o.away; m.awayReason = o.away ? 'training' : null; m.awaySetAt = sim.absSub; m.trainedInPeriod = sim.period;
        if (m.trainingRequestedPeriod === sim.period) changes.push(...trustChange(m, 4, { label: 'Request heard', cause: `${firstName(sim, m.id)} asked for training and got it.`, rule: 'Granting a training request raises trust by 4.', evidence: [] }));
      }
      break;
    case 'assess': {
      // Role fit (SIMULATION 4.3): reveals how this person would do in the stage, give or take 6.
      const m = targets[0];
      const stage = input.stage && sim.config.stages.some(st => st.key === input.stage) ? input.stage : m.stage;
      const base = person(sim, m.id).byStage[stage];
      const j = () => Math.round(rng.range(-6, 6));
      const fit = { skill: Math.max(0, Math.min(100, base.skill + j())), morale: Math.max(0, Math.min(100, base.morale + j())), result: Math.max(0, Math.min(100, base.result + j())) };
      m.assessedStages = [...new Set([...m.assessedStages, stage])];
      m.assessments[stage] = fit;
      log(sim, { kind: 'action', title: `Assessed for ${stageName(sim, stage)}: skill about ${fit.skill}, morale about ${fit.morale}, result about ${fit.result}`, memberIds: [m.id], changes: [] });
      break;
    }
    default:
      break;
  }

  // Evidence for decisions with no words: the choice itself, as the participant made it (rule 5).
  const choice = { quote: a.options.length > 1 ? `${a.name}: ${o.label}` : a.name, by: 'You', judgedByAI: false };
  for (const c of changes) if (!c.reason.evidence.length) c.reason = { ...c.reason, evidence: [choice] };

  let interactionId: string | null = null;
  if (a.kind === 'static') {
    changes.push(...keepPromises(sim, a.key, input.memberIds));
    changes.push(...respond(sim, rng, a.key, a.scope === 'team' ? sim.members.map(m => m.id) : input.memberIds));
    const title = o.label === a.description ? a.name : `${a.name}: ${o.label}`;
    if (a.rule !== 'assess') log(sim, { kind: 'action', title, memberIds: input.memberIds, changes });
    // Static decisions show what they changed, with reasons, like conversations do (rule 5).
    const affected = [...new Set(changes.map(c => c.subject).filter(id => id !== 'sponsor'))];
    const assessed = a.rule === 'assess' ? sim.log[sim.log.length - 1]?.title : undefined;
    sim.outcome = {
      id: nextId(sim, 'o'), actionKey: a.key, speaker: input.memberIds[0] ?? affected[0] ?? 'sponsor',
      headline: assessed ?? title, reply: '', affected,
      reactions: Object.fromEntries(affected.map(id => {
        const net = changes.filter(c => c.subject === id).reduce((s, c) => s + c.delta, 0);
        return [id, net > 0 ? 'Glad about it.' : net < 0 ? 'Not happy about it.' : 'Taking it in.'];
      })),
      changes, ripple: null, changed: []
    };
  } else {
    interactionId = nextId(sim, 'i');
    sim.liveTaken[sim.period] = (sim.liveTaken[sim.period] ?? 0) + 1;
    sim.interactions[interactionId] = blank({ actionKey: a.key, optionKey: o.key, memberIds: input.memberIds, format: a.format!, startedAt: sim.absSub,
      // Interview two candidates, then choose (Design doc, Hire member).
      candidates: a.rule === 'hire' ? interviewees(sim) : undefined, candidate: a.rule === 'hire' ? 0 : undefined,
      budget: a.rule === 'hire' && sim.hireBudget ? true : undefined });
    // Hybrid decisions are locked before the conversation (spec).
    if (a.rule === 'swap' || a.rule === 'reward' || a.rule === 'fire') changes.push(...hybridDecision(sim, rng, a, targets, input.stage));
  }
  if (a.scope === 'team') sim.touchedTeam = true;
  sim.touched.push(...input.memberIds);
  // Attention per person for the report: a team action counts for everyone, its days for no one.
  const days = a.rule === 'hire' && sim.hireBudget ? 0 : o.cost ?? a.cost;
  for (const id of a.scope === 'team' ? sim.members.map(m => m.id) : input.memberIds) {
    const t = (sim.attention[id] ??= { actions: 0, days: 0 });
    t.actions += 1;
    if (a.scope !== 'team') t.days += days / Math.max(1, input.memberIds.length);
  }
  const budget = a.rule === 'hire' && sim.hireBudget;
  if (budget) sim.hireBudget = false;
  setCooldown(sim, a, o, input.memberIds);
  spend(sim, rng, budget ? 0 : o.cost ?? a.cost);
  return { changes, interactionId, summary: a.name };
}

function hybridDecision(sim: Sim, rng: Rng, a: Action, targets: MemberSim[], stage?: string): Change[] {
  const changes: Change[] = [];
  if (a.rule === 'swap') {
    const moves: Array<[MemberSim, string]> = targets.length === 2 ? [[targets[0], targets[1].stage], [targets[1], targets[0].stage]] : [[targets[0], stage ?? targets[0].stage]];
    for (const [m, to] of moves) {
      const base = person(sim, m.id).byStage[to];
      const before = { skill: m.skill, morale: m.morale, result: m.result };
      const j = () => Math.round(rng.range(-6, 6));
      m.skill = Math.max(0, Math.min(100, base.skill + j()));
      m.morale = Math.max(0, Math.min(100, base.morale + j()));
      m.result = Math.max(0, Math.min(100, base.result + j()));
      const reason: Reason = { label: 'New role', cause: `${firstName(sim, m.id)} moved from ${stageName(sim, m.stage)} to ${stageName(sim, to)}.`, rule: 'In a new stage, people perform at their level for that stage, give or take 6.', evidence: [] };
      for (const k of ['skill', 'morale', 'result'] as const) if (m[k] !== before[k]) changes.push({ subject: m.id, metric: k, from: before[k], to: m[k], delta: m[k] - before[k], reason });
      if (!m.assessedStages.includes(to)) changes.push(...effectChanges(sim, rng, m, [0, -3, 0], { label: 'Not assessed first', cause: `You moved ${firstName(sim, m.id)} without assessing ${pr(sim, m.id) === 'she' ? 'her' : pr(sim, m.id) === 'they' ? 'them' : 'him'} for ${stageName(sim, to)}.`, rule: 'Skipping the assessment before a move costs 3 morale.', evidence: [] }, { useTrust: false }));
      m.stage = to; m.stageSincePeriod = sim.period; m.reassignedInPeriod = sim.period; m.roleChangeRequestedPeriod = null;
    }
  }
  if (a.rule === 'reward') {
    const m = targets[0];
    const top = [...sim.members].filter(x => x.away === 0).sort((x, y) => y.result - x.result)[0];
    const o = a.options[0];
    changes.push(...effectChanges(sim, rng, m, o.effects.m0, { label: 'Rewarded', cause: `You rewarded ${firstName(sim, m.id)}.`, rule: ruleText(a, o), evidence: [] }));
    m.recognizedAt = sim.absSub;
    if (!top || top === m) sim.fairRecognitions += 1;
    if (top && top !== m) {
      const reason: Reason = { label: 'Passed over', cause: `${firstName(sim, top.id)} is the top performer and saw ${firstName(sim, m.id)} rewarded instead.`, rule: 'Rewarding anyone but the top performer upsets the top performer (Model doc).', evidence: [] };
      changes.push(...effectChanges(sim, rng, top, o.effects.m1, reason, { useTrust: false }));
      changes.push(...trustChange(top, -6, { ...reason, rule: 'Rewarding someone else while you are the top performer lowers trust by 6.' }));
    }
  }
  if (a.rule === 'fire') {
    const gone = targets[0];
    sim.members = sim.members.filter(x => x !== gone);
    sim.departed.push(gone);
    for (const m of sim.members) {
      const reason: Reason = { label: 'Colleague let go', cause: `You let ${firstName(sim, gone.id)} go.`, rule: 'Letting someone go unsettles everyone else: morale drops (Model doc), and trust falls by 4.', evidence: [] };
      const ripple = a.options[0].effects.m1.some(v => v !== 0) ? a.options[0].effects.m1 : [0, -3, 0] as Triple;
      changes.push(...effectChanges(sim, rng, m, ripple, reason, { useTrust: false }));
      changes.push(...trustChange(m, -4, reason));
    }
  }
  log(sim, { kind: 'action', title: a.name, memberIds: targets.map(m => m.id), changes });
  return changes;
}

// ---------------------------------------------------------------- live interactions (5)

const BAND_TRUST: Record<Band, number> = { strong: 6, adequate: 2, weak: -3, harmful: -8 };
const BAND_CHAT_MORALE: Record<Band, number> = { strong: 3, adequate: 1, weak: -1, harmful: -4 };
const BAND_WORDS: Record<Band, string> = { strong: 'went well', adequate: 'landed', weak: 'did not land', harmful: 'went badly' };

function adjust(mt: Mismatch, band: Band): Mismatch {
  if (band === 'strong') return Math.max(0, mt - 1) as Mismatch;
  if (band === 'weak') return Math.min(2, mt + 1) as Mismatch;
  if (band === 'harmful') return 2;
  return mt;
}

const quotes = (ev: Evaluation): Reason['evidence'] => ev.evidence.slice(0, 2).map(q => ({ quote: q, by: 'You', judgedByAI: true }));

export function submitInteraction(sim: Sim, rng: Rng, interactionId: string, ev: Evaluation, npcReply = ''): Outcome {
  const it = sim.interactions[interactionId];
  if (!it) throw new IntentError('Unknown or finished interaction', 'unknownInteraction');
  if (sim.phase !== 'board') throw new IntentError('Conversations happen on the board', 'wrongPhase');
  const replyMsg = it.replyTo ? sim.inbox.find(x => x.id === it.replyTo) : undefined;
  if (it.replyTo && (!replyMsg || replyMsg.state !== 'open')) { delete sim.interactions[interactionId]; throw new IntentError('That message is closed', 'closedMessage'); }
  delete sim.interactions[interactionId];
  for (const id of it.memberIds) sim.touched.push(id);
  if (it.format === 'meeting') sim.touchedTeam = true;
  const a = it.actionKey === 'reply' || it.actionKey === 'sponsor' ? null : action(sim, it.actionKey);
  const changes: Change[] = [];
  const targets = (a?.scope === 'team' && a.rule === 'styleOption' ? sim.members.filter(m => m.away === 0) : it.memberIds.map(id => member(sim, id)).filter(Boolean)) as MemberSim[];
  const label = (who: string) => `${a?.name ?? 'Conversation'} with ${who} ${BAND_WORDS[ev.band]}`;
  sim.liveCount++;
  const vp = (sim.voicePeriods[sim.period] ??= { voice: 0, total: 0 });
  vp.total++; if (ev.usedVoice) vp.voice++;

  const table = a?.live.consequences?.[ev.band];
  let sponsorLine: string | null = null;
  if (it.actionKey === 'sponsor') {
    const msg = sim.inbox.find(x => x.id === it.replyTo);
    if (msg) msg.state = 'answered';
    changes.push(...sponsorChange(sim, sim.config.gamification.sponsor.briefing[ev.band], `Sponsor briefing ${BAND_WORDS[ev.band]}`));
    sponsorLine = changes.some(c => c.subject === 'sponsor' && c.delta > 0) ? `${sim.config.sponsor.name.split(' ')[0]} is more confident in you now.` : changes.some(c => c.subject === 'sponsor' && c.delta < 0) ? `${sim.config.sponsor.name.split(' ')[0]} is less confident in you now.` : null;
  } else if (a && table && a.rule !== 'hire') {
    // Authored consequence table for the band (Configuration Spec, Consequence table).
    const reason: Reason = { label: label(targets.length === 1 ? firstName(sim, targets[0].id) : 'the team'), cause: `How the ${a.name.toLowerCase()} landed.`, rule: `The author set what each outcome does for ${a.name}.`, evidence: quotes(ev) };
    const ids = new Set(targets.map(m => m.id));
    for (const m of targets) {
      changes.push(...effectChanges(sim, rng, m, [table.target[0], table.target[1], table.target[2]], reason, { useTrust: false }));
      changes.push(...trustChange(m, table.target[3], reason));
    }
    if (table.bystanders) for (const m of sim.members.filter(x => !ids.has(x.id) && x.away === 0)) {
      const ripple = { ...reason, label: 'Noticed', cause: `${firstName(sim, m.id)} noticed how the ${a.name.toLowerCase()} went.` };
      changes.push(...effectChanges(sim, rng, m, [table.bystanders[0], table.bystanders[1], table.bystanders[2]], ripple, { useTrust: false }));
      changes.push(...trustChange(m, table.bystanders[3], ripple));
    }
    if (table.sponsor) changes.push(...sponsorChange(sim, table.sponsor, `${a.name} ${BAND_WORDS[ev.band]}`));
  } else if (it.actionKey === 'reply') {
    if (replyMsg && !targets.length) replyMsg.state = 'answered';
    for (const m of targets) {
      const msg = sim.inbox.find(x => x.id === it.replyTo);
      const onTime = msg && msg.state === 'open';
      if (msg) msg.state = 'answered';
      const reason: Reason = { label: `Reply to ${firstName(sim, m.id)} ${BAND_WORDS[ev.band]}`, cause: `You replied to ${firstName(sim, m.id)}${onTime ? ' in time' : ''}.`, rule: 'A reply lifts morale by 3, 1, −1 or −4 depending on how it lands, and an on time reply raises trust by 3.', evidence: quotes(ev) };
      changes.push(...effectChanges(sim, rng, m, [0, BAND_CHAT_MORALE[ev.band], 0], reason));
      if (onTime) changes.push(...trustChange(m, 3, reason));
      changes.push(...trustChange(m, BAND_TRUST[ev.band] > 0 ? 0 : BAND_TRUST[ev.band], reason));
    }
  } else if (a && a.rule === 'styleOption') {
    const option = a.options.find(o => o.style === ev.styleUsed) ?? a.options[0];
    // Meetings, briefings, interviews and multi person conversations carry no style (scoring-and-report.md 3).
    const tagged = targets.length === 1 && !UNTAGGED.has(it.format);
    for (const m of targets) {
      const n = needed(sim, m);
      const diff = tagged ? record(sim, m, ev.styleUsed, a.key) : styleDifference(ev.styleUsed, n);
      if (tagged) changes.push(...intentGap(sim, m, ev));
      const mt = adjust(mismatchType(diff, rng, misread(sim, m)), ev.band);
      const reason: Reason = {
        label: label(firstName(sim, m.id)),
        cause: `Your approach read as ${ev.confidence < 0.5 ? 'mostly ' : ''}${STYLE_NAMES[ev.styleUsed]}, which ${mt === 0 ? 'fit' : 'did not fit'} what ${firstName(sim, m.id)} needed.`,
        rule: `${ruleText(a, option)} A conversation that goes very well counts one step better, one that falls flat one step worse.`,
        evidence: quotes(ev)
      };
      changes.push(...effectChanges(sim, rng, m, effectFor(option, mt), reason, { boost: ev.band === 'strong' ? 1.2 : 1 }));
      const t = a.format === 'meeting' ? Math.round(BAND_TRUST[ev.band] / 2) : BAND_TRUST[ev.band];
      changes.push(...trustChange(m, t, { ...reason, rule: 'How a conversation lands moves trust: +6, +2, −3 or −8 (half in a team meeting).' }));
    }
  } else if (a && a.rule === 'trend') {
    for (const m of targets) {
      const ago = m.resultHistory.length >= 11 ? m.resultHistory[m.resultHistory.length - 11] : m.resultHistory[0] ?? m.result;
      const trend = m.result - ago;
      const intent = ev.emailIntent ?? (a.options.find(o => o.key === it.optionKey)?.intent ?? 'congratulate');
      const o = a.options.find(x => x.intent === (intent === 'warn' ? 'warn' : 'congratulate')) ?? a.options[0];
      const base: Mismatch = intent === 'warn' ? (trend < 0 ? 0 : 1) : trend >= 0 ? 0 : 1;
      const mt = adjust(base, ev.band);
      const reason: Reason = {
        label: `Email to ${firstName(sim, m.id)} ${BAND_WORDS[ev.band]}`,
        cause: `Your email read as ${intent === 'warn' ? 'a warning' : intent === 'neutral' ? 'neutral' : 'congratulations'}; ${firstName(sim, m.id)}'s result has ${trend >= 0 ? 'held or risen' : 'fallen'} recently.`,
        rule: `${ruleText(a, o)} Congratulate when results hold or rise, warn when they fall.`,
        evidence: quotes(ev)
      };
      changes.push(...effectChanges(sim, rng, m, effectFor(o, mt), reason, { scale: intent === 'neutral' ? 0.5 : 1 }));
      if (intent === 'congratulate') m.recognizedAt = sim.absSub;
      addMessage(sim, { from: m.id, kind: 'email', title: `Re: your email`, body: npcReply || 'Thanks for the note.', dueIn: null });
    }
  } else if (a && a.rule === 'hire') {
    // The participant chose after interviewing (Design doc, Hire member). How the interviews went
    // sets the new hire's first trust in you.
    const cid = it.memberIds[0];
    const room = cid ? sim.members.filter(m => m.stage === person(sim, cid).homeStage).length < sim.config.maxPerStage + (it.budget ? 1 : 0) : false;
    // SIMULATION 4.3: a Weak interview lands the candidate half the time, a Harmful one never.
    const accepts = ev.band === 'strong' || ev.band === 'adequate' || (ev.band === 'weak' && rng.chance(0.5));
    if (cid && room && !accepts) {
      log(sim, { kind: 'interaction', title: `${firstName(sim, cid)} turned the offer down`, memberIds: [], changes: [] });
    }
    if (cid && room && accepts && sim.candidates.includes(cid)) {
      const p = person(sim, cid);
      const hire = { ...createMemberFrom(sim, cid), stage: p.homeStage };
      sim.members.push(hire);
      sim.candidates = sim.candidates.filter(c => c !== cid);
      changes.push(...trustChange(hire, BAND_TRUST[ev.band], { label: 'First impression', cause: `${firstName(sim, cid)} joined after an interview that ${BAND_WORDS[ev.band]}.`, rule: 'How the interview went sets a new hire’s first trust in you: +6, +2, −3 or −8.', evidence: quotes(ev) }));
    }
  } else if (a && a.rule === 'fire') {
    // The exit conversation: the team watches how it was handled (Design doc: team morale and trust).
    const gone = firstName(sim, it.memberIds[0]);
    for (const m of sim.members.filter(x => x.away === 0)) {
      const reason: Reason = { label: `Exit conversation ${BAND_WORDS[ev.band]}`, cause: `The team saw how you handled ${gone}'s exit.`, rule: 'A dignified, clear exit steadies the team: morale +3, +1, −1 or −4, and trust follows how it lands, at half strength.', evidence: quotes(ev) };
      changes.push(...effectChanges(sim, rng, m, [0, BAND_CHAT_MORALE[ev.band], 0], reason));
      changes.push(...trustChange(m, Math.round(BAND_TRUST[ev.band] / 2), reason));
    }
  } else if (a) {
    // Hybrid conversation after a locked decision: how it lands moves morale and trust.
    for (const m of targets) {
      const reason: Reason = { label: label(firstName(sim, m.id)), cause: `You explained the decision to ${firstName(sim, m.id)}.`, rule: 'Explaining a decision well softens it: morale +3, +1, −1 or −4, and trust follows how it lands.', evidence: quotes(ev) };
      changes.push(...effectChanges(sim, rng, m, [0, BAND_CHAT_MORALE[ev.band], 0], reason));
      changes.push(...trustChange(m, BAND_TRUST[ev.band], reason));
    }
  }

  // Promises, hidden concerns, badges (3.4, 5.4, 7.3). Earlier promises are checked before this
  // conversation's own promise is recorded, so a promise is never kept by the talk that made it.
  const main = targets[0];
  if (a) changes.push(...keepPromises(sim, a.key, targets.map(m => m.id)));
  if (main && ev.flags.promise) {
    sim.promises.push({ id: nextId(sim, 'p'), memberId: main.id, text: ev.flags.promise.text, dueAbsSub: sim.absSub + ev.flags.promise.dueInSubPeriods, fulfilledBy: ev.flags.promise.fulfilledBy, state: 'open' });
  }
  if (main && ev.flags.concernSurfaced && !main.concernShared && person(sim, main.id).hiddenConcern && (main.trust >= 45 || ev.band === 'strong')) {
    main.concernShared = true;
    changes.push(...trustChange(main, 4, { label: 'Opened up', cause: `${firstName(sim, main.id)} shared what is really on ${pr(sim, main.id) === 'she' ? 'her' : pr(sim, main.id) === 'they' ? 'their' : 'his'} mind.`, rule: 'When someone trusts you enough to share a concern, trust rises by 4.', evidence: quotes(ev) }));
  }
  // Live interaction record for the week score and the Leadership pillar; an expected response to an event; badges.
  changes.push(...respond(sim, rng, it.actionKey, it.memberIds, it.replyTo));
  sim.liveRecords.push(liveRecord(sim, it, ev, changes, a?.name, replyMsg));
  checkBadges(sim, 'interaction');

  const affected = [...new Set(changes.filter(c => c.subject !== 'sponsor').map(c => c.subject))];
  const outcome: Outcome = {
    id: nextId(sim, 'o'), actionKey: it.actionKey, speaker: main?.id ?? (it.format === 'sponsor' ? 'sponsor' : it.memberIds[0] ?? 'sponsor'),
    headline: main ? `${a?.name ?? 'Conversation'} with ${firstName(sim, main.id)} ${BAND_WORDS[ev.band]}` : `${a?.name ?? 'Conversation'} ${BAND_WORDS[ev.band]}`,
    reply: npcReply,
    affected,
    reactions: Object.fromEntries(affected.map(id => {
      const net = changes.filter(c => c.subject === id && c.metric !== 'confidence').reduce((s, c) => s + c.delta, 0);
      return [id, net > 0 ? 'Feels better about how you lead.' : net < 0 ? 'Not happy with how that went.' : 'Taking it in.'];
    })),
    changes,
    ripple: null,
    changed: sponsorLine ? [sponsorLine] : []
  };
  sim.outcome = outcome;
  log(sim, { kind: 'interaction', title: outcome.headline, memberIds: affected, changes, quote: ev.evidence[0] });
  return outcome;
}

/** Up to two candidates whose home stage has room (role coverage), in storyline order. */
const words = (t: string) => t.split(/\s+/).filter(Boolean).length;

/** What the report keeps about a finished conversation (scoring-and-report.md 5 and 7). */
function liveRecord(sim: Sim, it: Interaction, ev: Evaluation, changes: Change[], actionName: string | undefined, msg: { title: string } | undefined): LiveRecord {
  const mine = it.turns.filter(t => t.by === 'you');
  const theirs = it.turns.filter(t => t.by !== 'you');
  const phrases = sim.config.report.recognitionPhrases.map(p => p.toLowerCase());
  const said = mine.map(t => t.text).join(' ');
  const recognition = phrases.reduce((n, p) => n + (said.toLowerCase().split(p).length - 1), 0);
  const people = new Map<string, number>();
  for (const c of changes) if (c.subject !== 'sponsor' && c.metric !== 'confidence') people.set(c.subject, (people.get(c.subject) ?? 0) + Math.abs(c.delta));
  const tagged = it.memberIds.length === 1 && !UNTAGGED.has(it.format) && it.actionKey !== 'reply' && it.actionKey !== 'sponsor';
  const title = it.actionKey === 'sponsor' ? 'Sponsor briefing' : it.actionKey === 'reply' ? `Reply: ${msg?.title ?? 'a message'}` : actionName ?? it.actionKey;
  return {
    id: nextId(sim, 'r'), period: sim.period, sub: sim.sub, actionKey: it.actionKey, format: it.format, band: ev.band, memberIds: it.memberIds, title,
    styleShown: tagged ? ev.styleUsed : null,
    skills: ev.skills ?? [],
    quotes: mine.map(t => t.text),
    talk: { you: words(said), npc: theirs.reduce((n, t) => n + words(t.text), 0), openQuestions: (said.match(/\b(?:what|how|why|tell me|describe|walk me through)\b[^?]*\?/gi) ?? []).length, recognition, spoken: mine.some(t => t.voice) },
    concern: !!ev.flags.concernSurfaced,
    impact: [...people.values()].reduce((a, b) => a + b, 0),
    changes: [...changes].filter(c => c.subject !== 'sponsor').sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta)).slice(0, 4).map(c => ({ subject: c.subject, metric: c.metric, delta: c.delta }))
  };
}

export function interviewees(sim: Sim): string[] {
  // Extra hire budget (an unlock) allows one seat past a full stage.
  const room = (stage: string) => sim.members.filter(m => m.stage === stage).length < sim.config.maxPerStage + (sim.hireBudget ? 1 : 0);
  return sim.candidates.filter(id => room(person(sim, id).homeStage)).slice(0, 2);
}

/**
 * Intent vs action (Design doc, Consistency): when the style you show someone differs from the one
 * you declared for them, two periods running, they lose trust. Applied once per period.
 */
function intentGap(sim: Sim, m: MemberSim, ev: Evaluation): Change[] {
  if (!m.style || ev.styleUsed === m.style) return [];
  const gaps = (sim.intentGaps[m.id] ??= []);
  if (gaps.includes(sim.period)) return [];
  gaps.push(sim.period);
  if (!gaps.includes(sim.period - 1)) return [];
  return trustChange(m, sim.config.trustRules.intentGap, {
    label: 'Mixed signals',
    cause: `You said you would lead ${firstName(sim, m.id)} with ${STYLE_NAMES[m.style]}, but in conversation it came across as ${STYLE_NAMES[ev.styleUsed]}, two ${sim.config.time.period.unit}s running.`,
    rule: `When what you declare and what you do differ two ${sim.config.time.period.unit}s in a row, trust drops by ${-sim.config.trustRules.intentGap}.`,
    evidence: quotes(ev)
  });
}

function createMemberFrom(sim: Sim, id: string): MemberSim {
  const p = person(sim, id);
  const n = { skill: p.start.skill, morale: p.start.morale };
  return {
    id, stage: p.homeStage, ...p.start, trust: p.start.trust ?? sim.config.trustRules.start, trustCap: sim.config.trustRules.capPerSubPeriod, trustMovedThisSub: 0, style: null, lastStyle: null, lastReaction: null,
    neededAtStart: n.skill >= sim.config.thresholds.high ? (n.morale >= sim.config.thresholds.high ? 'E' : 'P') : n.morale >= sim.config.thresholds.high ? 'G' : 'D',
    away: 0, awayReason: null, resultHistory: [], periodEnds: [], stageSincePeriod: sim.period, revealed: false, concernShared: false, lastChange: 0,
    recognizedAt: null, reassignedInPeriod: null, trainedInPeriod: null, assessedStages: [], assessments: {}, neededPrevStart: null, awaySetAt: -1, trainingRequestedPeriod: null, roleChangeRequestedPeriod: null, lowestResult: p.start.result, lowestMorale: p.start.morale
  };
}

/** Opens a reply to an inbox message, or a sponsor briefing. Costs no days (spec). */
export function openConversation(sim: Sim, kind: 'reply' | 'sponsor', messageId?: string): string {
  if (sim.phase !== 'board') throw new IntentError('Conversations happen on the board', 'wrongPhase');
  const msg = messageId ? sim.inbox.find(m => m.id === messageId) : undefined;
  if (kind === 'reply' && !msg) throw new IntentError('Unknown message', 'closedMessage');
  // One conversation per message: an open one is resumed, never doubled.
  const existing = Object.entries(sim.interactions).find(([, it]) => it.replyTo && it.replyTo === messageId);
  if (existing) return existing[0];
  const id = nextId(sim, 'i');
  // Sponsor briefings happen when scheduled, from the briefing message (Design doc: weeks 4 and 8).
  if (kind === 'sponsor' && !msg?.briefing) throw new IntentError('The sponsor briefing is not due yet', 'noBriefing');
  if (msg && msg.state !== 'open') throw new IntentError('That message is closed', 'closedMessage');
  sim.interactions[id] = blank({ actionKey: kind, optionKey: null, memberIds: msg && msg.from !== 'sponsor' && msg.from !== 'news' ? [msg.from] : [], format: kind === 'sponsor' ? 'sponsor' : 'chat', startedAt: sim.absSub, replyTo: messageId });
  return id;
}

