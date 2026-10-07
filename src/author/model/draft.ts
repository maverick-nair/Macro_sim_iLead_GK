import { z } from 'zod';
import { Brief, FrameworkDimension, QUESTION_IDS } from '../../api/author';
import { LENS_IDS, MAX_STYLES, MIN_STYLES, NEEDS } from '../../engine/lens';

/**
 * The author's draft (D105): one typed model for the whole of /author, the co-creator chat and every
 * workspace tab. It is persisted to local storage and parsed back with this schema, so a stale or
 * hand edited value starts a fresh draft instead of breaking the page. `toStoryline` turns it into
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

const Text = z.string().max(4000);
const Short = z.string().max(400);
const Pct = z.number().int().min(0).max(100);

/** The chat's transcript: a question with the author's answer, or a note from Kora. */
export const ChatEntry = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('qa'), id: z.enum(QUESTION_IDS), prompt: Short, answer: Text, voice: z.boolean().default(false) }),
  z.object({ kind: z.literal('note'), text: Text, took: z.boolean().default(false) })
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
  clientDimensions: z.array(FrameworkDimension)
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
export const REPLY_LENGTHS = ['short', 'medium', 'long'] as const;

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
  availableFrom: z.number().int().min(1).max(12),
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

export const EventDraft = z.object({
  key: z.string().regex(/^[a-z][a-z0-9_]*$/),
  title: Short,
  kind: z.enum(EVENT_KINDS),
  /** Fixed week and day; null for a random or conditional event (`timing` says which). */
  week: z.number().int().min(1).max(12).nullable(),
  day: z.number().int().min(1).max(7),
  timing: z.enum(['fixed', 'random', 'condition']),
  timingNote: Short,
  who: Short,
  arrives: z.enum(ARRIVALS),
  body: Text,
  skill: z.number().int().min(-30).max(30),
  morale: z.number().int().min(-30).max(30),
  result: z.number().int().min(-30).max(30),
  leadFlow: z.number().int().min(-100).max(100),
  response: Short,
  within: z.number().int().min(1).max(5),
  ignored: Short,
  origin: z.enum(['library', 'yours'])
});
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
    saveAndResume: z.boolean()
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
    weeks: z.number().int().min(2).max(12),
    daysPerWeek: z.number().int().min(3).max(7),
    pacing: z.enum(['forgiving', 'balanced', 'demanding'])
  }),
  team: z.array(Character).min(1).max(12),
  lens: DraftLens,
  actions: z.array(ActionDraft),
  events: z.array(EventDraft),
  scoring: z.object({
    skills: z.array(z.object({ key: z.string(), name: Short, reportOnly: z.boolean() })),
    samples: z.array(z.object({ id: z.string(), with: Short, answer: Text, scored: z.enum(BANDS), call: z.enum(BANDS).nullable() })),
    framework: z.object({ file: Short, pages: z.number().int().min(0), step: z.union([z.literal(1), z.literal(2), z.literal(3)]), rows: z.array(FrameworkRow), confirmed: z.boolean() }).nullable(),
    scale: Short,
    sections: z.number().int().min(1).max(20)
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
  publish: z.object({ cohort: Short, notes: Text, version: z.number().int().min(0), played: z.boolean() }),
  marks: z.record(z.string(), z.enum(MARKS)),
  suggestions: z.array(z.object({ id: z.string(), tab: z.enum(TABS), text: Text, action: Short, done: z.boolean() })),
  /** Calibration results the Test tab reports, when it has run. */
  calibration: z.object({ ranAt: z.number(), passed: z.boolean(), summary: Short, configHash: z.string().optional(), advisory: z.boolean().optional() }).nullable()
});
export type AuthorDraft = z.infer<typeof AuthorDraft>;

/** Where "Play a week" leaves the storyline; the participant mock reads it (`src/engine/mock.ts`, DRAFT_KEY). */
export const DRAFT_KEY = 'ilead.author.draft';
/** Where the author's draft model is kept between visits. */
export const WORKSPACE_KEY = 'ilead.author.workspace';
