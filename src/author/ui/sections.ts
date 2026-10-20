import { LENS_BY_ID } from '../lenses';
import type { AuthorDraft, Tab } from '../model/draft';
import { needsOf, tabStatus } from '../model/needs';

/** The workspace's tabs in order, with the nav's labels (docs/design/genie/Overview). */
export const NAV: Array<{ tab: Tab; label: string; n?: number }> = [
  { tab: 'overview', label: 'Overview' },
  { tab: 'brief', label: 'Brief', n: 1 },
  { tab: 'story', label: 'Story and world', n: 2 },
  { tab: 'process', label: 'Work process', n: 3 },
  { tab: 'team', label: 'Team', n: 4 },
  { tab: 'lens', label: 'Leadership lens', n: 5 },
  { tab: 'actions', label: 'Actions and conversations', n: 6 },
  { tab: 'events', label: 'Events', n: 7 },
  { tab: 'scoring', label: 'Scoring and report', n: 8 },
  { tab: 'brand', label: 'Brand and theme', n: 9 },
  { tab: 'calibrate', label: 'Test with synthetic players', n: 10 },
  { tab: 'publish', label: 'Review and publish', n: 11 }
];
export const labelOf = (t: Tab) => NAV.find(n => n.tab === t)!.label;

/** One line on what each section holds, for First draft ready and the Overview. */
export function summaryOf(d: AuthorDraft, tab: Tab): string {
  const live = d.actions.filter(a => (a.core || a.enabled) && a.plays !== 'static').length;
  switch (tab) {
    case 'brief': return 'Participants, industry, challenge, run length';
    case 'story': return 'Company, product, market, sponsor, intro screens';
    case 'process': return `${d.process.stages.length} stages, weekly targets, pacing`;
    case 'team': return `${d.team.length} characters with personas, voices and hidden concerns`;
    case 'lens': return `${LENS_BY_ID[d.lens.id].title}, ${d.lens.styles.length} styles, fit rules`;
    case 'actions': return `${d.actions.filter(a => a.core || a.enabled).length} actions, ${live} live conversations with goals`;
    case 'events': return `${d.events.length} events across ${d.process.weeks} weeks`;
    case 'scoring': return `${d.scoring.skills.filter(s => !s.reportOnly).length} skills, ${d.brief.purpose} purpose`;
    case 'brand': return d.brand.from === 'knolskape' ? 'KNOLSKAPE default; add a client theme any time' : `${d.brand.name} brand`;
    default: return '';
  }
}

/** The status word of a section: needs you, from you, generated, or ready. */
export function statusOf(d: AuthorDraft, tab: Tab): { kind: 'need' | 'you' | 'generated' | 'done'; text: string } {
  const needs = needsOf(d).filter(n => n.tab === tab).length;
  if (needs) return { kind: 'need', text: `${needs} needs you` };
  if (tab === 'brief') return { kind: 'you', text: 'From you' };
  if (tab === 'brand') return { kind: 'done', text: 'Ready' };
  return tabStatus(d, tab) === 'yours' ? { kind: 'you', text: 'Mostly yours' } : { kind: 'generated', text: 'Generated' };
}
