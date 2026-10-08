import { blockedReason, freeActivity } from './actions';
import { ONE_SHOT, PRACTICE, practiceAvailable, practicePartner, speakerFor, turnLimit } from './live';
import { purposeOf } from '../config';
import { buildReport } from '../report/build';
import { finalScore } from './period';
import { pulse as pulseOf, roundHalfUp } from './score';
import { capacity, capacityLeft, fill, idealThroughput, perPeriod, person, teamAverage } from './sim';
import { bestStyle, lensView, NEEDS } from '../lens';
import type { InboxMessage, MemberSim, Mood, Sim, SponsorLevel } from './types';
import type { StorylineConfig } from '../config';
import { msg, type Copy } from '../copy';
import { choiceBody, varName } from './business';
import { engagedNow, interactionLabel, interactionOf, offered, stakeholderBlock, stakeholderMood } from './stakeholders';
import { relationLevel, stakeholderConfig } from './stakeholderState';

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


/** Sponsor level words from confidence: below the check in line is low, at the unlock line confident. */
export function sponsorLevel(sim: Sim, v = sim.sponsor.value): SponsorLevel {
  const s = sim.config.gamification.sponsor;
  return v < s.checkInBelow ? 'low' : v < 50 ? 'wavering' : v < s.unlockAt ? 'steady' : v < 85 ? 'confident' : 'champion';
}

/** Name and portrait for a member, a departed member, a candidate, or the sponsor. */
function who(sim: Sim, id: string) {
  const c = sim.config;
  if (id === 'sponsor') return { id, name: c.sponsor.name, img: c.sponsor.portrait ?? null };
  const sh = stakeholderConfig(sim, id);
  if (sh) return { id, name: sh.name, img: sh.portrait ?? null };
  const p = c.members.find(x => x.id === id) ?? c.candidates.find(x => x.id === id);
  return p ? { id, name: p.name, img: p.portrait ?? null } : { id, name: c.sponsor.name, img: c.sponsor.portrait ?? null };
}

/** The goal of a conversation that is not an action: the sponsor briefing, or a reply to a message. */
function goalFor(sim: Sim, it: Sim['interactions'][string]): Copy | null {
  const first = sim.config.sponsor.name.split(' ')[0];
  if (it.actionKey === 'sponsor') return msg('engine.goal.sponsor', { name: first });
  const m = it.replyTo ? sim.inbox.find(x => x.id === it.replyTo) : undefined;
  const sh = m ? stakeholderConfig(sim, m.from) : undefined;
  return m ? msg('engine.goal.reply', { name: m.from === 'sponsor' ? first : sh ? sh.name.split(' ')[0] : person(sim, m.from).name.split(' ')[0], title: m.title }) : null;
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
  const sh = it.stakeholder ? stakeholderConfig(sim, it.stakeholder.key) : undefined;
  const shx = sh ? interactionOf(sim, it) : null;
  const who = (pid: string) => pid === 'sponsor' ? { id: 'sponsor', name: c.sponsor.name, img: c.sponsor.portrait ?? null }
    : sh && pid === sh.key ? { id: sh.key, name: sh.name, img: sh.portrait ?? null } : { id: pid, name: person(sim, pid).name, img: person(sim, pid).portrait ?? null };
  const yours = it.turns.filter(t => t.by === 'you').length;
  const mode = a?.live.hints ?? 'onRequest';
  return {
    id, format: it.format, actionKey: it.actionKey, actionName: a?.name ?? (sh && shx ? interactionLabel(shx) : null), optionLabel: option && a && a.options.length > 1 ? option.label : null,
    oneShot: ONE_SHOT.has(it.format),
    people: (it.format === 'meeting' ? sim.members.filter(m => m.away === 0).map(m => m.id) : sh ? [sh.key] : it.memberIds).map(who),
    speaker: who(speakerFor(sim, it)),
    /** Team meeting: attendees with a hand up, first to speak first. */
    raisedHands: it.format === 'meeting' ? it.hands ?? [] : [],
    brief: {
      goal: it.actionKey === PRACTICE ? c.practice.goal ?? msg('engine.practice.goal', { name: person(sim, it.memberIds[0]).name.split(' ')[0] })
        : sh ? (shx ? shx.goal ?? msg('engine.stakeholder.goal', { type: shx.type, name: sh.name.split(' ')[0] }) : goalFor(sim, it))
        : a?.live.goal ?? (option && a && a.options.length > 1 ? option.label : a?.description ?? goalFor(sim, it)),
      // An interview's brief is its structured questions, the same for every candidate (D85). A stakeholder's: who they are and where you stand.
      known: it.format === 'interview'
        ? a?.live.questions ?? [msg('engine.interview.q1'), msg('engine.interview.q2'), msg('engine.interview.q3')]
        : sh ? [msg('engine.stakeholder.known', { role: sh.role, kind: sh.kind, level: relationLevel(sim.stakeholders[sh.key]) }), sh.about, sim.stakeholders[sh.key]?.concernShared ? sh.hiddenConcern : undefined].filter((x): x is NonNullable<typeof x> => !!x && (typeof x !== 'string' || !!x.trim()))
        : [p?.profile.remarks, main?.concernShared ? p?.hiddenConcern : undefined].filter((x): x is string => !!x && !!x.trim()),
      mood: main ? moodOf(main, sim) : sh ? stakeholderMood(sim, sh.key) : null,
      promises: sim.promises.filter(x => x.state === 'open' && it.memberIds.includes(x.memberId)).map(x => x.text),
      declaredStyle: main?.style ?? null
    },
    turns: it.turns.map(t => ({ id: t.id, by: t.by, text: t.text, voice: !!t.voice, interrupted: !!t.interrupted, aiGenerated: t.by !== 'you' })),
    turnLimit: turnLimit(sim, it), turnsLeft: Math.max(0, turnLimit(sim, it) - yours), minutes: it.actionKey === PRACTICE ? c.practice.minutes : a?.live.minutes ?? 3,
    /** The Week 0 practice (D84): not scored, ends without the team reacting. */
    practice: it.actionKey === PRACTICE,
    closed: it.closed,
    hint: { mode: mode === 'afterWeak' ? 'onRequest' : mode, text: it.hint },
    candidates: it.candidates?.map(cid => {
      const cp = person(sim, cid);
      return { id: cid, name: cp.name, title: cp.title, img: cp.portrait ?? null, cv: { previous: cp.profile.previous, experience: cp.profile.experience, skills: cp.profile.skills, remarks: cp.profile.remarks } };
    }) ?? null,
    candidate: it.candidate ?? null,
    replyTo: it.replyTo ?? null,
    /** A conversation with a stakeholder (D161): who they are and which interaction it is. */
    stakeholder: sh ? { key: sh.key, role: sh.role, kind: sh.kind, type: shx?.type ?? 'reply' } : null
  };
}

export function buildView(sim: Sim) {
  const c = sim.config;
  const ideal = idealThroughput(sim);
  const ratios = sim.funnel.stageOutPeriod.map((v, i) => (ideal[i] ? v / ideal[i] : 1));
  const bottleneck = sim.sub > 0 ? ratios.indexOf(Math.min(...ratios)) : -1;
  const message = (x: InboxMessage) => ({ id: x.id, from: x.from, kind: x.kind, title: x.title, body: x.body, urgent: x.urgent, state: x.state, briefing: !!x.briefing,
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
      // The optional authored rows (D97) are sent only when the storyline has them.
      profile: p.profile
    };
  };
  const demoAction = c.demo.action ?? c.actions.find(a => a.kind === 'static' && a.scope === 'member')?.key ?? null;
  const score = finalScore(sim);
  return {
    phase: sim.phase,
    /** Read only storyline identity, for onboarding. */
    storyline: { name: c.name, organisation: c.organisation ?? null, locale: c.locale, ...(c.intro ? { intro: c.intro } : null), video: c.video ?? null },
    /**
     * The lens's styles and needs; never the fit table or the source (D70). The Tutorial's worked examples
     * (D91) are authored archetypes, or two worded from the needs and the first style that fits each.
     */
    lens: { ...lensView(c.lens), examples: c.lens.examples ?? defaultExamples(c.lens) },
    clock: {
      period: sim.period, periods: c.time.period.count, periodUnit: c.time.period.unit,
      subPeriod: Math.min(sim.sub + 1, c.time.subPeriod.perPeriod), subPeriodUnit: c.time.subPeriod.unit,
      capacity: capacity(sim), capacityLeft: capacityLeft(sim), costStep: c.time.costStep,
      /** How far through the run we are, 0 to 1: where the pace marker sits. */
      runShare: Math.min(1, ((sim.period - 1) * perPeriod(sim) + sim.sub) / (c.time.period.count * perPeriod(sim)))
    },
    money: { currency: c.money.currency, locale: c.money.locale, display: c.money.display, target: c.money.target, value: Math.round(sim.funnel.value), valueThisPeriod: Math.round(sim.funnel.periodValue) },
    members: sim.members.map(member),
    kpis: (['skill', 'morale', 'result', 'trust'] as const).map(k => {
      const value = teamAverage(sim, k), start = sim.periodStart.kpis[k];
      return { metric: k, value, start, trend: (value > start ? 'up' : value < start ? 'down' : 'flat') as 'up' | 'down' | 'flat' };
    }),
    pulse: (() => {
      const moods = sim.members.map(m => moodOf(m, sim));
      const value = roundHalfUp(pulseOf(sim)), start = roundHalfUp(sim.pulseAtStart);
      return { value, start, trend: (value > start ? 'up' : value < start ? 'down' : 'flat') as 'up' | 'down' | 'flat',
        upbeat: moods.filter(x => x === 'happy').length, steady: moods.filter(x => x === 'neutral' || x === 'thinking').length, struggling: moods.filter(x => x === 'concerned' || x === 'frustrated').length };
    })(),
    maxPerStage: c.maxPerStage,
    funnel: c.stages.map((st, i) => ({ key: st.key, name: st.name, members: sim.members.filter(m => m.stage === st.key).length, ideal: st.ideal,
      throughput: Math.round(sim.funnel.stageOutPeriod[i] * 10) / 10, idealThroughput: Math.round(ideal[i] * 10) / 10, bottleneck: i === bottleneck,
      // What the stage does and which skills suit it (D97), when authored.
      about: st.about ?? null, suits: st.suits ?? null })),
    actions: c.actions.map(a => ({
      key: a.key, name: a.name, description: a.description, scope: a.scope, kind: a.kind, format: a.format ?? null,
      cost: a.rule === 'hire' && sim.hireBudget ? 0 : a.cost,
      perk: a.rule === 'hire' && sim.hireBudget ? 'hireBudget' as const : freeActivity(sim, a) ? 'noCooldown' as const : null,
      targets: a.targets,
      prerequisite: a.prerequisite ?? null,
      rule: a.rule,
      // For the list of every action (D97): how long before it can be taken again, and when it unlocks.
      cooldown: a.cooldownDays, unlockPeriod: a.unlockPeriod,
      options: a.options.map(o => ({ key: o.key, label: o.label, cost: a.rule === 'hire' && sim.hireBudget ? 0 : o.cost ?? a.cost, away: o.away, cooldown: o.cooldownDays ?? a.cooldownDays,
        // Stages a move can go to, with a reason where the stage has no room (role coverage).
        stages: o.pickStage ? c.stages.map(st => ({ key: st.key, blocked: a.rule === 'swap' && sim.members.filter(m => m.stage === st.key).length >= c.maxPerStage ? { reason: 'stageFull' as const, stage: st.key } : null })) : null, targets: o.targets ?? null, distinctStages: o.distinctStages, pickStage: o.pickStage, blocked: a.scope === 'team' ? blockedReason(sim, a, null, o.key) : null })),
      blocked: a.scope === 'team' ? blockedReason(sim, a, null) : null,
      blockedFor: a.scope === 'member' ? Object.fromEntries(sim.members.map(m => [m.id, blockedReason(sim, a, m.id)])) : {}
    })),
    promises: sim.promises.map(x => ({ id: x.id, memberId: x.memberId, text: x.text, state: x.state, dueInSubPeriods: Math.max(0, x.dueAbsSub - sim.absSub) })),
    inbox: sim.inbox.filter(x => x.state === 'open').map(message),
    cards: sim.cards,
    outcome: sim.outcome ? { ...sim.outcome, from: who(sim, sim.outcome.speaker) } : null,
    score: {
      total: score.total, max: score.max, business: roundHalfUp(score.business), people: roundHalfUp(score.people), leadership: roundHalfUp(score.leadership),
      capability: roundHalfUp(score.capability), live: score.live === null ? null : roundHalfUp(score.live), bonus: score.bonus,
      tier: sim.phase === 'ended' ? { key: score.tier.key, name: score.tier.name } : null
    },
    streak: sim.streak,
    gamification: {
      weights: c.gamification.weights, stars: c.gamification.stars, streak: c.gamification.streak, tiers: c.gamification.tiers,
      leaderboard: { ...c.gamification.leaderboard, enabled: c.gamification.leaderboard.enabled ?? purposeOf(c) !== 'assessment' },
      celebration: c.gamification.celebration
    },
    periods: sim.periods,
    badges: c.gamification.badges.map(b => {
      const got = sim.badges.find(x => x.key === b.key);
      return { key: b.key, rule: b.rule, name: b.name, description: b.description, earned: !!got, period: got?.period ?? null, reason: got?.reason ?? null };
    }),
    sponsor: { name: c.sponsor.name, title: c.sponsor.title, img: c.sponsor.portrait ?? null, styleLine: c.sponsor.styleLine, value: sim.sponsor.value,
      unlockAt: c.gamification.sponsor.unlockAt, checkInBelow: c.gamification.sponsor.checkInBelow, level: sponsorLevel(sim), causes: sim.sponsor.causes },
    pendingReward: sim.pendingReward,
    perks: { bonusDay: sim.bonusPeriod !== null && sim.bonusPeriod >= sim.period, hireBudget: sim.hireBudget, teamActivity: sim.freeTeamActivity, checkIn: sim.checkInPeriod === sim.period },
    history: sim.log,
    /**
     * Each person's result at the start of every period so far, then now (D96): the profile's result trend
     * and the result overview. Only for people whose profile has been opened (D39).
     */
    trends: Object.fromEntries(sim.members.filter(m => m.revealed).map(m => [m.id, [...sim.periodStartResults.slice(0, sim.period).map(r => r[m.id] ?? null), m.result]])),
    /** Progress milestones reached, in order (D93). */
    milestones: sim.milestones,
    /** The guided tour's settings and the demo round on offer (D92, D94). */
    guide: {
      tour: { enabled: c.tour.enabled, steps: c.tour.steps },
      demo: { enabled: c.demo.enabled && !!demoAction, with: c.demo.with ?? c.members[0]?.id ?? null, action: demoAction }
    },
    live: liveView(sim),
    /** The Week 0 practice on offer, and who it is with (D16, D84). */
    practice: { available: practiceAvailable(sim), partner: practicePartner(sim) },
    liveCap: { cap: sim.config.time.liveCap, used: sim.liveTaken[sim.period] ?? 0 },
    /** Business variables the participant is shown (D136): value, the period's start, range and the last causes. */
    variables: c.variables.filter(v => v.shown).map(v => ({ key: v.key, name: v.name, format: v.format, value: sim.vars[v.key] ?? v.start, start: sim.varsAtStart[v.key] ?? v.start, min: v.min, max: v.max, higherIsBetter: v.higherIsBetter, about: v.about ?? null, causes: sim.varCauses[v.key] ?? [] })),
    /** Choices waiting for the participant (D137): what is known and the options, never their consequences. */
    openChoices: sim.openChoices.map(oc => {
      const ev = c.events.find(e => e.key === oc.eventKey)!;
      const f = (t: string) => fill(t, sim, oc.memberId);
      return { id: oc.id, eventKey: ev.key, card: ev.card, title: f(ev.title), body: choiceBody(sim, ev, oc.memberId), memberId: oc.memberId, known: ev.choice!.known.map(f),
        options: ev.choice!.options.map(o => ({ key: o.key, label: f(o.label), detail: o.detail ? f(o.detail) : null })), dueInSubPeriods: Math.max(0, oc.dueAbsSub - sim.absSub) };
    }),
    /** Choices made or defaulted (D137), with what they changed: the decision's "what happened" and the History. */
    choices: sim.choices.map(r => ({ id: r.id, eventKey: r.eventKey, title: r.title, option: r.option, label: r.label, outcome: r.outcome, by: r.by, period: r.period, sub: r.sub,
      changes: r.changes, variables: r.variables.filter(x => c.variables.find(v => v.key === x.key)?.shown).map(x => ({ ...x, name: varName(sim, x.key) })), revenue: Math.round(r.revenue),
      triggered: r.triggered.map(t => ({ key: t.key, title: t.title, period: t.period })) })),
    /** Stakeholders outside the team (D160 to D162): their relationship, what you can do with each now, and what they asked for. */
    stakeholders: c.stakeholders.map(s => {
      const st = sim.stakeholders[s.key];
      const req = sim.stakeholderRequests.find(r => r.stakeholder === s.key && r.state === 'open');
      const msgOf = req ? sim.inbox.find(x => x.id === req.messageId) : undefined;
      return {
        key: s.key, name: s.name, role: s.role, kind: s.kind, pronoun: s.pronoun, img: s.portrait ?? null, about: s.about ?? null,
        trust: st.trust, satisfaction: st.satisfaction, start: { ...st.atStart }, level: relationLevel(st), mood: stakeholderMood(sim, s.key),
        causes: st.moves.slice(-3).reverse().map(m => ({ text: m.cause, trust: m.trust, satisfaction: m.satisfaction })),
        engaged: engagedNow(sim, s.key), concern: st.concernShared ? s.hiddenConcern ?? null : null,
        interactions: offered(sim, s).map(x => ({ key: x.key, type: x.type, label: interactionLabel(x), kind: x.kind, cost: x.cost, goal: x.goal ?? null,
          options: x.options ? x.options.map(o => ({ key: o.key, label: o.label, detail: o.detail ?? null })) : null,
          blocked: sim.phase === 'board' ? stakeholderBlock(sim, s, x) : null })),
        request: req ? { id: req.id, messageId: req.messageId, kind: req.kind, title: msgOf?.title ?? '', interaction: req.interaction, dueInSubPeriods: Math.max(0, req.dueAbsSub - sim.absSub) } : null
      };
    }),
    report: sim.phase === 'ended' ? buildReport(sim) : null
  };
}

/**
 * Two worked examples when the lens has none authored (D91): the "keen to learn" and "capable but
 * cautious" needs, each with the first style that fits it, worded by the client from the need and style.
 */
function defaultExamples(lens: StorylineConfig['lens']) {
  return NEEDS.filter(n => n === 'lowSkill_highMorale' || n === 'highSkill_lowMorale').map(need => {
    const style = bestStyle(lens, need);
    const s = lens.styles.find(x => x.key === style)!;
    return { need, style, person: msg('engine.example.person', { need: lens.needs[need].label, needShort: lens.needs[need].short }), why: msg('engine.example.why', { style: s.name, styleShort: s.short }) };
  });
}

export type EngineView = ReturnType<typeof buildView>;
