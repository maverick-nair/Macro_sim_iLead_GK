import type { I18n, MessageKey } from '../../i18n';
import type { SectionModel } from './engine';
import type { PeriodUnit, Purpose } from './types';

/**
 * The full report under the first page (D235): each section's title, for the contents and the line that
 * names what was left out, and the rule that leaves out what has nothing to say.
 */

export type SectionKey = SectionModel['key'];
/** What the full report left out for want of evidence: a skill, or a whole section. */
export type LeftOut = { kind: 'skill'; name: string } | { kind: 'section'; key: SectionKey };

const TITLES: Record<SectionKey | 'team', MessageKey> = {
  about: 'report.about.title', summary: 'report.summary.title', skills: 'report.skills.title', objectives: 'report.objectives.title', adaptability: 'report.adaptability.title',
  styles: 'report.styles.title', style: 'report.fit.title', consistency: 'report.consistency.title', intent: 'report.intent.title', actions: 'report.actions.title',
  distribution: 'report.distribution.title', moments: 'report.moments.title', decisions: 'report.decisions.title', people: 'report.people.title', business: 'report.business.title',
  analytics: 'report.analytics.title', thought: 'report.thought.title', takeaways: 'report.takeaways.title', plan: 'report.plan.title', progress: 'report.progress.title',
  methodology: 'report.method.title', stakeholders: 'report.stakeholders.title', team: 'report.team.title'
};

/** A section's title as its h2 reads; `team` is the team over the run. */
export function sectionTitle(t: I18n['t'], key: SectionKey | 'team', o: { purpose: Purpose; unit: PeriodUnit; periods: number }): string {
  return t(TITLES[key], { purpose: o.purpose, unit: o.unit, n: o.periods });
}

/**
 * Leaves out what has nothing to say instead of printing "Not enough evidence" again and again: a skill
 * without a level, and a section with no evidence in it (no rated skill, no moment, no conversation, no
 * person whose style a conversation showed, nothing to compare, no style used, no action taken). Sections
 * the model already drops when they do not apply (decisions, stakeholders, progress) are not counted.
 */
export function withEvidence(sections: SectionModel[]): { sections: SectionModel[]; leftOut: LeftOut[] } {
  const leftOut: LeftOut[] = [];
  const kept = sections.flatMap((s): SectionModel[] => {
    const empty = (): SectionModel[] => { leftOut.push({ kind: 'section', key: s.key }); return []; };
    switch (s.key) {
      case 'skills': {
        const rated = s.rows.filter(r => r.level !== null);
        if (!rated.length) return empty();
        leftOut.push(...s.rows.filter(r => r.level === null).map(r => ({ kind: 'skill' as const, name: r.name })));
        return [{ ...s, rows: rated }];
      }
      case 'moments': return s.moments.length ? [s] : empty();
      // A neutral card is one no conversation has shown yet.
      case 'intent': return s.cards.some(c => c.tone !== 'neutral') ? [s] : empty();
      case 'analytics': return s.data.conversations ? [s] : empty();
      case 'consistency': return s.data.deviations.some(d => d.value !== null) ? [s] : empty();
      case 'styles': return s.data.styles.some(x => x.count > 0) ? [s] : empty();
      case 'style': return s.rows.length ? [s] : empty();
      case 'actions': return s.rows.some(r => r.frequency > 0) ? [s] : empty();
      case 'distribution': return s.data.totals.some(n => n > 0) ? [s] : empty();
      case 'people': return s.people.length ? [s] : empty();
      default: return [s];
    }
  });
  return { sections: kept, leftOut };
}
