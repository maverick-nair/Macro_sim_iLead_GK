import type { ReportSection } from '../config';
import type { Copy } from '../copy';
import { relationLevel } from '../sim/stakeholderState';
import type { Sim } from '../sim/types';

/**
 * The report's "Stakeholders" part (D164): each stakeholder's relationship from the start of the run to the end,
 * how it moved week by week, the interactions with them (and the requests left unanswered), and what moved it
 * most. Data only: the client words it. Kept apart from the report's narratives (build.ts calls it).
 */

/** The default sections, with "Stakeholders" after "Decisions and consequences" (or the key moments) when the storyline has stakeholders. */
export function withStakeholders(sections: ReportSection[], sim: Sim): ReportSection[] {
  if (!sim.config.stakeholders.length || sections.includes('stakeholders')) return sections;
  const at = sections.includes('decisions') ? sections.indexOf('decisions') : sections.indexOf('moments');
  return at < 0 ? [...sections, 'stakeholders'] : [...sections.slice(0, at + 1), 'stakeholders', ...sections.slice(at + 1)];
}

export function stakeholdersOf(sim: Sim) {
  const c = sim.config;
  const skillName = (k: string) => c.report.skills.find(s => s.key === k)?.name ?? k;
  return {
    stakeholders: c.stakeholders.map(s => {
      const st = sim.stakeholders[s.key];
      const start = { trust: s.start.trust, satisfaction: s.start.satisfaction };
      const end = { trust: st.trust, satisfaction: st.satisfaction };
      const recs = sim.stakeholderRecords.filter(r => r.stakeholder === s.key);
      const biggest = [...st.moves].sort((a, b) => (Math.abs(b.trust) + Math.abs(b.satisfaction)) - (Math.abs(a.trust) + Math.abs(a.satisfaction))).slice(0, 3);
      return {
        key: s.key, name: s.name, role: s.role, kind: s.kind, img: s.portrait ?? null,
        start, end, levelStart: relationLevel(start), levelEnd: relationLevel(end),
        series: sim.periods.map(p => {
          const x = p.stakeholders?.find(y => y.key === s.key);
          return { period: p.period, trust: x?.trust.end ?? end.trust, satisfaction: x?.satisfaction.end ?? end.satisfaction };
        }),
        interactions: recs.map(r => ({
          id: r.id, period: r.period, title: r.title, type: r.type, band: r.band, option: r.option, outcome: r.outcome, answered: r.answered,
          trust: r.trust, satisfaction: r.satisfaction, variables: r.variables.map(x => ({ key: x.key, name: c.variables.find(v => v.key === x.key)?.name ?? x.key, delta: x.delta })),
          revenue: Math.round(r.revenue), sponsor: r.sponsor, read: r.read.map(x => ({ skill: skillName(x.skill), band: x.band }))
        })),
        moves: biggest.map(m => ({ period: m.period, cause: m.cause as Copy, trust: m.trust, satisfaction: m.satisfaction }))
      };
    })
  };
}
