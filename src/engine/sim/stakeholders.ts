import type { GeneralEvent, Stakeholder, StakeholderEffect } from '../config';
import type { z } from 'zod';
import type { Rng } from './rng';
import { IntentError } from './errors';
import { applyBusiness, conditionsHold, type Applied } from './business';
import { blank } from './live';
import { addMessage, capacityLeft, effectChanges, log, nextId, perPeriod, spend, sponsorChange, YOU } from './sim';
import { checkBadges } from './score';
import { isStakeholder, moveRelation, relationScale, stakeholderConfig } from './stakeholderState';
import { msg, type Copy } from '../copy';
import type { Band, Change, EventCard, Evaluation, Interaction, LiveRecord, MemberSim, Mood, Outcome, Reason, Sim, StakeholderFormat, StakeholderRecord, StakeholderRequestState } from './types';

/**
 * Stakeholders outside the team (D160 to D165, docs/SIMULATION.md 6.9). A stakeholder is never in the funnel and
 * produces no result: what the participant does with them moves their relationship (trust and satisfaction) and,
 * through it, the business (variables, revenue, sponsor confidence, flags and follow ups) and sometimes the team.
 *
 *   engage     a live conversation (meet, present, negotiate, or an email written once) through the same AI
 *              character and evaluator as the team's, or a static decision with options. It costs days, never the
 *              team's live cap, and each stakeholder can be engaged once a period.
 *   effects    the band's (or the option's) effect lands scaled by the relationship (`relationScale`): gains land
 *              fuller with trust, losses harder without it; an effect that `needs` more trust or satisfaction than
 *              the stakeholder has applies its `otherwise` instead.
 *   requests   a stakeholder can write or ask to meet, by a deadline (D162): answered in time, `onTime`; ignored,
 *              `ifIgnored`, and the event's escalation.
 *   period end a stakeholder nobody engaged loses their `drift`.
 *
 * Nothing here runs for a storyline without stakeholders.
 */

type Interact = Stakeholder['interactions'][number];
type Type = Interact['type'];
type EventConfig = z.output<typeof GeneralEvent>;

/** What each band does when the author left the consequences out (D161): the relationship only. */
export const STAKEHOLDER_BANDS: Record<Band, { trust: number; satisfaction: number }> = {
  strong: { trust: 8, satisfaction: 8 }, adequate: { trust: 3, satisfaction: 3 }, weak: { trust: -3, satisfaction: -4 }, harmful: { trust: -8, satisfaction: -10 }
};
/** How each type is evaluated and voiced (the evaluator's and the AI character's format). */
export const STAKEHOLDER_FORMAT: Record<Type, StakeholderFormat> = { meet: 'stakeholder', present: 'present', negotiate: 'negotiate', email: 'email' };
/** How each type shows in the live screen. */
export const STAKEHOLDER_SCREEN: Record<Type, 'roleplay' | 'sponsor' | 'email'> = { meet: 'roleplay', present: 'sponsor', negotiate: 'roleplay', email: 'email' };
/** The skills each type rates when the author named none, as far as the framework has them. */
export const STAKEHOLDER_SKILLS: Record<Type, string[]> = {
  meet: ['difficult_conversations', 'results_ownership'], present: ['results_ownership', 'communicating_change'],
  negotiate: ['difficult_conversations', 'results_ownership'], email: ['communicating_change', 'results_ownership']
};

const first = (s: Stakeholder) => s.name.split(' ')[0];
const signed = (n: number) => `${n >= 0 ? '+' : '−'}${Math.abs(n)}`;
const stakeholder = (sim: Sim, key: string) => {
  const s = stakeholderConfig(sim, key);
  if (!s) throw new IntentError(`No stakeholder ${key}`, 'unknownStakeholder');
  return s;
};
export const interactionLabel = (x: Interact): Copy => x.label ?? msg('engine.stakeholder.label', { type: x.type });
/** "Negotiate with Priya" */
export const interactionTitle = (s: Stakeholder, x: Interact | null): Copy => msg('engine.stakeholder.title', { action: x ? interactionLabel(x) : msg('engine.stakeholder.label', { type: 'reply' }), name: first(s) });
/** The engine's action key for a stakeholder interaction, for history and the report. */
export const stakeholderAction = (key: string, interaction: string) => `stakeholder:${key}:${interaction}`;

/** Whether the participant engaged this stakeholder this period. */
export const engagedNow = (sim: Sim, key: string) => !!sim.stakeholders[key]?.engaged.includes(sim.period);

/** The interactions offered now: from their period on, while their conditions hold. */
export function offered(sim: Sim, s: Stakeholder): Interact[] {
  return s.interactions.filter(x => conditionsHold(sim, x.if));
}

/** Why an interaction cannot be taken now, as the board's block reasons, or null. */
export function stakeholderBlock(sim: Sim, s: Stakeholder, x: Interact): { reason: 'locked'; period: number } | { reason: 'capacity'; need: number; have: number } | { reason: 'cooldown'; in: number } | null {
  if (sim.period < x.from) return { reason: 'locked', period: x.from };
  if (x.cost > capacityLeft(sim)) return { reason: 'capacity', need: x.cost, have: capacityLeft(sim) };
  if (engagedNow(sim, s.key)) return { reason: 'cooldown', in: Math.max(1, perPeriod(sim) - sim.sub) };
  return null;
}

/** A stakeholder's mood, from the relationship: what the AI character and the live screen show. */
export function stakeholderMood(sim: Sim, key: string): Mood {
  const st = sim.stakeholders[key];
  if (!st) return 'neutral';
  if (st.trust < 25 || st.satisfaction < 20) return 'frustrated';
  if (st.satisfaction < 40 || st.trust < 40) return 'concerned';
  if (sim.stakeholderRequests.some(r => r.stakeholder === key && r.state === 'open')) return 'thinking';
  if (st.trust >= 70 && st.satisfaction >= 65) return 'happy';
  return 'neutral';
}

/** The open request a meeting with this stakeholder would answer: one for this interaction, or any of theirs. */
function meetingRequest(sim: Sim, key: string, interaction: string) {
  return sim.stakeholderRequests.find(r => r.stakeholder === key && r.state === 'open' && r.kind === 'meeting' && (!r.interaction || r.interaction === interaction));
}

function answer(sim: Sim, r: StakeholderRequestState) {
  r.state = 'answered';
  const m = sim.inbox.find(x => x.id === r.messageId);
  if (m && m.state === 'open') m.state = 'answered';
}

// ---------------------------------------------------------------- effects

export interface Landed { trust: number; satisfaction: number; applied: Applied | null; changes: Change[]; outcome: Copy | null; met: boolean }

/** Scales an effect's business part by the relationship: gains by `gain`, losses by `loss` (a variable's direction counts). */
function scaleBusiness(sim: Sim, b: StakeholderEffect['business'], k: { gain: number; loss: number }): StakeholderEffect['business'] {
  const by = (v: number, good: boolean) => v * (good ? k.gain : k.loss);
  const variables = Object.fromEntries(Object.entries(b.variables).map(([key, d]) => {
    const up = sim.config.variables.find(v => v.key === key)?.higherIsBetter ?? true;
    return [key, Math.round(by(d, (d > 0) === up))];
  }));
  return { ...b, variables, revenue: Math.round(by(b.revenue, b.revenue > 0)), sponsor: Math.round(by(b.sponsor, b.sponsor > 0)) };
}

/** Who an effect's people part lands on. */
function whoOf(sim: Sim, who: string): MemberSim[] {
  if (who === 'team') return sim.members.filter(m => m.away === 0);
  if (who.startsWith('stage:')) return sim.members.filter(m => m.stage === who.slice(6));
  return sim.members.filter(m => m.id === who);
}

/**
 * Lands an effect on a stakeholder (D161): the one their relationship allows (`needs`, else `otherwise`), scaled by
 * their trust, on them, the business and the team members it names.
 */
export function landEffect(sim: Sim, rng: Rng, s: Stakeholder, eff: StakeholderEffect | undefined, cause: Copy, extra?: { trust: number; satisfaction: number }): Landed {
  const st = sim.stakeholders[s.key];
  const out: Landed = { trust: 0, satisfaction: 0, applied: null, changes: [], outcome: null, met: true };
  if (!st) return out;
  const met = !eff?.needs || ((eff.needs.trust ?? 0) <= st.trust && (eff.needs.satisfaction ?? 0) <= st.satisfaction);
  const e = !eff ? undefined : met ? eff : eff.otherwise;
  out.met = met;
  const k = relationScale(st.trust);
  const sc = (v: number) => Math.round(v * (v >= 0 ? k.gain : k.loss));
  const moved = moveRelation(sim, s.key, { trust: sc((e?.trust ?? 0) + (extra?.trust ?? 0)), satisfaction: sc((e?.satisfaction ?? 0) + (extra?.satisfaction ?? 0)) }, cause);
  out.trust = moved.trust;
  out.satisfaction = moved.satisfaction;
  if (!e) { out.outcome = met ? null : msg('engine.stakeholder.declined', { name: first(s) }); return out; }
  out.outcome = e.outcome ?? (met ? null : msg('engine.stakeholder.declined', { name: first(s) }));
  out.applied = applyBusiness(sim, scaleBusiness(sim, e.business, k), cause);
  out.changes.push(...out.applied.changes);
  if (e.people.some(v => v !== 0)) {
    const reason: Reason = { label: cause, cause, rule: msg('engine.stakeholder.rule', { name: first(s) }), evidence: [{ quote: cause, by: YOU, judgedByAI: false }] };
    for (const m of whoOf(sim, e.who)) out.changes.push(...effectChanges(sim, rng, m, e.people, reason, { useTrust: false }));
  }
  return out;
}

function record(sim: Sim, s: Stakeholder, x: Interact | null, l: Landed, fields: { title: Copy; band?: Band | null; option?: Copy | null; read?: StakeholderRecord['read']; answered?: boolean; type?: StakeholderRecord['type'] }): StakeholderRecord {
  const rec: StakeholderRecord = {
    id: nextId(sim, 'k'), period: sim.period, sub: sim.sub, stakeholder: s.key, interaction: x?.key ?? null, type: fields.type ?? x?.type ?? 'email', title: fields.title,
    band: fields.band ?? null, option: fields.option ?? null, outcome: l.outcome, trust: l.trust, satisfaction: l.satisfaction,
    variables: l.applied?.variables ?? [], revenue: l.applied?.revenue ?? 0, sponsor: l.changes.filter(c => c.subject === 'sponsor').reduce((a, c) => a + c.delta, 0),
    changes: l.changes.filter(c => c.subject !== 'sponsor'), read: fields.read ?? [], answered: !!fields.answered
  };
  sim.stakeholderRecords.push(rec);
  return rec;
}

/** The outcome panel after a stakeholder interaction: who answered, what moved, what happened. */
function outcomeOf(sim: Sim, s: Stakeholder, actionKey: string, headline: Copy, reply: Copy, l: Landed): Outcome {
  const affected = [...new Set(l.changes.filter(c => c.subject !== 'sponsor').map(c => c.subject))];
  const changed: Copy[] = [msg('engine.stakeholder.moved', { name: first(s), trust: signed(l.trust), satisfaction: signed(l.satisfaction) })];
  if (l.outcome) changed.push(l.outcome);
  return {
    id: nextId(sim, 'o'), actionKey, speaker: s.key, headline, reply, affected,
    reactions: Object.fromEntries(affected.map(id => {
      const net = l.changes.filter(c => c.subject === id).reduce((a, c) => a + c.delta, 0);
      return [id, msg(net > 0 ? 'engine.reaction.glad' : net < 0 ? 'engine.reaction.unhappy' : 'engine.reaction.neutral')];
    })),
    changes: l.changes, ripple: null, changed: changed.slice(0, 2)
  };
}

// ---------------------------------------------------------------- engaging

/**
 * Engages a stakeholder (D161): a static decision resolves now with its option; a live one opens a conversation
 * that `finishStakeholder` resolves. Either way the days are spent now and the stakeholder counts as engaged.
 */
export function engageStakeholder(sim: Sim, rng: Rng, input: { stakeholder: string; interaction: string; option?: string }): { changes: Change[]; interactionId: string | null } {
  if (sim.phase !== 'board') throw new IntentError('Stakeholders are engaged on the board', 'wrongPhase');
  const s = stakeholder(sim, input.stakeholder);
  const x = offered(sim, s).find(i => i.key === input.interaction);
  if (!x) throw new IntentError(`${s.name} has no interaction ${input.interaction} now`, 'unknownInteraction');
  const block = stakeholderBlock(sim, s, x);
  if (block) throw new IntentError(block.reason === 'capacity' ? 'Not enough time left' : block.reason === 'locked' ? `Offered from period ${block.period}` : `You have already engaged ${s.name} this period`, block.reason === 'capacity' ? 'noCapacity' : 'blocked');
  const st = sim.stakeholders[s.key];
  const req = meetingRequest(sim, s.key, x.key);
  if (x.kind === 'static') {
    const o = x.options!.find(p => p.key === input.option);
    if (!o) throw new IntentError(`Pick an option for ${interactionLabel(x)}`, 'unknownOption');
    st.engaged.push(sim.period);
    const cause = msg('engine.stakeholder.option', { action: interactionTitle(s, x), option: o.label });
    const ev = req ? sim.config.events.find(e => e.key === req.eventKey) : undefined;
    if (req) answer(sim, req);
    const l = landEffect(sim, rng, s, o.effect, cause);
    if (ev?.request) mergeLanded(l, landEffect(sim, rng, s, ev.request.onTime, msg('engine.stakeholder.onTime', { name: first(s) })));
    record(sim, s, x, l, { title: interactionTitle(s, x), option: o.label, read: o.read, answered: !!req });
    log(sim, { kind: 'action', title: cause, memberIds: [...new Set(l.changes.map(c => c.subject).filter(id => id !== 'sponsor'))], changes: l.changes, action: stakeholderAction(s.key, x.key) });
    sim.outcome = outcomeOf(sim, s, stakeholderAction(s.key, x.key), cause, '', l);
    spend(sim, rng, x.cost);
    return { changes: l.changes, interactionId: null };
  }
  const id = nextId(sim, 'i');
  st.engaged.push(sim.period);
  if (req) answer(sim, req);
  sim.interactions[id] = blank({ actionKey: stakeholderAction(s.key, x.key), optionKey: null, memberIds: [], format: STAKEHOLDER_SCREEN[x.type], startedAt: sim.absSub,
    stakeholder: { key: s.key, interaction: x.key, format: STAKEHOLDER_FORMAT[x.type], ...(req ? { requestId: req.id } : null) } });
  spend(sim, rng, x.cost);
  return { changes: [], interactionId: id };
}

function mergeLanded(a: Landed, b: Landed) {
  a.trust += b.trust;
  a.satisfaction += b.satisfaction;
  a.changes.push(...b.changes);
  if (b.applied) a.applied = a.applied ? { ...a.applied, variables: [...a.applied.variables, ...b.applied.variables], revenue: a.applied.revenue + b.applied.revenue } : b.applied;
}

/** The message this one answers is from a stakeholder: the reply or the meeting goes to them. */
export const stakeholderMessage = (sim: Sim, messageId: string | undefined) => {
  const m = messageId ? sim.inbox.find(x => x.id === messageId) : undefined;
  return m && isStakeholder(sim, m.from) ? m : undefined;
};

/**
 * Opens what a stakeholder's message asks for (D162): their meeting (the interaction they asked for, which costs its
 * days), or a reply in writing to their message (no days, as any reply).
 */
export function openStakeholderMessage(sim: Sim, rng: Rng, messageId: string): string {
  if (sim.phase !== 'board') throw new IntentError('Conversations happen on the board', 'wrongPhase');
  const m = stakeholderMessage(sim, messageId);
  if (!m || m.state !== 'open') throw new IntentError('That message is closed', 'closedMessage');
  const s = stakeholder(sim, m.from);
  const req = sim.stakeholderRequests.find(r => r.messageId === messageId && r.state === 'open');
  if (req?.kind === 'meeting') {
    const x = offered(sim, s).find(i => (req.interaction ? i.key === req.interaction : i.kind === 'live'));
    if (!x || x.kind !== 'live') throw new IntentError(`Answer ${s.name} from the stakeholders panel`, 'useStakeholders');
    const r = engageStakeholder(sim, rng, { stakeholder: s.key, interaction: x.key });
    return r.interactionId!;
  }
  const existing = Object.entries(sim.interactions).find(([, it]) => it.replyTo === messageId);
  if (existing) return existing[0];
  const id = nextId(sim, 'i');
  sim.interactions[id] = blank({ actionKey: 'reply', optionKey: null, memberIds: [], format: 'chat', startedAt: sim.absSub, replyTo: messageId,
    stakeholder: { key: s.key, interaction: 'reply', format: 'chat', ...(req ? { requestId: req.id } : null) } });
  return id;
}

/** The interaction a conversation is, or null for a reply to a message. */
export const interactionOf = (sim: Sim, it: Interaction): Interact | null => (it.stakeholder ? stakeholderConfig(sim, it.stakeholder.key)?.interactions.find(x => x.key === it.stakeholder!.interaction) ?? null : null);

/** The evaluator's rubric and skills for a stakeholder conversation. */
export function stakeholderEvaluation(sim: Sim, it: Interaction): { rubric?: Array<{ key: string }>; skills: string[] } {
  const x = interactionOf(sim, it);
  const known = new Set(sim.config.report.skills.map(k => k.key));
  const skills = (x?.skills ?? STAKEHOLDER_SKILLS[x?.type ?? 'email']).filter(k => known.has(k));
  return { ...(x?.rubric ? { rubric: x.rubric } : null), skills };
}

const words = (t: string) => t.split(/\s+/).filter(Boolean).length;

/**
 * Ends a stakeholder conversation (D161): the band's effect (authored, or the defaults) lands through the relationship,
 * with the request it answered on time; the conversation counts as a live record (the Leadership pillar, the week
 * score and the skills' evidence) and a stakeholder record (the report).
 */
export function finishStakeholder(sim: Sim, rng: Rng, interactionId: string, ev: Evaluation, npcReply: Copy): Outcome {
  const it = sim.interactions[interactionId];
  const s = stakeholder(sim, it.stakeholder!.key);
  delete sim.interactions[interactionId];
  const x = interactionOf(sim, it);
  const st = sim.stakeholders[s.key];
  const title = interactionTitle(s, x);
  const cause = msg('engine.live.with', { action: x ? interactionLabel(x) : msg('engine.stakeholder.label', { type: 'reply' }), who: first(s), band: ev.band });
  const base = STAKEHOLDER_BANDS[ev.band];
  // A reply in writing costs no days: it moves the relationship half as far as a meeting.
  const eff = x ? x.consequences?.[ev.band] : undefined;
  const l = landEffect(sim, rng, s, eff, cause, eff ? undefined : x ? base : { trust: Math.round(base.trust / 2), satisfaction: Math.round(base.satisfaction / 2) });
  // The request this answered: on time, its own effect too.
  const req = it.stakeholder!.requestId ? sim.stakeholderRequests.find(r => r.id === it.stakeholder!.requestId) : undefined;
  let answered = false;
  if (req && (req.state === 'answered' || (req.state === 'open' && sim.absSub <= req.dueAbsSub))) {
    if (req.state === 'open') answer(sim, req);
    const e = sim.config.events.find(y => y.key === req.eventKey);
    if (e?.request) mergeLanded(l, landEffect(sim, rng, s, e.request.onTime, msg('engine.stakeholder.onTime', { name: first(s) })));
    answered = true;
  }
  if (it.replyTo) {
    const m = sim.inbox.find(y => y.id === it.replyTo);
    if (m && m.state === 'open') m.state = 'answered';
  }
  if (!x) st.engaged.push(sim.period);
  // Their hidden concern, when the conversation surfaced it (as with a team member).
  if (ev.flags.concernSurfaced && it.concernRevealed && s.hiddenConcern && !st.concernShared) {
    st.concernShared = true;
    const d = moveRelation(sim, s.key, { trust: 4 }, msg('engine.stakeholder.openedUp', { name: first(s) }));
    l.trust += d.trust;
  }
  record(sim, s, x, l, { title, band: ev.band, answered, type: x?.type ?? 'email' });
  // The live record: the Leadership pillar, the week score and the skills read it as any conversation (D164).
  const mine = it.turns.filter(t => t.by === 'you');
  const said = mine.map(t => String(t.text)).join(' ');
  const rec: LiveRecord = {
    id: nextId(sim, 'r'), period: sim.period, sub: sim.sub, actionKey: it.actionKey, format: it.format, band: ev.band, memberIds: [], title, stakeholder: s.key,
    styleShown: null, skills: ev.skills ?? [], quotes: mine.map(t => String(t.text)),
    talk: { you: words(said), npc: it.turns.filter(t => t.by !== 'you').reduce((n, t) => n + (typeof t.text === 'string' ? words(t.text) : 0), 0), openQuestions: (said.match(/\b(?:what|how|why|tell me|describe|walk me through)\b[^?]*\?/gi) ?? []).length, recognition: 0, spoken: mine.some(t => t.voice) },
    concern: !!ev.flags.concernSurfaced, impact: l.changes.filter(c => c.subject !== 'sponsor').reduce((a, c) => a + Math.abs(c.delta), 0),
    changes: l.changes.filter(c => c.subject !== 'sponsor').slice(0, 4).map(c => ({ subject: c.subject, metric: c.metric, delta: c.delta }))
  };
  sim.liveRecords.push(rec);
  sim.liveCount++;
  const vp = (sim.voicePeriods[sim.period] ??= { voice: 0, total: 0 });
  vp.total++; if (ev.usedVoice) vp.voice++;
  checkBadges(sim, 'interaction');
  const outcome = outcomeOf(sim, s, it.actionKey, cause, npcReply, l);
  sim.outcome = outcome;
  log(sim, { kind: 'interaction', title: cause, memberIds: outcome.affected, changes: l.changes, quote: ev.evidence[0], action: it.actionKey });
  return outcome;
}

// ---------------------------------------------------------------- events and requests (D162)

/**
 * An event from a stakeholder: their message (a chat or email, or the request's), a card when it arrives as one, and
 * the request it makes, with its deadline. Called for events that name a stakeholder and are not decisions.
 */
export function stakeholderEvent(sim: Sim, ev: EventConfig, body: string, changes: Change[], focus: string | null) {
  const s = stakeholderConfig(sim, ev.stakeholder!);
  if (!s) return;
  let messageId: string | null = null;
  if (ev.delivery === 'chat' || ev.delivery === 'email' || ev.request) {
    addMessage(sim, { from: s.key, kind: ev.delivery === 'chat' ? 'chat' : 'email', title: ev.title, body, dueIn: ev.request ? ev.request.within : 2, urgent: ev.card === 'crisis' || !!ev.request });
    messageId = sim.inbox[sim.inbox.length - 1].id;
  }
  if (ev.delivery === 'modal' || ev.delivery === 'sponsorCall' || (ev.delivery === 'bulletin' && sim.period === 1)) {
    const card: EventCard = { id: nextId(sim, 'ev'), key: ev.key, card: ev.card, delivery: 'modal', title: ev.title, body, memberId: focus, changes, label: ev.label ?? null, messageId, stakeholder: s.key };
    sim.cards.push(card);
  }
  if (ev.request && messageId) {
    sim.stakeholderRequests.push({ id: nextId(sim, 'q'), eventKey: ev.key, stakeholder: s.key, messageId, kind: ev.request.kind, interaction: ev.request.interaction ?? null, dueAbsSub: sim.absSub + ev.request.within, state: 'open' });
  }
}

/** Requests past their deadline (D162): the stakeholder takes it badly, and the event's escalation follows. Every sub-period. */
export function stakeholderDueChecks(sim: Sim, rng: Rng) {
  for (const r of sim.stakeholderRequests) {
    if (r.state !== 'open' || sim.absSub <= r.dueAbsSub) continue;
    // A conversation already under way answers it when it ends.
    if (Object.values(sim.interactions).some(it => it.stakeholder?.requestId === r.id)) continue;
    r.state = 'ignored';
    const s = stakeholderConfig(sim, r.stakeholder);
    const ev = sim.config.events.find(e => e.key === r.eventKey);
    if (!s || !ev?.request) continue;
    const m = sim.inbox.find(x => x.id === r.messageId);
    if (m && m.state === 'open') m.state = 'expired';
    const cause = msg('engine.stakeholder.ignored', { name: first(s), title: ev.title });
    const l = landEffect(sim, rng, s, ev.request.ifIgnored, cause);
    if (ev.escalation?.sponsor) l.changes.push(...sponsorChange(sim, sim.config.gamification.sponsor.escalation, msg('engine.escalated.sponsor', { title: ev.title, name: sim.config.sponsor.name.split(' ')[0] })));
    if (ev.escalation?.event) {
      const wait = ev.escalation.delay ? ev.escalation.delay.days + ev.escalation.delay.weeks * perPeriod(sim) : 0;
      sim.events.delayed.push({ key: ev.escalation.event, at: sim.absSub + wait, cause: null });
    }
    record(sim, s, null, l, { title: ev.title, type: 'ignored' });
    log(sim, { kind: 'trigger', title: cause, memberIds: [...new Set(l.changes.map(c => c.subject).filter(id => id !== 'sponsor'))], changes: l.changes, action: `stakeholder:${s.key}` });
  }
}

/** Period end (D160): a stakeholder nobody engaged this period drifts; the week end gets each relationship's start and end. */
export function stakeholdersPeriodEnd(sim: Sim) {
  for (const s of sim.config.stakeholders) {
    const st = sim.stakeholders[s.key];
    if (!st || st.engaged.includes(sim.period) || (!s.drift.trust && !s.drift.satisfaction)) continue;
    moveRelation(sim, s.key, s.drift, msg('engine.stakeholder.drift', { name: first(s), unit: sim.config.time.period.unit }));
  }
}

/** The week end's summary of each relationship (D160), left out without stakeholders. */
export function stakeholderSummary(sim: Sim) {
  return sim.config.stakeholders.map(s => {
    const st = sim.stakeholders[s.key];
    return { key: s.key, name: s.name, trust: { start: st.atStart.trust, end: st.trust }, satisfaction: { start: st.atStart.satisfaction, end: st.satisfaction } };
  });
}

/**
 * The leadership reads of static stakeholder decisions the participant made (D164), as records the ratings and the
 * Leadership pillar read beside conversations and choices.
 */
export function stakeholderReadRecords(sim: Sim): LiveRecord[] {
  return sim.stakeholderRecords.filter(r => r.read.length).map(r => ({
    id: r.id, period: r.period, sub: r.sub, actionKey: stakeholderAction(r.stakeholder, r.interaction ?? 'reply'), format: 'choice', band: r.read[0].band, memberIds: [], stakeholder: r.stakeholder,
    title: r.title, quotes: [], skills: r.read.map(x => ({ key: x.skill, band: x.band, evidence: [] }))
  }));
}
