import { AuthorDraftRequest, AuthorDraftResponse, AuthorTurnRequest, AuthorTurnResponse } from '../../../src/api/author';
import { parseStoryline } from '../../../src/engine/config';
import type { ServerContext } from '../context';
import { HttpError } from '../http/errors';
import { named } from '../http/route';

const Err = { description: 'Error: `{ message, code }`' };

/**
 * GenieKreator's author chat (D74), behind the author role and the AI rate limit. The drafter is the
 * `AuthorDrafter` port; its answers are checked against the same Zod shapes the app parses with before
 * they leave, so a model's malformed answer is a 502 the app falls back from, never a broken page.
 */
export function registerAuthor(ctx: ServerContext) {
  const { routes } = ctx;

  routes.add({ method: 'post', path: '/genie/author/turn', tag: 'author', auth: ['author'], limit: 'ai', body: named(AuthorTurnRequest, 'AuthorTurnRequest'),
    summary: 'The next question, or the lens step once the brief is complete',
    responses: { 200: { description: 'AuthorTurnResponse', schema: named(AuthorTurnResponse, 'AuthorTurnResponse') }, 501: { description: 'Not offered: the app uses its templates' }, 502: Err }
  }, async (c, { body }) => {
    const out = await ctx.ai.author.turn(body);
    if (out === null) return c.json({ message: 'Not offered', code: 'notImplemented' }, 501);
    const r = AuthorTurnResponse.safeParse(out);
    if (!r.success) throw new HttpError(502, 'badModelOutput', 'The drafting model gave an answer the app cannot use.');
    return c.json(r.data);
  });

  routes.add({ method: 'post', path: '/genie/author/draft', tag: 'author', auth: ['author'], limit: 'ai', body: named(AuthorDraftRequest, 'AuthorDraftRequest'),
    summary: 'The locked Leadership Lens module drafted into a storyline (saved as a draft version)',
    responses: { 200: { description: 'AuthorDraftResponse', schema: named(AuthorDraftResponse, 'AuthorDraftResponse') }, 501: { description: 'Not offered: the app uses its templates' }, 502: Err }
  }, async (c, { body, principal }) => {
    const out = await ctx.ai.author.draft(body as Parameters<typeof ctx.ai.author.draft>[0]);
    if (out === null) return c.json({ message: 'Not offered', code: 'notImplemented' }, 501);
    const r = AuthorDraftResponse.safeParse(out);
    if (!r.success) throw new HttpError(502, 'badModelOutput', 'The drafting model gave an answer the app cannot use.');
    // A draft that plays is kept as the next draft version of its storyline, for the author to publish later.
    const parsed = parseStoryline(r.data.storyline);
    if (parsed.ok) {
      const saved = await ctx.repo.saveStoryline({ id: parsed.config.id, status: 'draft', name: parsed.config.name, config: r.data.storyline, createdBy: principal!.id });
      c.header('X-Storyline-Version', `${saved.id}@${saved.version}`);
    }
    return c.json(r.data);
  });
}
