import { DEFAULT_SECTIONS, purposeOf, type Purpose } from '../config';
import { moneyFormatter } from '../money';
import { roundHalfUp, capability, leadershipScore, tierFor } from '../sim/score';
import { fitOf, lensView, NEEDS } from '../lens';
import { firstName, person, styleName } from '../sim/sim';
import type { Sim, Style } from '../sim/types';
import { overallOf, rateSkills, shortName, when, type SkillRating } from './ratings';
import { summarizeRun, type RunSummary } from './summary';

/**
 * Report 2.0 and 3.0 (docs/genie/scoring-and-report.md 5 and 7; D75, D76), built by the engine from the
 * run. Every element traces to engine output or authored copy; no text here is written by a model at
 * runtime. Sentences are English server content (D60), filled from templates and the narrative banks.
 */

const unitName = (sim: Sim) => sim.config.time.period.unit;
const Unit = (sim: Sim) => unitName(sim)[0].toUpperCase() + unitName(sim).slice(1);
const nameOf = (sim: Sim, id: string) => (id === 'sponsor' ? sim.config.sponsor.name : person(sim, id)?.name ?? id);

/** Most frequent values; ties listed. */
function dominant<T>(xs: T[]): T[] {
  const counts = new Map<T, number>();
  for (const x of xs) counts.set(x, (counts.get(x) ?? 0) + 1);
  const top = Math.max(0, ...counts.values());
  return top ? [...counts].filter(([, n]) => n === top).map(([x]) => x) : [];
}

/** Fills {placeholders} in authored copy. */
export const fillCopy = (text: string, vars: Record<string, string | number>) => text.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
/** A line from a list keyed by level, read in proportion to the scale (the list may be shorter or longer than the scale). */
export const byLevel = <T>(list: T[], index: number, levels: number): T => list[Math.min(list.length - 1, Math.round((index * (list.length - 1)) / Math.max(1, levels - 1)))];
/** "A, B and C". */
const list = (xs: string[], last: string) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} ${last} ${xs[xs.length - 1]}`);
const names = (xs: string[]) => list(xs, 'and');
const lower = (t: string) => t.charAt(0).toLowerCase() + t.slice(1);
const band3 = (v: number, lo: number, hi: number) => (v < lo ? 'low' as const : v < hi ? 'mid' as const : 'high' as const);

export function buildReport(sim: Sim) {
  const c = sim.config, r = c.report, g = c.gamification;
  const money = moneyFormatter(c.money);
  const unit = unitName(sim);
  const score = leadershipScore(sim);
  const tier = tierFor(sim, score.total);
  const all = [...sim.members, ...sim.departed];
  const purpose = purposeOf(c);
  const P = r.purposeCopy[purpose];

  // ---- 4. Skills profile (5.4)
  const skills: SkillRating[] = rateSkills(sim);
  // The summary, its level and the plan read the primary lens's skills only (D70).
  const scored = skills.filter(s => !s.reportOnly);
  const rated = scored.filter(s => s.level !== null);
  const byScore = [...rated].sort((a, b) => b.rawScore! - a.rawScore! || b.observations - a.observations || a.order - b.order);
  const strengths = byScore.slice(0, 3).map(s => s.key);
  const priorities = [...rated].sort((a, b) => a.rawScore! - b.rawScore! || b.observations - a.observations || a.order - b.order).filter(s => !strengths.includes(s.key)).slice(0, 3).map(s => s.key);
  const overall = overallOf(sim, skills).level;

  // ---- 7. Business outcomes
  const funnel = c.stages.map((st, i) => ({ stage: st.key, name: st.name, cumulative: sim.funnel.stageOut[i], cumulativeIdeal: sim.periods.reduce((a, p) => a + (p.funnel[i]?.ideal ?? 0), 0) }));
  const counts = new Map<string, number>();
  for (const p of sim.periods) if (p.bottleneck) counts.set(p.bottleneck, (counts.get(p.bottleneck) ?? 0) + 1);
  const worst = [...counts].sort((a, b) => b[1] - a[1])[0];
  const bottleneck = worst ? (() => {
    const owners = sim.members.filter(m => m.stage === worst[0]);
    const low = [...owners].sort((a, b) => a.result - b.result)[0];
    const stat = low ? (['skill', 'morale', 'result'] as const).reduce((k, x) => (low[x] < low[k] ? x : k), 'skill' as 'skill' | 'morale' | 'result') : null;
    return { stage: worst[0], name: c.stages.find(s => s.key === worst[0])?.name ?? worst[0], periods: worst[1],
      why: low && stat ? `${firstName(sim, low.id)} owns the stage with the lowest result there; ${stat} is ${low[stat]}, the weakest of ${pr(sim, low.id)} numbers.` : null };
  })() : null;
  const share = sim.funnel.value / c.money.target;
  const businessLine = `You reached ${Math.round(share * 100)}% of the ${money.format(c.money.target)} target with ${Math.floor(sim.funnel.conversions)} deals${bottleneck ? `; ${bottleneck.name} was the bottleneck in ${bottleneck.periods} of ${sim.periods.length} ${unit}s` : ''}.`;

  // ---- 2. Style flexibility and fit (3): the lens's styles (D70); grid rows are the four needs, columns the styles.
  const styles: Style[] = c.lens.styles.map(s => s.key);
  const choices = sim.decisions.run;
  const shares = Object.fromEntries(styles.map(s => [s, choices.filter(d => d.chosen === s).length])) as Record<Style, number>;
  const dom = dominant(choices.map(d => d.chosen));
  const cap = capability(sim);
  const grid = NEEDS.map(need => styles.map(used => choices.filter(d => d.need === need && d.chosen === used).length));
  // The lens's fit table in the grid's shape: sent with the report, once the run has ended.
  const fitGrid = NEEDS.map(need => styles.map(used => c.lens.fit[need][used] ?? 2));
  const capBand = band3(cap, 40, 70);
  // Development keeps the authored capability lines; assessment words the finding neutrally (D75).
  const capNarrative = purpose === 'assessment' ? fillCopy(P.adaptability[capBand], { pct: roundHalfUp(cap) }) : r.narratives.capability[capBand];
  const weekly = choices.filter(d => d.source === 'weeklyStyle');
  const weeks = all.map(m => ({
    memberId: m.id, name: nameOf(sim, m.id), left: sim.departed.includes(m),
    cells: sim.periods.map(p => {
      const d = weekly.find(x => x.memberId === m.id && x.period === p.period);
      return d ? { period: p.period, chosen: d.chosen, fit: d.mismatch } : null;
    })
  })).filter(w => w.cells.some(Boolean));
  const matched = weekly.filter(d => d.mismatch === 0).length;

  // ---- 3. Intent vs action
  const intent = all.map(m => {
    const mine = weekly.filter(d => d.memberId === m.id).map(d => d.chosen);
    const shownChoices = choices.filter(d => d.memberId === m.id && d.source !== 'weeklyStyle').map(d => d.chosen);
    const intentStyles = dominant(mine), shown = dominant(shownChoices);
    const status = !shown.length ? 'noEvidence' : shown.some(s => intentStyles.includes(s)) ? 'aligned' : 'gap';
    const gapRec = status === 'gap' ? [...sim.liveRecords].reverse().find(rec => rec.memberIds.length === 1 && rec.memberIds[0] === m.id && rec.styleShown && !intentStyles.includes(rec.styleShown)) : undefined;
    const note = [...sim.styleNotes].reverse().find(n => n.memberId === m.id);
    return {
      memberId: m.id, name: nameOf(sim, m.id), intent: intentStyles, shown, status: status as 'aligned' | 'gap' | 'noEvidence',
      quote: gapRec?.quotes?.[0] ? { text: gapRec.quotes[0], when: when(sim, gapRec) } : null,
      note: note ? { text: note.text, period: note.period } : null,
      // Trust lost to repeated gaps: the logged "Mixed signals" changes for this person.
      trustCost: sim.log.flatMap(l => l.changes).filter(ch => ch.subject === m.id && ch.metric === 'trust' && ch.reason.label === 'Mixed signals').reduce((a, ch) => a + ch.delta, 0)
    };
  }).filter(x => x.intent.length);

  // ---- 5. Key moments (SBI), 5 to 7, ranked by impact
  const intentFor = (memberId: string | undefined, period: number) => (memberId ? weekly.find(d => d.memberId === memberId && d.period === period)?.chosen ?? null : null);
  const change = (ch: { subject: string; metric: string; delta: number }) => `${ch.subject === 'team' ? 'The team' : shortName(sim, ch.subject)} ${ch.metric} ${ch.delta > 0 ? '+' : '−'}${Math.abs(ch.delta)}`;
  const fromLive = sim.liveRecords.filter(rec => rec.band !== 'adequate').map(rec => ({
    id: rec.id ?? `${rec.period}`, kind: rec.band === 'strong' ? 'best' as const : 'revisit' as const, period: rec.period, memberId: rec.memberIds.length === 1 ? rec.memberIds[0] : null,
    title: `${rec.title ?? rec.actionKey}${rec.memberIds.length === 1 ? ` with ${shortName(sim, rec.memberIds[0])}` : ''} ${rec.band === 'strong' ? 'went well' : rec.band === 'weak' ? 'did not land' : 'went badly'}`,
    situation: `${Unit(sim)} ${rec.period}. ${rec.memberIds.length === 1 ? `${shortName(sim, rec.memberIds[0])} needed a conversation.` : rec.actionKey === 'sponsor' ? `${shortName(sim, 'sponsor')} wanted an update.` : 'The team needed you.'}`,
    behaviour: `You chose ${rec.title ?? rec.actionKey}${rec.styleShown ? ` and came across as ${styleName(sim, rec.styleShown)}` : ''}.`,
    quote: rec.quotes?.[0] ?? null,
    impact: rec.changes?.length ? rec.changes.slice(0, 3).map(change).join(', ') + '.' : 'No visible change.',
    intent: intentFor(rec.memberIds[0], rec.period), weight: rec.impact ?? 0, sub: rec.sub ?? 0
  }));
  const fromLog = sim.log.filter(l => /escalated|Promise (kept|broken)|went unanswered/.test(l.title) || l.changes.some(ch => ch.reason.label === 'Promise kept' || ch.reason.label === 'Promise broken')).map(l => {
    const good = /kept/i.test(l.title) || l.changes.some(ch => ch.reason.label === 'Promise kept');
    const who = l.memberIds[0];
    return {
      id: l.id, kind: good ? 'best' as const : 'revisit' as const, period: l.period, memberId: who ?? null,
      title: who ? `${l.title}: ${shortName(sim, who)}` : l.title,
      situation: `${Unit(sim)} ${l.period}. ${l.changes[0]?.reason.cause ?? l.title}`,
      behaviour: good ? 'You did what you said you would.' : 'It waited too long for an answer.',
      quote: null, impact: l.changes.length ? l.changes.slice(0, 3).map(ch => change({ subject: ch.subject === 'sponsor' ? 'sponsor' : ch.subject, metric: ch.metric === 'confidence' ? 'confidence' : ch.metric, delta: ch.delta })).join(', ') + '.' : 'No visible change.',
      intent: intentFor(who, l.period), weight: l.changes.reduce((a, ch) => a + Math.abs(ch.delta), 0), sub: l.sub
    };
  });
  // One moment per title (the same thing three times teaches nothing), the weightiest kept.
  const moments = [...fromLive, ...fromLog].sort((a, b) => b.weight - a.weight || a.period - b.period || a.sub - b.sub)
    .filter((m, i, arr) => arr.findIndex(x => x.title === m.title) === i).slice(0, 7)
    .sort((a, b) => a.period - b.period || a.sub - b.sub).map(({ weight: _w, sub: _s, ...m }) => m);

  // ---- 6. People outcomes
  const people = all.map(m => {
    const p = person(sim, m.id);
    const start = { morale: p.start.morale, trust: p.start.trust ?? c.trustRules.start, result: p.start.result };
    return { memberId: m.id, name: p.name, img: p.portrait ?? null, left: sim.departed.includes(m), start,
      series: m.periodEnds.map((e, i) => ({ period: i + 1 + (sim.periods.length - m.periodEnds.length), ...e })),
      actions: sim.attention[m.id]?.actions ?? 0, days: roundHalfUp((sim.attention[m.id]?.days ?? 0) * 10) / 10, resultChange: m.result - start.result };
  });

  // ---- 8. Conversation analytics: descriptive only, never scored
  const spoken = sim.liveRecords.filter(rec => ['roleplay', 'meeting', 'sponsor', 'interview'].includes(rec.format) && rec.talk);
  const youWords = spoken.reduce((a, rec) => a + rec.talk!.you, 0), npcWords = spoken.reduce((a, rec) => a + rec.talk!.npc, 0);
  const analytics = {
    conversations: sim.liveRecords.length,
    talkRatio: npcWords ? Math.round((youWords / npcWords) * 100) / 100 : null,
    openQuestions: sim.liveRecords.reduce((a, rec) => a + (rec.talk?.openQuestions ?? 0), 0),
    recognition: sim.liveRecords.reduce((a, rec) => a + (rec.talk?.recognition ?? 0), 0),
    spoken: sim.liveRecords.filter(rec => rec.talk?.spoken).length
  };

  // ---- 9. Development plan: the 3 lowest rated skills, then skills without enough evidence
  const lowest = [...rated].sort((a, b) => a.rawScore! - b.rawScore! || a.order - b.order);
  const unrated = scored.filter(s => s.level === null);
  const plan = [...lowest, ...unrated].slice(0, 3).map(s => ({ skill: s.key, name: s.name, enoughEvidence: s.level !== null, ...(r.development[s.key] ?? { practice: '', onTheJob: '' }) }));

  // ---- Team over the run (small multiples) and results
  const kpis = (['skill', 'morale', 'result', 'trust'] as const).map(k => ({ metric: k, start: sim.periods[0]?.kpis[k].start ?? 0, end: sim.periods.at(-1)?.kpis[k].end ?? 0, series: sim.periods.map(p => p.kpis[k].end) }));
  const revenue = sim.periods.map(p => ({ period: p.period, value: p.cumulativeValue, pace: (c.money.target * p.period) / c.time.period.count }));

  const dom1 = dom.length === 1 ? dom[0] : null;
  const domLine = purpose === 'development' && dom1 ? r.narratives.dominant[dom1] : undefined;
  // Methodology names the lens in participant language; the source ("based on") is author only (D70).
  const lensLines = [`This simulation looks at leadership through the ${c.lens.title} lens.`,
    ...(c.lens.secondary ? [`Your report also looks at ${c.lens.secondary.title}. Those skills are marked Report only: they never change your score.`] : [])];
  const v3 = report3(sim, purpose, skills, plan.map(p => p.name));
  return {
    available: sim.phase === 'ended',
    purpose,
    storyline: { name: c.name, organisation: c.organisation ?? null },
    lens: { ...lensView(c.lens), secondary: c.lens.secondary ? { id: c.lens.secondary.id, title: c.lens.secondary.title } : null },
    periods: sim.periods.length, periodUnit: unit,
    sections: r.sections ?? DEFAULT_SECTIONS[purpose],
    score: { total: score.total, max: score.max, tier: { key: tier.key, name: tier.name } },
    results: { revenue: Math.round(sim.funnel.value), target: c.money.target, share, conversions: Math.floor(sim.funnel.conversions), kpis },
    summary: {
      level: overall === null ? null : { index: overall, name: r.scale[overall].name },
      strengths, priorities, business: businessLine,
      narrative: overall === null ? null : P.overall ? byLevel(P.overall, overall, r.scale.length) : r.narratives.overall[Math.min(overall, r.narratives.overall.length - 1)] ?? null
    },
    style: { shares, total: choices.length, dominant: dom, capability: roundHalfUp(cap), grid, fit: fitGrid, matched, weeklyTotal: weekly.length, weeks,
      narrative: [capNarrative, ...(domLine ? [domLine] : [])] },
    intent,
    skills: skills.map(({ rawScore: _r, order: _o, recordIds: _ids, review: _rv, ...s }) => ({ ...s, ...v3.skillNotes[s.key] })),
    scale: r.scale,
    moments,
    people,
    business: { revenue, funnel, bottleneck, conversions: Math.floor(sim.funnel.conversions) },
    analytics,
    plan, checkInDays: r.checkInDays,
    reflection: sim.reflection, questions: r.reflection,
    methodology: { lines: [...lensLines, ...r.methodology], reviewed: sim.liveRecords.some(rec => rec.reviewed), reviewedCount: sim.liveRecords.filter(rec => rec.reviewed).length, conversations: sim.liveRecords.length, observations: sim.liveRecords.reduce((a, rec) => a + (rec.skills?.length ?? 0), 0) },
    badges: sim.badges.length, gamificationTiers: g.tiers.map(t => ({ key: t.key, name: t.name, min: t.min })),
    ...v3.sections
  };
}

/**
 * Report 3.0's sections (D75): the run summary's numbers with the narratives the purpose's bank gives
 * them, the assessment verdicts with their evidence, food for thought, takeaways and the plan's path.
 */
function report3(sim: Sim, purpose: Purpose, skills: SkillRating[], planSkills: string[]) {
  const c = sim.config, r = c.report, P = r.purposeCopy[purpose];
  const run: RunSummary = summarizeRun(sim);
  const levels = r.scale.length;
  const bar = r.assessment.bar;
  const barWords = `an overall level of ${r.scale[bar.overall].name}, with no skill below ${r.scale[bar.floor].name}`;
  const styleLabel = (k: string) => styleName(sim, k);
  const needsFor = (k: string) => {
    const fits = NEEDS.filter(n => fitOf(c.lens, k, n) === 0);
    return (fits.length ? fits : NEEDS.filter(n => fitOf(c.lens, k, n) === 1)).map(n => lower(c.lens.needs[n].label));
  };

  // Skills: the score out of 10, the skill's description and its narrative.
  const skillNotes = Object.fromEntries(skills.map(s => [s.key, {
    outOf10: s.score === null ? null : s.score / 10,
    description: r.skills.find(x => x.key === s.key)?.description ?? null,
    narrative: fillCopy(s.level === null ? P.skillNone : byLevel(P.skill, s.level.index, levels), { skill: s.name })
  }]));

  // Verdicts (assessment only), each with the conversations it rests on and their review status.
  const review = (ids: string[]) => {
    const recs = sim.liveRecords.filter(x => x.id && ids.includes(x.id));
    const reviewed = recs.filter(x => x.reviewed).length;
    return { review: recs.length && reviewed === recs.length ? 'assessor' as const : reviewed ? 'mixed' as const : 'ai' as const, reviewed, total: recs.length };
  };
  const verdict = run.verdict ? (() => {
    const primary = skills.filter(s => !s.reportOnly && s.level !== null);
    const ids = [...new Set(primary.flatMap(s => s.recordIds))];
    // The words behind the verdict: the best and the weakest rated skills' first quotes.
    const sorted = [...primary].sort((a, b) => b.rawScore! - a.rawScore! || a.order - b.order);
    const quotes = [sorted[0], sorted.at(-1), sorted[1]].filter((s): s is SkillRating => !!s).flatMap(s => s.quotes.slice(0, 1))
      .filter((q, i, arr) => arr.findIndex(x => x.text === q.text) === i).slice(0, 3);
    const key = run.verdict.overall;
    return {
      overall: { key, label: key ? r.assessment.labels[key] : r.assessment.labels.insufficient, bar: barWords, recordIds: ids, quotes, ...review(ids) },
      skills: skills.filter(s => !s.reportOnly).map(s => {
        const k = run.verdict!.skills[s.key] ?? null;
        return { key: s.key, verdict: k, label: k ? r.assessment.skillLabels[k] : null, recordIds: s.recordIds, quotes: s.quotes, ...review(s.recordIds) };
      })
    };
  })() : null;

  // Objectives and adaptability.
  const share = run.objectives.share;
  const objectives = { narrative: fillCopy(P.objectives[share < 60 ? 'below' : share < 100 ? 'near' : 'met'], { share: `${roundHalfUp(share)}%` }) };
  const adaptability = { narrative: fillCopy(P.adaptability[band3(run.styles.adaptability, 40, 70)], { pct: roundHalfUp(run.styles.adaptability) }) };

  // Styles summary: a narrative per style, the preferred style.
  const styleSummary = {
    perStyle: run.styles.perStyle.map(s => {
      const vars = { style: styleLabel(s.key), needs: list(needsFor(s.key), 'or') };
      if (!s.count) return { key: s.key, narrative: [fillCopy(P.style.unused, vars)] };
      const lines = [fillCopy(P.style[band3(s.accuracy ?? 0, 40, 70)], vars)];
      if (s.proportion < s.neededShare - 10) lines.push(fillCopy(P.style.under, vars));
      else if (s.proportion > s.neededShare + 10) lines.push(fillCopy(P.style.over, vars));
      return { key: s.key, narrative: lines };
    }),
    preferred: run.styles.preferred.length ? fillCopy(P.preferred, {
      styles: names(run.styles.preferred.map(styleLabel)),
      pct: roundHalfUp(run.styles.perStyle.find(s => s.key === run.styles.preferred[0])?.proportion ?? 0)
    }) : null
  };

  // Consistency: a narrative per deviation.
  const dev = run.consistency.deviations;
  const line = (k: keyof typeof dev) => (dev[k] === null ? null : P.consistency[k][band3(dev[k]!, 25, 50)]);
  const consistency = { narrative: { neededUsed: line('neededUsed'), intendedUsed: line('intendedUsed'), neededIntended: line('neededIntended') } };

  // Summary of actions: what each is for, and a narrative by its impact.
  const actionSummary = run.actions.map(a => {
    const action = c.actions.find(x => x.key === a.key)!;
    return { key: a.key, name: action.name, description: r.actionCopy[a.key] ?? null, narrative: fillCopy(P.actions[a.frequency ? a.impact : 'unused'], { action: action.name }) };
  });

  // The plan: development gets the 30, 60 and 90 day path and the check ins; assessment lists development needs neutrally.
  const path = purpose === 'development' && planSkills.length ? {
    day30: fillCopy(r.path.day30, { skills: names(planSkills.map(lower)) }), day60: fillCopy(r.path.day60, { skills: names(planSkills.map(lower)) }), day90: fillCopy(r.path.day90, { skills: names(planSkills.map(lower)) })
  } : null;
  const checkIns = purpose === 'development' ? [...new Set([r.checkInDays, 30, 60, 90])].filter(d => d >= r.checkInDays).sort((a, b) => a - b) : [];
  const needs = verdict ? skills.filter(s => !s.reportOnly && run.verdict!.skills[s.key] === 'development').map(s => ({
    key: s.key, name: s.name, level: s.level?.name ?? null, bar: r.scale[bar.overall].name, anchor: r.skills.find(x => x.key === s.key)?.anchors[bar.overall] ?? null
  })) : [];

  const unit = c.time.period.unit;
  return {
    skillNotes,
    sections: {
      run,
      about: { lines: P.about.map(l => fillCopy(l, { unit, bar: barWords })), howToRead: P.howToRead.map(l => fillCopy(l, { unit, bar: barWords })), confidentiality: P.confidentiality },
      verdict,
      objectives, adaptability, styleSummary, consistency, actionSummary,
      thought: r.thought, takeaways: r.takeaways,
      path, checkIns, needs
    }
  };
}

const pr = (sim: Sim, id: string) => { const p = person(sim, id).pronoun; return p === 'she' ? 'her' : p === 'they' ? 'their' : 'his'; };
export type ReportView = ReturnType<typeof buildReport>;
