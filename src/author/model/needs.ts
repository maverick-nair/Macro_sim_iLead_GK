import type { AuthorDraft, Mark, Tab } from './draft';
import { fieldPaths } from './seed';

/**
 * "Needs you" (docs/design/genie/Main.dc.html): what Kora could not infer and the author must give
 * before publishing. Computed from the draft, never stored, so filling a field clears it at once.
 */
export interface Need { id: string; tab: Tab; label: string; where: string; path: string }

export function needsOf(d: AuthorDraft): Need[] {
  const out: Need[] = [];
  const add = (id: string, tab: Tab, label: string, where: string, path = id) => out.push({ id, tab, label, where, path });
  if (!d.story.product.dealValue) add('story.product.dealValue', 'story', 'Average deal value', 'Story and world');
  if (!d.brief.challenge.trim()) add('brief.challenge', 'brief', 'Business challenge', 'Brief');
  if (!d.story.company.name.trim()) add('story.company.name', 'story', 'Company name', 'Story and world');
  if (!d.story.sponsor.name.trim()) add('story.sponsor.name', 'story', 'Sponsor', 'Story and world');
  if (!d.process.revenue) add('process.revenue', 'process', 'Revenue target', 'Work process');
  for (const c of d.team) if (!c.first.trim()) add(`team.${c.id}.identity`, 'team', 'A character\'s first name', 'Team');
  for (const s of d.lens.styles) if (!s.name.trim() || !s.letter.trim()) add(`lens.styles.${s.key}`, 'lens', 'A style\'s name and tag', 'Leadership lens');
  if (d.scoring.samples.some(s => s.call === null)) add('scoring.samples', 'scoring', 'Approve the scoring samples', 'Scoring and report');
  if (d.scoring.framework && !d.scoring.framework.confirmed) add('scoring.framework', 'scoring', 'Confirm your skills framework', 'Scoring and report');
  return out;
}

/** Marks counted for the "so far" badges: from you (you and edited), generated (ai). */
export function markCounts(d: AuthorDraft): { you: number; ai: number; need: number } {
  const marks = fieldPaths(d).map(p => d.marks[p]).filter((m): m is Mark => !!m);
  return { you: marks.filter(m => m !== 'ai').length, ai: marks.filter(m => m === 'ai').length, need: needsOf(d).length };
}

/** The status a tab shows in the nav: needs you first, then whether most of it is the author's. */
export function tabStatus(d: AuthorDraft, tab: Tab): 'need' | 'yours' | 'ai' {
  if (needsOf(d).some(n => n.tab === tab)) return 'need';
  const prefix: Partial<Record<Tab, string[]>> = { brief: ['brief.'], story: ['story.'], process: ['process.'], team: ['team.'], lens: ['lens.'], actions: ['actions.'], events: ['events.'] };
  const ps = prefix[tab];
  if (!ps) return 'yours';
  const marks = Object.entries(d.marks).filter(([k]) => ps.some(p => k.startsWith(p))).map(([, m]) => m);
  return marks.length && marks.filter(m => m !== 'ai').length * 2 >= marks.length ? 'yours' : 'ai';
}
