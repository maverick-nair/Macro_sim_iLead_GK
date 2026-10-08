import { industryOf } from '../context';
import { LENS_BY_ID } from '../lenses';
import type { AuthorDraft } from './draft';
import { redraft, regenerate } from './regenerate';

/**
 * Kora's suggestions (D107): ideas beside a tab that the author uses or dismisses; nothing changes until
 * they do. Plain instructions are read by `intents.ts` (offline) or the model (`../editor.ts`), D125.
 */

/** Applies one of Kora's suggestions; returns the paths it changed (marked as Kora's). */
export function applySuggestion(d: AuthorDraft, id: string): string[] {
  const s = d.suggestions.find(x => x.id === id);
  if (s) s.done = true;
  if (id === 'story.rival') {
    const ind = industryOf(d.brief.industry);
    const name = ind.companies.find(c => c !== d.story.company.name && !d.story.market.rivals.some(r => r.name === c)) ?? 'Value Rival Group';
    d.story.market.rivals.push({ name, angle: 'Competes on price, and wins when buyers only compare the quote' });
    return ['story.market.rivals'];
  }
  if (id === 'story.shorten') {
    const w = d.story.screens.find(x => x.key === 'welcome');
    if (w) {
      const sentences = w.body.replace(/\n+/g, ' ').match(/[^.!?]+[.!?]/g) ?? [w.body];
      let out = '';
      for (const sen of sentences) { if ((out + sen).split(/\s+/).length > 58) break; out += sen; }
      w.body = out.trim() || w.body;
    }
    return ['story.screens.welcome'];
  }
  if (id.startsWith('team.link.')) {
    const c = d.team.find(m => m.id === id.slice('team.link.'.length));
    if (c) c.hiddenConcern = `${c.hiddenConcern} It comes to a head when prices change, so a good conversation early pays off later.`.trim();
    return c ? [`team.${c.id}.hiddenConcern`] : [];
  }
  if (id.startsWith('events.fill.')) {
    const week = Number(id.slice('events.fill.'.length));
    const counts = new Map<number, number>();
    for (const e of d.events) if (e.week) counts.set(e.week, (counts.get(e.week) ?? 0) + 1);
    const busiest = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0]?.[0];
    const e = [...d.events].reverse().find(x => x.week === busiest && x.timing === 'fixed');
    if (e) { e.week = week; return [`events.${e.key}`]; }
    return [];
  }
  if (id.startsWith('scoring.secondary.')) {
    const lens = id.slice('scoring.secondary.'.length) as AuthorDraft['lens']['id'];
    d.lens.secondary = lens;
    for (const dim of LENS_BY_ID[lens].dimensions) if (!d.scoring.skills.some(k => k.key === dim.key)) d.scoring.skills.push({ key: dim.key, name: dim.name, reportOnly: true });
    return ['lens.id'];
  }
  if (id === 'brief.challenge') {
    // Drafted again from the changed challenge (D126): the events and the welcome screens, only what is still Kora's.
    const fresh = redraft(d);
    regenerate(d, { tab: 'events' }, fresh);
    regenerate(d, { section: 'sponsor' }, fresh);
    return [];
  }
  return [];
}
