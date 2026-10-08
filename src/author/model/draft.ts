import { z } from 'zod';
import { Brief, Clarify, Dilemma, FrameworkDimension, QUESTION_IDS, Stakeholder } from '../../api/author';
import { CONDITION_METRICS, EVENT_CONDITIONS, MAX_MEMBERS, MAX_PERIODS, MAX_VARIABLES, MIN_MEMBERS, REPLY_LENGTHS, REPORT_SECTIONS, VARIABLE_FORMATS } from '../../engine/config';
import { LENS_IDS, MAX_STYLES, MIN_STYLES, NEEDS } from '../../engine/lens';
import { DEFAULT_SCALE } from '../../engine/report/defaults';

/**
 * The author's draft (D105): one typed model for the whole of /author, the co-creator chat and every
 * workspace tab. It is persisted to local storage and parsed back with this schema; a value that no longer
 * parses is kept under a backup key and repaired field by field (`repair.ts`) instead of dropped. `toStoryline` turns it into
 * the engine's StorylineConfig; `seedDraft` fills it from the chat without a model.
 *
 * Provenance (who wrote what, docs/design/genie/Main.dc.html): every author facing field has a path,
 * and `marks` records `ai` (Kora wrote it), `you` (the author did) or `edited` (Kora wrote it, the
 * author changed it). "Needs you" is not stored: it is a required field that is still empty
 * (`needs.ts`). Suggestions are Kora's ideas, kept apart until the author uses or dismisses them.
 */

export const MARKS = ['ai', 'you', 'edited'] as const;
export type Mark = (typeof MARKS)[number];

export const TABS = ['overview', 'brief', 'story', 'process', 'team', 'lens', 'actions', 'events', 'scoring', 'brand', 'calibrate', 'publish'] as const;
export type Tab = (typeof TABS)[number];

/** The longest a short field (a name, a label, a line) and a text field may be; the inputs use the same limits. */
export const SHORT_MAX = 400;
export const TEXT_MAX = 4000;
const Text = z.string().max(TEXT_MAX);
const Short = z.string().max(SHORT_MAX);
const Pct = z.number().int().min(0).max(100);
/**
 * A whole number kept inside the engine's range (D128): a stored draft from before a bound tightened (12
 * weeks, say) reads back at the nearest value the engine plays, instead of failing and losing its section.
 */
const IntIn = (min: number, max: number) => z.preprocess(v => (typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : v), z.number().int().min(min).max(max));

/** The run's limits, the engine's own (D128): the authoring inputs show them and the draft keeps to them. */
export const MIN_WEEKS = 2;
export const MAX_WEEKS = MAX_PERIODS;
export const MIN_TEAM = MIN_MEMBERS;
export const MAX_TEAM = MAX_MEMBERS;
export const MIN_DAYS = 3;
export const MAX_DAYS = 7;

/**
 * The chat's transcript: a question with the author's answer, a note from Kora, or what Kora took from a long answer
 * or an upload, each with a way to change it (D146). A `took` item's id is a question id or stakeholders, objectives
 * or dilemmas.
 */
export const ChatEntry = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('qa'), id: z.enum(QUESTION_IDS), prompt: Short, answer: Text, voice: z.boolean().default(false) }),
  z.object({ kind: z.literal('note'), text: Text, took: z.boolean().default(false) }),
  z.object({ kind: z.literal('took'), items: z.array(z.object({ id: z.string().max(40), label: Short, value: Text })).max(20) })
]);
export type ChatEntry = z.infer<typeof ChatEntry>;

export const Chat = z.object({
  brief: Brief,
  asked: z.array(z.enum(QUESTION_IDS)),
  answers: z.record(z.string(), z.string()),
  log: z.array(ChatEntry),
  /** The question being asked, or null once the questions are done. */
  current: z.object({ id: z.enum(QUESTION_IDS), n: z.number().int(), about: z.number().int(), confirm: z.string().optional() }).nullable(),
  recommendation: z.object({ id: z.enum(LENS_IDS), reason: z.string(), rule: z.string() }).nullable(),
  primary: z.enum(LENS_IDS).nullable(),
  secondary: z.enum(LENS_IDS).nullable(),
  clientDimensions: z.array(FrameworkDimension),
  /**
   * The template fit check (D133, `fit.ts`): what the brief asks for that iLead cannot play yet. `open` waits for the
   * author to continue with a team leadership version or change the brief; `seen` keeps the kinds already raised.
   */
  fit: z.object({ status: z.enum(['open', 'accepted']), from: z.enum(QUESTION_IDS).nullable(), kinds: z.array(z.string()), seen: z.array(z.string()) }).nullable().optional(),
  /** One short question with choices, waiting for the author (D147). */
  clarify: Clarify.nullable().optional(),
  /** Questions a long answer or an upload answered, said back with a way to change each (D146). */
  taken: z.array(z.enum(QUESTION_IDS)).optional()
});
export type Chat = z.infer<typeof Chat>;

const Fit = z.union([z.literal(0), z.literal(1), z.literal(2)]);
export const DraftStyle = z.object({
  key: z.string().regex(/^[A-Za-z][A-Za-z0-9_]{0,15}$/),
  letter: z.string().max(2),
  name: Short,
  /** What the participant reads: the one line description on the style cards and the live brief. */
  short: Short,
  description: Text
});
export type DraftStyle = z.infer<typeof DraftStyle>;

export const DraftLens = z.object({
  id: z.enum(LENS_IDS),
  title: Short,
  secondary: z.enum(LENS_IDS).nullable(),
  styles: z.array(DraftStyle).min(MIN_STYLES).max(MAX_STYLES),
  /** The library's words, for "Restore lens names". */
  library: z.array(DraftStyle),
  needs: z.record(z.enum(NEEDS), z.object({ label: Short, short: Short })),
  fit: z.record(z.enum(NEEDS), z.record(z.string(), Fit))
});
export type DraftLens = z.infer<typeof DraftLens>;

export const GENDERS = ['woman', 'man', 'nonbinary', 'unstated'] as const;
export { REPLY_LENGTHS };

export const Character = z.object({
  id: z.string().regex(/^[a-z][a-z0-9_]*$/),
  first: Short,
  last: Short,
  gender: z.enum(GENDERS),
  pronouns: Short,
  ageRange: Short,
  title: Short,
  /** A stage key of the work process. */
  stage: z.string(),
  /** A library portrait (each has four moods in play), or the name of an uploaded photo. */
  photo: z.string().max(300),
  voice: z.object({ id: Short, language: Short, accent: Short, pace: Pct, warmth: Pct, formality: Pct, replyLength: z.enum(REPLY_LENGTHS) }),
  persona: Text,
  hiddenConcern: Text,
  /** What the person says when a conversation surfaces the concern. */
  concernLine: Text,
  commStyles: z.array(Short),
  motivatedBy: Text,
  /** How the person reacts to each lens style, by style key. */
  reactions: z.record(z.string(), Text),
  relationships: z.array(z.object({ with: z.string(), kind: Short })),
  noTopics: Text,
  stats: z.object({ skill: Pct, morale: Pct, result: Pct, trust: Pct }),
  bestStage: z.string(),
  experience: Short,
  tenure: Short,
  previousCompany: Short,
  careerGoal: Text,
  shown: z.object({ experience: z.boolean(), tenure: z.boolean(), previousCompany: z.boolean(), careerGoal: z.boolean() }),
  custom: z.array(z.object({ label: Short, value: Text }))
});
export type Character = z.infer<typeof Character>;

export const PLAYS = ['static', 'live', 'hybrid'] as const;
export type Plays = (typeof PLAYS)[number];

/** One option of a static decision. `style` is a lens style key. */
export const ActionOptionDraft = z.object({ key: z.string(), label: Short, style: z.string().nullable(), away: z.number().int().min(0).max(10), fits: Short, misses: Short });

export const ActionDraft = z.object({
  key: z.string().regex(/^[a-z][a-z0-9_]*$/),
  /** The engine action this one plays as (Sales Elevator's tested mechanics). */
  template: z.string(),
  name: Short,
  description: Text,
  group: z.enum(['team', 'person', 'story']),
  core: z.boolean(),
  enabled: z.boolean(),
  plays: z.enum(PLAYS),
  /** Which ways of playing the template's rule supports. */
  canPlay: z.array(z.enum(PLAYS)),
  forWhom: Short,
  cost: z.number().min(0.5).max(5),
  againAfter: z.number().int().min(0).max(20),
  availableFrom: IntIn(1, MAX_WEEKS),
  format: Short,
  starts: z.enum(['npc', 'participant']),
  goal: Text,
  /** Impact by style for conversations: per lens style key, what fitting, one step off and wrong do. */
  impact: z.record(z.string(), z.object({ fit: Short, close: Short, wrong: Short })),
  options: z.array(ActionOptionDraft),
  decides: Text,
  scoredOn: z.array(Short),
  origin: z.enum(['library', 'yours'])
});
export type ActionDraft = z.infer<typeof ActionDraft>;

export const EVENT_KINDS = ['impact', 'opportunity', 'people', 'sponsor'] as const;
export const ARRIVALS = ['modal', 'bulletin', 'chat', 'email', 'sponsorCall'] as const;
/**
 * When an event happens (D128): on a fixed week and day, some time in a range of weeks, when a condition the
 * engine checks holds, or only as the follow up of another event that was ignored.
 */
export const TIMINGS = ['fixed', 'random', 'condition', 'followup'] as const;
export { EVENT_CONDITIONS };
const Delta = z.number().int().min(-30).max(30);
const DraftKey = z.string().regex(/^[a-z][a-z0-9_]*$/);
export { CONDITION_METRICS, VARIABLE_FORMATS };

/**
 * A business variable (D136), edited in Work process: Budget, Customer satisfaction, Quality, Reputation. `weight` is
 * its share of the Business pillar in percent (0 to 80 across all of them).
 */
export const VariableDraft = z.object({
  key: DraftKey,
  name: Short,
  format: z.enum(VARIABLE_FORMATS),
  start: z.number(),
  min: z.number(),
  max: z.number(),
  drift: z.number(),
  shown: z.boolean(),
  weight: z.number().int().min(0).max(80),
  higherIsBetter: z.boolean(),
  about: Text
});
export type VariableDraft = z.infer<typeof VariableDraft>;
export { MAX_VARIABLES };

/** One clause of "Plays only if" (D138): a flag set or not, a business variable, or a team metric, against a value. */
export const ClauseDraft = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('flag'), flag: DraftKey, is: z.boolean() }),
  z.object({ kind: z.literal('variable'), variable: DraftKey, op: z.enum(['below', 'atLeast']), value: z.number() }),
  z.object({ kind: z.literal('metric'), metric: z.enum(CONDITION_METRICS), op: z.enum(['below', 'atLeast']), value: z.number() })
]);
export type ClauseDraft = z.infer<typeof ClauseDraft>;
export const BANDS_READ = ['strong', 'adequate', 'weak', 'harmful'] as const;

/**
 * One option of a choice event (D137): who its people part lands on, its effects on people, revenue, the sponsor and
 * the business variables, the flags it sets or clears, a later event after a delay, and its leadership read (skills by
 * name, as Scored on names them).
 */
export const ChoiceOptionDraft = z.object({
  key: DraftKey,
  label: Short,
  detail: Short,
  outcome: Text,
  who: z.string(),
  skill: Delta, morale: Delta, result: Delta, trust: Delta,
  revenue: z.number().min(-1e9).max(1e9),
  sponsor: Delta,
  variables: z.record(z.string(), z.number()),
  set: z.array(DraftKey).max(6),
  clear: z.array(DraftKey).max(6),
  followUp: z.object({ event: z.string(), days: z.number().int().min(0).max(20), weeks: z.number().int().min(0).max(10) }).nullable(),
  read: z.array(z.object({ skill: Short, band: z.enum(BANDS_READ) })).max(4)
});
export type ChoiceOptionDraft = z.infer<typeof ChoiceOptionDraft>;

/** A choice event (D137): what the participant knows (a line each), 2 to 4 options, the days to decide and the default. */
export const ChoiceDraft = z.object({
  known: Text,
  within: z.number().int().min(1).max(5),
  /** The option that applies when nobody decides in time; null: nothing happens. */
  default: z.string().nullable(),
  options: z.array(ChoiceOptionDraft).min(2).max(4)
});
export type ChoiceDraft = z.infer<typeof ChoiceDraft>;

/**
 * Drafts saved before D128 kept the expected response and what happens if ignored as free text. They read
 * back as structure: the action keys named in the text, and whether the sponsor hears of it.
 */
function migrateEvent(v: unknown): unknown {
  if (v === null || typeof v !== 'object' || Array.isArray(v)) return v;
  const e = { ...(v as Record<string, unknown>) };
  if (!('respondWith' in e)) e.respondWith = (typeof e.response === 'string' ? e.response : '').split(/[\s,]+/).filter(k => /^[a-z][a-z0-9_]*$/.test(k));
  if (!('ifIgnored' in e)) e.ifIgnored = { sponsor: typeof e.ignored === 'string' && /sponsor/i.test(e.ignored), followUp: null };
  return e;
}

/**
 * The event's fields as an object schema, without the migration in front of it. Code that needs one field's
 * schema (Kora's whitelist in patch.ts) reads `EventFields.shape`; parsing a stored event goes through `EventDraft`.
 */
export const EventFields = z.object({
  key: z.string().regex(/^[a-z][a-z0-9_]*$/),
  title: Short,
  kind: z.enum(EVENT_KINDS),
  /** Fixed week and day; null for any other timing (`timing` says which). */
  week: IntIn(1, MAX_WEEKS).nullable(),
  day: z.number().int().min(1).max(MAX_DAYS),
  timing: z.enum(TIMINGS),
  /** Random timing: some day in these weeks, with this chance in 100. Left out, the whole run. */
  window: z.object({ from: IntIn(1, MAX_WEEKS), to: IntIn(1, MAX_WEEKS), chance: Pct }).optional(),
  /** Conditional timing: one of the conditions the engine checks at the start of each week. */
  condition: z.object({ kind: z.enum(EVENT_CONDITIONS), value: Pct, weeks: z.number().int().min(1).max(4) }).optional(),
  who: Short,
  arrives: z.enum(ARRIVALS),
  body: Text,
  skill: Delta,
  morale: Delta,
  result: Delta,
  /** Percent change in new leads in the event's week (fixed timing only). */
  leadFlow: z.number().int().min(-100).max(100),
  /** Action keys that count as answering it (`reply` answers its message). Empty: no response expected. */
  respondWith: z.array(z.string().regex(/^[a-z][a-z0-9_]*$/)).default([]),
  /** Days the participant has to respond, 1 to 5. */
  within: z.number().int().min(1).max(5),
  /** Skill, morale and result for the person when the response comes in time. */
  onTime: z.tuple([Delta, Delta, Delta]).default([0, 2, 0]),
  /** When the response does not come in time: the sponsor hears of it, and an event that follows. */
  /** `afterDays`: the follow up waits this many days after the deadline passes (D138); left out, it plays at once. */
  ifIgnored: z.object({ sponsor: z.boolean(), followUp: z.string().nullable(), afterDays: z.number().int().min(0).max(20).optional() }).default({ sponsor: false, followUp: null }),
  /** Plays only if all of these hold (D138): checked when it is due; with no other timing, at every day. */
  conditions: z.array(ClauseDraft).max(3).optional(),
  /** A choice the participant makes (D137), or null for an event that just happens. */
  choice: ChoiceDraft.nullable().optional(),
  origin: z.enum(['library', 'yours'])
});
export const EventDraft = z.preprocess(migrateEvent, EventFields);
export type EventDraft = z.infer<typeof EventDraft>;

export const BANDS = ['strong', 'adequate', 'weak', 'harmful'] as const;
export type Band = (typeof BANDS)[number];

export const FrameworkRow = z.object({ skill: Short, behaviors: Text, levels: z.number().int().min(0).max(10).nullable(), page: z.number().int().min(1).nullable(), include: z.boolean() });

export const AuthorDraft = z.object({
  v: z.literal(1),
  stage: z.enum(['chat', 'ready', 'workspace']),
  title: Short,
  savedAt: z.number().nullable(),
  chat: Chat,
  brief: z.object({
    participants: Text,
    industry: Short,
    client: Short,
    challenge: Text,
    purpose: z.enum(['development', 'assessment']),
    run: z.enum(['full', 'standard', 'lite']),
    language: Short,
    conversationBy: z.enum(['both', 'text', 'voice']),
    tones: z.array(Short),
    documents: z.array(z.object({ name: Short, use: Short })),
    minutesPerWeek: z.number().int().min(3).max(30),
    targetSkills: Text,
    saveAndResume: z.boolean(),
    /**
     * Read from the brief (D146): people outside the team, what the programme must achieve, and dilemmas in a shape
     * that can seed choice events later. Author notes: Kora drafts from them; the simulation does not play them yet.
     */
    stakeholders: z.array(Stakeholder).max(20).default([]),
    objectives: z.array(Short).max(12).default([]),
    dilemmas: z.array(Dilemma).max(12).default([])
  }),
  story: z.object({
    company: z.object({ name: Short, hq: Short, about: Text, team: Short, office: Short, logo: Short }),
    product: z.object({ name: Short, dealValue: z.number().positive().nullable(), oneLine: Text, points: z.array(Short), view: z.enum(['model', 'photos', 'none']) }),
    market: z.object({ customers: Short, rivals: z.array(z.object({ name: Short, angle: Text })) }),
    sponsor: z.object({ name: Short, title: Short, voice: Short }),
    screens: z.array(z.object({ key: z.string(), title: Short, body: Text }))
  }),
  process: z.object({
    stages: z.array(z.object({ key: z.string().regex(/^[a-z][a-z0-9_]*$/), name: Short, people: z.number().int().min(0).max(6), perWeek: z.number().min(0), passesOn: Pct })).min(3).max(6),
    pressure: z.string().nullable(),
    revenue: z.number().positive().nullable(),
    weeks: IntIn(MIN_WEEKS, MAX_WEEKS),
    daysPerWeek: IntIn(MIN_DAYS, MAX_DAYS),
    pacing: z.enum(['forgiving', 'balanced', 'demanding']),
    /** People dynamics (D135): morale and trust reach output and attrition. New drafts switch it on; drafts saved before read back off. */
    dynamics: z.boolean().optional()
  }),
  /** Business variables (D136), 0 to 6, edited in Work process. */
  variables: z.array(VariableDraft).max(MAX_VARIABLES).default([]),
  team: z.array(Character).min(MIN_TEAM).max(MAX_TEAM),
  lens: DraftLens,
  actions: z.array(ActionDraft),
  events: z.array(EventDraft),
  scoring: z.object({
    skills: z.array(z.object({ key: z.string(), name: Short, reportOnly: z.boolean() })),
    samples: z.array(z.object({ id: z.string(), with: Short, answer: Text, scored: z.enum(BANDS), call: z.enum(BANDS).nullable() })),
    framework: z.object({ file: Short, pages: z.number().int().min(0), step: z.union([z.literal(1), z.literal(2), z.literal(3)]), rows: z.array(FrameworkRow), confirmed: z.boolean() }).nullable(),
    /** The rating scale's level names, lowest first: 3 to 7 (the report's scale, D128). */
    levels: z.array(Short).min(3).max(7).default(() => DEFAULT_SCALE.map(l => l.name)),
    /** The report's sections in the engine's order; null is the purpose's default set. */
    reportSections: z.array(z.enum(REPORT_SECTIONS)).min(1).nullable().default(null)
  }),
  brand: z.object({
    from: z.enum(['knolskape', 'client']),
    name: Short,
    logo: Short,
    main: Short,
    second: Short,
    font: Short,
    look: z.enum(['dark', 'light', 'participant']),
    preview: z.enum(['board', 'report'])
  }),
  /**
   * `skipTest`: the author ticked "Publish without testing" for this version (D132): a synthetic test that has
   * not run, or not run fully, on this version is then advisory. It never covers a failed test, and it resets on publish.
   */
  publish: z.object({ cohort: Short, notes: Text, version: z.number().int().min(0), played: z.boolean(), skipTest: z.boolean().default(false) }),
  marks: z.record(z.string(), z.enum(MARKS)),
  suggestions: z.array(z.object({ id: z.string(), tab: z.enum(TABS), text: Text, action: Short, done: z.boolean() })),
  /**
   * Calibration results the Test tab reports, when it has run (D119, D132). `status` is the last run's: passed, advisory
   * (warnings only), failed, or partial (not all four levels, or the probes off). `failed` is sticky: set by a failed run
   * and cleared only by a full run that passes, so an edit or a partial run never turns a failure into advice.
   */
  calibration: z.object({
    ranAt: z.number(), passed: z.boolean(), summary: Short, configHash: z.string().optional(), advisory: z.boolean().optional(),
    status: z.enum(['passed', 'advisory', 'failed', 'partial']).optional(),
    failed: z.object({ summary: Short, configHash: z.string() }).nullable().optional()
  }).nullable()
});
export type AuthorDraft = z.infer<typeof AuthorDraft>;

/** Where "Play a week" leaves the storyline; the participant mock reads it (`src/engine/mock.ts`, DRAFT_KEY). */
export const DRAFT_KEY = 'ilead.author.draft';
/** Where the author's draft model is kept between visits. */
export const WORKSPACE_KEY = 'ilead.author.workspace';
/** Where a stored draft that did not parse is kept, as it was, before it is repaired. */
export const WORKSPACE_BACKUP_KEY = 'ilead.author.workspace.backup';
/** Where the draft's named versions (restore points) are kept, apart from the draft (D122). */
export const WORKSPACE_VERSIONS_KEY = 'ilead.author.workspace.versions';
