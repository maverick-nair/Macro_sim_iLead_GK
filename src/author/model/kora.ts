import { industryOf } from '../context';
import { LENS_BY_ID } from '../lenses';
import type { AuthorDraft, Character, Tab } from './draft';
import { freshKey, PORTRAITS, pronounsOf } from './seed';

/**
 * Ask Kora, offline (D107): the copilot beside every tab. With no model it reads plain instructions by
 * rule and always shows the change before applying it: a character's name changes their persona, "the
 * sponsor" their letter, "shorten" or "Lite" the run length, "add a remote team member" a character,
 * anything else the tab's main text. Kora's suggestions are ideas the author uses or dismisses; nothing
 * changes until they do. On a server the same panel would send the instruction to the model.
 */

export interface Proposal {
  /** What changes, as the panel heads it: "Persona" or "Run length". */
  label: string;
  path: string;
  before: string;
  after: string;
  apply(d: AuthorDraft): void;
}

const pron = (c: Character) => (c.gender === 'woman' ? ['she', 'She', 'her'] : c.gender === 'man' ? ['he', 'He', 'his'] : ['they', 'They', 'their']);
const sentenceCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** The words after "more" or "less" in an instruction: "more defensive" gives "defensive". */
function quality(text: string): { word: string; more: boolean } | null {
  const m = text.match(/\b(more|less)\s+([a-z]+(?:\s+[a-z]+)?)/i);
  if (!m) return null;
  const word = m[2].replace(/\s+(in|at|with|about|during|for|on)$/i, '').replace(/\s+(in|at|with|about|during|for|on)\s.*$/i, '');
  return { word: word.toLowerCase(), more: m[1].toLowerCase() === 'more' };
}

function personaLine(c: Character, text: string, variant: number): string {
  const [p, P] = pron(c);
  const q = quality(text);
  const when = /first meeting/i.test(text) ? 'every first meeting' : 'conversations with a new manager';
  if (q?.word.startsWith('defensive')) {
    return variant % 2 === 0
      ? `Starts ${when} guarded and tests the new manager with a hard question; opens up only after ${p} feels heard.`
      : `${P} answers questions with questions in ${when}, and relaxes once the manager shows ${p} has been listened to.`;
  }
  if (q) return variant % 2 === 0 ? `${P} is ${q.more ? 'noticeably' : 'much less'} ${q.word} in ${when}, and the manager has to earn a change.` : `${sentenceCase(q.word)} ${q.more ? 'shows early' : 'rarely shows'} in ${when}; ${p} warms up when ${p} feels heard.`;
  return variant % 2 === 0 ? `${P} ${text.trim().replace(/[.!?]$/, '').toLowerCase()}.` : `In play, ${p} ${text.trim().replace(/[.!?]$/, '').toLowerCase()}.`;
}

export function propose(d: AuthorDraft, tab: Tab, instruction: string, variant = 0): Proposal | null {
  const text = instruction.trim();
  if (!text) return null;
  const who = d.team.find(c => new RegExp(`\\b${c.first}\\b`, 'i').test(text));
  if (who) {
    const concern = /\b(concern|secret|worry|worried)\b/i.test(text);
    const field = concern ? 'hiddenConcern' : 'persona';
    const before = who[field];
    const after = concern ? `${before} ${personaLine(who, text, variant)}`.trim() : personaLine(who, text, variant) + (variant > 1 ? ` ${before}` : '');
    return { label: concern ? 'Hidden concern' : 'Persona', path: `team.${who.id}.${field}`, before, after, apply: x => { const c = x.team.find(m => m.id === who.id); if (c) c[field] = after; } };
  }
  if (/\bsponsor\b/i.test(text)) {
    const s = d.story.screens.find(x => x.key === 'welcome');
    const before = s?.body ?? '';
    const q = quality(text);
    const add = q?.word.startsWith('demanding') || /strict|tough|demanding/i.test(text)
      ? (variant % 2 === 0 ? 'I expect a plan from you by the end of week one, and I will hold you to it.' : 'I will ask for your numbers every Friday. Have them ready.')
      : (variant % 2 === 0 ? 'My door is open. Bring me problems early, with what you propose.' : 'Call me when you need me; I would rather hear early than late.');
    const after = `${before}\n\n${add}`.trim();
    return { label: 'Welcome letter', path: 'story.screens.welcome', before, after, apply: x => { const t = x.story.screens.find(y => y.key === 'welcome'); if (t) t.body = after; } };
  }
  if (/\b(shorten|shorter|lite|30 minute|thirty minute)\b/i.test(text)) {
    return { label: 'Run length', path: 'brief.run', before: d.brief.run === 'full' ? 'Full' : d.brief.run === 'standard' ? 'Standard' : 'Lite', after: 'Lite, 4 weeks, about 30 minutes', apply: x => { x.brief.run = 'lite'; x.process.weeks = 4; for (const e of x.events) if (e.week && e.week > 4) e.week = Math.ceil(e.week / 2); } };
  }
  if (/\b(add|new)\b.*\b(member|character|person|remote)\b/i.test(text)) {
    const remote = /remote/i.test(text);
    const id = freshKey(remote ? 'remote_member' : 'new_member', d.team.map(c => c.id));
    const stage = d.process.stages[Math.min(d.process.stages.length - 1, 1)].key;
    const name = remote ? 'Sam Okoro' : 'Alex Moreno';
    const c: Character = {
      ...structuredClone(d.team[0]), id, first: name.split(' ')[0], last: name.split(' ')[1], gender: 'nonbinary', pronouns: pronounsOf('nonbinary'), stage, photo: PORTRAITS[d.team.length % PORTRAITS.length],
      title: `${d.process.stages.find(s => s.key === stage)!.name} Specialist`, persona: remote ? 'Works from another city and joins every meeting by video. Easy to forget, quick to feel left out.' : 'New to the team and keen to prove themselves.',
      hiddenConcern: remote ? 'They think decisions are made in the office before they hear about them.' : '', concernLine: '', relationships: [], custom: []
    };
    return { label: 'New character', path: `team.${id}.identity`, before: '', after: `${name}, ${c.title}. ${c.persona}`, apply: x => { if (x.team.length < 12) x.team.push(c); } };
  }
  // Anything else changes the tab's main text.
  const ind = industryOf(d.brief.industry);
  const main: Partial<Record<Tab, { label: string; path: string; get: (x: AuthorDraft) => string; set: (x: AuthorDraft, v: string) => void }>> = {
    overview: { label: 'What the company does', path: 'story.company.about', get: x => x.story.company.about, set: (x, v) => { x.story.company.about = v; } },
    story: { label: 'What the company does', path: 'story.company.about', get: x => x.story.company.about, set: (x, v) => { x.story.company.about = v; } },
    brief: { label: 'Business challenge', path: 'brief.challenge', get: x => x.brief.challenge, set: (x, v) => { x.brief.challenge = v; } },
    events: { label: `Event: ${d.events[0]?.title ?? ''}`, path: `events.${d.events[0]?.key}`, get: x => x.events[0]?.body ?? '', set: (x, v) => { if (x.events[0]) x.events[0].body = v; } },
    team: { label: `Persona: ${d.team[0].first}`, path: `team.${d.team[0].id}.persona`, get: x => x.team[0].persona, set: (x, v) => { x.team[0].persona = v; } }
  };
  const m = main[tab] ?? main.story!;
  const before = m.get(d);
  const topic = text.replace(/^(make|please|can you|could you)\s+/i, '').replace(/[.!?]$/, '');
  const after = /pricing/i.test(text)
    ? `${before} Pricing pressure from ${d.story.market.rivals[0]?.name ?? 'a rival'} is squeezing every ${ind.work}.`.trim()
    : variant % 2 === 0 ? `${before} ${sentenceCase(topic)}.`.trim() : `${sentenceCase(topic)}. ${before}`.trim();
  return { label: m.label, path: m.path, before, after, apply: x => m.set(x, after) };
}

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
    const e = d.events[0];
    if (e) e.body = `${e.body} ${d.brief.challenge.replace(/[.!?]?$/, '.')}`.trim();
    for (const c of d.team.slice(0, 2)) c.persona = `${c.persona} Feels the pressure of the challenge: ${d.brief.challenge.replace(/[.!?]$/, '').toLowerCase()}.`;
    return [e ? `events.${e.key}` : '', ...d.team.slice(0, 2).map(c => `team.${c.id}.persona`)].filter(Boolean);
  }
  return [];
}
