import type { ActionRealism, Realism, StorylineConfig } from '../config';
import { msg } from '../copy';
import type { Change, MemberSim, Reason, Sim } from './types';
import { share } from './dynamics';

/**
 * Realism (D171 to D178, docs/SIMULATION.md 3.6): what a working week costs and what neglect does. Every rule here
 * applies only when the storyline has a `realism` block, so a storyline without one plays exactly as before (the
 * same numbers and the same random draws: nothing here draws).
 *
 *   repeat       the same action with the same person, or a team wide action, within its window lands at a decaying
 *                share of its good effects, people and business alike; the share recovers as earlier uses age out
 *   fatigue      a team wide action repeated in its window costs everyone a little morale and that day some output
 *   opportunity  a team wide action takes the team off its work for part of each of its days
 *   neglect      people with no time of their own for some weeks drift down in morale and trust and deliver less
 *   drag         neglected people with a low result hold the whole team back
 *   idle         days left unused at the week end deliver less; a week with no conversation counts low in Leadership
 *   escalation   an ignored event costs revenue (and its authored business effect), not only people
 *   sponsor      silence costs confidence; the participant can update the sponsor; low confidence makes them react
 *   stakeholders neglected stakeholders cool
 *   output       morale above a healthy level adds less; low skill holds output back; clear goals add some
 *
 * The score's curves (the Business pillar past the target, sponsor confidence in it, the People pillar, the gradual
 * streak) live in `./score`.
 */

export const realismOf = (sim: Pick<Sim, 'config'>): Realism | undefined => sim.config.realism;

type Action = StorylineConfig['actions'][number];
type Option = Action['options'][number];

/** The state realism keeps (D171 to D178), created with the run when the storyline has a realism block. */
export interface RealismState {
  /** Absolute sub-periods of each use, by `<action>@<member id>` or `<action>@team`. */
  uses: Record<string, number[]>;
  /** Output lost on an absolute sub-period, 0 to 0.9: the team's time away, fatigue, an idle day. */
  dayLoss: Record<number, number>;
  /** Weeks each member has had no time of their own with you, as of the last week end. */
  unattended: Record<string, number>;
  /** People given time of their own this period. */
  attended: string[];
  /** The absolute sub-period each member last had goals set. */
  goalsAt: Record<string, number>;
  /** The last period with a word to the sponsor (0 before any). */
  sponsorContact: number;
  /** The period of the participant's own sponsor update (one a period). */
  updatedPeriod: number | null;
  /** Weeks each stakeholder has gone without being engaged, as of the last week end. */
  stakeholderGap: Record<string, number>;
  /** Evidence for the report's drivers: counts of what realism did in the run. */
  evidence: RealismEvidence;
}

/** What realism did in a run, for the report's drivers (narrative.ts). */
export interface RealismEvidence {
  /** Uses that landed at a reduced share because the same action was repeated in its window. */
  repeats: number;
  /** By action key, the repeated uses. */
  repeatedActions: Record<string, number>;
  /** Team wide actions repeated in their window (fatigue). */
  fatigue: number;
  /** Days left unused at a week end. */
  idleDays: number;
  /** Weeks with no conversation at all. */
  idleWeeks: number;
  /** Person weeks spent neglected (past the neglect window), and by person. */
  neglectWeeks: number;
  neglected: Record<string, number>;
  /** Week ends at which the sponsor had heard nothing for the silence window. */
  silentWeeks: number;
  /** Revenue lost to ignored events and to the sponsor's reactions. */
  escalationRevenue: number;
  /** Times the sponsor reacted to low confidence. */
  reactions: number;
}

export function startRealism(config: StorylineConfig): RealismState | undefined {
  if (!config.realism) return undefined;
  return {
    uses: {}, dayLoss: {}, unattended: Object.fromEntries(config.members.map(m => [m.id, 0])), attended: [], goalsAt: {}, sponsorContact: 0, updatedPeriod: null,
    stakeholderGap: Object.fromEntries(config.stakeholders.map(s => [s.key, 0])),
    evidence: { repeats: 0, repeatedActions: {}, fatigue: 0, idleDays: 0, idleWeeks: 0, neglectWeeks: 0, neglected: {}, silentWeeks: 0, escalationRevenue: 0, reactions: 0 }
  };
}

const own = (a: Action): ActionRealism => a.realism ?? {};
const team = (a: Action) => a.scope === 'team';
const keyOfUse = (a: Action, memberId: string | null) => `${a.key}@${memberId ?? 'team'}`;

/** The days an earlier use of this action still lowers its effect. */
export function windowOf(r: Realism, a: Action): number {
  return own(a).window ?? (team(a) ? r.repeat.teamWindow : r.repeat.window);
}

/** The decay table for an action: the share of its good effects by how many earlier uses are in its window. */
export const decayOf = (r: Realism, a: Action) => own(a).decay ?? r.repeat.decay;

/** How a use now would land: earlier uses in the window, the share, and the days since the last one. */
export interface Repeat { uses: number; share: number; ago: number | null }

/** The repeat for this action with this person (or the team, for a team wide action), now. */
export function repeatOf(sim: Sim, a: Action, memberId: string | null): Repeat {
  const r = realismOf(sim);
  const st = sim.realism;
  if (!r || !st) return { uses: 0, share: 1, ago: null };
  const w = windowOf(r, a);
  // A use on the day it was taken counts as 0 days ago; a use `w` days ago has left the window.
  const now = sim.absSub + 1;
  const recent = (st.uses[keyOfUse(a, team(a) ? null : memberId)] ?? []).filter(t => now - t < w);
  const decay = decayOf(r, a);
  const n = recent.length;
  return { uses: n, share: decay[Math.min(n, decay.length - 1)], ago: n ? now - recent[recent.length - 1] : null };
}

/** Records a use (after its effects are worked out). */
export function noteUse(sim: Sim, a: Action, memberId: string | null) {
  const st = sim.realism;
  if (!st) return;
  const k = keyOfUse(a, team(a) ? null : memberId);
  (st.uses[k] ??= []).push(sim.absSub + 1);
}

/** Notes a use that landed at a reduced share, for the report. */
export function noteRepeat(sim: Sim, a: Action, rep: Repeat) {
  const st = sim.realism;
  if (!st || rep.share >= 1) return;
  st.evidence.repeats += 1;
  st.evidence.repeatedActions[a.key] = (st.evidence.repeatedActions[a.key] ?? 0) + 1;
}

/** Output lost on the coming days (each of `days` from the next sub-period), capped at 0.9 a day. */
export function addDayLoss(sim: Sim, loss: number, days: number) {
  const st = sim.realism;
  if (!st || loss <= 0) return;
  for (let d = 0; d < Math.max(1, Math.ceil(days)); d++) {
    const at = sim.absSub + 1 + d;
    st.dayLoss[at] = Math.min(0.9, (st.dayLoss[at] ?? 0) + loss);
  }
}

/** The share of the team's day an action takes (D172): the option's, the action's, else the storyline's for team wide actions. */
export function opportunityOf(r: Realism, a: Action, o: Option | undefined): number {
  return o?.opportunity ?? own(a).opportunity ?? (team(a) ? r.opportunity.team : 0);
}

/** Whether a repeat of this action tires the team (team wide actions unless the action says otherwise). */
export const tires = (a: Action) => own(a).fatigue ?? team(a);

/** Whether the action sets goals (the written plan format, unless the action says otherwise). */
export const setsGoals = (a: Action) => own(a).goals ?? a.format === 'plan';

/**
 * What taking an action costs and records before its effects (D171, D172): the team's time away, fatigue for a team
 * wide action repeated in its window, the person's own time, goals set. Returns the fatigue changes.
 */
export function onAction(sim: Sim, a: Action, o: Option, memberIds: string[], days: number, rep: Repeat): Change[] {
  const r = realismOf(sim);
  const st = sim.realism;
  if (!r || !st) return [];
  const changes: Change[] = [];
  addDayLoss(sim, opportunityOf(r, a, o), days);
  if (team(a) && tires(a) && rep.uses > 0) {
    st.evidence.fatigue += 1;
    addDayLoss(sim, r.fatigue.output, days);
    if (r.fatigue.morale) {
      const reason: Reason = {
        label: msg('engine.real.fatigue.label'),
        cause: msg('engine.real.fatigue.cause', { action: a.name, days: rep.ago ?? 0 }),
        rule: msg('engine.real.fatigue.rule', { morale: r.fatigue.morale, output: Math.round(r.fatigue.output * 100), window: windowOf(r, a), unit: sim.config.time.subPeriod.unit }),
        evidence: []
      };
      for (const m of sim.members.filter(x => x.away === 0)) {
        const from = m.morale, to = Math.max(0, from + r.fatigue.morale);
        if (to === from) continue;
        m.morale = to;
        m.lowestMorale = Math.min(m.lowestMorale, to);
        changes.push({ subject: m.id, metric: 'morale', from, to, delta: to - from, reason });
      }
    }
  }
  // Time of their own: a one to one action with them (assessing someone is not time with them).
  if (!team(a) && a.rule !== 'assess') attend(sim, memberIds);
  if (setsGoals(a)) for (const id of memberIds) st.goalsAt[id] = sim.absSub + 1;
  return changes;
}

/** People given time of their own (a one to one action, an answered message): their neglect clock resets. */
export function attend(sim: Sim, memberIds: string[]) {
  const st = sim.realism;
  if (!st) return;
  for (const id of memberIds) if (!st.attended.includes(id)) st.attended.push(id);
}

/** A word to the sponsor this period: a briefing, a reply to them, an update. */
export function sponsorContact(sim: Sim) {
  if (sim.realism) sim.realism.sponsorContact = sim.period;
}

/** Weeks the member has gone without time of their own: as of the last week end, 0 once given time this period. */
export function unattendedWeeks(sim: Sim, id: string): number {
  const st = sim.realism;
  if (!st) return 0;
  return st.attended.includes(id) ? 0 : st.unattended[id] ?? 0;
}

/** Neglected: past the neglect window and not given time this period. */
export function neglected(sim: Sim, m: MemberSim): boolean {
  const r = realismOf(sim);
  return !!r && unattendedWeeks(sim, m.id) >= r.neglect.weeks;
}

/** The share of a positive result change from an action that lands (D178): less above a healthy morale. */
export function saturation(sim: Sim, m: MemberSim): number {
  const r = realismOf(sim);
  if (!r || m.morale <= r.output.healthy) return 1;
  const over = (m.morale - r.output.healthy) / Math.max(1, 100 - r.output.healthy);
  return 1 - (1 - r.output.saturation) * Math.min(1, over);
}

/** A person's share of output from realism (D174, D178): skill, goals and neglect. 1 without realism. */
export function personOutput(sim: Sim, m: MemberSim): number {
  const r = realismOf(sim);
  const st = sim.realism;
  if (!r || !st) return 1;
  const skill = share(m.skill, r.output.skill.full, r.output.skill.floor);
  const goals = st.goalsAt[m.id] !== undefined && sim.absSub - st.goalsAt[m.id] < r.output.goals.weeks * sim.config.time.subPeriod.perPeriod ? 1 + r.output.goals.boost : 1;
  const care = neglected(sim, m) ? 1 - r.neglect.output : 1;
  return skill * goals * care;
}

/** The whole team's output share on this sub-period (D172 to D174): time away, fatigue, idle days and drag. */
export function teamOutput(sim: Sim): number {
  const r = realismOf(sim);
  const st = sim.realism;
  if (!r || !st) return 1;
  const lost = st.dayLoss[sim.absSub] ?? 0;
  const low = sim.members.filter(m => m.result < r.drag.below && neglected(sim, m)).length;
  const drag = Math.min(r.drag.max, low * r.drag.share);
  return (1 - lost) * (1 - drag);
}

/** Days left unused at a week end (D174): they deliver less. Call before the week's last days run. */
export function idleDays(sim: Sim, left: number, remaining: number) {
  const r = realismOf(sim);
  const st = sim.realism;
  if (!r || !st) return;
  const n = Math.max(0, Math.min(remaining, Math.floor(left + 1e-9)));
  st.evidence.idleDays += n;
  // The unused days are the week's last ones.
  for (let d = remaining - n; d < remaining; d++) {
    const at = sim.absSub + 1 + d;
    st.dayLoss[at] = Math.min(0.9, (st.dayLoss[at] ?? 0) + r.idle.output);
  }
}

/** A week's target: the run's target shared over its periods. */
const weekTarget = (sim: Sim) => sim.config.money.target / sim.config.time.period.count;

/** Revenue an ignored event costs (D173), as a negative amount, or 0. */
export function escalationRevenue(sim: Sim): number {
  const r = realismOf(sim);
  return r ? -Math.round(r.escalation.revenue * weekTarget(sim)) : 0;
}

/** Revenue the sponsor's reaction takes (D173). */
export function reactionRevenue(sim: Sim): number {
  const r = realismOf(sim);
  return r ? -Math.round(r.sponsor.reaction.revenue * weekTarget(sim)) : 0;
}

/** A weeks count for a period end: everyone not given time of their own this period adds a week. */
export function advanceAttention(sim: Sim) {
  const st = sim.realism;
  if (!st) return;
  for (const m of sim.members) st.unattended[m.id] = st.attended.includes(m.id) ? 0 : (st.unattended[m.id] ?? 0) + 1;
  st.attended = [];
}
