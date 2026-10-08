import { z } from 'zod';
import { ActionDraft, AuthorDraft, Character, ChoiceOptionDraft, ClauseDraft, DraftStyle, EventDraft, EventFields, MAX_DAYS, MAX_WEEKS, MIN_DAYS, MIN_WEEKS, SHORT_MAX, TEXT_MAX, type Tab } from './draft';
import { flagsSet } from './choices';
import { fitRun, type Moved } from './run';
import { parseEffect } from './seed';

/**
 * Kora's edits as data (D125). Every change Kora proposes, from the offline rules or from the model, is a
 * list of operations on the draft: `set` one whitelisted field, or add or remove a character. Nothing else
 * can change, so an instruction can never be pasted into the content. Each `set` path names one field by
 * the keys the draft already uses (`events.budget_cut.within`, `team.priya.persona`,
 * `actions.f2f.impact.coach.fit`, `events.budget_cut.ifIgnored.followUp`); its value is parsed with the draft
 * schema's own field before it is shown, and the whole draft is parsed again after the change. The model sees
 * only the whitelisted fields of the section it is editing (`editView`), and may only set paths it was shown.
 *
 * Events are structured (D128): who answers them (`respondWith`, action keys), the days to answer (`within`),
 * and what follows when nobody does (`ifIgnored.sponsor`, `ifIgnored.followUp`, an event key). A follow up
 * must name an event that exists (or one the same change adds), and a response an action of the draft.
 * Setting the run's weeks or days goes through `fitRun` (run.ts), the same remapping the Brief and Work
 * process tabs use, so events, random windows and action unlocks move with it and the diff says what moved.
 */

export type EditOp =
  | { op: 'set'; path: string; value: unknown }
  | { op: 'addCharacter'; value: Character }
  | { op: 'removeCharacter'; id: string }
  /** A new event (the offline rules' "If ignored" follow up); the model cannot add one. */
  | { op: 'addEvent'; value: EventDraft };

/** One row of the structured diff the panel shows. */
export interface Change { path: string; field: string; before: string; after: string }

const Short = z.string().max(SHORT_MAX);
const Text = z.string().max(TEXT_MAX);
/** An impact cell or an option's effect: words the export reads back to numbers ("Skill +4, result −2"). */
const Effect = Short.refine(v => parseEffect(v) !== null, 'An effect names skill, morale or result with a number, or says No change');

const co = ChoiceOptionDraft.shape;
const ev = EventFields.shape, ch = Character.shape, ac = ActionDraft.shape, st = DraftStyle.shape, br = AuthorDraft.shape.brief.shape, pr = AuthorDraft.shape.process.shape;
const stage = pr.stages.element.shape;
const story = AuthorDraft.shape.story.shape;

const KEY = '([a-z][a-z0-9_]*)';
const STYLE = '([A-Za-z][A-Za-z0-9_]{0,15})';
const OPT = '([A-Za-z0-9_]+)';

interface Rule {
  re: RegExp;
  schema: z.ZodType;
  /** The provenance mark this field belongs to (draft.ts `marks`). */
  mark(m: RegExpMatchArray): string;
}

const TEAM_MARK: Record<string, string> = { first: 'identity', last: 'identity', title: 'identity', persona: 'persona', hiddenConcern: 'hiddenConcern', concernLine: 'hiddenConcern', motivatedBy: 'personality', careerGoal: 'stats', stats: 'stats' };
const same = (m: RegExpMatchArray) => m[0];

/** Every field Kora may set. A path that matches none of these is refused. */
const RULES: Rule[] = [
  { re: /^title$/, schema: AuthorDraft.shape.title, mark: same },
  { re: /^brief\.(participants|challenge)$/, schema: Text, mark: same },
  { re: /^brief\.run$/, schema: br.run, mark: same },
  { re: /^brief\.tones$/, schema: br.tones.max(3), mark: same },
  { re: /^story\.company\.(name|hq|team|office)$/, schema: story.company.shape.name, mark: same },
  { re: /^story\.company\.about$/, schema: story.company.shape.about, mark: same },
  { re: /^story\.product\.name$/, schema: story.product.shape.name, mark: same },
  { re: /^story\.product\.oneLine$/, schema: story.product.shape.oneLine, mark: same },
  { re: /^story\.product\.points$/, schema: story.product.shape.points.max(6), mark: same },
  { re: /^story\.market\.customers$/, schema: story.market.shape.customers, mark: () => 'story.market.rivals' },
  { re: /^story\.sponsor\.(name|title|voice)$/, schema: story.sponsor.shape.name, mark: same },
  { re: new RegExp(`^story\\.screens\\.${KEY}\\.body$`), schema: Text, mark: m => `story.screens.${m[1]}` },
  { re: /^process\.revenue$/, schema: z.number().positive().max(1e12), mark: same },
  { re: /^process\.weeks$/, schema: z.number().int().min(MIN_WEEKS).max(MAX_WEEKS), mark: same },
  { re: /^process\.daysPerWeek$/, schema: z.number().int().min(MIN_DAYS).max(MAX_DAYS), mark: same },
  { re: /^process\.pacing$/, schema: pr.pacing, mark: same },
  { re: new RegExp(`^process\\.stages\\.${KEY}\\.perWeek$`), schema: stage.perWeek.max(100000), mark: () => 'process.stages' },
  { re: new RegExp(`^process\\.stages\\.${KEY}\\.passesOn$`), schema: stage.passesOn, mark: () => 'process.stages' },
  { re: new RegExp(`^process\\.stages\\.${KEY}\\.people$`), schema: stage.people, mark: () => 'process.stages' },
  { re: new RegExp(`^team\\.${KEY}\\.(first|last|title)$`), schema: ch.first, mark: m => `team.${m[1]}.${TEAM_MARK[m[2]]}` },
  { re: new RegExp(`^team\\.${KEY}\\.(persona|hiddenConcern|concernLine|motivatedBy|careerGoal)$`), schema: ch.persona, mark: m => `team.${m[1]}.${TEAM_MARK[m[2]]}` },
  { re: new RegExp(`^team\\.${KEY}\\.stats\\.(skill|morale|result|trust)$`), schema: ch.stats.shape.skill, mark: m => `team.${m[1]}.stats` },
  { re: new RegExp(`^events\\.${KEY}\\.title$`), schema: ev.title, mark: m => `events.${m[1]}` },
  { re: new RegExp(`^events\\.${KEY}\\.body$`), schema: ev.body, mark: m => `events.${m[1]}` },
  { re: new RegExp(`^events\\.${KEY}\\.(skill|morale|result)$`), schema: ev.skill, mark: m => `events.${m[1]}` },
  { re: new RegExp(`^events\\.${KEY}\\.respondWith$`), schema: z.array(z.string().regex(/^[a-z][a-z0-9_]*$/)).max(8), mark: m => `events.${m[1]}` },
  { re: new RegExp(`^events\\.${KEY}\\.within$`), schema: ev.within, mark: m => `events.${m[1]}` },
  { re: new RegExp(`^events\\.${KEY}\\.ifIgnored\\.sponsor$`), schema: z.boolean(), mark: m => `events.${m[1]}` },
  { re: new RegExp(`^events\\.${KEY}\\.ifIgnored\\.followUp$`), schema: z.string().regex(/^[a-z][a-z0-9_]*$/).nullable(), mark: m => `events.${m[1]}` },
  { re: new RegExp(`^events\\.${KEY}\\.week$`), schema: z.number().int().min(1).max(MAX_WEEKS), mark: m => `events.${m[1]}` },
  { re: new RegExp(`^events\\.${KEY}\\.day$`), schema: ev.day, mark: m => `events.${m[1]}` },
  { re: new RegExp(`^events\\.${KEY}\\.window\\.(from|to)$`), schema: z.number().int().min(1).max(MAX_WEEKS), mark: m => `events.${m[1]}` },
  { re: new RegExp(`^events\\.${KEY}\\.window\\.chance$`), schema: z.number().int().min(0).max(100), mark: m => `events.${m[1]}` },
  // Choices and conditions on earlier choices (D137, D138).
  { re: new RegExp(`^events\\.${KEY}\\.ifIgnored\\.afterDays$`), schema: z.number().int().min(0).max(20), mark: m => `events.${m[1]}` },
  { re: new RegExp(`^events\\.${KEY}\\.conditions$`), schema: z.array(ClauseDraft).max(3), mark: m => `events.${m[1]}` },
  { re: new RegExp(`^events\\.${KEY}\\.choice\\.options\\.${KEY}\\.(skill|morale|result|trust|sponsor)$`), schema: co.skill, mark: m => `events.${m[1]}` },
  { re: new RegExp(`^events\\.${KEY}\\.choice\\.options\\.${KEY}\\.revenue$`), schema: co.revenue, mark: m => `events.${m[1]}` },
  { re: new RegExp(`^events\\.${KEY}\\.choice\\.options\\.${KEY}\\.variables\\.${KEY}$`), schema: z.number().min(-1e9).max(1e9), mark: m => `events.${m[1]}` },
  { re: new RegExp(`^events\\.${KEY}\\.choice\\.options\\.${KEY}\\.(set|clear)$`), schema: co.set, mark: m => `events.${m[1]}` },
  { re: new RegExp(`^events\\.${KEY}\\.choice\\.options\\.${KEY}\\.followUp$`), schema: co.followUp, mark: m => `events.${m[1]}` },
  { re: new RegExp(`^events\\.${KEY}\\.choice\\.options\\.${KEY}\\.(label|outcome)$`), schema: co.outcome, mark: m => `events.${m[1]}` },
  { re: new RegExp(`^actions\\.${KEY}\\.(description|goal)$`), schema: ac.description, mark: m => `actions.${m[1]}` },
  { re: new RegExp(`^actions\\.${KEY}\\.cost$`), schema: ac.cost, mark: m => `actions.${m[1]}` },
  { re: new RegExp(`^actions\\.${KEY}\\.againAfter$`), schema: ac.againAfter, mark: m => `actions.${m[1]}` },
  { re: new RegExp(`^actions\\.${KEY}\\.availableFrom$`), schema: z.number().int().min(1).max(MAX_WEEKS), mark: m => `actions.${m[1]}` },
  { re: new RegExp(`^actions\\.${KEY}\\.impact\\.${STYLE}\\.(fit|close|wrong)$`), schema: Effect, mark: m => `actions.${m[1]}` },
  { re: new RegExp(`^actions\\.${KEY}\\.options\\.${OPT}\\.(fits|misses)$`), schema: Effect, mark: m => `actions.${m[1]}` },
  { re: new RegExp(`^actions\\.${KEY}\\.options\\.${OPT}\\.label$`), schema: Short, mark: m => `actions.${m[1]}` },
  { re: new RegExp(`^actions\\.${KEY}\\.options\\.${OPT}\\.away$`), schema: z.number().int().min(0).max(10), mark: m => `actions.${m[1]}` },
  { re: new RegExp(`^lens\\.styles\\.${STYLE}\\.(name|short)$`), schema: st.name, mark: m => `lens.styles.${m[1]}` },
  { re: new RegExp(`^lens\\.styles\\.${STYLE}\\.description$`), schema: st.description, mark: m => `lens.styles.${m[1]}` }
];

/** The rule for a path, or null when Kora may not set it. Needs no draft, so the server checks paths too. */
export function ruleOf(path: string): { schema: z.ZodType; mark: string } | null {
  if (path.length > 200) return null;
  for (const r of RULES) {
    const m = path.match(r.re);
    if (m) return { schema: r.schema, mark: r.mark(m) };
  }
  return null;
}

const EVENT_FIELD: Record<string, string> = {
  title: 'Title', body: 'What participants read', skill: 'Skill impact', morale: 'Morale impact', result: 'Result impact', within: 'Days to respond',
  respondWith: 'What counts as a response', 'ifIgnored.sponsor': 'If ignored, the sponsor hears of it', 'ifIgnored.followUp': 'If ignored, then this event follows',
  week: 'Week', day: 'Day', 'window.from': 'From week', 'window.to': 'To week', 'window.chance': 'Happens in, of 100 runs',
  'ifIgnored.afterDays': 'If ignored, days before the follow up', conditions: 'Plays only if'
};
const OPTION_FIELD: Record<string, string> = { skill: 'skill', morale: 'morale', result: 'result', trust: 'trust', sponsor: 'sponsor confidence', revenue: 'revenue', set: 'sets flags', clear: 'clears flags', followUp: 'then this event follows', label: 'label', outcome: 'what happened' };
const TEAM_FIELD: Record<string, string> = { first: 'First name', last: 'Last name', title: 'Job title', persona: 'Persona', hiddenConcern: 'Hidden concern', concernLine: 'What they say when it comes out', motivatedBy: 'Motivated by', careerGoal: 'Career goal', skill: 'Starting skill', morale: 'Starting morale', result: 'Starting result', trust: 'Starting trust' };
const PLAIN: Record<string, string> = {
  title: 'Simulation title', 'brief.participants': 'Participants', 'brief.challenge': 'Business challenge', 'brief.run': 'Run length', 'brief.tones': 'Tone',
  'story.company.name': 'Company name', 'story.company.hq': 'Headquarters', 'story.company.team': 'Your team', 'story.company.office': 'Office image', 'story.company.about': 'What the company does',
  'story.product.name': 'Product name', 'story.product.oneLine': 'Product in one line', 'story.product.points': 'Selling points', 'story.market.customers': 'Customers',
  'story.sponsor.name': 'Sponsor name', 'story.sponsor.title': 'Sponsor title', 'story.sponsor.voice': 'Sponsor voice',
  'process.revenue': 'Revenue target', 'process.weeks': 'Weeks', 'process.daysPerWeek': 'Days per week', 'process.pacing': 'Pacing'
};
const CELL: Record<string, string> = { fit: 'when it fits', close: 'one step off', wrong: 'when it is wrong', fits: 'if it fits', misses: 'if it misses', label: 'label', away: 'days away' };

interface Loc { get(): unknown; set(v: unknown): void; label: string }

/** Finds a whitelisted path in a draft: its value, a setter and the label the diff shows. Null when absent. */
export function locate(d: AuthorDraft, path: string): Loc | null {
  if (!ruleOf(path)) return null;
  const parts = path.split('.');
  const [head, a, b, c, e] = parts;
  const field = (obj: Record<string, unknown>, k: string, label: string): Loc | null =>
    obj && k in obj ? { get: () => obj[k], set: v => { obj[k] = v; }, label } : null;
  if (path === 'title') return field(d as unknown as Record<string, unknown>, 'title', PLAIN.title);
  if (head === 'brief') return field(d.brief, a, PLAIN[path]);
  if (head === 'story' && a === 'screens') {
    const s = d.story.screens.find(x => x.key === b);
    return s ? field(s, 'body', s.title) : null;
  }
  if (head === 'story') return field((d.story as unknown as Record<string, Record<string, unknown>>)[a], b, PLAIN[path]);
  if (head === 'process' && a === 'stages') {
    const s = d.process.stages.find(x => x.key === b);
    return s ? field(s, c, `${s.name} · ${c === 'perWeek' ? 'Per week' : c === 'passesOn' ? 'Passes on, percent' : 'People'}`) : null;
  }
  if (head === 'process') return field(d.process, a, PLAIN[path]);
  if (head === 'team') {
    const m = d.team.find(x => x.id === a);
    if (!m) return null;
    const who = [m.first, m.last].filter(Boolean).join(' ') || m.id;
    return b === 'stats' ? field(m.stats, c, `${who} · ${TEAM_FIELD[c]}`) : field(m, b, `${who} · ${TEAM_FIELD[b]}`);
  }
  if (head === 'events') {
    const x = d.events.find(y => y.key === a);
    if (!x) return null;
    if (b === 'choice') {
      // events.<key>.choice.options.<option>.<field>[.<variable>]
      const o = x.choice?.options.find(y => y.key === e);
      const f = parts[5], v = parts[6];
      if (!o || c !== 'options') return null;
      const head2 = `${x.title || x.key} · ${short(o.label)}`;
      if (f === 'variables') {
        const vd = d.variables.find(y => y.key === v);
        return vd ? { get: () => o.variables[v] ?? 0, set: val => { o.variables[v] = val as number; }, label: `${head2} · ${vd.name}` } : null;
      }
      return field(o as unknown as Record<string, unknown>, f, `${head2} · ${OPTION_FIELD[f] ?? f}`);
    }
    if (b === 'conditions') return { get: () => x.conditions ?? [], set: v => { x.conditions = v as EventDraft['conditions']; }, label: `${x.title || x.key} · ${EVENT_FIELD.conditions}` };
    if (b === 'ifIgnored' && c === 'afterDays') return { get: () => x.ifIgnored.afterDays ?? 0, set: v => { x.ifIgnored.afterDays = v as number; }, label: `${x.title || x.key} · ${EVENT_FIELD['ifIgnored.afterDays']}` };
    const label = `${x.title || x.key} · ${EVENT_FIELD[c ? `${b}.${c}` : b]}`;
    if (b === 'ifIgnored') return field(x.ifIgnored, c, label);
    if (b === 'window') return x.window ? field(x.window, c, label) : null;
    return field(x, b, label);
  }
  if (head === 'actions') {
    const x = d.actions.find(y => y.key === a);
    if (!x) return null;
    if (b === 'impact') {
      const row = x.impact[c];
      const style = d.lens.styles.find(s => s.key === c);
      return row && style ? field(row, e, `${x.name} · ${style.name} ${CELL[e]}`) : null;
    }
    if (b === 'options') {
      const o = x.options.find(y => y.key === c);
      return o ? field(o, e, `${x.name} · ${short(o.label)} ${CELL[e]}`) : null;
    }
    return field(x, b, `${x.name} · ${b === 'cost' ? 'Time it takes, days' : b === 'againAfter' ? 'Days before it can be used again' : b === 'availableFrom' ? 'Available from week' : b === 'goal' ? 'Goal' : 'Description'}`);
  }
  if (head === 'lens') {
    const s = d.lens.styles.find(x => x.key === b);
    return s ? field(s, c, `${s.name} · ${c === 'name' ? 'Name' : c === 'short' ? 'One line' : 'Description'}`) : null;
  }
  return null;
}

const short = (s: string, n = 40) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

/** A value as the diff shows it: numbers signed where they are effects, lists joined, yes or no, an event by its title. */
export function shown(path: string, v: unknown, d?: AuthorDraft): string {
  if (v === null || v === undefined || v === '') return /\.ifIgnored\.followUp$/.test(path) ? 'None' : '';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (/\.respondWith$/.test(path) && Array.isArray(v)) return v.map(k => (k === 'reply' ? 'Reply to the message' : d?.actions.find(a => a.key === k)?.name ?? k)).join(' or ') || 'None expected';
  if (/\.ifIgnored\.followUp$/.test(path) && typeof v === 'string') return d?.events.find(e => e.key === v)?.title || v;
  if (/\.followUp$/.test(path) && v && typeof v === 'object') { const f = v as { event: string; days: number; weeks: number }; return `${d?.events.find(e => e.key === f.event)?.title || f.event}, ${f.weeks ? `${f.weeks} week${f.weeks === 1 ? '' : 's'}` : ''}${f.weeks && f.days ? ' and ' : ''}${f.days ? `${f.days} day${f.days === 1 ? '' : 's'}` : ''} later`.replace(', later', ', at once'); }
  if (/\.conditions$/.test(path) && Array.isArray(v)) return v.length ? (v as EventDraft['conditions'] & object).map(c => (c.kind === 'flag' ? `${c.is ? '' : 'not '}${c.flag.replace(/_/g, ' ')}` : c.kind === 'variable' ? `${d?.variables.find(x => x.key === c.variable)?.name ?? c.variable} ${c.op === 'below' ? 'below' : 'at least'} ${c.value}` : `${c.metric} ${c.op === 'below' ? 'below' : 'at least'} ${c.value}`)).join(' and ') : 'Always';
  if (Array.isArray(v)) return v.join(', ');
  if (typeof v === 'number') {
    if (/\.(skill|morale|result|trust|sponsor|revenue)$/.test(path) && path.startsWith('events.')) return v > 0 ? `+${v}` : v < 0 ? `−${-v}` : '0';
    if (/\.variables\.[a-z0-9_]+$/.test(path)) return v > 0 ? `+${v}` : v < 0 ? `−${-v}` : '0';
    return path === 'process.revenue' ? v.toLocaleString('en-US') : String(v);
  }
  if (path === 'process.pacing' || path === 'brief.run') return String(v).charAt(0).toUpperCase() + String(v).slice(1);
  return String(v);
}

function characterLine(c: Character): string {
  return `${[c.first, c.last].filter(Boolean).join(' ')}, ${c.title}. ${c.persona}`.trim();
}

const ENGINE_PICKS = 'One person, the engine picks';

/**
 * The diff rows for a list of operations, read against the draft before the change. `after` is the draft
 * after it, so a follow up the same change adds shows by its title; `moved` are what a new run length moved.
 */
export function describeOps(d: AuthorDraft, ops: EditOp[], after: AuthorDraft = d, moved: Moved[] = []): Change[] {
  const out: Change[] = [];
  for (const o of ops) {
    if (o.op === 'set') {
      const loc = locate(d, o.path);
      if (loc) out.push({ path: o.path, field: loc.label, before: shown(o.path, loc.get(), d), after: shown(o.path, o.value, after) });
    } else if (o.op === 'addCharacter') {
      out.push({ path: `team.${o.value.id}`, field: 'New character', before: '', after: characterLine(o.value) });
    } else if (o.op === 'addEvent') {
      out.push({ path: `events.${o.value.key}`, field: 'New event, only when another is ignored', before: '', after: `${o.value.title}. ${o.value.body}`.trim() });
    } else {
      const c = d.team.find(x => x.id === o.id);
      if (!c) continue;
      out.push({ path: `team.${c.id}`, field: 'Remove character', before: characterLine(c), after: '' });
      // Their events are said, never moved silently (D128).
      for (const e of d.events.filter(x => x.who === c.id)) out.push({ path: `events.${e.key}.who`, field: `${e.title || e.key} · Who it hits`, before: [c.first, c.last].filter(Boolean).join(' '), after: ENGINE_PICKS });
    }
  }
  moved.forEach((m, i) => out.push({ path: `moved.${i}`, field: `${m.what} · moves to fit the run`, before: m.from, after: m.to }));
  return out;
}

const CHARACTER_MARKS = ['identity', 'voice', 'persona', 'hiddenConcern', 'personality', 'stats'];

/**
 * Applies operations to a draft (in place) and returns the provenance paths they touched. A new number of
 * weeks or days per week goes through `fitRun`, so everything placed on a week moves with it; what moved is
 * added to `moved` when given.
 */
export function applyOps(d: AuthorDraft, ops: EditOp[], moved?: Moved[]): string[] {
  const marks = new Set<string>();
  for (const o of ops) {
    if (o.op === 'set') {
      const loc = locate(d, o.path);
      if (!loc) continue;
      if (o.path === 'process.weeks' || o.path === 'process.daysPerWeek') {
        const m = fitRun(d, o.path === 'process.weeks' ? Number(o.value) : d.process.weeks, o.path === 'process.daysPerWeek' ? Number(o.value) : d.process.daysPerWeek);
        moved?.push(...m);
      } else loc.set(structuredClone(o.value));
      marks.add(ruleOf(o.path)!.mark);
    } else if (o.op === 'addCharacter') {
      if (d.team.length >= 12 || d.team.some(c => c.id === o.value.id)) continue;
      d.team.push(structuredClone(o.value));
      for (const m of CHARACTER_MARKS) marks.add(`team.${o.value.id}.${m}`);
    } else if (o.op === 'addEvent') {
      if (d.events.some(e => e.key === o.value.key)) continue;
      d.events.push(structuredClone(o.value));
      marks.add(`events.${o.value.key}`);
    } else {
      if (d.team.length <= 1 || !d.team.some(c => c.id === o.id)) continue;
      d.team = d.team.filter(c => c.id !== o.id);
      for (const c of d.team) c.relationships = c.relationships.filter(r => r.with !== o.id);
      for (const e of d.events) if (e.who === o.id) e.who = 'member';
      for (const k of Object.keys(d.marks)) if (k.startsWith(`team.${o.id}.`)) delete d.marks[k];
    }
  }
  return [...marks];
}

export type Checked = { ok: true; ops: EditOp[]; changes: Change[]; marks: string[] } | { ok: false; issues: string[] };

/** References a change may not leave dangling: a follow up that is not an event (or is the event itself), a response that is not an action. */
function referenceIssues(next: AuthorDraft, ops: EditOp[]): string[] {
  const issues: string[] = [];
  const events = new Set(next.events.map(e => e.key));
  const actions = new Set(next.actions.map(a => a.key));
  const flags = flagsSet(next);
  for (const o of ops) {
    if (o.op !== 'set') continue;
    // A follow up from a choice names an event; a condition tests a flag some decision sets, or a variable that exists (D138).
    const fu = o.path.match(/^events\.([a-z][a-z0-9_]*)\.choice\.options\.[a-z][a-z0-9_]*\.followUp$/);
    if (fu && o.value && !events.has((o.value as { event: string }).event)) issues.push(`${o.path}: no event called ${(o.value as { event: string }).event}`);
    if (/\.conditions$/.test(o.path)) for (const c of o.value as NonNullable<EventDraft['conditions']>) {
      if (c.kind === 'flag' && c.is && !flags.has(c.flag)) issues.push(`${o.path}: no decision sets ${c.flag}`);
      if (c.kind === 'variable' && !next.variables.some(v => v.key === c.variable)) issues.push(`${o.path}: no variable called ${c.variable}`);
    }
    const m = o.path.match(/^events\.([a-z][a-z0-9_]*)\.(ifIgnored\.followUp|respondWith)$/);
    if (!m) continue;
    if (m[2] === 'respondWith') {
      for (const k of o.value as string[]) if (k !== 'reply' && !actions.has(k)) issues.push(`${o.path}: no action called ${k}`);
    } else if (typeof o.value === 'string') {
      if (o.value === m[1]) issues.push(`${o.path}: an event cannot follow itself`);
      else if (!events.has(o.value)) issues.push(`${o.path}: no event called ${o.value}`);
    }
  }
  return issues;
}

/**
 * Checks operations against a draft before they are shown: every `set` path is whitelisted (and, when
 * `allowed` is given, one the model was shown), exists in this draft, and its value parses with the
 * draft schema's field; a value equal to the current one is dropped; a follow up or a response names
 * something that exists; and the changed draft must still parse. Returns the operations that change
 * something, with their diff rows (and a row for each item a new run length moves).
 */
export function checkOps(d: AuthorDraft, ops: EditOp[], allowed?: ReadonlySet<string>): Checked {
  const issues: string[] = [];
  const kept: EditOp[] = [];
  for (const o of ops) {
    if (o.op === 'addEvent') {
      const r = EventDraft.safeParse(o.value);
      if (!r.success) { issues.push(`events: ${r.error.issues[0]?.message ?? 'invalid event'}`); continue; }
      if (!d.events.some(e => e.key === r.data.key)) kept.push({ op: 'addEvent', value: r.data });
      continue;
    }
    if (o.op !== 'set') { kept.push(o); continue; }
    const rule = ruleOf(o.path);
    if (!rule) { issues.push(`${o.path}: not a field Kora may change`); continue; }
    if (allowed && !allowed.has(o.path)) { issues.push(`${o.path}: not one of the fields sent`); continue; }
    const loc = locate(d, o.path);
    if (!loc) { issues.push(`${o.path}: not in this draft`); continue; }
    const r = rule.schema.safeParse(o.value);
    if (!r.success) { issues.push(`${o.path}: ${r.error.issues[0]?.message ?? 'invalid value'}`); continue; }
    if (JSON.stringify(r.data) === JSON.stringify(loc.get())) continue;
    kept.push({ op: 'set', path: o.path, value: r.data });
  }
  if (issues.length) return { ok: false, issues };
  const next = structuredClone(d);
  const moved: Moved[] = [];
  const marks = applyOps(next, kept, moved);
  const refs = referenceIssues(next, kept);
  if (refs.length) return { ok: false, issues: refs };
  const parsed = AuthorDraft.safeParse(next);
  if (!parsed.success) return { ok: false, issues: parsed.error.issues.slice(0, 5).map(i => `${i.path.join('.')}: ${i.message}`) };
  return { ok: true, ops: kept, changes: describeOps(d, kept, next, moved), marks };
}

/** Checks a model's operations against the fields it was shown (server side, no draft): path, whitelist, value. */
export function checkViewOps(view: EditView, ops: Array<{ path: string; value: unknown }>): string[] {
  const issues: string[] = [];
  const seen = new Set<string>();
  for (const o of ops) {
    const rule = ruleOf(o.path);
    if (!rule) { issues.push(`${o.path}: not a field you may change`); continue; }
    if (!(o.path in view.fields)) { issues.push(`${o.path}: not one of the fields given`); continue; }
    if (seen.has(o.path)) { issues.push(`${o.path}: set twice`); continue; }
    seen.add(o.path);
    const r = rule.schema.safeParse(o.value);
    if (!r.success) issues.push(`${o.path}: ${r.error.issues[0]?.message ?? 'invalid value'}`);
  }
  return issues;
}

/* ------------------------------------------------------------------------------------------------
 * The compact view the model edits: the whitelisted fields of the tab (and of anyone or anything the
 * instruction names), flat by path, with a little read only context.
 * ---------------------------------------------------------------------------------------------- */

export const EditView = z.object({
  context: z.record(z.string().max(60), z.string().max(400)),
  fields: z.record(z.string().max(200), z.union([z.string().max(TEXT_MAX), z.number(), z.array(z.string().max(SHORT_MAX)).max(12), z.null()]))
});
export type EditView = z.infer<typeof EditView>;

/** The most fields one view carries, so a request stays small. */
export const VIEW_MAX_FIELDS = 400;

function put(out: Record<string, EditView['fields'][string]>, path: string, v: unknown) {
  if (Object.keys(out).length >= VIEW_MAX_FIELDS) return;
  if (typeof v === 'string' || typeof v === 'number' || v === null) out[path] = v;
  else if (Array.isArray(v) && v.every(x => typeof x === 'string')) out[path] = v as string[];
}

function characterFields(out: Record<string, EditView['fields'][string]>, c: Character) {
  for (const f of ['first', 'last', 'title', 'persona', 'hiddenConcern', 'concernLine', 'motivatedBy', 'careerGoal'] as const) put(out, `team.${c.id}.${f}`, c[f]);
  for (const f of ['skill', 'morale', 'result', 'trust'] as const) put(out, `team.${c.id}.stats.${f}`, c.stats[f]);
}
function eventFields(out: Record<string, EditView['fields'][string]>, e: EventDraft) {
  for (const f of ['title', 'body', 'skill', 'morale', 'result', 'respondWith', 'within', 'week', 'day'] as const) put(out, `events.${e.key}.${f}`, e[f]);
  // The model answers in text, numbers and lists: it may name a follow up, not switch the sponsor on or off.
  put(out, `events.${e.key}.ifIgnored.followUp`, e.ifIgnored.followUp);
  if (e.window) for (const f of ['from', 'to', 'chance'] as const) put(out, `events.${e.key}.window.${f}`, e.window[f]);
  // A choice's options (D137): their effects on people, revenue, the sponsor and each variable, and the flags they set.
  for (const o of e.choice?.options ?? []) {
    for (const f of ['label', 'outcome', 'skill', 'morale', 'result', 'trust', 'sponsor', 'revenue', 'set'] as const) put(out, `events.${e.key}.choice.options.${o.key}.${f}`, o[f]);
    for (const [k, v] of Object.entries(o.variables)) put(out, `events.${e.key}.choice.options.${o.key}.variables.${k}`, v);
  }
}
function actionFields(out: Record<string, EditView['fields'][string]>, a: ActionDraft) {
  put(out, `actions.${a.key}.description`, a.description);
  put(out, `actions.${a.key}.goal`, a.goal);
  put(out, `actions.${a.key}.cost`, a.cost);
  put(out, `actions.${a.key}.availableFrom`, a.availableFrom);
  for (const [s, row] of Object.entries(a.impact)) for (const k of ['fit', 'close', 'wrong'] as const) put(out, `actions.${a.key}.impact.${s}.${k}`, row[k]);
  for (const o of a.options) for (const k of ['label', 'fits', 'misses', 'away'] as const) put(out, `actions.${a.key}.options.${o.key}.${k}`, o[k]);
}

/**
 * The fields Kora's model may change for an instruction on a tab, and what it should know. `named` are
 * the characters and events the instruction names (from the rules' reading), added whatever the tab.
 */
export function editView(d: AuthorDraft, tab: Tab, named: { characters?: string[]; events?: string[] } = {}): EditView {
  const f: Record<string, EditView['fields'][string]> = {};
  const all = tab === 'overview';
  put(f, 'title', d.title);
  if (all || tab === 'brief') for (const k of ['participants', 'challenge', 'run', 'tones'] as const) put(f, `brief.${k}`, d.brief[k]);
  if (all || tab === 'story') {
    for (const k of ['name', 'hq', 'about', 'team', 'office'] as const) put(f, `story.company.${k}`, d.story.company[k]);
    put(f, 'story.product.name', d.story.product.name); put(f, 'story.product.oneLine', d.story.product.oneLine); put(f, 'story.product.points', d.story.product.points);
    put(f, 'story.market.customers', d.story.market.customers);
    for (const k of ['name', 'title', 'voice'] as const) put(f, `story.sponsor.${k}`, d.story.sponsor[k]);
    for (const s of d.story.screens) put(f, `story.screens.${s.key}.body`, s.body);
  }
  if (all || tab === 'process') {
    for (const k of ['revenue', 'weeks', 'daysPerWeek', 'pacing'] as const) put(f, `process.${k}`, d.process[k]);
    for (const s of d.process.stages) for (const k of ['perWeek', 'passesOn', 'people'] as const) put(f, `process.stages.${s.key}.${k}`, s[k]);
  }
  if (all || tab === 'team') for (const c of d.team) characterFields(f, c);
  if (tab === 'lens') for (const s of d.lens.styles) for (const k of ['name', 'short', 'description'] as const) put(f, `lens.styles.${s.key}.${k}`, s[k]);
  if (tab === 'actions') for (const a of d.actions.filter(x => x.core || x.enabled)) actionFields(f, a);
  if (all || tab === 'events') for (const e of d.events) eventFields(f, e);
  for (const id of named.characters ?? []) { const c = d.team.find(x => x.id === id); if (c) characterFields(f, c); }
  for (const k of named.events ?? []) { const e = d.events.find(x => x.key === k); if (e) eventFields(f, e); }
  const context: Record<string, string> = {
    industry: d.brief.industry, company: d.story.company.name, product: d.story.product.name, participants: d.brief.participants,
    lens: d.lens.title, styles: d.lens.styles.map(s => `${s.key}: ${s.name}`).join('; ').slice(0, 400),
    team: d.team.map(c => `${c.id}: ${c.first} ${c.last}`).join('; ').slice(0, 400), weeks: String(d.process.weeks), tab
  };
  return { context, fields: f };
}
