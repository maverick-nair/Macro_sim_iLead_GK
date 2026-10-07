import { z } from 'zod';
import { REGION_IDS, DURATIONS, TONE_IDS } from '../../../src/api/author';
import { js } from '../llm/transport';

/** What the author chat model answers: brief fields read from answers and uploads (`author-turn.md`). */
export const BriefReading = z.object({
  roleLevel: z.string().nullable(),
  industry: z.string().nullable(),
  challenge: z.string().nullable(),
  client: z.object({ kind: z.enum(['named', 'fictional', 'unknown']), name: z.string().nullable() }),
  teamSize: z.number().int().nullable(),
  process: z.array(z.string()).nullable(),
  duration: z.enum(DURATIONS).nullable(),
  region: z.enum(REGION_IDS).nullable(),
  language: z.string().nullable(),
  tone: z.enum(TONE_IDS).nullable(),
  frameworkDocument: z.string().nullable()
});
export type BriefReading = z.infer<typeof BriefReading>;

export const briefReadingJsonSchema = js.obj({
  roleLevel: js.nullable(js.str()), industry: js.nullable(js.str()), challenge: js.nullable(js.str()),
  client: js.obj({ kind: js.enum(['named', 'fictional', 'unknown']), name: js.nullable(js.str()) }),
  teamSize: js.nullable(js.int('6 to 12')), process: js.nullable(js.arr(js.str(), '3 to 6 stage names')),
  duration: js.nullable(js.enum(DURATIONS)), region: js.nullable(js.enum(REGION_IDS)), language: js.nullable(js.str()),
  tone: js.nullable(js.enum(TONE_IDS)), frameworkDocument: js.nullable(js.str())
});

export const FrameworkReading = z.object({ dimensions: z.array(z.object({ name: z.string(), behaviours: z.array(z.string()), levels: z.array(z.string()) })) });
export const frameworkReadingJsonSchema = js.obj({ dimensions: js.arr(js.obj({ name: js.str(), behaviours: js.arr(js.str()), levels: js.arr(js.str()) })) });

/** The draft's copy, merged over the template storyline by id and key (`author-draft.md`). */
export const DraftCopy = z.object({
  name: z.string().min(1),
  organisation: z.string().min(1),
  sponsor: z.object({ name: z.string().min(1), title: z.string().min(1), styleLine: z.string().min(1) }),
  intro: z.object({ welcome: z.array(z.string().min(1)).min(1).max(4), product: z.array(z.string().min(1)).min(1).max(4), targets: z.array(z.string().min(1)).min(1).max(4) }),
  styles: z.array(z.object({ key: z.string(), name: z.string().min(1), short: z.string().min(1), description: z.string().min(1) })),
  members: z.array(z.object({
    id: z.string(), name: z.string().min(1), title: z.string().min(1), remarks: z.string(),
    hiddenConcern: z.string().nullable(), concernLine: z.string().nullable(), careerGoal: z.string().nullable()
  })),
  events: z.array(z.object({ key: z.string(), title: z.string().min(1), he: z.string().min(1), she: z.string().min(1), they: z.string().nullable() })),
  sampleEvent: z.object({ title: z.string().min(1), body: z.string().min(1) })
});
export type DraftCopy = z.infer<typeof DraftCopy>;

export function draftCopyJsonSchema(o: { members: string[]; styles: string[]; events: string[] }) {
  const s = js.str();
  return js.obj({
    name: s, organisation: s,
    sponsor: js.obj({ name: s, title: s, styleLine: s }),
    intro: js.obj({ welcome: js.arr(s), product: js.arr(s), targets: js.arr(s) }),
    styles: js.arr(js.obj({ key: js.enum(o.styles), name: s, short: s, description: s })),
    members: js.arr(js.obj({ id: js.enum(o.members), name: s, title: s, remarks: s, hiddenConcern: js.nullable(s), concernLine: js.nullable(s), careerGoal: js.nullable(s) })),
    events: js.arr(js.obj({ key: js.enum(o.events), title: s, he: s, she: s, they: js.nullable(s) })),
    sampleEvent: js.obj({ title: s, body: s })
  });
}
