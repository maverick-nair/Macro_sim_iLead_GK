import type { GeneralEvent } from '../config';
import type { z } from 'zod';
import { createRng, type Rng } from './rng';
import { mismatchType, type Mismatch } from './rules';
import { addMessage, effectChanges, firstName, fit, gendered, log, member, misread, nextId, sponsorChange } from './sim';
import type { Change, EventCard, MemberSim, NewsItem, Reason, Sim } from './types';
import { msg } from '../copy';
import { applyBusiness, conditionsHold, noteTriggered, openChoice } from './business';

/**
 * Events (Configuration Spec, Events and NPC initiated moments): fixed, random or conditional timing;
 * a team, stage, member or the sponsor as target; delivery as a board card, a bulletin, a chat or email,
 * or a sponsor call; an expected response with a window, and an escalation when it does not come.
 */

type EventConfig = z.output<typeof GeneralEvent>;

/** Impact scales with how well the target was being led: half, full or one and a half (SIMULATION 6.3). */
const EVENT_SHARE: Record<Mismatch, number> = { 0: 0.5, 1: 1, 2: 1.5 };

/**
 * Timing for every event, drawn once at the start of the run. Random draws use their own stream from
 * the seed, so adding an event never changes anything else in the run.
 */
export function scheduleEvents(sim: Sim): Sim['events']['schedule'] {
  const rng = createRng((sim.seed ^ 0x5eed5) >>> 0);
  const per = sim.config.time.subPeriod.perPeriod;
  const out: Sim['events']['schedule'] = {};
  for (const ev of sim.config.events) {
    if (ev.period !== undefined) out[ev.key] = { period: ev.period, sub: ev.subPeriod };
    else if (ev.window) {
      const roll = rng.next() * 100;
      const period = ev.window.from + Math.floor(rng.next() * (ev.window.to - ev.window.from + 1));
      const sub = 1 + Math.floor(rng.next() * per);
      out[ev.key] = roll < ev.window.probability ? { period, sub } : null;
    } else out[ev.key] = null;
  }
  return out;
}

/** Event keys some other event or effect leads to (an escalation or a follow up): they play only then (D138). */
const followed = new WeakMap<Sim['config'], Set<string>>();
function followUpTargets(config: Sim['config']): Set<string> {
  let out = followed.get(config);
  if (!out) {
    out = new Set<string>();
    const add = (b: { followUps: Array<{ event: string }> } | undefined) => { for (const f of b?.followUps ?? []) out!.add(f.event); };
    for (const ev of config.events) {
      if (ev.escalation?.event) out.add(ev.escalation.event);
      add(ev.business);
      for (const o of ev.choice?.options ?? []) add(o.business);
      add(ev.choice?.ignored?.business);
    }
    for (const a of config.actions) for (const o of a.options) for (const b of Object.values(o.business ?? {})) add(b);
    followed.set(config, out);
  }
  return out;
}

const done = (sim: Sim, key: string) => sim.events.fired.includes(key) || sim.events.skipped.includes(key);

/**
 * Plays an event that is due, when its conditions on earlier choices hold (D138); otherwise it is skipped
 * and never plays. `cause` is the choice that scheduled it, if one did.
 */
function playIfHolds(sim: Sim, rng: Rng, ev: EventConfig, cause: string | null = null) {
  if (!conditionsHold(sim, ev.if)) { sim.events.skipped.push(ev.key); return; }
  fireEvent(sim, rng, ev, cause);
}

/**
 * Fires the events due in this sub-period. Conditional events are checked at the first sub-period; an event
 * whose only timing is a condition on earlier choices (`if`) at every sub-period (D138). Follow ups scheduled
 * after a delay play when their sub-period comes.
 */
export function runEvents(sim: Sim, rng: Rng) {
  for (const d of [...sim.events.delayed]) {
    if (d.at > sim.absSub) continue;
    sim.events.delayed = sim.events.delayed.filter(x => x !== d);
    const ev = sim.config.events.find(e => e.key === d.key);
    if (ev && !done(sim, ev.key)) playIfHolds(sim, rng, ev, d.cause);
  }
  for (const ev of sim.config.events) {
    if (done(sim, ev.key)) continue;
    const at = sim.events.schedule[ev.key];
    if (at) { if (at.period === sim.period && at.sub === sim.sub) playIfHolds(sim, rng, ev); continue; }
    if (ev.when) { if (sim.sub === 1 && conditionHolds(sim, ev) && conditionsHold(sim, ev.if)) fireEvent(sim, rng, ev); continue; }
    if (ev.if && ev.period === undefined && !ev.window && !followUpTargets(sim.config).has(ev.key) && conditionsHold(sim, ev.if)) fireEvent(sim, rng, ev);
  }
  checkResponses(sim, rng);
}

function conditionHolds(sim: Sim, ev: EventConfig): boolean {
  const w = ev.when!;
  const ends = sim.periods.slice(-w.periods);
  if (ends.length < w.periods) return false;
  switch (w.condition) {
    case 'teamMoraleBelow': return ends.every(p => p.kpis.morale.end < w.value);
    case 'teamTrustBelow': return ends.every(p => p.kpis.trust.end < w.value);
    case 'memberMoraleBelow': return sim.members.some(m => m.periodEnds.slice(-w.periods).length === w.periods && m.periodEnds.slice(-w.periods).every(e => e.morale < w.value));
    case 'behindPace': return ends.every(p => p.pace * 100 < w.value);
  }
}

/** Who an event lands on. `member` picks: the top performer for an offer, otherwise someone mid table. */
function targetsOf(sim: Sim, ev: EventConfig): { members: MemberSim[]; focus: string | null } {
  const t = ev.target;
  if (t === 'sponsor') return { members: [], focus: null };
  if (t === 'team') return { members: sim.members, focus: null };
  if (t.startsWith('stage:')) return { members: sim.members.filter(m => m.stage === t.slice(6)), focus: null };
  if (t === 'member') {
    if (!sim.members.length) return { members: [], focus: null };
    const byResult = [...sim.members].sort((a, b) => b.result - a.result);
    const m = ev.card === 'opportunity' || ev.key === 'job_offer' ? byResult[0] : byResult[Math.floor(byResult.length / 2)];
    return { members: [m], focus: m.id };
  }
  const m = member(sim, t);
  return { members: m ? [m] : [], focus: m?.id ?? null };
}

export function fireEvent(sim: Sim, rng: Rng, ev: EventConfig, cause: string | null = null) {
  sim.events.fired.push(ev.key);
  noteTriggered(sim, ev, cause);
  const { members, focus } = targetsOf(sim, ev);
  // A named person who has left the team: the event no longer applies.
  if (ev.target !== 'team' && ev.target !== 'sponsor' && !ev.target.startsWith('stage:') && !members.length) return;
  const body = gendered(ev.body, sim, focus);
  const changes: Change[] = [];
  for (const m of members) {
    const mt = m.style ? mismatchType(fit(sim, m.style, m.neededAtStart), rng, misread(sim, m)) : 1;
    const reason: Reason = {
      label: ev.title,
      cause: body,
      evidence: [{ quote: ev.title, by: msg('engine.news'), judgedByAI: false }],
      rule: msg('engine.event.rule', { share: mt === 0 ? 'half' : mt === 1 ? 'full' : 'more' })
    };
    changes.push(...effectChanges(sim, rng, m, ev.impact, reason, { scale: EVENT_SHARE[mt], useTrust: false }));
    if (ev.away > 0) { m.away = Math.max(m.away, ev.away); m.awayReason = 'leave'; m.awaySetAt = sim.absSub; }
  }

  // Business variables, flags and follow ups the event moves (D136, D138).
  if (ev.business) changes.push(...applyBusiness(sim, ev.business, ev.title).changes);
  // A choice (D137) opens a decision, on a card of its own.
  if (ev.choice) {
    const choiceId = openChoice(sim, ev, focus);
    sim.cards.push({ id: nextId(sim, 'ev'), key: ev.key, card: ev.card, delivery: 'modal', title: ev.title, body, memberId: focus, changes, label: ev.label ?? null, messageId: null, choiceId });
    log(sim, { kind: 'event', title: ev.title, memberIds: members.map(m => m.id), changes });
    return;
  }

  // Delivery. A bulletin was read at the last week end; in the first period there was none, so it shows as a card.
  let messageId: string | null = null;
  const within = ev.response?.within ?? 2;
  if (ev.delivery === 'chat' || ev.delivery === 'email') {
    if (focus) {
      addMessage(sim, { from: focus, kind: ev.delivery, title: ev.title, body, dueIn: ev.response ? within : 2, urgent: ev.card === 'crisis' });
      messageId = sim.inbox[sim.inbox.length - 1].id;
    }
  } else if (ev.delivery === 'sponsorCall') {
    addMessage(sim, { from: 'sponsor', kind: 'sponsor', title: ev.title, body, dueIn: within, urgent: true });
    messageId = sim.inbox[sim.inbox.length - 1].id;
  }
  const carded = ev.delivery === 'modal' || ev.delivery === 'sponsorCall' || (ev.delivery === 'bulletin' && sim.period === 1);
  if (carded) {
    const card: EventCard = { id: nextId(sim, 'ev'), key: ev.key, card: ev.card, delivery: ev.delivery === 'sponsorCall' ? 'sponsorCall' : 'modal', title: ev.title, body, memberId: focus, changes, label: ev.label ?? null, messageId };
    sim.cards.push(card);
  }
  if (ev.response) {
    const actions = ev.delivery === 'chat' || ev.delivery === 'email' || ev.delivery === 'sponsorCall' ? [...new Set(['reply', ...ev.response.actions])] : ev.response.actions;
    sim.events.pending.push({ eventKey: ev.key, memberId: focus, messageId, actions, dueAbsSub: sim.absSub + within });
  }
  log(sim, { kind: 'event', title: ev.title, memberIds: members.map(m => m.id), changes });
}

/**
 * The participant acted. Any pending event whose expected response this is, with its target (or any
 * target for a team or sponsor event), is answered; on time, the authored bonus applies.
 */
export function respond(sim: Sim, rng: Rng, actionKey: string, memberIds: string[], messageId?: string): Change[] {
  const out: Change[] = [];
  for (const p of [...sim.events.pending]) {
    const byMessage = actionKey === 'reply' && p.messageId !== null && p.messageId === messageId;
    const byAction = actionKey !== 'reply' && p.actions.includes(actionKey) && (p.memberId === null || memberIds.includes(p.memberId));
    if (!byMessage && !byAction) continue;
    if (byMessage && !p.actions.includes('reply')) continue;
    sim.events.pending = sim.events.pending.filter(x => x !== p);
    const ev = sim.config.events.find(e => e.key === p.eventKey);
    const m = p.memberId ? member(sim, p.memberId) : undefined;
    if (ev?.response && m && sim.absSub <= p.dueAbsSub) {
      const reason: Reason = { label: msg('engine.responded.label'), cause: msg('engine.responded.cause', { title: ev.title }), rule: msg('engine.responded.rule', { name: firstName(sim, m.id), n: ev.response.within, unit: sim.config.time.subPeriod.unit }), evidence: [] };
      out.push(...effectChanges(sim, rng, m, ev.response.onTime, reason, { useTrust: false }));
    }
  }
  return out;
}

/** Pending responses past their window escalate: a follow up event, and the sponsor hears of it. */
function checkResponses(sim: Sim, rng: Rng) {
  for (const p of [...sim.events.pending]) {
    if (sim.absSub <= p.dueAbsSub) continue;
    sim.events.pending = sim.events.pending.filter(x => x !== p);
    const ev = sim.config.events.find(e => e.key === p.eventKey);
    if (!ev?.escalation) continue;
    if (ev.escalation.sponsor) {
      const first = sim.config.sponsor.name.split(' ')[0];
      log(sim, { kind: 'trigger', title: msg('engine.escalated', { title: ev.title }), memberIds: p.memberId ? [p.memberId] : [], changes: sponsorChange(sim, sim.config.gamification.sponsor.escalation, msg('engine.escalated.sponsor', { title: ev.title, name: first })) });
    }
    const next = ev.escalation.event ? sim.config.events.find(e => e.key === ev.escalation!.event) : undefined;
    // A follow up may wait (D138): it plays after its delay, if its own conditions hold then.
    const wait = ev.escalation.delay ? ev.escalation.delay.days + ev.escalation.delay.weeks * sim.config.time.subPeriod.perPeriod : 0;
    if (next && wait > 0) sim.events.delayed.push({ key: next.key, at: sim.absSub + wait, cause: null });
    else if (next && !done(sim, next.key)) playIfHolds(sim, rng, next);
  }
}

/** Bulletins that land in the next period, for the week end's news step. */
export function upcomingNews(sim: Sim): NewsItem[] {
  const next = sim.period + 1;
  return sim.config.events
    .filter(ev => ev.delivery === 'bulletin' && sim.events.schedule[ev.key]?.period === next && !sim.events.fired.includes(ev.key))
    .sort((a, b) => sim.events.schedule[a.key]!.sub - sim.events.schedule[b.key]!.sub)
    .map(ev => ({ key: ev.key, card: ev.card, title: ev.title, body: gendered(ev.body, sim, null), impact: ev.impactText ?? null }));
}

