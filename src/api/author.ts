import { z } from 'zod';
import { LENS_IDS } from '../engine/lens';

/**
 * GenieKreator author chat API (D70, D73): the request and response shapes of the proposed endpoints
 * `POST /author/turn` (the next question, or the lens step once the brief is complete) and
 * `POST /author/draft` (the locked lens module turned into a storyline). Authoring only: nothing in the
 * participant app imports this file. The server prompts that must return these shapes are in
 * docs/genie/prompts/author-chat.md and docs/genie/prompts/leadership-lens.md.
 */

export const QUESTION_IDS = ['role_level', 'industry', 'challenge', 'client', 'team_size', 'process', 'duration', 'language', 'framework', 'tone'] as const;
export type QuestionId = (typeof QUESTION_IDS)[number];

export const DURATIONS = ['full', 'standard', 'lite'] as const;
export const TONE_IDS = ['professional', 'warm', 'direct'] as const;
export const REGION_IDS = ['global', 'us', 'uk', 'india', 'singapore', 'uae', 'australia'] as const;

/** One uploaded or pasted document. The prototype reads text files only; a PDF keeps its name and no text. */
export const AuthorDocument = z.object({ name: z.string().min(1), text: z.string().nullable() });

/**
 * People outside the team the brief names (D146): kept as the author's notes and passed to the drafter, which may
 * use them in events and the sponsor's voice; the template plays only the participant's own team (D133).
 */
export const Stakeholder = z.object({ name: z.string().max(120), role: z.string().max(200), relation: z.string().max(120) });
export type Stakeholder = z.infer<typeof Stakeholder>;
/**
 * A dilemma the brief names ("short term revenue vs customer trust"), in the shape a choice event can be seeded
 * from later: a title, the two options and what is at stake (empty when the brief does not say).
 */
export const Dilemma = z.object({ title: z.string().max(200), a: z.string().max(200), b: z.string().max(200), stake: z.string().max(400) });
export type Dilemma = z.infer<typeof Dilemma>;

/** What the author has told the chat so far. Every field is optional until asked or read from an upload. */
export const Brief = z.object({
  roleLevel: z.string().optional(),
  industry: z.string().optional(),
  challenge: z.string().optional(),
  /** The client the build is for. Null: a fictional company. */
  client: z.string().nullable().optional(),
  teamSize: z.number().int().min(6).max(12).optional(),
  /** Work process stage names, 3 to 6. */
  process: z.array(z.string().min(1)).min(3).max(6).optional(),
  duration: z.enum(DURATIONS).optional(),
  region: z.enum(REGION_IDS).optional(),
  language: z.string().optional(),
  /** The client leadership framework text. Null: the author has none. */
  framework: z.string().nullable().optional(),
  tone: z.enum(TONE_IDS).optional(),
  documents: z.array(AuthorDocument).default([]),
  /** Read from a long answer or an upload (D146): people outside the team, what the programme must achieve, the dilemmas. */
  stakeholders: z.array(Stakeholder).max(20).optional(),
  objectives: z.array(z.string().min(1).max(400)).max(12).optional(),
  dilemmas: z.array(Dilemma).max(12).optional()
});
export type Brief = z.output<typeof Brief>;

export const Chip = z.object({ label: z.string().min(1), value: z.string().min(1), detail: z.string().optional() });
export const Question = z.object({
  id: z.enum(QUESTION_IDS),
  prompt: z.string().min(1),
  help: z.string().optional(),
  chips: z.array(Chip).max(8),
  /** `framework` also offers paste and upload. */
  input: z.enum(['text', 'number', 'framework']),
  placeholder: z.string().optional(),
  /** Set when an upload or an earlier answer already suggests the answer: the chat asks to confirm it. */
  confirm: z.string().optional()
});
export type Question = z.infer<typeof Question>;

export const AuthorTurnRequest = z.object({
  brief: Brief,
  /** Question ids asked so far, in order. */
  asked: z.array(z.enum(QUESTION_IDS)),
  /** The author's raw answers by question id. */
  answers: z.record(z.string(), z.string()),
  /**
   * Question ids a long answer or an upload answered, which the chat said back ("I took these from your brief") with a
   * way to change each (D146): they count as confirmed, so they are not asked again to reach the minimum.
   */
  taken: z.array(z.enum(QUESTION_IDS)).optional()
});
export type AuthorTurnRequest = z.input<typeof AuthorTurnRequest>;

const Recommendation = z.object({ id: z.enum(LENS_IDS), reason: z.string().min(1), rule: z.enum(['client_framework', 'challenge', 'role_level', 'default']) });
export type Recommendation = z.infer<typeof Recommendation>;

export const FrameworkDimension = z.object({ name: z.string().min(1), behaviours: z.array(z.string().min(1)), levels: z.array(z.string().min(1)) });
export type FrameworkDimension = z.infer<typeof FrameworkDimension>;

/**
 * One short question when an answer is ambiguous or contradicts itself (D147): two industries, two team sizes, a
 * team size in words, participants given as a level only. The choices answer the question `id`.
 */
export const Clarify = z.object({ id: z.enum(QUESTION_IDS), prompt: z.string().min(1).max(400), choices: z.array(Chip).min(2).max(8) });
export type Clarify = z.infer<typeof Clarify>;

/**
 * The next turn: a question, a clarifying question, or the lens step once the brief is complete. `brief` is the
 * brief with anything the server read from the answers and uploads filled in; `progress` is "Question n of about m"
 * (fewer than five when a long answer or an upload answered the rest, D146).
 */
export const AuthorTurnResponse = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('question'), brief: Brief, question: Question, progress: z.object({ n: z.number().int().min(1), about: z.number().int().min(1).max(10) }) }),
  z.object({ kind: z.literal('clarify'), brief: Brief, clarify: Clarify }),
  z.object({ kind: z.literal('lens'), brief: Brief, recommendation: Recommendation, framework: z.array(FrameworkDimension).nullable() })
]);
export type AuthorTurnResponse = z.infer<typeof AuthorTurnResponse>;

/** The Leadership Lens module's output on confirmation (leadership-lens-module.md, Output). */
export const LeadershipLensModule = z.object({
  library_version: z.literal(1),
  primary: z.object({
    id: z.enum(LENS_IDS), title: z.string().min(1), npc_design: z.string(), event_design: z.string(),
    action_classification: z.array(z.string()), scoring_dimensions: z.array(z.string())
  }),
  secondary: z.object({ id: z.enum(LENS_IDS), title: z.string().min(1), report_only_dimensions: z.array(z.string()) }).nullable(),
  client_model: z.object({ used: z.boolean(), source_document: z.string(), confirmed_dimensions: z.array(FrameworkDimension) }),
  context: z.object({ industry: z.string(), role_level: z.string(), team_size: z.string(), business_challenge: z.string(), client_name: z.string() }),
  locked: z.boolean()
}).refine(m => !m.secondary || m.secondary.id !== m.primary.id, { message: 'The secondary lens must differ from the primary', path: ['secondary', 'id'] });
export type LeadershipLensModule = z.infer<typeof LeadershipLensModule>;

export const AuthorDraftRequest = z.object({ brief: Brief, leadership_lens: LeadershipLensModule });
export type AuthorDraftRequest = z.input<typeof AuthorDraftRequest>;

/**
 * The draft: the storyline config (checked against the engine's StorylineConfig schema by the client
 * before it is used) and a short preview for the build preview step.
 */
export const AuthorDraftResponse = z.object({
  storyline: z.record(z.string(), z.unknown()),
  preview: z.object({
    teamSize: z.number().int(),
    sampleEvent: z.object({ title: z.string(), body: z.string() }),
    styles: z.array(z.object({ name: z.string(), short: z.string() })),
    dimensions: z.array(z.object({ name: z.string(), reportOnly: z.boolean() })),
    reportSections: z.array(z.string())
  })
});
export type AuthorDraftResponse = z.infer<typeof AuthorDraftResponse>;
