import type { Brief, Clarify, Dilemma, FrameworkDimension, QuestionId, Stakeholder } from '../api/author';
import { DURATION_MODES, INDUSTRIES, REGIONS, ROLE_LEVELS, TONE_LABELS, type Industry } from './context';
import { extractFramework } from './extract';

type ChipOf = Clarify['choices'][number];

/**
 * Reading a long answer or an uploaded brief without a model (D146): every field the chat asks (participants,
 * industry, the client, the challenge, team size, tone, the framework's skills, run length, region) and the
 * people, objectives and dilemmas the brief names. Plain rules over sentences: named organisations, "team of N",
 * role phrases, "X vs Y" and "between X and Y". What the text does not state is left out, never guessed; what
 * it states twice in different ways is a clarifying question (D147), not a pick.
 *
 * The server reads the same brief with the model (`author-turn.md`) and falls back to these rules.
 */

export type TookId = QuestionId | 'stakeholders' | 'objectives' | 'dilemmas';
/** One thing a long answer or an upload gave, as the chat says it back ("I took these from your brief"). */
export interface TookItem { id: TookId; label: string; value: string }

export interface Reading {
  fields: Partial<Brief>;
  /** One short question when the text is ambiguous or contradicts itself; the field it asks about is left unset. */
  clarify?: Clarify;
}

/* -------------------------------------------------------------------------------------------- *
 * Sentences and words
 * -------------------------------------------------------------------------------------------- */

const ABBR = /\b(?:e\.g|i\.e|etc|vs|Mr|Mrs|Ms|Dr|Inc|Ltd|Co|St|approx|U\.S|U\.K)\./g;
const HOLD = '\u0000';

/** The text as sentences: on ". ", "! ", "? " before a capital or a number, and on line breaks. Abbreviations hold. */
export function sentences(text: string): string[] {
  const held = text.replace(/\r/g, '').replace(ABBR, m => m.replace(/\./g, HOLD));
  return held.split(/(?<=[.!?])\s+(?=["'“(]?[A-Z0-9])|\n+/).map(s => s.replace(new RegExp(HOLD, 'g'), '.').trim()).filter(Boolean);
}

/** A brief rather than a one line answer: long, several sentences, or several lines. */
export function isLong(text: string): boolean {
  const t = text.trim();
  return t.length >= 180 || sentences(t).length >= 3 || (t.split(/\n/).filter(l => l.trim()).length >= 3 && t.length >= 60);
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const tidy = (s: string) => s.replace(/\s+/g, ' ').replace(/^[\s,;:]+|[\s,;:.]+$/g, '').trim();
const WORD_NUMBERS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, twenty: 20, thirty: 30 };
const numberOf = (w: string): number | null => (/^\d+$/.test(w) ? Number(w) : WORD_NUMBERS[w.toLowerCase()] ?? null);

/* -------------------------------------------------------------------------------------------- *
 * Participants
 * -------------------------------------------------------------------------------------------- */

const LEVEL_WORDS = '(?:newly\\s+(?:appointed|promoted)|new(?:ly)?|first[- ]time|first[- ]line|front[- ]?line|senior|junior|mid[- ]level|middle|experienced|aspiring|high[- ]potential|regional|area|national|global|existing|current)';
const ROLE_WORDS = '(?:vice\\s+presidents?|s?vps?|evps?|directors?|heads?|managers?|team\\s+leads?|team\\s+leaders?|supervisors?|leaders?|executives?|officers?)';
const STOP_AFTER = '(?=\\s+(?:at|in|from|who|across|with|working|to|that|whose|each|on|for)\\b|[,.;:()]|$)';
const EXPLICIT = new RegExp(`\\b(?:participants|audience|learners|cohort|target\\s+group)\\s+(?:are|is|will\\s+be|:)\\s+(?:our\\s+|the\\s+|all\\s+)?(.+?)${STOP_AFTER}`, 'i');
const FOR_WHOM = new RegExp(`\\b(?:simulation|sim|programme|program|course|experience|workshop|journey)\\s+(?:is\\s+)?(?:for|aimed\\s+at|designed\\s+for|targeting|built\\s+for)\\s+(?:our\\s+|the\\s+|all\\s+)?(.+?)${STOP_AFTER}`, 'i');
const ROLE_PHRASE = new RegExp(`\\b((?:${LEVEL_WORDS}\\s+)*(?:[A-Za-z&]+\\s+){0,2}?${ROLE_WORDS}(?:\\s+of\\s+[A-Z][\\w&]*(?:\\s+(?:and\\s+)?[A-Z][\\w&]*){0,3})?)`, 'i');
/** A brief that opens with who it is for: "Newly appointed VPs at a regional healthcare system ...". */
const LEADS_WITH = new RegExp(`^((?:${LEVEL_WORDS}\\s+)*(?:[A-Za-z&]+\\s+){0,2}?${ROLE_WORDS})(?=\\s+(?:at|in|from|who|across|with|of)\\b)`, 'i');
const LEVEL_ONLY = new RegExp(`^(?:(?:${LEVEL_WORDS}|people)\\s+)*${ROLE_WORDS}$`, 'i');

/** The participants a sentence names: "participants are X", "a simulation for X", else a role phrase with "of". */
export function participantsIn(text: string): string | undefined {
  const m = text.match(EXPLICIT) ?? text.match(FOR_WHOM);
  let p = m?.[1];
  if (!p) {
    const r = text.match(ROLE_PHRASE);
    if (r && /\bof\s+[A-Z]/.test(r[1])) p = r[1];
    else p = text.trim().match(LEADS_WITH)?.[1];
  }
  if (!p) return undefined;
  const out = tidy(p.replace(/^(?:a|an|the|our|their)\s+/i, ''));
  return out && out.split(/\s+/).length <= 10 ? cap(out).slice(0, 120) : undefined;
}

/** Participants named by level only ("Senior managers", "VPs"): who they lead is missing (D147). */
export function levelOnly(participants: string): boolean {
  return LEVEL_ONLY.test(participants.trim()) && !ROLE_LEVELS.some(r => r.label.toLowerCase() === participants.trim().toLowerCase());
}

/* -------------------------------------------------------------------------------------------- *
 * Industry, organisations, region
 * -------------------------------------------------------------------------------------------- */

/** Phrases that name one industry though their words point at two ("health insurer" is healthcare, not banking). */
const COMPOUNDS: Array<[RegExp, string]> = [
  [/\bhealth\s*(?:care\s+)?(?:insur\w*|plans?|payers?)\b/gi, 'healthcare'],
  [/\b(?:retail|commercial|investment|private|business)\s+bank\w*/gi, 'banking'],
  [/\b(?:software|tech|technology|saas)\s+(?:sales|company|firm|vendor)\b/gi, 'technology']
];
/** Keywords that also appear in other contexts ("one platform", "the plant"): they count half. */
const WEAK = /^(?:platform|plant|engineering|store|stores|consumer|audit|legal|advisory|drug|cloud|digital)$/i;

/** The industries a text names, strongest first, each with a score (a clear keyword counts 2, a weak one 1). */
export function industriesIn(text: string): Array<{ industry: Industry; score: number }> {
  let t = text;
  const score = new Map<string, number>();
  for (const [re, id] of COMPOUNDS) {
    const n = [...t.matchAll(re)].length;
    if (n) { score.set(id, (score.get(id) ?? 0) + 3 * n); t = t.replace(re, ' '); }
  }
  for (const i of INDUSTRIES) {
    for (const m of t.matchAll(new RegExp(i.keywords.source, 'gi'))) score.set(i.id, (score.get(i.id) ?? 0) + (WEAK.test(m[0]) ? 1 : 2));
  }
  return INDUSTRIES.filter(i => score.has(i.id)).map(i => ({ industry: i, score: score.get(i.id)! })).sort((a, b) => b.score - a.score);
}

/** One industry when the text clearly points at one; `ambiguous` with the candidates when two are close. */
export function industryOfText(text: string): { industry?: Industry; ambiguous?: Industry[] } {
  const found = industriesIn(text);
  if (!found.length) return {};
  if (found.length === 1 || found[0].score >= 2 * found[1].score) return { industry: found[0].industry };
  return { ambiguous: found.filter(f => f.score * 2 > found[0].score).slice(0, 4).map(f => f.industry) };
}

const ORG = '([A-Z][\\w&\'.-]*(?:\\s+(?:of|and|&|for|the)\\s+[A-Z][\\w&\'.-]*|\\s+[A-Z][\\w&\'.-]*){0,4})';
const ORG_NOUN = '(?:insurer|insurance\\s+company|bank|lender|hospital|health\\s+system|health\\s+network|clinic|company|firm|provider|manufacturer|maker|retailer|group|network|consultancy|organi[sz]ation|business|carrier|chain|brand|agency|operator|telco|start\\s?up|scale\\s?up|plc|enterprise|corporation|conglomerate|utility|distributor|wholesaler)';
const NOT_ORG = /^(?:The|Our|Their|A|An|This|That|These|Each|Every|We|I|They|It|Head|Heads|VP|VPs|SVP|EVP|Director|Directors|Manager|Managers|Senior|Junior|Key|Objectives?|Goals?|Dilemmas?|Stakeholders?|Participants?|Use|Using|Each|Run|Tone|Challenge|Client|Company|Business|Monday|Tuesday|Wednesday|Thursday|Friday|January|February|March|April|May|June|July|August|September|October|November|December|US|USA|UK|UAE|India|Singapore|Australia|America|Europe|Asia|APAC|EMEA|Customer|Customers|Sales|Service|Operations|Leadership|HR|CEO|COO|CFO|CTO|CIO|CHRO)$/;

function cleanOrg(raw: string): string | undefined {
  const words = raw.trim().replace(/[.,;:]+$/, '').split(/\s+/);
  while (words.length && (NOT_ORG.test(words[0]) || /^(?:of|and|&|for|the)$/i.test(words[0]))) words.shift();
  while (words.length && /^(?:of|and|&|for|the)$/i.test(words[words.length - 1])) words.pop();
  const name = words.join(' ');
  return name && !NOT_ORG.test(name) ? name.slice(0, 60) : undefined;
}

/** Organisations a merger or partnership names as the other side: never the client. */
function partnersIn(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(new RegExp(`\\b(?:merg\\w*|combin\\w*|integrat\\w*|partner\\w*|acquir\\w*|acquisition\\s+of)\\s+(?:with\\s+|by\\s+)?(?:its\\s+|their\\s+|our\\s+|a\\s+)?(?:partner\\s+company|partner|rival|competitor)?,?\\s*${ORG}`, 'g'))) {
    const o = cleanOrg(m[1]);
    if (o) out.push(o);
  }
  return out;
}

/** The client a brief names: a labelled line, "the client is X", "X, a US health insurer", or "at X". Never invented. */
export function clientIn(text: string, people: readonly string[] = []): string | undefined {
  const labelled = text.match(/^\s*(?:client|company|organi[sz]ation|customer)(?:\s+name)?\s*[:=]\s*(.+)$/im);
  if (labelled) return cleanOrg(labelled[1]) ?? tidy(labelled[1]).slice(0, 60);
  const partners = new Set(partnersIn(text).map(p => p.toLowerCase()));
  const ok = (o: string | undefined): o is string => !!o && !partners.has(o.toLowerCase()) && !people.some(p => p.toLowerCase() === o.toLowerCase());
  const tries: RegExp[] = [
    new RegExp(`\\b(?:client|company|organi[sz]ation|employer)\\s+(?:is|will\\s+be|called|named)\\s+${ORG}`, 'g'),
    new RegExp(`${ORG},\\s+(?:a|an|the)\\s+(?:[\\w-]+\\s+){0,4}?${ORG_NOUN}\\b`, 'g'),
    new RegExp(`\\b(?:at|for|from)\\s+${ORG}(?=,|\\s+(?:a|an|the|which|who|in|that|is|has)\\b|\\.|$)`, 'g')
  ];
  for (const re of tries) {
    for (const m of text.matchAll(re)) {
      const o = cleanOrg(m[1]);
      if (ok(o) && !ROLE_HEAD.test(o)) return o;
    }
  }
  return undefined;
}
const ROLE_HEAD = new RegExp(`^${ROLE_WORDS}\\b`, 'i');

/** The region a text names; "US" only in capitals, so "us" the word never counts. */
export function regionIn(text: string): (typeof REGIONS)[number] | undefined {
  if (/(?<![\w.])U\.?S\.?(?:A\.?)?(?![\w])/.test(text)) return REGIONS.find(r => r.id === 'us');
  return REGIONS.find(x => x.id !== 'global' && x.keywords.test(text));
}

/* -------------------------------------------------------------------------------------------- *
 * Team size, challenge, tone, run length, framework
 * -------------------------------------------------------------------------------------------- */

const SIZE_WORD = '(\\d{1,3}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|twenty|thirty)';
const SIZE_PATTERNS = [
  new RegExp(`\\bteams?\\s+of\\s+(?:about\\s+|around\\s+|roughly\\s+|up\\s+to\\s+|some\\s+)?${SIZE_WORD}\\b`, 'gi'),
  new RegExp(`\\b${SIZE_WORD}\\s+(?:direct\\s+reports|reports|people|team\\s+members|staff|employees)\\b`, 'gi'),
  new RegExp(`\\bteam\\s*size\\s*(?:is|of|:|=)?\\s*${SIZE_WORD}\\b`, 'gi'),
  new RegExp(`\\b${SIZE_WORD}[- ](?:person|people|strong)\\s+teams?\\b`, 'gi')
];
const VAGUE_TEAM = /\bteams?\s+of\s+(?:a\s+few|several|some|a\s+handful|many)\b|\b(?:a\s+few|several|a\s+handful\s+of)\s+(?:direct\s+reports|reports|people)\b/i;

/** Team sizes the text states, in order, without repeats. */
export function teamSizesIn(text: string): number[] {
  const found: Array<[number, number]> = [];
  for (const re of SIZE_PATTERNS) for (const m of text.matchAll(re)) { const n = numberOf(m[1]); if (n !== null) found.push([m.index ?? 0, n]); }
  return [...new Set(found.sort((a, b) => a[0] - b[0]).map(f => f[1]))];
}

const SIZE_CHOICES: ChipOf[] = [6, 8, 10, 12].map(n => ({ label: String(n), value: String(n) }));
export const SIZE_PROMPT = 'How many people? iLead teams have 6 to 12. Pick 6 for a small team, 8 or 10 for a typical one, or 12 for a large one.';

function challengeIn(all: string[]): string | undefined {
  for (const s of all) {
    const labelled = s.match(/^\s*(?:the\s+)?(?:main\s+|key\s+|business\s+|big(?:gest)?\s+)?challenge\s*(?:is|:|=|will\s+be|we\s+face\s+is)\s*(?:that\s+)?(.+)$/i)
      ?? s.match(/\bthe\s+(?:main\s+|key\s+|business\s+|big(?:gest)?\s+)?challenge\s+(?:is|will\s+be)\s+(?:that\s+)?(.+)$/i);
    if (labelled) return cap(tidy(labelled[1])).slice(0, 400);
  }
  const s = all.find(x => /\b(?:struggl\w*|challenge|pressure|facing|problem|need\s+to|must|have\s+to|difficult|stall\w*|miss\w*\s+(?:targets?|deadlines?))\b/i.test(x)
    && !/\b(?:stakeholders?|objectives?|goals?|dilemmas?|tone|framework|participants)\b/i.test(x));
  return s ? tidy(s).slice(0, 400) : undefined;
}

const TONE_RULES: Array<[RegExp, 'professional' | 'warm' | 'direct']> = [
  [/\b(?:serious|realistic|professional|formal|high[- ]stakes|business[- ]like|grounded)\b/i, 'professional'],
  [/\b(?:warm|encouraging|supportive|friendly|light[- ]?hearted|gentle|positive)\b/i, 'warm'],
  [/\b(?:direct|brisk|blunt|punchy|no[- ]nonsense|crisp)\b/i, 'direct']
];
function toneIn(all: string[]): { tone: 'professional' | 'warm' | 'direct'; words: string } | undefined {
  for (const s of all) {
    if (!/\b(?:tone|feel|voice|keep\s+it|should\s+(?:be|sound|feel))\b/i.test(s)) continue;
    let best: { tone: 'professional' | 'warm' | 'direct'; at: number } | null = null;
    for (const [re, tone] of TONE_RULES) { const m = s.match(re); if (m && (best === null || (m.index ?? 0) < best.at)) best = { tone, at: m.index ?? 0 }; }
    if (best) {
      const words = s.match(/\b(?:tone|feel|voice)\b[^.]*?\b(?:be|is|:|sound|feel)\s+(.+?)[.!]?$/i)?.[1];
      return { tone: best.tone, words: tidy(words ?? '') };
    }
  }
  return undefined;
}

function durationIn(all: string[]): Brief['duration'] {
  for (const s of all) {
    const labelled = s.match(/\b(?:run\s+length|duration|play\s+mode)\s*[:=]?\s*(full|standard|lite)\b/i);
    if (labelled) return labelled[1].toLowerCase() as Brief['duration'];
    if (!/\b(?:run|runs|duration|minutes?|mins?|hours?|sittings?|sessions?|weeks?|long|take)\b/i.test(s)) continue;
    if (/\b(?:two|2)\s+sittings\b|\b100\s*min\w*|\b(?:two|2)\s+hours?\b/i.test(s)) return 'full';
    if (/\bhalf\s+an\s+hour\b|\b(?:30|thirty|35)\s*min\w*|\b(?:4|four)\s+weeks?\b/i.test(s)) return 'lite';
    if (/\b(?:about|around|roughly|under|within)?\s*(?:an|one|1)\s+hour\b|\b(?:60|65|70|75)\s*(?:to\s*\d+\s*)?min\w*/i.test(s)) return 'standard';
  }
  return undefined;
}

const FRAMEWORK_RX = [
  /\b(?:use|uses|using|apply|our|their|its|the)\s+(?:own\s+)?(?:client'?s?\s+)?([A-Z][\w&-]*(?:\s+[A-Z][\w&-]*){0,3})\s+(?:leadership\s+)?(?:framework|model|competency\s+model|capability\s+model|behaviou?rs)\b\s*(?:\(|:|,?\s*(?:with|of|covering|which\s+(?:has|covers)|made\s+up\s+of)\s+)\s*([^.;)]*)/,
  /\bframework\s+(?:called|named)\s+(?:the\s+)?([A-Z][\w&-]*(?:\s+[A-Z][\w&-]*){0,3})\s*(?:\(|:|,?\s*(?:with|of|covering)\s+)\s*([^.;)]*)/
];

/** A framework named in a sentence: "our LEAD framework: Listen, Empower, Align, Deliver". Skills only, no behaviours. */
export function inlineFramework(text: string): { name: string; skills: string[]; source: string } | null {
  for (const s of sentences(text)) {
    for (const re of FRAMEWORK_RX) {
      const m = s.match(re);
      if (!m) continue;
      const skills = m[2].split(/,\s*(?:and\s+)?|\s+and\s+/).map(tidy).filter(x => x && x.split(/\s+/).length <= 4).map(cap);
      if (skills.length >= 2 && skills.length <= 10) return { name: m[1].trim(), skills, source: s.trim() };
    }
  }
  return null;
}

/** A client framework's skills: headings and bullets when the text has them (extract.ts), else one named in a sentence. */
export function frameworkOf(text: string): FrameworkDimension[] {
  const dims = extractFramework(text);
  if (dims.length) return dims;
  const inline = inlineFramework(text);
  return inline ? inline.skills.map(name => ({ name, behaviours: [], levels: [] })) : [];
}

/* -------------------------------------------------------------------------------------------- *
 * Stakeholders, objectives, dilemmas
 * -------------------------------------------------------------------------------------------- */

const NAME = '([A-Z][a-z\'’-]+(?:\\s+[A-Z][a-z\'’-]+){1,2})';
const STAKE_ROLE = /\b(?:ceo|coo|cfo|cto|cio|chro|cmo|chief|president|vp|svp|evp|director|head|manager|lead|partner|representative|rep|officer|chair|board|sponsor|business\s+partner|counsel|steward|regulator|client|customer|investor|supplier|founder|owner)\b/i;
const RELATIONS: Array<[RegExp, string]> = [
  [/\b(?:boss|line\s+manager|reports?\s+to|their\s+manager)\b/i, 'boss'],
  [/\bsponsor\b/i, 'sponsor'],
  [/\b(?:peer|counterpart|colleague)\b/i, 'peer'],
  [/\bunion\b/i, 'union'],
  [/\bboard\b/i, 'board'],
  [/\bregulator\b/i, 'regulator'],
  [/\b(?:client|customer|account)\b/i, 'client'],
  [/\b(?:hr|human\s+resources|people\s+partner)\b/i, 'HR partner'],
  [/\b(?:ceo|coo|cfo|cto|cio|chro|cmo|chief|president|svp|evp)\b/i, 'senior leader'],
  [/\bpartner\b/i, 'partner']
];

function stakeholderFrom(item: string): Stakeholder | null {
  const t = tidy(item.trim().replace(/^(?:and|plus|also)\s+/i, ''));
  if (!t) return null;
  let name = '', role = '';
  let m = t.match(new RegExp(`^${NAME}\\s*(?:,|\\(|\\s+[-–]\\s+|\\s+who\\s+is|\\s+is)\\s*(.+)$`));
  if (m) { name = m[1]; role = m[2]; } else if ((m = t.match(new RegExp(`^(.+?),?\\s+${NAME}$`))) && STAKE_ROLE.test(m[1])) { role = m[1]; name = m[2]; } else if (STAKE_ROLE.test(t) && t.split(/\s+/).length <= 8) { role = t; } else return null;
  if (!STAKE_ROLE.test(role) && !RELATIONS.some(([re]) => re.test(role))) return null;
  const explicit = role.match(/(?:,|\s+and)\s+(?:their|the\s+participants?'?s?|his|her|your|a|an|the)\s+(boss|line\s+manager|manager|sponsor|peer|counterpart|colleague|mentor)\b/i);
  let relation = explicit ? explicit[1].toLowerCase().replace(/line\s+manager|manager/, 'boss') : '';
  if (explicit) role = role.slice(0, explicit.index);
  role = tidy(role.replace(/\)$/, '').replace(/^(?:the|their|our|a|an|is|who\s+is)\s+/i, ''));
  if (!relation) relation = RELATIONS.find(([re]) => re.test(role))?.[1] ?? 'stakeholder';
  return { name: name.slice(0, 120), role: role.slice(0, 200), relation };
}

/** People outside the team the brief names, from a "stakeholders" sentence and from "Name, the COO" anywhere. */
export function stakeholdersIn(text: string): Stakeholder[] {
  const out: Stakeholder[] = [];
  const add = (s: Stakeholder | null) => { if (s && !out.some(o => (o.name && o.name === s.name) || (!o.name && !s.name && o.role === s.role))) out.push(s); };
  for (const s of sentences(text)) {
    const seg = s.match(/\bstakeholders?\b[^:]*?(?::|\b(?:are|include|includes|including|will\s+be)\b)\s*(.+)$/i);
    if (!seg) continue;
    const items = seg[1].includes(';') ? seg[1].split(/;/) : seg[1].split(/,\s*(?:and\s+)?(?=[A-Z])|\s+and\s+(?=[A-Z][a-z]+\s+[A-Z])/);
    for (const i of items) add(stakeholderFrom(i));
  }
  for (const m of text.matchAll(new RegExp(`${NAME},\\s+(?:the|their|our)\\s+([A-Za-z][\\w ]{1,40}?)(?=[,.;)]|\\s+and\\b|$)`, 'g'))) {
    if (STAKE_ROLE.test(m[2])) add(stakeholderFrom(`${m[1]}, ${m[2]}`));
  }
  return out.slice(0, 20);
}

/** What the programme must achieve: an "Objectives:" or "goals are" list, or "should learn to". */
export function objectivesIn(text: string): string[] {
  for (const s of sentences(text)) {
    const m = s.match(/\b(?:objectives?|goals?|aims?|(?:learning\s+)?outcomes?)\b[^:]*?(?::|\b(?:are|is|include|includes)\b)\s*(?:to\s+)?(.+)$/i)
      ?? s.match(/\b(?:should|must|need\s+to)\s+(?:learn|be\s+able)\s+to\s+(.+)$/i);
    if (!m || /\bdilemmas?\b|\bstakeholders?\b/i.test(s)) continue;
    const items = (m[1].includes(';') ? m[1].split(/;/) : m[1].split(/,\s*(?:and\s+)?/)).map(x => tidy(x.replace(/^(?:to|and)\s+/i, ''))).filter(x => x.split(/\s+/).length >= 2);
    if (items.length) return items.slice(0, 12).map(x => cap(x).slice(0, 400));
  }
  return [];
}

function dilemmaFrom(item: string, stake = ''): Dilemma | null {
  const t = tidy(item.trim().replace(/^(?:and|or)\s+/i, ''));
  const m = t.match(/^(?:between\s+)?(.+?)\s+(?:vs\.?|versus|against)\s+(.+)$/i) ?? t.match(/^between\s+(.+?)\s+and\s+(.+)$/i) ?? t.match(/^(.+?)\s+or\s+(.+)$/i);
  if (!m) return null;
  // Participant ready words (a choice event may show them): "short-term" reads "short term".
  const words = (x: string) => tidy(x).replace(/(\p{L})-(?=\p{L})/gu, '$1 ');
  const a = words(m[1]), b = words(m[2]);
  if (!a || !b || a.split(/\s+/).length > 10 || b.split(/\s+/).length > 10) return null;
  return { title: `${cap(a)} or ${b.charAt(0).toLowerCase() + b.slice(1)}`.slice(0, 200), a: cap(a).slice(0, 200), b: cap(b).slice(0, 200), stake: stake.slice(0, 400) };
}

/** The dilemmas a brief names, as choices: "X vs Y", "between X and Y", or a "dilemmas:" list with "or". */
export function dilemmasIn(text: string): Dilemma[] {
  const out: Dilemma[] = [];
  const add = (d: Dilemma | null) => { if (d && !out.some(o => o.title.toLowerCase() === d.title.toLowerCase())) out.push(d); };
  for (const s of sentences(text)) {
    const seg = s.match(/\b(?:dilemmas?|trade[- ]?offs?|tensions?)\b[^:]*?(?::|\b(?:are|include|includes|such\s+as|like)\b)\s*(.+)$/i);
    if (seg) {
      const stake = seg[1].match(/\(\s*(?:at\s+stake|stake)\s*:\s*([^)]+)\)/i)?.[1] ?? '';
      const items = seg[1].replace(/\([^)]*\)/g, '').split(/;|,\s*(?:and\s+)?/);
      for (const i of items) add(dilemmaFrom(i, tidy(stake)));
      continue;
    }
    for (const m of s.matchAll(/\b((?:[\w'-]+\s+){0,3}[\w'-]+)\s+(?:vs\.?|versus)\s+((?:[\w'-]+\s+){0,3}[\w'-]+)/gi)) add(dilemmaFrom(`${m[1]} vs ${m[2]}`));
    const between = s.match(/\b(?:torn|choose|choosing|balance|balancing)\s+between\s+(.+?)\s+and\s+(.+?)(?:[,.;]|$)/i);
    if (between) add(dilemmaFrom(`${between[1]} vs ${between[2]}`));
  }
  return out.slice(0, 12);
}

/* -------------------------------------------------------------------------------------------- *
 * The whole reading
 * -------------------------------------------------------------------------------------------- */

const industryChips = (list: Industry[]): ChipOf[] => list.map(i => ({ label: i.label, value: i.label }));

/** Which industry, when a text names two: the candidates as choices. */
export function industryClarify(list: Industry[]): Clarify {
  return { id: 'industry', prompt: `You mention ${list.map(i => i.label).join(' and ')}. Which industry should the story be set in?`, choices: industryChips(list) };
}

/** Which team size, when the text states two, or one outside 6 to 12, or "a few". */
export function sizeClarify(sizes: number[]): Clarify {
  const ok = sizes.filter(n => n >= 6 && n <= 12);
  if (sizes.length > 1 && ok.length >= 2) return { id: 'team_size', prompt: `You mention teams of ${sizes.join(' and ')}. Which size should the participant's team be?`, choices: ok.slice(0, 4).map(n => ({ label: String(n), value: String(n) })) };
  if (sizes.length && !ok.length) return { id: 'team_size', prompt: `iLead teams have 6 to 12 people, so ${sizes[0]} cannot play as it is. Which size should the participant's team be?`, choices: SIZE_CHOICES };
  return { id: 'team_size', prompt: SIZE_PROMPT, choices: SIZE_CHOICES };
}

/** Everything a long answer or an upload states. Fields `known` already has are left out. */
export function readBrief(text: string, known: Brief): Reading {
  const all = sentences(text);
  const fields: Partial<Brief> = {};
  let clarify: Clarify | undefined;
  const ask = (c: Clarify) => { clarify ??= c; };

  const people = stakeholdersIn(text);
  if (!known.roleLevel) { const p = participantsIn(text); if (p) fields.roleLevel = p; }
  if (!known.industry) {
    const ind = industryOfText(text);
    if (ind.industry) fields.industry = ind.industry.label;
    else if (ind.ambiguous) ask(industryClarify(ind.ambiguous));
  }
  if (known.client === undefined) { const c = clientIn(text, people.map(p => p.name).filter(Boolean)); if (c) fields.client = c; }
  if (!known.challenge) { const c = challengeIn(all); if (c) fields.challenge = c; }
  if (known.teamSize === undefined) {
    const sizes = teamSizesIn(text);
    if (sizes.length === 1 && sizes[0] >= 6 && sizes[0] <= 12) fields.teamSize = sizes[0];
    else if (sizes.length) ask(sizeClarify(sizes));
    else if (VAGUE_TEAM.test(text)) ask(sizeClarify([]));
  }
  if (!known.duration) { const d = durationIn(all); if (d) fields.duration = d; }
  if (!known.region) { const r = regionIn(text); if (r) { fields.region = r.id; fields.language = r.label; } }
  if (!known.tone) { const t = toneIn(all); if (t) fields.tone = t.tone; }
  if (known.framework === undefined) {
    if (extractFramework(text).length) fields.framework = text;
    else { const f = inlineFramework(text); if (f) fields.framework = f.source; }
  }
  if (!known.stakeholders?.length && people.length) fields.stakeholders = people;
  if (!known.objectives?.length) { const o = objectivesIn(text); if (o.length) fields.objectives = o; }
  if (!known.dilemmas?.length) { const d = dilemmasIn(text); if (d.length) fields.dilemmas = d; }
  return clarify ? { fields, clarify } : { fields };
}

const LABELS: Record<TookId, string> = {
  role_level: 'Participants', industry: 'Industry', client: 'Client', challenge: 'Challenge', team_size: 'Team size', process: 'Work process',
  duration: 'Run length', language: 'Language and region', framework: 'Framework', tone: 'Tone', stakeholders: 'Stakeholders', objectives: 'Objectives', dilemmas: 'Dilemmas'
};
export const tookLabel = (id: TookId) => LABELS[id];

/** What changed between two briefs, as the chat says it back: one line per field, in the question order. */
export function tookFrom(before: Brief, after: Brief): TookItem[] {
  const out: TookItem[] = [];
  const add = (id: TookId, value: string) => out.push({ id, label: LABELS[id], value });
  if (!before.roleLevel && after.roleLevel) add('role_level', after.roleLevel);
  if (!before.industry && after.industry) add('industry', after.industry);
  if (before.client === undefined && after.client) add('client', after.client);
  if (!before.challenge && after.challenge) add('challenge', after.challenge);
  if (before.teamSize === undefined && after.teamSize !== undefined) add('team_size', `${after.teamSize} people`);
  if (!before.process && after.process) add('process', after.process.join(', '));
  if (!before.duration && after.duration) add('duration', `${DURATION_MODES[after.duration].label}, ${DURATION_MODES[after.duration].detail}`);
  if (!before.region && after.region) add('language', after.language ?? after.region);
  if (before.framework === undefined && after.framework) {
    const inline = inlineFramework(after.framework);
    const dims = frameworkOf(after.framework);
    add('framework', inline ? `${inline.name}: ${inline.skills.join(', ')}` : dims.length ? dims.map(d => d.name).join(', ') : 'Shared');
  }
  if (!before.tone && after.tone) add('tone', TONE_LABELS[after.tone]);
  if (!before.stakeholders?.length && after.stakeholders?.length) add('stakeholders', after.stakeholders.map(stakeholderText).join('; '));
  if (!before.objectives?.length && after.objectives?.length) add('objectives', after.objectives.join('; '));
  if (!before.dilemmas?.length && after.dilemmas?.length) add('dilemmas', after.dilemmas.map(d => d.title).join('; '));
  return out;
}

/** "Dana Whitfield (COO, boss)": the relation only when the role does not already say it. */
export function stakeholderText(s: Stakeholder): string {
  const relation = s.relation && s.relation !== 'stakeholder' && !s.role.toLowerCase().includes(s.relation.split(' ')[0].toLowerCase()) ? s.relation : '';
  const about = [s.role, relation].filter(Boolean).join(', ');
  return s.name ? (about ? `${s.name} (${about})` : s.name) : about;
}

/** Fills the fields a reading found that the brief does not have yet. */
export function fillBrief(brief: Brief, fields: Partial<Brief>): Brief {
  const next: Brief = { ...brief, documents: [...brief.documents] };
  for (const [k, v] of Object.entries(fields) as Array<[keyof Brief, unknown]>) {
    if (v === undefined) continue;
    const cur = next[k];
    if (cur === undefined || (Array.isArray(cur) && !cur.length && k !== 'documents')) (next as Record<string, unknown>)[k] = v;
  }
  return next;
}
