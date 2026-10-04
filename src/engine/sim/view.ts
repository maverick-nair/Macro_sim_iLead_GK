import { blockedReason } from './actions';
import { ONE_SHOT, speakerFor, turnLimit } from './live';
import { finalScore, pillarMax, RUN_MAX } from './period';
import { capacity, capacityLeft, idealThroughput, perPeriod, person, teamAverage } from './sim';
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

/** The goal of a conversation that is not an action: the sponsor briefing, or a reply to a message. */
function goalFor(sim: Sim, it: Sim['interactions'][string]): string | null {
  const first = sim.config.sponsor.name.split(' ')[0];
  if (it.actionKey === 'sponsor') return `Give ${first} an honest update: where you stand against target, the biggest risk, and what you need.`;
  const msg = it.replyTo ? sim.inbox.find(m => m.id === it.replyTo) : undefined;
  return msg ? `Reply to ${msg.from === 'sponsor' ? first : person(sim, msg.from).name.split(' ')[0]} about: ${msg.title}` : null;
}

/** The open live interaction, everything the shell shows (spec, Live interaction screens). */
function liveView(sim: Sim) {
  const entries = Object.entries(sim.interactions);
  if (!entries.length) return null;
  const [id, it] = entries[entries.length - 1];
  const c = sim.config;
  const a = c.actions.find(x => x.key === it.actionKey);
  const option = a?.options.find(o => o.key === it.optionKey);
  const main = it.memberIds[0] ? sim.members.find(m => m.id === it.memberIds[0]) : undefined;
  const p = main ? person(sim, main.id) : undefined;
  const who = (pid: string) => pid === 'sponsor' ? { id: 'sponsor', name: c.sponsor.name, img: c.sponsor.portrait ?? null } : { id: pid, name: person(sim, pid).name, img: person(sim, pid).portrait ?? null };
  const yours = it.turns.filter(t => t.by === 'you').length;
  const mode = a?.live.hints ?? 'onRequest';
  return {
    id, format: it.format, actionKey: it.actionKey, actionName: a?.name ?? null, optionLabel: option && a && a.options.length > 1 ? option.label : null,
    oneShot: ONE_SHOT.has(it.format),
    people: (it.format === 'meeting' ? sim.members.filter(m => m.away === 0).map(m => m.id) : it.memberIds).map(who),
    speaker: who(speakerFor(sim, it)),
    brief: {
      goal: a?.live.goal ?? (option && a && a.options.length > 1 ? option.label : a?.description ?? goalFor(sim, it)),
      known: [p?.profile.remarks, main?.concernShared ? p?.hiddenConcern : undefined].filter((x): x is string => !!x && !!x.trim()),
      mood: main ? moodOf(main, sim) : null,
      promises: sim.promises.filter(x => x.state === 'open' && it.memberIds.includes(x.memberId)).map(x => x.text),
      declaredStyle: main?.style ?? null
    },
    turns: it.turns.map(t => ({ id: t.id, by: t.by, text: t.text, voice: !!t.voice, interrupted: !!t.interrupted, aiGenerated: t.by !== 'you' })),
    turnLimit: turnLimit(sim, it), turnsLeft: Math.max(0, turnLimit(sim, it) - yours), minutes: a?.live.minutes ?? 3,
    closed: it.closed,
    hint: { mode: mode === 'afterWeak' ? 'onRequest' : mode, text: it.hint },
    candidates: it.candidates?.map(cid => {
      const cp = person(sim, cid);
      return { id: cid, name: cp.name, title: cp.title, img: cp.portrait ?? null, cv: { previous: cp.profile.previous, experience: cp.profile.experience, skills: cp.profile.skills, remarks: cp.profile.remarks } };
    }) ?? null,
    candidate: it.candidate ?? null,
    replyTo: it.replyTo ?? null
  };
}

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
      // Stats stay hidden until the profile is first opened (spec, D39): the engine never sends them early.
      skill: m.revealed ? m.skill : null, morale: m.revealed ? m.morale : null, result: m.revealed ? m.result : null, trust: m.revealed ? m.trust : null,
      style: m.style, lastStyle: m.lastStyle, lastReaction: m.lastReaction,
      mood, img: p.portraits?.[mood] ?? p.portrait ?? null, away: m.away, awayReason: m.awayReason,
      statsRevealed: m.revealed, shared: m.concernShared ? p.hiddenConcern ?? null : null,
      careerGoal: m.concernShared ? p.careerGoal ?? null : null, assessedStages: m.assessedStages, assessments: m.assessments,
      unread: sim.inbox.some(x => x.from === m.id && x.state === 'open'),
      promise: sim.promises.find(x => x.memberId === m.id && x.state === 'open')?.text ?? null,
      profile: p.profile
    };
  };
  const score = finalScore(sim);
  return {
    phase: sim.phase,
    /** Read only storyline identity, for onboarding. */
    storyline: { name: c.name, organisation: c.organisation ?? null },
    clock: {
      period: sim.period, periods: c.time.period.count, periodUnit: c.time.period.unit,
      subPeriod: Math.min(sim.sub + 1, c.time.subPeriod.perPeriod), subPeriodUnit: c.time.subPeriod.unit,
      capacity: capacity(sim), capacityLeft: capacityLeft(sim), costStep: c.time.costStep,
      /** How far through the run we are, 0 to 1: where the pace marker sits. */
      runShare: Math.min(1, ((sim.period - 1) * perPeriod(sim) + sim.sub) / (c.time.period.count * perPeriod(sim)))
    },
    money: { currency: c.money.currency, locale: c.money.locale, display: c.money.display, target: c.money.target, value: Math.round(sim.funnel.value), valueThisPeriod: Math.round(sim.funnel.periodValue) },
    members: sim.members.map(member),
    kpis: (['skill', 'morale', 'result', 'trust'] as const).map(k => ({ metric: k, value: teamAverage(sim, k), start: sim.periodStart.kpis[k] })),
    pulse: (() => {
      const moods = sim.members.map(m => moodOf(m, sim));
      return { upbeat: moods.filter(x => x === 'happy').length, steady: moods.filter(x => x === 'neutral' || x === 'thinking').length, struggling: moods.filter(x => x === 'concerned' || x === 'frustrated').length };
    })(),
    maxPerStage: c.maxPerStage,
    funnel: c.stages.map((st, i) => ({ key: st.key, name: st.name, members: sim.members.filter(m => m.stage === st.key).length, ideal: st.ideal,
      throughput: Math.round(sim.funnel.stageOutPeriod[i] * 10) / 10, idealThroughput: Math.round(ideal[i] * 10) / 10, bottleneck: i === bottleneck })),
    actions: c.actions.map(a => ({
      key: a.key, name: a.name, description: a.description, scope: a.scope, kind: a.kind, format: a.format ?? null, cost: a.cost, targets: a.targets,
      prerequisite: a.prerequisite ?? null,
      rule: a.rule,
      options: a.options.map(o => ({ key: o.key, label: o.label, cost: o.cost ?? a.cost, away: o.away, targets: o.targets ?? null, distinctStages: o.distinctStages, pickStage: o.pickStage, blocked: a.scope === 'team' ? blockedReason(sim, a, null, o.key) : null })),
      blocked: a.scope === 'team' ? blockedReason(sim, a, null) : null,
      blockedFor: a.scope === 'member' ? Object.fromEntries(sim.members.map(m => [m.id, blockedReason(sim, a, m.id)])) : {}
    })),
    promises: sim.promises.map(x => ({ id: x.id, memberId: x.memberId, text: x.text, state: x.state, dueInSubPeriods: Math.max(0, x.dueAbsSub - sim.absSub) })),
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
    sponsor: { name: c.sponsor.name, title: c.sponsor.title, img: c.sponsor.portrait ?? null, styleLine: c.sponsor.styleLine, level: SPONSOR_LEVELS[Math.min(4, Math.floor(sim.sponsor.value / 20))], causes: sim.sponsor.causes },
    pendingReward: sim.pendingReward,
    history: sim.log,
    live: liveView(sim),
    liveCap: { cap: sim.config.time.liveCap, used: sim.liveTaken[sim.period] ?? 0 }
  };
}

export type EngineView = ReturnType<typeof buildView>;
