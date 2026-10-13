import type { Purpose } from '../config';
import { hasCode, isMsg, listOf, msg, type Copy, type Msg, type Param } from '../copy';
import { firstName, styleName } from '../sim/sim';
import type { Change, Sim } from '../sim/types';
import { classify, contradicts, gatherEvidence, guard, MISSED, strengths, type Claim, type Evidence, type Profile, type Tone } from './evidence';
import type { RunSummary } from './summary';

/**
 * The report's narrative from the evidence (D143, D145): the headline and summary by the run's profile,
 * every claim checked by the contradiction guard; "What drove your results", the decisions and patterns
 * that moved the outcomes most, with their numbers; and food for thought and takeaways that name what
 * happened in this run. Deterministic: the same run words the same. Every sentence is a catalog code.
 */

type Metric = 'skill' | 'morale' | 'result' | 'trust';
const METRICS: Metric[] = ['result', 'morale', 'skill', 'trust'];
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const round = (n: number) => Math.round(n);
const nameOf = (sim: Sim, id: string) => (id === 'sponsor' ? sim.config.sponsor.name.split(' ')[0] : firstName(sim, id));
const actionName = (sim: Sim, key: string) => sim.config.actions.find(a => a.key === key)?.name ?? key;
/** "week 2", "weeks 2 and 4", in the participant's language. */
const periodsOf = (sim: Sim, periods: number[]): Msg => msg('engine.report.periods', { unit: sim.config.time.period.unit, count: periods.length, list: listOf(periods, 'and') });
const changesOf = (sim: Sim, label: string) => sim.log.flatMap(l => l.changes).filter(ch => hasCode(ch.reason.label, label));
const total = (chs: Change[], metric: Change['metric']) => sum(chs.filter(ch => ch.metric === metric).map(ch => ch.delta));

// ---------------------------------------------------------------- headline and summary

export interface Narrative {
  profile: Profile;
  headline: Copy;
  lines: Copy[];
  /** The authored line for the overall level, when the data does not contradict it. */
  levelLine: Copy | null;
}

/**
 * The headline and summary (D143). Lines are factual sentences with the run's numbers, chosen for the
 * profile; the authored level line is praise of the whole run when it sits in the upper half of the
 * scale, so it is shown then only if no core dimension (conversations, style fit, people, business) is weak.
 */
export function narrate(sim: Sim, purpose: Purpose, e: Evidence, levelIndex: number | null, levelLine: Copy | null): Narrative {
  const t = sim.config.report.evidence;
  const profile = classify(e, t);
  const s = strengths(e, t);
  const unit = sim.config.time.period.unit;
  const headline = msg('engine.report.headline', { purpose, profile, met: e.share >= 100 ? 'yes' : 'no' });

  const claims: Array<Claim<Copy>> = [];
  // People: every average that moved, largest first, then who left.
  const moves = METRICS.map(m => ({ m, d: round(e.change[m]) })).filter(x => x.d !== 0).sort((a, b) => Math.abs(b.d) - Math.abs(a.d) || METRICS.indexOf(a.m) - METRICS.indexOf(b.m));
  claims.push({ dimension: 'people', tone: 'neutral', text: moves.length
    ? msg('engine.report.people', { purpose, moves: listOf(moves.map(x => msg('engine.report.move', { metric: x.m, delta: x.d })), 'and') })
    : msg('engine.report.peopleFlat', { purpose }) });
  const left = sim.departed.map(m => nameOf(sim, m.id));
  if (left.length) claims.push({ dimension: 'people', tone: 'neutral', text: msg('engine.report.left', { names: listOf(left, 'and'), count: left.length }) });
  // Style fit, and one style used for most choices.
  if (e.styleFit !== null) claims.push({ dimension: 'styleFit', tone: 'neutral', text: msg('engine.report.fit', { purpose, pct: round(e.styleFit) }) });
  const choices = sim.decisions.run;
  const counts = sim.config.lens.styles.map(st => ({ key: st.key, n: choices.filter(d => d.chosen === st.key).length })).sort((a, b) => b.n - a.n);
  if (choices.length && counts[0].n / choices.length >= 0.6 && s.styleFit !== 'strong') {
    claims.push({ dimension: 'styleFit', tone: 'negative', text: msg('engine.report.oneStyle', { purpose, style: styleName(sim, counts[0].key), n: counts[0].n, total: choices.length }) });
  }
  // Conversations, when the profile turns on them or there were enough to read.
  if (e.words !== null) claims.push({ dimension: 'words', tone: 'neutral', text: msg('engine.report.words', { purpose, landed: e.landed, total: e.conversations }) });
  // Activity: always for the profiles about acting; otherwise only when it was low.
  if (profile === 'readNoAction' || profile === 'absent' || s.activity === 'weak') {
    claims.push({ dimension: 'activity', tone: 'negative', text: msg('engine.report.activity', { purpose, n: e.actions, periods: e.periods, unit }) });
  }
  if (e.missed > 0) claims.push({ dimension: 'events', tone: 'negative', text: msg('engine.report.missed', { purpose, n: e.missed }) });
  const sponsorMove = round(e.sponsor.end - e.sponsor.start);
  if (s.sponsor !== 'ok') claims.push({ dimension: 'sponsor', tone: 'neutral', text: msg('engine.report.sponsor', { purpose, name: nameOf(sim, 'sponsor'), from: round(e.sponsor.start), to: round(e.sponsor.end), dir: sponsorMove > 0 ? 'up' : 'down' }) });

  const kept = guard(claims, e, t).slice(0, 5).map(c => c.text);
  // Development reports close the summary with the next step; assessment states the findings only (D75).
  const lines = purpose === 'development' ? [...kept, msg('engine.report.next', { profile })] : kept;

  const levels = sim.config.report.scale.length;
  const praises = levelIndex !== null && levelIndex >= Math.floor(levels / 2);
  const core = (['words', 'styleFit', 'people', 'business'] as const).map(dimension => ({ dimension, tone: 'positive' as Tone }));
  const allowed = !praises || core.every(c => !contradicts(c, e, t) || strengths(e, t)[c.dimension] === null);
  return { profile, headline, lines, levelLine: allowed ? levelLine : null };
}

// ---------------------------------------------------------------- what drove the results

export interface DriverItem { key: string; tone: 'positive' | 'negative'; text: Copy }
interface Candidate extends DriverItem { weight: number }

/** The bottleneck as the report found it, with the owner's weakest number. */
export interface BottleneckFact { name: string; periods: number; owner: { id: string; stat: 'skill' | 'morale' | 'result'; value: number } | null }

/**
 * "What drove your results" (D145): the 3 to 5 decisions and patterns that moved people and the business
 * most, each with its numbers. Read from the run's history: action records (what each action did to
 * each person), the log (weekly styles, drift, unanswered messages, escalations, departures) and the
 * funnel. Ranked by the size of what they moved; ties by key, so the same run always tells the same story.
 */
export function drivers(sim: Sim, purpose: Purpose, bottleneck: BottleneckFact | null): DriverItem[] {
  const out: Candidate[] = [];
  const unit = sim.config.time.period.unit;
  const push = (key: string, weight: number, tone: Candidate['tone'], text: Copy) => { if (weight > 0) out.push({ key, weight, tone, text }); };

  // One action with one person over the run: the net change it made to them.
  const pairs = new Map<string, { action: string; id: string; periods: Set<number>; net: [number, number, number] }>();
  for (const rec of sim.actionRecords.filter(r => r.scope === 'member')) {
    for (const id of rec.reached) {
      const k = `${rec.actionKey}:${id}`;
      const p = pairs.get(k) ?? { action: rec.actionKey, id, periods: new Set<number>(), net: [0, 0, 0] as [number, number, number] };
      p.periods.add(rec.period);
      const fx = rec.effects[id];
      if (fx) fx.forEach((v, i) => { p.net[i] += v; });
      pairs.set(k, p);
    }
  }
  const people = [...pairs.entries()].map(([k, p]) => {
    const moves = (['result', 'morale', 'skill'] as const).map((m, i) => ({ m, d: p.net[[2, 1, 0][i]] })).filter(x => x.d !== 0).sort((a, b) => Math.abs(b.d) - Math.abs(a.d));
    return { k, p, moves, weight: sum(moves.map(x => Math.abs(x.d))) };
  }).filter(x => x.moves.length).sort((a, b) => b.weight - a.weight || a.k.localeCompare(b.k)).slice(0, 3);
  for (const { k, p, moves, weight } of people) {
    const [main, ...rest] = moves;
    push(`person:${k}`, weight, sum(moves.map(x => x.d)) >= 0 ? 'positive' : 'negative', msg('engine.report.driver.person', {
      action: actionName(sim, p.action), name: nameOf(sim, p.id), when: periodsOf(sim, [...p.periods].sort((a, b) => a - b)),
      metric: main.m, dir: main.d > 0 ? 'up' : 'down', n: Math.abs(main.d),
      more: rest.length ? listOf(rest.map(x => msg('engine.report.move', { metric: x.m, delta: x.d })), 'and') : '', hasMore: rest.length ? 'yes' : 'no'
    }));
  }

  // Team actions: what each did across everyone it reached.
  for (const key of [...new Set(sim.actionRecords.filter(r => r.scope === 'team').map(r => r.actionKey))].sort()) {
    const recs = sim.actionRecords.filter(r => r.scope === 'team' && r.actionKey === key);
    const net = [0, 1, 2].map(i => sum(recs.flatMap(r => Object.values(r.effects).map(fx => fx[i]))));
    const moves = (['result', 'morale', 'skill'] as const).map((m, i) => ({ m, d: net[[2, 1, 0][i]] })).filter(x => x.d !== 0).sort((a, b) => Math.abs(b.d) - Math.abs(a.d));
    if (!moves.length) continue;
    push(`team:${key}`, sum(moves.map(x => Math.abs(x.d))) / 2, sum(moves.map(x => x.d)) >= 0 ? 'positive' : 'negative', msg('engine.report.driver.team', {
      action: actionName(sim, key), when: periodsOf(sim, [...new Set(recs.map(r => r.period))].sort((a, b) => a - b)), moves: listOf(moves.map(x => msg('engine.report.move', { metric: x.m, delta: x.d })), 'and')
    }));
  }

  // Weekly style choices: what the fits added and the misses cost.
  const people3 = (chs: Change[]) => sum(chs.filter(ch => ch.metric !== 'trust' && ch.metric !== 'confidence').map(ch => ch.delta));
  const weekly = sim.decisions.run.filter(d => d.source === 'weeklyStyle');
  const fits = people3(changesOf(sim, 'engine.style.fits')), misses = people3(changesOf(sim, 'engine.style.missed'));
  const nFit = weekly.filter(d => d.mismatch === 0).length;
  if (nFit && fits) push('style:fit', Math.abs(fits) / 2, fits > 0 ? 'positive' : 'negative', msg('engine.report.driver.styleFit', { purpose, n: nFit, total: weekly.length, delta: fits }));
  if (weekly.length - nFit && misses) push('style:miss', Math.abs(misses) / 2, misses > 0 ? 'positive' : 'negative', msg('engine.report.driver.styleMiss', { purpose, n: weekly.length - nFit, total: weekly.length, delta: misses }));

  // Nobody's attention for a whole period.
  const drift = changesOf(sim, 'engine.drift.label');
  const driftMorale = total(drift, 'morale'), driftResult = total(drift, 'result');
  const driftTimes = new Set(sim.log.filter(l => l.changes.some(ch => hasCode(ch.reason.label, 'engine.drift.label'))).flatMap(l => l.changes.filter(ch => hasCode(ch.reason.label, 'engine.drift.label')).map(ch => `${l.period}:${ch.subject}`))).size;
  if (driftTimes) push('drift', Math.abs(driftMorale) + Math.abs(driftResult), 'negative', msg('engine.report.driver.drift', { purpose, n: driftTimes, unit, morale: driftMorale, result: driftResult }));

  // Unanswered messages (trust) and escalations to the sponsor (confidence).
  const noReply = changesOf(sim, 'engine.noReply.label');
  if (noReply.length) push('unanswered', Math.abs(total(noReply, 'trust')), 'negative', msg('engine.report.driver.unanswered', { purpose, n: noReply.length, delta: total(noReply, 'trust') }));
  const escalated = sim.log.filter(l => MISSED.slice(1).some(code => hasCode(l.title, code)));
  const confidence = sum(escalated.flatMap(l => l.changes.filter(ch => ch.metric === 'confidence').map(ch => ch.delta)));
  if (escalated.length && confidence) push('escalated', Math.abs(confidence), 'negative', msg('engine.report.driver.escalated', { n: escalated.length, name: nameOf(sim, 'sponsor'), delta: confidence }));

  // Saying one style and showing another.
  const mixed = changesOf(sim, 'engine.mixed.label');
  if (mixed.length) push('mixed', Math.abs(total(mixed, 'trust')), 'negative', msg('engine.report.driver.mixed', { purpose, n: mixed.length, delta: total(mixed, 'trust') }));

  // People who resigned.
  for (const l of sim.log.filter(x => isMsg(x.title) && x.title.code === 'engine.trigger.label' && x.title.params?.kind === 'resignation')) {
    const id = l.memberIds[0];
    if (id) push(`resigned:${id}`, 30, 'negative', msg('engine.report.driver.resigned', { name: nameOf(sim, id), unit, n: l.period }));
  }

  // Choice events (D137, D152): what each decision, or a default, did to people, the shown business variables and
  // revenue. Weighed like the rest: people points, a variable's move in points of its range, revenue in points of a
  // period's target; the tone is the net of those, with a variable counted for or against as more is better or not.
  const shown = new Map(sim.config.variables.filter(v => v.shown).map(v => [v.key, v]));
  const perPeriod = sim.config.money.target / Math.max(1, sim.config.time.period.count);
  for (const ch of sim.choices) {
    if (!ch.option) continue;
    const people = METRICS.map(m => ({ m, d: total(ch.changes.filter(x => x.subject !== 'sponsor'), m) })).filter(x => x.d !== 0);
    const vars = ch.variables.filter(x => x.delta !== 0 && shown.has(x.key)).map(x => ({ v: shown.get(x.key)!, d: x.delta }));
    const share = (v: { min: number; max: number }, d: number) => (100 * d) / Math.max(1, v.max - v.min);
    const revenue = (100 * ch.revenue) / Math.max(1, perPeriod);
    const weight = sum(people.map(x => Math.abs(x.d))) + sum(vars.map(x => Math.abs(share(x.v, x.d)))) + Math.abs(revenue);
    const net = sum(people.map(x => x.d)) + sum(vars.map(x => share(x.v, x.d) * (x.v.higherIsBetter ? 1 : -1))) + revenue;
    const moves = [
      ...people.map(x => msg('engine.report.move', { metric: x.m, delta: x.d })),
      ...vars.map(x => msg('engine.report.varMove', { name: x.v.name, delta: Math.round(x.d) })),
      ...(Math.round(ch.revenue) ? [msg('engine.report.varMove', { name: msg('engine.report.revenue'), delta: Math.round(ch.revenue) })] : [])
    ];
    if (!moves.length) continue;
    push(`choice:${ch.id}`, weight, net >= 0 ? 'positive' : 'negative', msg('engine.report.driver.choice', {
      purpose, by: ch.by, option: ch.label ?? ch.option, title: ch.title, unit, n: ch.period, moves: listOf(moves, 'and')
    }));
  }

  // The shown business variables over the whole run, when one moved by 5 points of its range or more.
  for (const v of shown.values()) {
    const end = sim.vars[v.key] ?? v.start, d = end - v.start;
    const moved = (100 * Math.abs(d)) / Math.max(1, v.max - v.min);
    if (moved < 5) continue;
    push(`variable:${v.key}`, moved, d * (v.higherIsBetter ? 1 : -1) >= 0 ? 'positive' : 'negative', msg('engine.report.driver.variable', {
      name: v.name, format: v.format, from: Math.round(v.start), to: Math.round(end), currency: sim.config.money.currency
    }));
  }

  // The stage that held the funnel back, and the weakest number of the person who owns it.
  if (bottleneck && bottleneck.periods >= 2) {
    const o = bottleneck.owner;
    push('bottleneck', (40 * bottleneck.periods) / Math.max(1, sim.periods.length), 'negative', msg('engine.report.driver.bottleneck', {
      stage: bottleneck.name, periods: bottleneck.periods, total: sim.periods.length, unit,
      owner: o ? 'yes' : 'no', name: o ? nameOf(sim, o.id) : '', stat: o?.stat ?? 'result', value: o?.value ?? 0
    }));
  }

  const ranked = out.sort((a, b) => b.weight - a.weight || a.key.localeCompare(b.key));
  // 3 to 5: everything that moved at least 5, at least the top 3.
  const big = ranked.filter(c => c.weight >= 5);
  return (big.length >= 3 ? big : ranked).slice(0, 5).map(({ weight: _w, ...d }) => d);
}

// ---------------------------------------------------------------- food for thought and takeaways

type Item = { question: Copy; guide: Copy };

/**
 * Food for thought and takeaways for this run (D145): questions that name a person, a week or an event
 * from the run, in the order the profile makes most useful, then the authored questions to fill up.
 */
export function reflections(sim: Sim, e: Evidence, profile: Profile, authored: { thought: Item[]; takeaways: Copy[] }) {
  const unit = sim.config.time.period.unit;
  const all = [...sim.members, ...sim.departed];
  const start = (id: string) => sim.config.members.find(p => p.id === id)?.start ?? sim.config.candidates.find(p => p.id === id)?.start;
  const q = (key: string, params: Record<string, Param>): Item => ({ question: msg(`engine.report.thought.${key}`, params), guide: msg(`engine.report.guide.${key}`, params) });
  const found: Record<string, Item | null> = {};

  // The person who got the least of the participant's one to one time.
  const oneToOne = (id: string) => sim.actionRecords.filter(r => r.scope === 'member' && r.reached.includes(id)).length;
  const totalOne = sim.actionRecords.filter(r => r.scope === 'member').length;
  const least = [...sim.members].sort((a, b) => oneToOne(a.id) - oneToOne(b.id) || a.id.localeCompare(b.id))[0];
  found.neglected = least && totalOne >= 2 ? q('neglected', { name: nameOf(sim, least.id), n: oneToOne(least.id), total: totalOne }) : null;

  // Reading people without acting.
  found.noAction = e.actions / e.periods < sim.config.report.evidence.activity.weak ? q('noAction', { n: e.actions, unit, periods: e.periods }) : null;

  // The person whose weekly style missed most often.
  const weekly = sim.decisions.run.filter(d => d.source === 'weeklyStyle');
  const misses = all.map(m => ({ id: m.id, n: weekly.filter(d => d.memberId === m.id && d.mismatch !== 0).length, of: weekly.filter(d => d.memberId === m.id).length }))
    .filter(x => x.n >= 2).sort((a, b) => b.n - a.n || a.id.localeCompare(b.id));
  found.mismatch = misses[0] ? q('mismatch', { name: nameOf(sim, misses[0].id), n: misses[0].n, total: misses[0].of, unit }) : null;

  // Words that went well with choices that did not fit.
  found.words = e.words !== null && e.styleFit !== null && e.landed * 2 >= e.conversations && e.styleFit < sim.config.report.evidence.styleFit.weak
    ? q('words', { landed: e.landed, total: e.conversations, pct: round(e.styleFit) }) : null;

  // The hardest period: the largest fall in team morale.
  const falls = sim.periods.map(p => ({ n: p.period, d: round(p.kpis.morale.end - p.kpis.morale.start) })).filter(x => x.d <= -5).sort((a, b) => a.d - b.d || a.n - b.n);
  found.hardest = falls[0] ? q('hardest', { unit, n: falls[0].n, delta: falls[0].d }) : null;

  // The first message or event that went unanswered.
  const missed = sim.log.find(l => MISSED.some(code => hasCode(l.title, code)));
  found.missed = missed ? (missed.memberIds[0]
    ? q('missedPerson', { name: nameOf(sim, missed.memberIds[0]), unit, n: missed.period })
    : q('missedSponsor', { name: nameOf(sim, 'sponsor'), unit, n: missed.period })) : null;

  // The person whose morale fell most.
  const fallen = all.map(m => ({ id: m.id, from: start(m.id)?.morale ?? m.morale, to: m.morale })).map(x => ({ ...x, d: x.to - x.from })).filter(x => x.d <= -10).sort((a, b) => a.d - b.d || a.id.localeCompare(b.id));
  found.cost = fallen[0] ? q('cost', { name: nameOf(sim, fallen[0].id), from: fallen[0].from, to: fallen[0].to }) : null;

  // The stage that held the funnel back.
  const counts = new Map<string, number>();
  for (const p of sim.periods) if (p.bottleneck) counts.set(p.bottleneck, (counts.get(p.bottleneck) ?? 0) + 1);
  const worst = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  const stage = worst ? sim.config.stages.find(s => s.key === worst[0])?.name ?? worst[0] : null;
  found.bottleneck = worst && worst[1] >= 2 ? q('bottleneck', { stage: stage!, n: worst[1], total: sim.periods.length, unit }) : null;

  // The best conversation.
  const best = [...sim.liveRecords].filter(r => r.band === 'strong' && r.memberIds.length === 1).sort((a, b) => (b.impact ?? 0) - (a.impact ?? 0) || a.period - b.period)[0];
  found.best = best ? q('best', { action: actionName(sim, best.actionKey), name: nameOf(sim, best.memberIds[0]), unit, n: best.period }) : null;

  const ORDER: Record<Profile, string[]> = {
    readNoAction: ['noAction', 'missed', 'hardest', 'neglected'],
    absent: ['noAction', 'missed', 'mismatch', 'hardest'],
    wordsNotChoices: ['words', 'mismatch', 'cost', 'missed'],
    allRound: ['best', 'neglected', 'bottleneck', 'hardest'],
    numbersAtCost: ['cost', 'hardest', 'mismatch', 'neglected'],
    peopleFirst: ['bottleneck', 'best', 'neglected', 'missed'],
    bothSlipped: ['mismatch', 'cost', 'bottleneck', 'missed'],
    mixed: ['hardest', 'mismatch', 'neglected', 'missed']
  };
  const specific = ORDER[profile].map(k => found[k]).filter((x): x is Item => !!x).slice(0, 3);
  const thought = [...specific, ...authored.thought].slice(0, Math.max(4, specific.length));

  // Takeaways: the profile's two, one about a person in this run, then the authored ones.
  const gained = all.map(m => ({ id: m.id, d: m.result - (start(m.id)?.result ?? m.result) })).sort((a, b) => b.d - a.d || a.id.localeCompare(b.id))[0];
  const person: Copy | null = fallen[0]
    ? msg('engine.report.takeaway.startWith', { name: nameOf(sim, fallen[0].id), from: fallen[0].from, to: fallen[0].to })
    : gained && gained.d >= 5 ? msg('engine.report.takeaway.repeat', { name: nameOf(sim, gained.id), delta: gained.d }) : null;
  const own = [msg('engine.report.takeaway.profile', { profile, which: 'a' }), msg('engine.report.takeaway.profile', { profile, which: 'b' }), ...(person ? [person] : [])];
  const takeaways = [...own, ...authored.takeaways].slice(0, Math.max(6, own.length));
  return { thought, takeaways };
}

/** Everything the report's narrative needs, from the run. */
export function narrativeOf(sim: Sim, purpose: Purpose, run: RunSummary, levelIndex: number | null, levelLine: Copy | null, bottleneck: BottleneckFact | null) {
  const e = gatherEvidence(sim, run);
  const n = narrate(sim, purpose, e, levelIndex, levelLine);
  return { evidence: e, ...n, drivers: drivers(sim, purpose, bottleneck), ...reflections(sim, e, n.profile, { thought: sim.config.report.thought, takeaways: sim.config.report.takeaways }) };
}
