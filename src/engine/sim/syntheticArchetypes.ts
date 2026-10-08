import { bestStyle } from '../lens';
import { energizeAction, PERSONA_TRAITS, present, ruleAction, type Member, type PlayerApi, type Policy, type Step } from './syntheticPolicy';
import type { EngineView } from './view';

/**
 * Four player types beside the four levels (D150): each plays from the participant's view like the levels,
 * with a level's traits and hooks for what it puts first. They show an author whether the storyline tells
 * different ways of leading apart, and whether caring for people and delivering results trade off.
 *
 *   riskTaker      hires, lets go, moves people, rewards the top performer, takes the costliest options and
 *                  hands skilled people the stretch style
 *   conservative   few actions: two careful 1:1s a week with the people who need them most, the cheapest
 *                  options, keeps last week's styles, every promise kept, every event answered
 *   peopleFirst    an Expert's reading, but morale first: team energy every week, rewards whoever is lowest,
 *                  1:1s that lift morale, praise in every email, leaves the sponsor's calls unanswered
 *   businessFirst  a Proficient's reading, but results first: the most directive style for anyone below par,
 *                  training every week, lets go of the weakest once, answers the sponsor first
 */
export const ARCHETYPES = ['riskTaker', 'conservative', 'peopleFirst', 'businessFirst'] as const;
export type ArchetypeKey = (typeof ARCHETYPES)[number];

export const ARCHETYPE_COPY: Record<ArchetypeKey, { name: string; label: string; plays: string }> = {
  riskTaker: { name: 'Risk taker', label: 'Bold choices', plays: 'Hires, lets people go and moves them between stages, picks the boldest option and stretches skilled people. Makes promises freely.' },
  conservative: { name: 'Conservative', label: 'Few, safe actions', plays: 'Takes few actions and the safest options: two careful one to ones a week, rarely changes a style, keeps every promise.' },
  peopleFirst: { name: 'People first', label: 'Morale and growth first', plays: 'Always puts morale and development first: team energy every week, recognition for whoever is lowest, one to ones that lift people.' },
  businessFirst: { name: 'Business first', label: 'Results and revenue first', plays: 'Always puts results and revenue first: directs anyone below par, trains every week, answers the sponsor first and lets the weakest go.' }
};

const by = (f: (m: Member) => number) => (a: Member, b: Member) => f(a) - f(b) || a.id.localeCompare(b.id);

function once(p: PlayerApi, key: string, step: Step | null): Step | null {
  if (step) p.memo.set(key, (p.memo.get(key) ?? 0) + 1);
  return step;
}

/** Moves someone to a stage where their assessed result is at least `margin` better. */
function swapTo(p: PlayerApi, v: EngineView, margin: number): Step | null {
  const swap = ruleAction(p.config, 'swap');
  if (!swap || !p.liveLeft(v)) return null;
  for (const m of present(v)) {
    const better = Object.entries(m.assessments ?? {}).filter(([st, s]) => st !== m.stage && s.result >= p.stats(m).result + margin && (v.funnel.find(f => f.key === st)?.members ?? 99) < v.maxPerStage);
    if (!better.length) continue;
    const step = p.stepFor(v, swap.key, m.id, 'extra');
    if (step?.stage !== undefined) return { ...step, stage: better[0][0] };
  }
  return null;
}

const riskTaker: Policy = {
  traits: { ...PERSONA_TRAITS.proficient, promise: 1, keepPromises: 0.5, events: 0.5, extras: 1, waste: 0.3 },
  level: 2,
  option: 'boldest',
  style: (p, m, need) => (need?.startsWith('highSkill') && p.rng.chance(0.8) ? bestStyle(p.config.lens, 'highSkill_highMorale') : null),
  first(p, v) {
    if (v.clock.period < 2) return null;
    const here = present(v);
    const worst = [...here].sort(by(m => p.stats(m).result))[0];
    const fire = ruleAction(p.config, 'fire'), hire = ruleAction(p.config, 'hire'), assess = ruleAction(p.config, 'assess'), reward = ruleAction(p.config, 'reward');
    if (fire && worst && (p.memo.get('fired') ?? 0) < 2 && p.stats(worst).result < 40) {
      const step = once(p, 'fired', p.stepFor(v, fire.key, worst.id, 'extra'));
      if (step) return step;
    }
    if (hire && v.members.length < p.config.members.length && p.liveLeft(v)) {
      const step = p.stepFor(v, hire.key, null, 'extra');
      if (step) return step;
    }
    if (assess) for (const m of here.filter(x => p.stats(x).result < 55)) {
      if (p.memo.has(`assessed:${m.id}`)) continue;
      const step = p.stepFor(v, assess.key, m.id, 'extra');
      if (step) { p.memo.set(`assessed:${m.id}`, v.clock.period); return step; }
    }
    const moved = swapTo(p, v, 5);
    if (moved) return moved;
    const top = [...here].sort(by(m => -p.stats(m).result))[0];
    if (reward && top && p.memo.get('rewarded') !== v.clock.period) {
      const step = p.stepFor(v, reward.key, top.id, 'extra');
      if (step) { p.memo.set('rewarded', v.clock.period); return step; }
    }
    return null;
  }
};

const conservative: Policy = {
  traits: { ...PERSONA_TRAITS.proficient, adapt: 0.15, promise: 0, keepPromises: 1, events: 1, extras: 0, waste: 0, fitAction: 1, focus: 0.9 },
  level: 2,
  option: 'safest',
  meetings: false,
  budget: 2,
  first(p, v) {
    // Careful one to ones, in the 1:1 action, and nothing else of its own.
    const f2f = p.config.actions.find(a => a.scope === 'member' && a.rule === 'styleOption' && a.kind !== 'static' && a.format === 'roleplay');
    if (!f2f || !p.liveLeft(v)) return null;
    for (const m of p.neediest(v).slice(0, 3)) {
      const step = p.stepFor(v, f2f.key, m.id, 'develop', p.styles[m.id]);
      if (step) return step;
    }
    return null;
  },
  extra: () => null
};

const peopleFirst: Policy = {
  traits: { ...PERSONA_TRAITS.expert, diagnose: 0.9, adapt: 0.9, promise: 0.3, extras: 1, waste: 0 },
  level: 3,
  email: 'congratulate',
  weights: () => [0.5, 3, 0.5],
  respond: kind => (kind === 'sponsor' ? 0 : 1),
  neediest: (p, v) => [...present(v)].sort(by(m => p.stats(m).morale)),
  extra(p, v) {
    const energize = energizeAction(p.config);
    if (energize && p.memo.get('energized') !== v.clock.period) {
      const step = p.stepFor(v, energize.key, null, 'extra');
      if (step) { p.memo.set('energized', v.clock.period); return step; }
    }
    const reward = ruleAction(p.config, 'reward');
    const low = [...present(v)].sort(by(m => p.stats(m).morale))[0];
    return reward && low ? p.stepFor(v, reward.key, low.id, 'extra') : null;
  }
};

const businessFirst: Policy = {
  traits: { ...PERSONA_TRAITS.proficient, promise: 0, extras: 1, waste: 0.2, events: 0.8 },
  level: 2,
  weights: () => [1, 0, 3],
  respond: kind => (kind === 'sponsor' ? 1 : kind === 'team' ? 0.9 : 0.3),
  style: (p, m) => (p.stats(m).result < 60 ? bestStyle(p.config.lens, 'lowSkill_lowMorale') : null),
  neediest: (p, v) => [...present(v)].sort(by(m => p.stats(m).result)),
  extra(p, v) {
    const here = present(v);
    const training = ruleAction(p.config, 'training'), assess = ruleAction(p.config, 'assess'), reward = ruleAction(p.config, 'reward'), fire = ruleAction(p.config, 'fire');
    const low = [...here].sort(by(m => p.stats(m).skill))[0];
    if (training && low && p.stats(low).skill < 60 && p.memo.get('trained') !== v.clock.period) {
      const step = p.stepFor(v, training.key, low.id, 'extra');
      if (step) { p.memo.set('trained', v.clock.period); return step; }
    }
    const worst = [...here].sort(by(m => p.stats(m).result))[0];
    if (fire && worst && p.stats(worst).result < 30 && !p.memo.has('fired') && v.clock.period >= 3) {
      const step = once(p, 'fired', p.stepFor(v, fire.key, worst.id, 'extra'));
      if (step) return step;
    }
    if (assess && worst && !p.memo.has('assessed')) {
      const step = once(p, 'assessed', p.stepFor(v, assess.key, worst.id, 'extra'));
      if (step) return step;
    }
    const moved = swapTo(p, v, 10);
    if (moved) return moved;
    const top = [...here].sort(by(m => -p.stats(m).result))[0];
    if (!reward || !top || p.memo.get('rewarded') === v.clock.period) return null;
    const step = p.stepFor(v, reward.key, top.id, 'extra');
    if (step) p.memo.set('rewarded', v.clock.period);
    return step;
  }
};

export const ARCHETYPE_POLICIES: Record<ArchetypeKey, Policy> = { riskTaker, conservative, peopleFirst, businessFirst };
