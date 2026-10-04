import { blockedReason } from './actions';
import { finalScore, pillarMax, RUN_MAX } from './period';
import { capacity, capacityLeft, idealThroughput, person, teamAverage } from './sim';
import type { InboxMessage, MemberSim, Mood, Sim } from './types';

/**
 * What the participant may see. Built from engine state, never computed by the UI. Deliberately
 * leaves out each member's needed style and the hidden concern text until it surfaces, since
 * working those out is the game.
 */

export function moodOf(m: MemberSim, sim: Sim): Mood {
  const open = sim.promises.some(p => p.memberId === m.id && p.state === 'open') || sim.inbox.some(x => x.from === m.id && x.state === 'open');
  if (m.morale < 25 || m.trust < 20) return 'frustrated';
  if (m.morale < 45 || m.lastChange <= -5) return 'concerned';
  if (open || m.reassignedInPeriod === sim.period) return 'thinking';
  if (m.morale >= 70 && m.lastChange >= 0) return 'happy';
  return 'neutral';
}

const SPONSOR_LEVELS = ['low', 'wavering', 'steady', 'confident', 'champion'] as const;

export const BADGES: Array<{ key: string; hint: string | null }> = [
  { key: 'first_word', hint: null }, { key: 'listener', hint: null },
  { key: 'pipeline_builder', hint: 'Push one stage past ideal' }, { key: 'steady_hand', hint: 'Keep everyone above 40' },
  { key: 'turnaround', hint: 'Help someone bounce back' }, { key: 'clear_voice', hint: 'A whole period in voice' },
  { key: 'promise_keeper', hint: 'Keep three promises' }, { key: 'right_style', hint: 'Lead everyone the right way for a period' }
];

export function buildView(sim: Sim) {
  const c = sim.config;
  const ideal = idealThroughput(sim);
  const ratios = sim.funnel.stageOutPeriod.map((v, i) => (ideal[i] ? v / ideal[i] : 1));
  const bottleneck = sim.sub > 0 ? ratios.indexOf(Math.min(...ratios)) : -1;
  const message = (x: InboxMessage) => ({ id: x.id, from: x.from, kind: x.kind, title: x.title, body: x.body, urgent: x.urgent, state: x.state,
    dueInSubPeriods: x.dueAbsSub === null ? null : Math.max(0, x.dueAbsSub - sim.absSub) });
  const member = (m: MemberSim) => {
    const p = person(sim, m.id);
    const mood = moodOf(m, sim);
    return {
      id: m.id, name: p.name, title: p.title, pronoun: p.pronoun, stage: m.stage,
      skill: m.skill, morale: m.morale, result: m.result, trust: m.trust,
      style: m.style, lastStyle: m.lastStyle, lastReaction: m.lastReaction,
      mood, img: p.portraits?.[mood] ?? p.portrait ?? null, away: m.away, awayReason: m.awayReason,
      statsRevealed: m.revealed, shared: m.concernShared ? p.hiddenConcern ?? null : null,
      unread: sim.inbox.some(x => x.from === m.id && x.state === 'open'),
      promise: sim.promises.find(x => x.memberId === m.id && x.state === 'open')?.text ?? null,
      profile: p.profile
    };
  };
  const score = finalScore(sim);
  return {
    phase: sim.phase,
    clock: {
      period: sim.period, periods: c.time.period.count, periodUnit: c.time.period.unit,
      subPeriod: Math.min(sim.sub + 1, c.time.subPeriod.perPeriod), subPeriodUnit: c.time.subPeriod.unit,
      capacity: capacity(sim), capacityLeft: capacityLeft(sim), costStep: c.time.costStep
    },
    money: { currency: c.money.currency, locale: c.money.locale, display: c.money.display, target: c.money.target, value: Math.round(sim.funnel.value), valueThisPeriod: Math.round(sim.funnel.periodValue) },
    members: sim.members.map(member),
    kpis: (['skill', 'morale', 'result', 'trust'] as const).map(k => ({ metric: k, value: teamAverage(sim, k), start: sim.periodStart.kpis[k] })),
    pulse: (() => {
      const moods = sim.members.map(m => moodOf(m, sim));
      return { upbeat: moods.filter(x => x === 'happy').length, steady: moods.filter(x => x === 'neutral' || x === 'thinking').length, struggling: moods.filter(x => x === 'concerned' || x === 'frustrated').length };
    })(),
    funnel: c.stages.map((st, i) => ({ key: st.key, name: st.name, members: sim.members.filter(m => m.stage === st.key).length, ideal: st.ideal,
      throughput: Math.round(sim.funnel.stageOutPeriod[i] * 10) / 10, idealThroughput: Math.round(ideal[i] * 10) / 10, bottleneck: i === bottleneck })),
    actions: c.actions.map(a => ({
      key: a.key, name: a.name, description: a.description, scope: a.scope, kind: a.kind, format: a.format ?? null, cost: a.cost, targets: a.targets,
      prerequisite: a.prerequisite ?? null,
      options: a.options.map(o => ({ key: o.key, label: o.label, blocked: a.scope === 'team' ? blockedReason(sim, a, null, o.key) : null })),
      blocked: a.scope === 'team' ? blockedReason(sim, a, null) : null,
      blockedFor: a.scope === 'member' ? Object.fromEntries(sim.members.map(m => [m.id, blockedReason(sim, a, m.id)])) : {}
    })),
    inbox: sim.inbox.filter(x => x.state === 'open').map(message),
    cards: sim.cards,
    outcome: sim.outcome,
    score: {
      business: sim.score.business, people: sim.score.people, leadership: sim.score.leadership, bonus: sim.score.bonus,
      total: score.total, max: RUN_MAX, periodMax: pillarMax(sim), tier: sim.phase === 'ended' ? score.tier : null
    },
    streak: sim.streak,
    periods: sim.periods,
    badges: BADGES.map(b => ({ key: b.key, earned: sim.badges.includes(b.key), hint: b.hint })),
    sponsor: { name: c.sponsor.name, title: c.sponsor.title, img: c.sponsor.portrait ?? null, level: SPONSOR_LEVELS[Math.min(4, Math.floor(sim.sponsor.value / 20))], causes: sim.sponsor.causes },
    pendingReward: sim.pendingReward,
    history: sim.log
  };
}

export type EngineView = ReturnType<typeof buildView>;
