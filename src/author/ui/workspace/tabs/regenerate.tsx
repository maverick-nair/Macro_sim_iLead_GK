import { useState } from 'react';
import type { AuthorDraft, Tab } from '../../../model/draft';
import { seedDraft } from '../../../model/seed';
import { useAuthor } from '../../../model/store';
import { BUTTON, Icon } from '../../kit';

/**
 * "Regenerate this tab": Kora drafts the tab again and replaces only what is still Kora's (marked AI).
 * Whatever the author wrote or edited stays. Offline the drafter is deterministic, so this brings
 * back Kora's version of anything changed by an applied suggestion; on a server it asks the model again.
 */
export function regenerate(d: AuthorDraft, tab: Tab): number {
  const fresh = seedDraft({ ...d.chat, primary: d.lens.id, secondary: d.lens.secondary }, 'workspace');
  const ai = (p: string) => d.marks[p] === 'ai';
  let n = 0;
  const take = (p: string, f: () => void) => { if (ai(p)) { f(); n++; } };
  if (tab === 'brief') for (const k of ['participants', 'industry', 'challenge', 'run', 'language', 'conversationBy', 'tones'] as const) take(`brief.${k}`, () => { (d.brief as Record<string, unknown>)[k] = fresh.brief[k]; });
  if (tab === 'story') {
    for (const k of ['name', 'hq', 'about', 'team', 'office'] as const) take(`story.company.${k}`, () => { d.story.company[k] = fresh.story.company[k]; });
    for (const k of ['name', 'oneLine', 'points'] as const) take(`story.product.${k}`, () => { (d.story.product as Record<string, unknown>)[k] = fresh.story.product[k]; });
    take('story.market.rivals', () => { d.story.market.rivals = fresh.story.market.rivals; });
    for (const k of ['name', 'title', 'voice'] as const) take(`story.sponsor.${k}`, () => { d.story.sponsor[k] = fresh.story.sponsor[k]; });
    for (const s of d.story.screens) { const f = fresh.story.screens.find(x => x.key === s.key); if (f) take(`story.screens.${s.key}`, () => { s.body = f.body; }); }
  }
  if (tab === 'process' && fresh.process.stages.length === d.process.stages.length) take('process.stages', () => { d.process.stages = fresh.process.stages.map((s, i) => ({ ...s, key: d.process.stages[i].key })); });
  if (tab === 'team') d.team = d.team.map(c => {
    const f = fresh.team.find(x => x.id === c.id);
    const mine = Object.entries(d.marks).some(([k, m]) => k.startsWith(`team.${c.id}.`) && m !== 'ai');
    if (!f || mine) return c;
    n++;
    return { ...f, stage: d.process.stages.some(s => s.key === f.stage) ? f.stage : c.stage };
  });
  if (tab === 'events') d.events = d.events.map(e => { const f = fresh.events.find(x => x.key === e.key); if (f && ai(`events.${e.key}`)) { n++; return f; } return e; });
  return n;
}

export function useRegenerate(tab: Tab, label = 'Regenerate this tab') {
  const edit = useAuthor(s => s.edit);
  const [done, setDone] = useState<number | null>(null);
  return {
    button: <button type="button" className={BUTTON.secondary} onClick={() => { let n = 0; edit(d => { n = regenerate(d, tab); }); setDone(n); }}>{Icon.refresh(14)} {label}</button>,
    note: done !== null ? <p role="status" className="m-0 mb-3 text-13 text-author-body">Kora drafted it again: {done} field{done === 1 ? '' : 's'} of Kora&rsquo;s refreshed. What you wrote or edited stays as it is.</p> : null
  };
}
