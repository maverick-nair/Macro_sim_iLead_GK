import type { StorylineConfig } from '../config';
import type { Rng } from './rng';
import { mismatchType, styleDifference, trainingMismatch, type Mismatch, type Style, type Triple } from './rules';
import {
  addMessage, capacityLeft, effectChanges, firstName, keepPromises, log, member, needed, nextId, person, record, spend, sponsorChange,
  STYLE_NAMES, stageName, trustChange
} from './sim';
import type { Band, Change, Evaluation, MemberSim, Outcome, Reason, Sim } from './types';

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
  for (const m of sim.members) {
    const chosen = styles[m.id];
    const wasNeeded = m.neededAtStart;
    // Changing someone's style when what they need has not changed feels erratic (3.1).
    if (sim.period > 1 && m.lastStyle && chosen !== m.lastStyle && m.periodEnds.length && needed(sim, m) === wasNeeded && m.lastStyle === wasNeeded) {
      changes.push(...trustChange(m, -2, { label: 'Style changed', cause: `You changed how you lead ${firstName(sim, m.id)}, though what ${pr(sim, m.id)} needs had not changed.`, rule: 'Changing someone’s style without a reason lowers trust by 2.', evidence: [] }));
    }
    m.lastStyle = m.style ?? chosen;
    m.style = chosen;
    const diff = record(sim, m, chosen, 'weeklyStyle');
    const mt = mismatchType(diff, rng, { trust: m.trust });
    const n = needed(sim, m);
    const reason: Reason = {
      label: mt === 0 ? 'Style fits' : 'Style missed',
      cause: `You chose ${STYLE_NAMES[chosen]} for ${firstName(sim, m.id)}, who needed ${STYLE_NAMES[n]}${notes[m.id] ? `. Your note: "${notes[m.id]}"` : ''}.`,
      rule: `The weekly style lands as ${mt === 0 ? 'a fit' : mt === 1 ? 'a partial miss' : 'a clear miss'}: fits give ${triple(w.m0)}, partial misses ${triple(w.m1)}, clear misses ${triple(w.m2 ?? w.m1)}.`,
      evidence: []
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
  | { reason: 'teamFull' };

export function blockedReason(sim: Sim, a: Action, memberId: string | null, optionKey?: string): Block | null {
  if (sim.period < a.unlockPeriod) return { reason: 'locked', period: a.unlockPeriod };
  const cost = (optionKey ? a.options.find(o => o.key === optionKey)?.cost : undefined) ?? a.cost;
  if (cost > capacityLeft(sim)) return { reason: 'capacity', need: cost, have: capacityLeft(sim) };
  // Role coverage (Teardown hidden rule 6): a full team hires nobody.
  if (a.rule === 'hire' && sim.members.length >= sim.config.stages.length * sim.config.maxPerStage) return { reason: 'teamFull' };
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
  const until = Math.max(...keys.map(k => sim.availableAt[k] ?? 0));
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
  }
}

function setCooldown(sim: Sim, a: Action, o: Option | undefined, memberIds: string[]) {
  const days = o?.cooldownDays ?? a.cooldownDays;
  if (!days) return;
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
  if (o.pickStage && (!stage || !sim.config.stages.some(st => st.key === stage) || picked.some(m => m.stage === stage))) throw new IntentError('Pick a stage to move to', 'stage');
  if (o.pickStage && stage) {
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
        const mt = mismatchType(styleDifference(m.style ?? m.neededAtStart, m.neededAtStart), rng, { trust: m.trust });
        changes.push(...effectChanges(sim, rng, m, effectFor(o, mt), { label: o.label, cause: `${o.label} with the team. ${firstName(sim, m.id)} is being led ${m.style ? STYLE_NAMES[m.style] : 'without a set style'} this period, and needed ${STYLE_NAMES[m.neededAtStart]}.`, rule: ruleText(a, o), evidence: [] }));
      }
      break;
    case 'training':
      for (const m of targets) {
        const mt = trainingMismatch(styleDifference(m.style ?? m.neededAtStart, m.neededAtStart), rng);
        changes.push(...effectChanges(sim, rng, m, effectFor(o, mt), { label: 'Training', cause: `${firstName(sim, m.id)} went to the ${o.label.toLowerCase()}.`, rule: ruleText(a, o), evidence: [] }));
        m.away = o.away; m.awayReason = o.away ? 'training' : null; m.trainedInPeriod = sim.period;
        if (m.trainingRequestedPeriod === sim.period) changes.push(...trustChange(m, 4, { label: 'Request heard', cause: `${firstName(sim, m.id)} asked for training and got it.`, rule: 'Granting a training request raises trust by 4.', evidence: [] }));
      }
      break;
    case 'assess': {
      const m = targets[0];
      const stage = input.stage ?? m.stage;
      m.assessedStages = [...new Set([...m.assessedStages, stage])];
      break;
    }
    default:
      break;
  }

  let interactionId: string | null = null;
  if (a.kind === 'static') {
    changes.push(...keepPromises(sim, a.key, input.memberIds));
    log(sim, { kind: 'action', title: o.label === a.description ? a.name : `${a.name}: ${o.label}`, memberIds: input.memberIds, changes });
  } else {
    interactionId = nextId(sim, 'i');
    sim.interactions[interactionId] = { actionKey: a.key, optionKey: o.key, memberIds: input.memberIds, format: a.format!, startedAt: sim.absSub };
    // Hybrid decisions are locked before the conversation (spec).
    if (a.rule === 'swap' || a.rule === 'reward' || a.rule === 'fire') changes.push(...hybridDecision(sim, rng, a, targets, input.stage));
  }
  setCooldown(sim, a, o, input.memberIds);
  spend(sim, rng, o.cost ?? a.cost);
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
      const reason: Reason = { label: 'Colleague let go', cause: `You let ${firstName(sim, gone.id)} go.`, rule: 'Letting someone go unsettles everyone else (Model doc), and lowers their trust by 4.', evidence: [] };
      changes.push(...effectChanges(sim, rng, m, a.options[0].effects.m1, reason, { useTrust: false }));
      changes.push(...trustChange(m, -4, reason));
    }
  }
  log(sim, { kind: 'action', title: a.name, memberIds: targets.map(m => m.id), changes });
  return changes;
}

// ---------------------------------------------------------------- live interactions (5)

const BAND_TRUST: Record<Band, number> = { strong: 6, adequate: 2, weak: -3, harmful: -8 };
const BAND_CHAT_MORALE: Record<Band, number> = { strong: 3, adequate: 1, weak: -1, harmful: -4 };
const BAND_SPONSOR: Record<Band, number> = { strong: 8, adequate: 3, weak: -4, harmful: -10 };
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
  delete sim.interactions[interactionId];
  const a = it.actionKey === 'reply' || it.actionKey === 'sponsor' ? null : action(sim, it.actionKey);
  const changes: Change[] = [];
  const targets = (a?.scope === 'team' && a.rule === 'styleOption' ? sim.members.filter(m => m.away === 0) : it.memberIds.map(id => member(sim, id)).filter(Boolean)) as MemberSim[];
  const label = (who: string) => `${a?.name ?? 'Conversation'} with ${who} ${BAND_WORDS[ev.band]}`;
  sim.liveCount++;
  const vp = (sim.voicePeriods[sim.period] ??= { voice: 0, total: 0 });
  vp.total++; if (ev.usedVoice) vp.voice++;

  if (it.actionKey === 'sponsor') {
    changes.push(...sponsorChange(sim, BAND_SPONSOR[ev.band], `Sponsor briefing ${BAND_WORDS[ev.band]}`));
  } else if (it.actionKey === 'reply') {
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
    for (const m of targets) {
      const n = needed(sim, m);
      const diff = record(sim, m, ev.styleUsed, a.key);
      const mt = adjust(mismatchType(diff, rng, { trust: m.trust }), ev.band);
      const reason: Reason = {
        label: label(firstName(sim, m.id)),
        cause: `Your approach read as ${ev.confidence < 0.5 ? 'mostly ' : ''}${STYLE_NAMES[ev.styleUsed]}; ${firstName(sim, m.id)} needed ${STYLE_NAMES[n]}.`,
        rule: `${ruleText(a, option)} A conversation that goes very well counts one step better, one that falls flat one step worse.`,
        evidence: quotes(ev)
      };
      changes.push(...effectChanges(sim, rng, m, effectFor(option, mt), reason, { boost: ev.band === 'strong' ? 1.2 : 1 }));
      const t = a.format === 'meeting' ? Math.round(BAND_TRUST[ev.band] / 2) : BAND_TRUST[ev.band];
      changes.push(...trustChange(m, t, { ...reason, rule: 'How a conversation lands moves trust: +6, +2, −3 or −8 (half in a team meeting).' }));
    }
  } else if (a && a.rule === 'trend') {
    for (const m of targets) {
      const ago = m.resultHistory[Math.max(0, m.resultHistory.length - 10)] ?? m.result;
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
    const accept = ev.band === 'strong' || ev.band === 'adequate' || (ev.band === 'weak' && rng.chance(0.5));
    const cid = it.memberIds[0] ?? sim.candidates[0];
    if (accept && cid) {
      const p = person(sim, cid);
      sim.members.push({ ...createMemberFrom(sim, cid), stage: p.homeStage });
      sim.candidates = sim.candidates.filter(c => c !== cid);
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
    changes.push(...trustChange(main, 4, { label: 'Opened up', cause: `${firstName(sim, main.id)} shared what is really on ${pr(sim, main.id) === 'she' ? 'her' : 'his'} mind.`, rule: 'When someone trusts you enough to share a concern, trust rises by 4.', evidence: quotes(ev) }));
  }
  award(sim, 'first_word');
  if (ev.flags.openQuestions >= 3 && (a?.format === 'roleplay' || a?.format === 'chat')) award(sim, 'listener');

  const affected = [...new Set(changes.filter(c => c.subject !== 'sponsor').map(c => c.subject))];
  const outcome: Outcome = {
    id: nextId(sim, 'o'), actionKey: it.actionKey, speaker: main?.id ?? 'sponsor',
    headline: main ? `${a?.name ?? 'Conversation'} with ${firstName(sim, main.id)} ${BAND_WORDS[ev.band]}` : `${a?.name ?? 'Conversation'} ${BAND_WORDS[ev.band]}`,
    reply: npcReply,
    affected,
    reactions: Object.fromEntries(affected.map(id => {
      const net = changes.filter(c => c.subject === id && c.metric !== 'confidence').reduce((s, c) => s + c.delta, 0);
      return [id, net > 0 ? 'Feels better about how you lead.' : net < 0 ? 'Not happy with how that went.' : 'Taking it in.'];
    })),
    changes,
    ripple: null,
    changed: []
  };
  sim.outcome = outcome;
  log(sim, { kind: 'interaction', title: outcome.headline, memberIds: affected, changes, quote: ev.evidence[0] });
  return outcome;
}

function createMemberFrom(sim: Sim, id: string): MemberSim {
  const p = person(sim, id);
  const n = { skill: p.start.skill, morale: p.start.morale };
  return {
    id, stage: p.homeStage, ...p.start, trustMovedThisSub: 0, style: null, lastStyle: null, lastReaction: null,
    neededAtStart: n.skill >= sim.config.thresholds.high ? (n.morale >= sim.config.thresholds.high ? 'E' : 'P') : n.morale >= sim.config.thresholds.high ? 'G' : 'D',
    away: 0, awayReason: null, resultHistory: [], periodEnds: [], stageSincePeriod: sim.period, revealed: false, concernShared: false, lastChange: 0,
    recognizedAt: null, reassignedInPeriod: null, trainedInPeriod: null, assessedStages: [], trainingRequestedPeriod: null, roleChangeRequestedPeriod: null, lowestResult: p.start.result
  };
}

/** Opens a reply to an inbox message, or a sponsor briefing. Costs no days (spec). */
export function openConversation(sim: Sim, kind: 'reply' | 'sponsor', messageId?: string): string {
  const msg = messageId ? sim.inbox.find(m => m.id === messageId) : undefined;
  const id = nextId(sim, 'i');
  sim.interactions[id] = { actionKey: kind, optionKey: null, memberIds: msg && msg.from !== 'sponsor' && msg.from !== 'news' ? [msg.from] : [], format: kind === 'sponsor' ? 'sponsor' : 'chat', startedAt: sim.absSub, replyTo: messageId };
  return id;
}

export function award(sim: Sim, badge: string) {
  if (!sim.badges.includes(badge)) sim.badges.push(badge);
}
