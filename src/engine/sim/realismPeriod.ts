import type { Rng } from './rng';
import { msg } from '../copy';
import { unitParams } from '../units';
import type { Change, Reason, Sim } from './types';
import { applyBusiness } from './business';
import { fireEvent } from './events';
import { firstName, log, sponsorChange, trustChange } from './sim';
import { moveRelation } from './stakeholderState';
import { advanceAttention, reactionRevenue, realismOf } from './realism';

/**
 * Realism at the week end (D173, D174, docs/SIMULATION.md 3.6): neglect, the sponsor's silence and reaction, and
 * stakeholders left alone. Applies only with a `realism` block. Nothing here draws from the run's streams.
 */

/** Neglect, idle weeks and stakeholders, after the week's last day and the weekly drift. */
export function realismWeekEnd(sim: Sim) {
  const r = realismOf(sim);
  const st = sim.realism;
  if (!r || !st) return;
  advanceAttention(sim);
  const unit = sim.config.time.period.unit;
  // People with no time of their own for the neglect window lose morale and trust at each further week end.
  const changes: Change[] = [];
  for (const m of sim.members) {
    const weeks = st.unattended[m.id] ?? 0;
    if (weeks < r.neglect.weeks || m.away > 0) continue;
    st.evidence.neglectWeeks += 1;
    st.evidence.neglected[m.id] = (st.evidence.neglected[m.id] ?? 0) + 1;
    const reason: Reason = {
      label: msg('engine.real.neglect.label'),
      cause: msg('engine.real.neglect.cause', { name: firstName(sim, m.id), weeks, unit }),
      rule: msg('engine.real.neglect.rule', { weeks: r.neglect.weeks, morale: r.neglect.morale, trust: r.neglect.trust, output: Math.round(r.neglect.output * 100), unit }),
      evidence: []
    };
    if (r.neglect.morale) {
      const from = m.morale, to = Math.max(0, from + r.neglect.morale);
      if (to !== from) { m.morale = to; m.lowestMorale = Math.min(m.lowestMorale, to); changes.push({ subject: m.id, metric: 'morale', from, to, delta: to - from, reason }); }
    }
    if (r.neglect.trust) changes.push(...trustChange(m, r.neglect.trust, reason));
  }
  if (changes.length) log(sim, { kind: 'periodEnd', title: msg('engine.real.neglect.log'), memberIds: [...new Set(changes.map(c => c.subject))], changes });
  // A week with no conversation at all, for the report.
  if (!sim.liveRecords.some(x => x.period === sim.period)) st.evidence.idleWeeks += 1;
  // Stakeholders nobody engaged for the window cool, on top of their own drift (D160).
  for (const s of sim.config.stakeholders) {
    const rel = sim.stakeholders[s.key];
    if (!rel) continue;
    st.stakeholderGap[s.key] = rel.engaged.includes(sim.period) ? 0 : (st.stakeholderGap[s.key] ?? 0) + 1;
    if (st.stakeholderGap[s.key] < r.stakeholders.weeks) continue;
    moveRelation(sim, s.key, { trust: r.stakeholders.trust, satisfaction: r.stakeholders.satisfaction }, msg('engine.real.stakeholder.cooled', { name: s.name.split(' ')[0], weeks: st.stakeholderGap[s.key], unit }));
  }
}

/** The sponsor's side at the week end: silence costs confidence (D173). Before the week's pace is judged. */
export function sponsorSilence(sim: Sim) {
  const r = realismOf(sim);
  const st = sim.realism;
  if (!r || !st) return;
  const silent = sim.period - st.sponsorContact;
  if (silent < r.sponsor.silence || !r.sponsor.decay) return;
  st.evidence.silentWeeks += 1;
  const first = sim.config.sponsor.name.split(' ')[0];
  const changes = sponsorChange(sim, r.sponsor.decay, msg('engine.real.silence', { name: first, weeks: silent, unit: sim.config.time.period.unit }));
  if (changes.length) log(sim, { kind: 'periodEnd', title: msg('engine.real.silence.log', { name: first }), memberIds: [], changes });
}

/**
 * The sponsor reacts when confidence falls under the reaction line during a week (D173): a deal moves to another team
 * (revenue), the authored business effect (a budget cut) and the authored event. Once each time it crosses the line.
 */
export function sponsorReaction(sim: Sim, rng: Rng, from: number) {
  const r = realismOf(sim);
  const st = sim.realism;
  if (!r || !st) return;
  const line = r.sponsor.reaction.below;
  if (!(from >= line && sim.sponsor.value < line)) return;
  st.evidence.reactions += 1;
  const first = sim.config.sponsor.name.split(' ')[0];
  const cause = msg('engine.real.reaction', { name: first, aUnit: unitParams(sim.config.money.unit).aUnit });
  const lost = reactionRevenue(sim);
  const b = applyBusiness(sim, { variables: {}, revenue: lost, sponsor: 0, set: [], clear: [], count: {}, followUps: [] }, cause);
  st.evidence.escalationRevenue += -b.revenue;
  const authored = applyBusiness(sim, r.sponsor.reaction.business, cause);
  log(sim, { kind: 'periodEnd', title: cause, memberIds: [], changes: [...b.changes, ...authored.changes] });
  const ev = r.sponsor.reaction.event ? sim.config.events.find(e => e.key === r.sponsor.reaction.event) : undefined;
  if (ev && !sim.events.fired.includes(ev.key)) fireEvent(sim, rng, ev);
}
