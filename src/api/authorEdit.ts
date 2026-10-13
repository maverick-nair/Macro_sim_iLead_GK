import { z } from 'zod';
import { SHORT_MAX, TABS, TEXT_MAX } from '../author/model/draft';
import { EditView } from '../author/model/patch';

/**
 * Ask Kora with a model (D127): `POST {VITE_GENIE_URL}/author/edit`. The app sends the author's
 * instruction, the tab, and a compact view of the fields Kora may change there (`editView`: whitelisted
 * paths with their current values, and a little read only context). The answer is either a patch (set
 * operations on paths from that view, each value checked against the draft schema's field) or a reply
 * (a question, a conflict, or "I can't do that yet") with optional answers to offer. A 404 or 501 means
 * the server offers no model; the app then reads the instruction with its own rules, and says so.
 */

export const AuthorEditRequest = z.object({
  instruction: z.string().trim().min(1).max(2000),
  tab: z.enum(TABS),
  view: EditView
});
export type AuthorEditRequest = z.infer<typeof AuthorEditRequest>;

export const AuthorEditOp = z.object({
  path: z.string().min(1).max(200),
  value: z.union([z.string().max(TEXT_MAX), z.number(), z.array(z.string().max(SHORT_MAX)).max(12)])
});
export type AuthorEditOp = z.infer<typeof AuthorEditOp>;

export const AuthorEditResponse = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('patch'), reply: z.string().max(1000), ops: z.array(AuthorEditOp).min(1).max(120) }),
  z.object({ kind: z.literal('reply'), reply: z.string().min(1).max(1000), options: z.array(z.string().min(1).max(200)).max(4).default([]) })
]);
export type AuthorEditResponse = z.infer<typeof AuthorEditResponse>;
