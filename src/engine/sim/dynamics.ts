import type { Dynamics } from '../config';
import { createRng } from './rng';
import type { MemberSim, Reason, Sim } from './types';
import { msg } from '../copy';

/**
 * People dynamics (D135, docs/SIMULATION.md 3.5): how people feel reaches what they deliver, with a lag.
 * Every rule here applies only when the storyline has a `dynamics` block, so a storyline without one plays
 * exactly as before (the same numbers and the same random draws).
 *
 *   output    a person's result counts in the funnel in full while their rolling morale is at or above
 *             `output.full`, and less below it, down to `output.floor` of it at morale 0
 *   growth    result gains scale the same way (`growth`), so pushing a worn out team for result buys little
 *   trust     below `trust.full` trust, the good your actions do lands at a smaller share, down to `trust.floor`
 *   attrition at each period end someone whose rolling morale is under `attrition.below` may go off sick, and
 *             the `resignAfter`th time resigns (never the last person in a stage: they go off sick instead)
 *
 * The rolling morale is the mean of the person's morale at the end of each of the last `window` sub-periods
 * (with the current value while there is less history), so a dip shows in the work a few days later and a
 * recovery does too.
 */

export const dynamicsOf = (sim: Sim): Dynamics | undefined => sim.config.dynamics;

/** The mean morale over the last `window` sub-periods, or the current morale with no history yet. */
export function rollingMorale(sim: Sim, m: MemberSim): number {
  const d = dynamicsOf(sim);
  if (!d) return m.morale;
  const recent = m.moraleHistory.slice(-d.window);
  return recent.length ? recent.reduce((a, b) => a + b, 0) / recent.length : m.morale;
}

/** A share from 1 at `full` and above to `floor` at 0, in a straight line. */
export const share = (value: number, full: number, floor: number) => (full <= 0 || value >= full ? 1 : floor + (1 - floor) * Math.max(0, value) / full);

/** The share of a person's result that reaches the funnel (1 without dynamics). */
export function outputShare(sim: Sim, m: MemberSim): number {
  const d = dynamicsOf(sim);
  return d ? share(rollingMorale(sim, m), d.output.full, d.output.floor) : 1;
}

/** The share of a result gain that lands (1 without dynamics). */
export function growthShare(sim: Sim, m: MemberSim): number {
  const d = dynamicsOf(sim);
  return d ? share(rollingMorale(sim, m), d.growth.full, d.growth.floor) : 1;
}

/** The share of your actions' positive effects that lands, from the person's trust in you (1 without dynamics). */
export function trustShare(sim: Sim, m: MemberSim): number {
  const d = dynamicsOf(sim);
  return d ? share(m.trust, d.trust.full, d.trust.floor) : 1;
}

const nameOf = (sim: Sim, m: MemberSim) => sim.config.members.find(p => p.id === m.id)?.name ?? sim.config.candidates.find(p => p.id === m.id)?.name ?? m.id;

/** One draw on the run's dynamics stream, which no other rule reads. */
function draw(sim: Sim): number {
  const r = createRng(sim.dynState);
  const v = r.next();
  sim.dynState = r.state();
  return v;
}

/** The seed of the dynamics stream for a run: its own, so attrition never moves another draw. */
export const dynamicsSeed = (seed: number) => (seed ^ 0x0d1a7e5) >>> 0;

/**
 * Attrition at a period end. Returns who went off sick or left, for the week end; the caller logs and messages.
 * `leave` removes a person from the team (the engine's resignation path).
 */
export function attrition(sim: Sim, leave: (m: MemberSim) => void, notify: (m: MemberSim, kind: 'sick' | 'resigned', reason: Reason) => void): Sim['attrition'] {
  const d = dynamicsOf(sim);
  if (!d) return [];
  const out: Sim['attrition'] = [];
  const { below, chance, sickDays, resignAfter } = d.attrition;
  for (const m of [...sim.members]) {
    if (m.away > 0) continue;
    const avg = rollingMorale(sim, m);
    if (avg >= below) continue;
    const p = Math.min(0.95, chance + (below - avg) / 100);
    if (draw(sim) >= p) continue;
    m.strikes += 1;
    const peers = sim.members.filter(x => x !== m && x.stage === m.stage);
    const resign = m.strikes >= resignAfter && peers.length > 0 && sim.members.length > 1;
    const reason: Reason = {
      label: msg(resign ? 'engine.dyn.resigned.label' : 'engine.dyn.sick.label'),
      cause: msg(resign ? 'engine.dyn.resigned.cause' : 'engine.dyn.sick.cause', { name: sim.config.members.find(p => p.id === m.id)?.name.split(' ')[0] ?? m.id, morale: Math.round(avg), days: sickDays }),
      rule: msg('engine.dyn.attrition.rule', { below, window: d.window }),
      evidence: []
    };
    if (resign) {
      leave(m);
      out.push({ memberId: m.id, name: nameOf(sim, m), kind: 'resigned' });
    } else {
      m.away = Math.max(m.away, sickDays);
      m.awayReason = 'leave';
      m.awaySetAt = sim.absSub;
      out.push({ memberId: m.id, name: nameOf(sim, m), kind: 'sick' });
    }
    notify(m, resign ? 'resigned' : 'sick', reason);
  }
  return out;
}
