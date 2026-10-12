import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { EngineView, Intent, IntentResult } from '../../../src/engine/contract';
import { jumpTo, parseJump } from '../../../src/engine/jump';
import { ExternalId } from '../auth/principal';
import type { ServerContext } from '../context';
import type { RunOwner } from '../engine/runs';
import { previewStorylineId } from '../engine/storylines';
import { badRequest, notFound } from '../http/errors';
import { named } from '../http/route';
import { checkStoryline } from './admin';
import { runMeta, streamTurn } from './engine';

const Err = { description: 'Error: `{ message, code }`' };
const View = named(EngineView, 'EngineView');
const Result = named(IntentResult, 'IntentResult');
const IntentBody = named(Intent, 'Intent');

/** How long a preview lasts after its last save (D195). */
export const PREVIEW_DAYS = 7;
/** Intents that call a model: rate limited as AI calls, as on a participant's run. */
const AI_INTENTS = new Set(['sendTurn', 'submitInteraction', 'endInteraction', 'chooseCandidate', 'nextCandidate', 'openConversation', 'planAction']);

const Target = z.string().max(80).refine(t => parseJump(t) !== null, 'a point in the run: onboarding, styles, board, weekend, end, report (a week may follow: board:3), event:<key> or action:<key>');
const PreviewBody = z.object({
  config: z.record(z.string(), z.unknown()),
  /** The version this draft becomes when published, for the preview bar. */
  draftVersion: z.number().int().min(0).max(1_000_000).optional(),
  /** When GenieKreator saved the draft. */
  savedAt: z.string().max(40).optional()
});
const Created = z.object({ id: z.string(), token: z.string(), url: z.string(), expiresAt: z.string(), storyline: z.object({ id: z.string(), name: z.string() }) });

/** The stand in participant a preview plays as: never a real participant, never in a cohort (D195). */
export const previewParticipant = (id: string) => `preview.${id}`;
const ownerOf = (id: string): RunOwner => ({ participantId: previewParticipant(id), cohortId: null, storylineId: previewStorylineId(id), purpose: null });
const expiry = () => new Date(Date.now() + PREVIEW_DAYS * 86400_000).toISOString();

/**
 * Preview from GenieKreator (D195). `POST /genie/author/preview` checks a StorylineConfig as a published
 * version is checked, keeps it as an ephemeral preview storyline (never a version in `storylines`) and
 * answers with its id (the token) and the participant app's preview address. The preview plays through
 * the engine contract at `/genie/preview/sessions/{id}`, as the author: its runs are flagged `preview`,
 * keep no summary, and are left out of cohorts, group reports, benchmarks, the history and admin
 * listings. A preview expires PREVIEW_DAYS after its last save; retention then removes it and its runs.
 */
export function registerPreview(ctx: ServerContext) {
  const { routes, repo, runs, storylines } = ctx;

  /** A preview that has not expired, or 404. */
  async function live(id: string) {
    const p = await repo.getPreview(id);
    if (!p || p.expiresAt < new Date().toISOString()) throw notFound('This preview has expired. Preview again from GenieKreator.', 'unknownPreview');
    return p;
  }

  /** A fresh run of the preview, played forward to `target` (`board:3`, `report`). */
  async function fresh(id: string, target: string | undefined) {
    const run = await runs.start(ownerOf(id));
    const jump = parseJump(target);
    if (jump && jump.to !== 'onboarding') {
      const { config } = await storylines.resolve(previewStorylineId(id));
      await jumpTo({ view: () => runs.view(run.id), dispatch: i => runs.dispatch(run.id, i as Intent) }, config, jump);
    }
    return run;
  }

  routes.add({ method: 'post', path: '/genie/author/preview', tag: 'author', auth: ['author'], body: named(PreviewBody.extend({ target: Target.optional() }), 'PreviewRequest'),
    summary: 'Keep a draft as a preview storyline and get its preview address (D195)',
    description: 'Checked as `POST /api/admin/storylines` checks a version: the storyline schema, the copy rules and the id. Kept as a preview, not a published or draft version, for PREVIEW_DAYS after its last save. `target` plays the preview\'s first run forward to a point. Runs on it are flagged `preview` and left out of every report.',
    responses: { 201: { description: 'The preview: its id (the token) and the participant app\'s preview address', schema: Created }, 400: Err, 403: Err }
  }, async (c, { body, principal }) => {
    const config = checkStoryline(body.config);
    const id = `p${randomBytes(15).toString('base64url')}`;
    const p = await repo.createPreview({ id, storylineId: config.id, name: config.name, config: body.config, draftVersion: body.draftVersion ?? null, savedAt: body.savedAt ?? null, createdBy: principal!.id, expiresAt: expiry() });
    if (body.target) await fresh(id, body.target);
    const q = new URLSearchParams({ preview: '1', storyline: 'draft', participant: 'preview', previewId: id, jump: body.target ?? 'onboarding' });
    ctx.log.info('preview created', { previewId: id, storyline: config.id, by: principal!.id });
    return c.json({ id, token: id, url: `/?${q}`, expiresAt: p.expiresAt, storyline: { id: config.id, name: config.name } }, 201);
  });

  routes.add({ method: 'put', path: '/genie/author/preview/{id}', tag: 'author', auth: ['author'], params: { id: ExternalId }, body: named(PreviewBody, 'PreviewUpdate'),
    summary: 'Replace a preview\'s draft with a newer save (checked as on create); its runs in progress keep theirs',
    responses: { 200: { description: 'Kept', schema: z.object({ id: z.string(), expiresAt: z.string() }) }, 400: Err, 404: Err }
  }, async (c, { params, body }) => {
    await live(params.id);
    const config = checkStoryline(body.config);
    const p = await repo.updatePreview(params.id, { storylineId: config.id, name: config.name, config: body.config, draftVersion: body.draftVersion ?? null, savedAt: body.savedAt ?? null, expiresAt: expiry() });
    if (!p) throw notFound('No such preview', 'unknownPreview');
    return c.json({ id: p.id, expiresAt: p.expiresAt });
  });

  const session = { session: ExternalId };

  routes.add({ method: 'get', path: '/genie/preview/sessions/{session}/view', tag: 'author', auth: ['author'], params: session,
    summary: 'The engine view of the preview\'s current run (started on first call)',
    responses: { 200: { description: 'EngineView', schema: View }, 404: Err }
  }, async (c, { params }) => {
    await live(params.session);
    const run = await runs.current(ownerOf(params.session));
    return c.json(await runs.view(run.id));
  });

  routes.add({ method: 'post', path: '/genie/preview/sessions/{session}/intents', tag: 'author', auth: ['author'], params: session, body: IntentBody,
    summary: 'Apply an intent on the preview\'s run', description: 'As on a participant\'s run: one at a time, `Idempotency-Key` answered once, model calls rate limited.',
    responses: { 200: { description: 'IntentResult', schema: Result }, 400: Err, 404: Err, 409: Err, 429: Err }
  }, async (c, { params, principal, body }) => {
    await live(params.session);
    const run = await runs.current(ownerOf(params.session));
    if (AI_INTENTS.has(body.type)) {
      const r = routes.limiter.hit('ai', `ai:${principal!.id}`);
      if (!r.ok) {
        c.header('Retry-After', String(r.retryAfter));
        return c.json({ message: 'Too many requests. Wait a moment and try again.', code: 'rateLimited' }, 429);
      }
    }
    const key = c.req.header('idempotency-key')?.trim();
    if (key !== undefined && (key.length < 1 || key.length > 200)) throw badRequest('Idempotency-Key must be 1 to 200 characters.');
    return c.json(await runs.dispatch(run.id, body, key));
  });

  routes.add({ method: 'get', path: '/genie/preview/sessions/{session}/interactions/{interaction}/turns/{turn}/stream', tag: 'author', auth: ['author'], params: session,
    summary: 'Stream an NPC turn of the preview\'s run (server sent events)',
    responses: { 200: { description: 'text/event-stream of StreamChunk', contentType: 'text/event-stream' }, 404: Err }
  }, async (c, { params }) => {
    await live(params.session);
    const run = await runs.current(ownerOf(params.session));
    return streamTurn(ctx, c, run.id, params.interaction, params.turn);
  });

  routes.add({ method: 'post', path: '/genie/preview/sessions/{session}/restart', tag: 'author', auth: ['author'], params: session, body: z.object({ target: Target.optional() }),
    summary: 'Start the preview over on a fresh run, played forward to a point (Jump to, Restart)',
    responses: { 200: { description: 'The new run and its view', schema: z.object({ run: z.record(z.string(), z.unknown()), view: View }) }, 400: Err, 404: Err }
  }, async (c, { params, body }) => {
    await live(params.session);
    const run = await fresh(params.session, body.target);
    return c.json({ run: runMeta((await runs.getRun(run.id)) ?? run), view: await runs.view(run.id) });
  });
}
