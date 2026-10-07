import type { StorylineConfig } from '../../../engine/config';
import { fitOf } from '../../../engine/lens';
import { UNTAGGED } from '../../../engine/sim/live';
import type { SyntheticRun } from '../../../engine/sim/synthetic';
import { explain } from './explain';
import type { Playthrough, RunResult } from './schema';

/** What the aggregation and the playthrough view read from one synthetic run. Pure. */

export function runResultOf(run: SyntheticRun, index: number, config: StorylineConfig): RunResult {
  const s = run.summary;
  const tiers = config.gamification.tiers;
  const tierIndex = Math.max(0, tiers.findIndex(t => t.key === s.score.tier));
  const bands = { strong: 0, adequate: 0, weak: 0, harmful: 0 };
  for (const c of run.conversations) if (c.evaluation) bands[c.evaluation.band]++;
  const weeks = run.weeks.flatMap(w => w.events.filter(e => e.expected));
  return {
    persona: run.persona, index, seed: run.seed,
    probe: run.probe ? { kind: run.probe.kind, key: run.probe.kind === 'style' ? run.probe.style : run.probe.action } : null,
    score: s.score.total, max: s.score.max,
    tier: { key: tiers[tierIndex].key, name: tiers[tierIndex].name, index: tierIndex },
    share: Math.round((s.objectives.revenue / s.objectives.target) * 1000) / 1000,
    level: s.overall.level,
    skills: s.skills.filter(k => !k.reportOnly).map(k => ({ key: k.key, level: k.level, score: k.score })),
    adaptability: s.styles.adaptability,
    bands,
    concerns: [...new Set(run.conversations.filter(c => c.concernSurfaced).flatMap(c => c.memberIds))],
    actions: Object.fromEntries(s.actions.map(a => [a.key, a.frequency])),
    events: { expected: weeks.length, handled: weeks.filter(e => e.handled).length }
  };
}

export function playthroughOf(run: SyntheticRun, index: number, config: StorylineConfig): Playthrough {
  const r = runResultOf(run, index, config);
  const styleName = (k: string | null) => (k ? config.lens.styles.find(s => s.key === k)?.name ?? k : null);
  return {
    persona: run.persona, index, seed: run.seed, score: r.score, tier: r.tier.name, share: r.share, adaptability: r.adaptability,
    weeks: run.weeks.map(w => ({
      period: w.period,
      styleFit: w.styleFit,
      actions: w.actions.map(a => `${a.option ? `${a.name} (${a.option})` : a.name}${a.names.length ? ` with ${a.names.map(n => n.split(' ')[0]).join(' and ')}` : ''}`),
      events: w.events.map(e => ({ title: e.title, expected: e.expected, handled: e.handled })),
      revenue: w.revenue,
      score: w.score
    })),
    conversations: run.conversations.map((c, i) => {
      const e = c.evaluation;
      const tagged = c.memberIds.length === 1 && !UNTAGGED.has(c.format) && c.actionKey !== 'reply' && c.actionKey !== 'sponsor';
      const shown = e && tagged ? e.styleUsed : null;
      const fit = shown && c.need ? fitOf(config.lens, shown, c.need) === 0 : null;
      const first = c.names[0]?.split(' ')[0] ?? null;
      return {
        id: `c${i + 1}`,
        period: c.period,
        title: c.names.length ? `${c.actionName} with ${c.names.map(n => n.split(' ')[0]).join(' and ')}` : c.actionName,
        format: c.format,
        memberIds: c.memberIds,
        names: c.names,
        band: e?.band ?? null,
        intended: tagged ? styleName(c.intent) : null,
        shown: styleName(shown),
        fit,
        turns: c.turns,
        dimensions: e?.dimensions.map(d => ({ key: d.key, band: d.band })) ?? [],
        why: explain({ evaluation: e, format: c.format, name: c.memberIds.length === 1 ? first : null, intended: tagged ? styleName(c.intent) : null, shown: styleName(shown), fit, needLabel: c.need ? config.lens.needs[c.need].label : null, concern: c.concern, surfaced: c.concernSurfaced, tagged })
      };
    })
  };
}
