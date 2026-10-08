import type { Business, Clause, GeneralEvent } from '../config';
import type { z } from 'zod';
import type { Rng } from './rng';
import { addEffects, clampTo, effectChanges, fill, gendered, log, member, nextId, perPeriod, sponsorChange, teamAverage, trustChange } from './sim';
import type { ActionRecord, Change, ChoiceRecord, MemberSim, Reason, Sim } from './types';
import { IntentError } from './errors';
import { msg, type Copy } from '../copy';

/**
 * The business state (D136 to D138, docs/SIMULATION.md 6.6 to 6.8): named business variables, flags and
 * counters, conditions on them, follow ups after a delay, and choice events. Nothing here runs for a
 * storyline that uses none of it, so older storylines play exactly as before.
 */

type EventConfig = z.output<typeof GeneralEvent>;
type Choice = NonNullable<EventConfig['choice']>;
type Option = Choice['options'][number];

/** Variables at the start of the run. */
export const startVars = (sim: Pick<Sim, 'config'>) => Object.fromEntries(sim.config.variables.map(v => [v.key, v.start]));

/** A variable's name, for engine copy. */
export const varName = (sim: Sim, key: string) => sim.config.variables.find(v => v.key === key)?.name ?? key;

/** Moves one variable within its range and keeps the last causes (the board's tooltip). Returns the applied change. */
export function moveVar(sim: Sim, key: string, delta: number, cause: Copy): number {
  const v = sim.config.variables.find(x => x.key === key);
  if (!v || !delta) return 0;
  const from = sim.vars[key] ?? v.start;
  const to = clampTo(from + delta, v.min, v.max);
  sim.vars[key] = to;
  const d = to - from;
  if (d !== 0) sim.varCauses[key] = [{ text: cause, delta: d }, ...(sim.varCauses[key] ?? [])].slice(0, 3);
  return d;
}

export interface Applied { changes: Change[]; variables: Array<{ key: string; delta: number }>; revenue: number; set: string[]; clear: string[]; scheduled: string[] }

/**
 * Applies a business effect: variables, revenue (added to the run's revenue, never below 0), sponsor confidence,
 * flags set and cleared, counters, and follow ups scheduled after their delay.
 */
export function applyBusiness(sim: Sim, b: Business | undefined, cause: Copy, from: string | null = null): Applied {
  const out: Applied = { changes: [], variables: [], revenue: 0, set: [], clear: [], scheduled: [] };
  if (!b) return out;
  for (const [key, delta] of Object.entries(b.variables)) {
    const d = moveVar(sim, key, delta, cause);
    if (d) out.variables.push({ key, delta: d });
  }
  if (b.revenue) {
    const before = sim.funnel.value;
    sim.funnel.value = Math.max(0, before + b.revenue);
    const d = sim.funnel.value - before;
    sim.funnel.periodValue += d;
    sim.extraRevenue += d;
    out.revenue = d;
  }
  if (b.sponsor) out.changes.push(...sponsorChange(sim, b.sponsor, cause));
  for (const f of b.set) if (!sim.flags.includes(f)) { sim.flags.push(f); out.set.push(f); }
  for (const f of b.clear) if (sim.flags.includes(f)) { sim.flags = sim.flags.filter(x => x !== f); out.clear.push(f); }
  for (const [k, n] of Object.entries(b.count)) sim.counters[k] = (sim.counters[k] ?? 0) + n;
  for (const f of b.followUps) {
    sim.events.delayed.push({ key: f.event, at: sim.absSub + f.days + f.weeks * perPeriod(sim), cause: from });
    out.scheduled.push(f.event);
  }
  return out;
}

/** Applies the business effect of an action's option (D136): `always`, then the one for how well the approach fitted. */
export function applyActionBusiness(sim: Sim, option: { business?: { always?: Business; m0?: Business; m1?: Business; m2?: Business } }, mismatch: 0 | 1 | 2 | null, cause: Copy): Applied | null {
  const b = option.business;
  if (!b) return null;
  const a = applyBusiness(sim, b.always, cause);
  const byFit = mismatch === null ? undefined : b[`m${mismatch}` as const];
  const f = applyBusiness(sim, byFit, cause);
  return { changes: [...a.changes, ...f.changes], variables: [...a.variables, ...f.variables], revenue: a.revenue + f.revenue, set: [...a.set, ...f.set], clear: [...a.clear, ...f.clear], scheduled: [...a.scheduled, ...f.scheduled] };
}

// ---------------------------------------------------------------- conditions (D138)

/** A metric's value now, for a condition. */
function metricOf(sim: Sim, metric: Extract<Clause, { kind: 'metric' }>['metric']): number {
  switch (metric) {
    case 'teamMorale': return teamAverage(sim, 'morale');
    case 'teamTrust': return teamAverage(sim, 'trust');
    case 'teamSkill': return teamAverage(sim, 'skill');
    case 'teamResult': return teamAverage(sim, 'result');
    case 'sponsor': return sim.sponsor.value;
    case 'revenuePace': {
      const total = perPeriod(sim) * sim.config.time.period.count;
      const share = Math.max(1, sim.absSub) / total;
      return 100 * sim.funnel.value / Math.max(1, sim.config.money.target * share);
    }
  }
}

export function clauseHolds(sim: Sim, c: Clause): boolean {
  const cmp = (v: number, op: 'below' | 'atLeast', x: number) => (op === 'below' ? v < x : v >= x);
  switch (c.kind) {
    case 'flag': return sim.flags.includes(c.flag) === c.is;
    case 'counter': return cmp(sim.counters[c.counter] ?? 0, c.op, c.value);
    case 'variable': return cmp(sim.vars[c.variable] ?? 0, c.op, c.value);
    case 'metric': return cmp(metricOf(sim, c.metric), c.op, c.value);
  }
}

/** All clauses hold (an event with none always holds). */
export const conditionsHold = (sim: Sim, clauses: Clause[] | undefined) => !clauses || clauses.every(c => clauseHolds(sim, c));

// ---------------------------------------------------------------- choices (D137)

/** Who an option's people part lands on. */
function whoOf(sim: Sim, who: string, target: MemberSim[]): MemberSim[] {
  if (who === 'target') return target;
  if (who === 'team') return sim.members.filter(m => m.away === 0);
  if (who.startsWith('stage:')) return sim.members.filter(m => m.stage === who.slice(6));
  const m = member(sim, who);
  return m ? [m] : [];
}

/** Opens a choice for an event that just played. Its card carries the choice's id. */
export function openChoice(sim: Sim, ev: EventConfig, focus: string | null): string {
  const id = nextId(sim, 'c');
  sim.openChoices.push({ id, eventKey: ev.key, memberId: focus, firedAbsSub: sim.absSub, dueAbsSub: sim.absSub + ev.choice!.within });
  return id;
}

/** Events a flag this choice set makes possible: those that test it. */
function testsFlags(ev: EventConfig, flags: string[]) {
  return (ev.if ?? []).some(c => c.kind === 'flag' && c.is && flags.includes(c.flag));
}

/**
 * Resolves a choice: the option the participant picked (`by: 'you'`), or the default when the deadline passed
 * (`by: 'default'`): its people, trust, business and flags apply, its follow ups are scheduled, and the record
 * keeps all of it for the report. Returns the record.
 */
export function resolveChoice(sim: Sim, rng: Rng, choiceId: string, optionKey: string | null, by: 'you' | 'default'): ChoiceRecord {
  const open = sim.openChoices.find(c => c.id === choiceId);
  if (!open) throw new IntentError('That choice is closed', 'closedChoice');
  const ev = sim.config.events.find(e => e.key === open.eventKey)!;
  const choice = ev.choice!;
  const picked: Option | undefined = optionKey ? choice.options.find(o => o.key === optionKey) : choice.default ? choice.options.find(o => o.key === choice.default) : undefined;
  if (optionKey && !picked) throw new IntentError(`No option ${optionKey}`, 'unknownOption');
  const ig = !picked ? choice.ignored : undefined;
  const opt = picked ?? (ig ? { label: null, outcome: ig.outcome ?? null, who: ig.who, people: ig.people, trust: ig.trust, business: ig.business, read: [] as Option['read'] } : undefined);
  sim.openChoices = sim.openChoices.filter(c => c !== open);
  sim.cards = sim.cards.filter(c => c.choiceId !== choiceId);
  const id = choiceId;
  const label: Copy | null = picked ? fill(picked.label, sim, open.memberId) : null;
  const cause: Copy = label ? msg('engine.choice.cause', { title: ev.title, option: label, by }) : msg('engine.choice.none', { title: ev.title });
  const target = open.memberId ? [member(sim, open.memberId)].filter((m): m is MemberSim => !!m) : ev.target === 'team' ? sim.members.filter(m => m.away === 0) : ev.target.startsWith('stage:') ? sim.members.filter(m => m.stage === ev.target.slice(6)) : [];
  const changes: Change[] = [];
  let applied: Applied = { changes: [], variables: [], revenue: 0, set: [], clear: [], scheduled: [] };
  if (opt) {
    const reason: Reason = { label: label ?? msg('engine.choice.defaultLabel'), cause, rule: msg('engine.choice.rule', { by }), evidence: [{ quote: label ?? ev.title, by: msg(by === 'you' ? 'engine.you' : 'engine.choice.nobody'), judgedByAI: false }] };
    for (const m of whoOf(sim, opt.who, target)) {
      if (opt.people.some(v => v !== 0)) changes.push(...effectChanges(sim, rng, m, opt.people, reason, { useTrust: false }));
      if (opt.trust) changes.push(...trustChange(m, opt.trust, reason));
    }
    applied = applyBusiness(sim, opt.business, cause, id);
    changes.push(...applied.changes);
  }
  const rec: ChoiceRecord = {
    id, eventKey: ev.key, title: ev.title, memberId: open.memberId, option: picked?.key ?? null, label, outcome: opt?.outcome ? fill(opt.outcome, sim, open.memberId) : null, by,
    period: sim.period, sub: sim.sub, changes, variables: applied.variables, revenue: applied.revenue, flags: { set: applied.set, clear: applied.clear },
    triggered: [], read: by === 'you' ? picked?.read ?? [] : []
  };
  sim.choices.push(rec);
  // A choice is an action in the report's record of what reached whom.
  const actionRec: ActionRecord = { id: `a${sim.actionRecords.length + 1}`, period: sim.period, sub: sim.sub, actionKey: `choice:${ev.key}`, optionKey: rec.option, scope: 'member', reached: [...new Set(changes.filter(c => c.subject !== 'sponsor').map(c => c.subject))], effects: {}, uses: [] };
  addEffects(actionRec, changes);
  log(sim, { kind: 'event', title: label ? msg('engine.choice.log', { title: ev.title, option: label, by }) : msg('engine.choice.none', { title: ev.title }), memberIds: [...new Set(changes.map(c => c.subject).filter(s => s !== 'sponsor'))], changes, action: `choice:${ev.key}` });
  return rec;
}

/** Choices past their deadline take their default (D137). Checked every sub-period. */
export function choiceDueChecks(sim: Sim, rng: Rng) {
  for (const c of [...sim.openChoices]) if (sim.absSub > c.dueAbsSub) resolveChoice(sim, rng, c.id, null, 'default');
}

/** Notes, on the choices that led to it, an event that just played: one they scheduled, or one their flags made possible. */
export function noteTriggered(sim: Sim, ev: EventConfig, cause: string | null) {
  for (const rec of sim.choices) {
    if (rec.triggered.some(t => t.key === ev.key)) continue;
    if (rec.id === cause || testsFlags(ev, rec.flags.set)) rec.triggered.push({ key: ev.key, title: ev.title, period: sim.period, sub: sim.sub });
  }
}

/** A choice's text for its card: the event's body, worded for the person it is about. */
export const choiceBody = (sim: Sim, ev: EventConfig, memberId: string | null) => gendered(ev.body, sim, memberId);

