import { streamSSE } from 'hono/streaming';
import { z } from 'zod';
import { wordTokens } from '../../../src/ai/mockStream';
import { BANDS } from '../../../src/engine/config';
import { EngineView, Intent, IntentResult, StreamChunk } from '../../../src/engine/contract';
import { ExternalId, seesCohort, type Principal } from '../auth/principal';
import type { ServerContext } from '../context';
import { forbidden, notFound } from '../http/errors';
import { named } from '../http/route';
import { wordEnglish } from '../../../src/i18n/engineCopyEn';
import type { RunRow } from '../store/repo';

const View = named(EngineView, 'EngineView');
const Result = named(IntentResult, 'IntentResult');
const IntentBody = named(Intent, 'Intent');
const Err = { description: 'Error: `{ message, code }`' };
const Band = z.enum(BANDS);

/** Intents that call a model (the NPC or the evaluator): rate limited as AI calls. */
const AI_INTENTS = new Set(['sendTurn', 'submitInteraction', 'endInteraction', 'chooseCandidate', 'nextCandidate', 'openConversation', 'planAction']);

const RunMeta = z.object({
  runId: z.string(), attempt: z.number().int(), status: z.enum(['active', 'ended']), storyline: z.object({ id: z.string(), version: z.number().int() }),
  purpose: z.enum(['development', 'assessment']), startedAt: z.string(), endedAt: z.string().nullable(), events: z.number().int()
});
export const runMeta = (r: RunRow): z.output<typeof RunMeta> => ({
  runId: r.id, attempt: r.attempt, status: r.status, storyline: { id: r.storylineId, version: r.storylineVersion }, purpose: r.purpose, startedAt: r.createdAt, endedAt: r.endedAt, events: r.eventCount
});

/** The participant's own session: the path's session id is the participant id from the launch (HANDOFF section 2). */
export function ownerOf(p: Principal) {
  return { participantId: p.id, cohortId: p.cohort, storylineId: p.storyline, purpose: p.purpose };
}

export function registerEngine(ctx: ServerContext) {
  const { routes, runs, repo, config } = ctx;
  const session = { session: ExternalId };

  /** The caller's current run, checking the path names them. */
  async function current(principal: Principal | null, sessionId: string) {
    if (!principal || principal.id !== sessionId) throw forbidden('This session belongs to someone else.');
    return runs.current(ownerOf(principal));
  }

  routes.add({
    method: 'get', path: '/engine/sessions/{session}/view', tag: 'engine', auth: ['participant'], params: session,
    summary: 'The engine view of the current run', description: 'Starts the first run on first call; resumes the latest attempt after that (a closed browser picks up where it left off).',
    responses: { 200: { description: 'EngineView', schema: View }, 401: Err, 403: Err }
  }, async (c, { params, principal }) => {
    const run = await current(principal, params.session);
    return c.json(await runs.view(run.id));
  });

  routes.add({
    method: 'post', path: '/engine/sessions/{session}/intents', tag: 'engine', auth: ['participant'], params: session, body: IntentBody,
    summary: 'Apply an intent', description: 'Intents on one run apply one at a time. A refused intent answers 409 with the engine\'s code and changes nothing.',
    responses: { 200: { description: 'IntentResult', schema: Result }, 400: Err, 409: Err, 429: Err }
  }, async (c, { params, principal, body }) => {
    const run = await current(principal, params.session);
    if (AI_INTENTS.has(body.type)) {
      const r = ctx.routes.limiter.hit('ai', `ai:${principal!.id}`);
      if (!r.ok) {
        c.header('Retry-After', String(r.retryAfter));
        return c.json({ message: 'Too many requests. Wait a moment and try again.', code: 'rateLimited' }, 429);
      }
    }
    return c.json(await runs.dispatch(run.id, body));
  });

  routes.add({
    method: 'get', path: '/engine/sessions/{session}/interactions/{interaction}/turns/{turn}/stream', tag: 'engine', auth: ['participant'], params: session,
    summary: 'Stream an NPC turn (server sent events)',
    description: 'One `StreamChunk` JSON per `data:` event: tokens, then `done` (or `error`). The words are the engine\'s, already decided when the turn was sent; they stream at a speaking pace (`STREAM_TOKENS_PER_SEC`).',
    responses: { 200: { description: 'text/event-stream of StreamChunk', schema: named(StreamChunk, 'StreamChunk'), contentType: 'text/event-stream' }, 404: Err }
  }, async (c, { params, principal }) => {
    const run = await current(principal, params.session);
    const view = await runs.view(run.id);
    const turn = view.live?.id === params.interaction ? view.live.turns.find(t => t.id === params.turn && t.by !== 'you') : undefined;
    if (!turn) throw notFound('No such turn in the open conversation', 'unknownTurn');
    const gap = config.STREAM_TOKENS_PER_SEC > 0 ? 1000 / config.STREAM_TOKENS_PER_SEC : 0;
    c.header('Cache-Control', 'no-cache, no-transform');
    c.header('X-Accel-Buffering', 'no');
    return streamSSE(c, async stream => {
      let aborted = false;
      stream.onAbort(() => { aborted = true; });
      // A turn that opens with engine copy (a reply to a message) streams its English words (D83).
      for (const token of wordTokens(typeof turn.text === 'string' ? turn.text : wordEnglish(turn.text))) {
        if (aborted) return;
        await stream.writeSSE({ data: JSON.stringify({ type: 'token', text: token }) });
        if (gap) await stream.sleep(gap);
      }
      if (!aborted) await stream.writeSSE({ data: JSON.stringify({ type: 'done', turnId: turn.id }) });
    }, async (_err, stream) => {
      await stream.writeSSE({ data: JSON.stringify({ type: 'error', retryable: true }) });
    });
  });

  routes.add({
    method: 'get', path: '/engine/sessions/{session}/run', tag: 'engine', auth: ['participant'], params: session,
    summary: 'The current run: attempt, status, storyline version',
    responses: { 200: { description: 'Run', schema: RunMeta } }
  }, async (c, { params, principal }) => c.json(runMeta(await current(principal, params.session))));

  routes.add({
    method: 'post', path: '/engine/sessions/{session}/runs', tag: 'engine', auth: ['participant'], params: session,
    summary: 'Start a new attempt', description: 'Earlier attempts stay, for the history in the report. Refused while the latest attempt is still being played.',
    responses: { 200: { description: 'The new run and its view', schema: z.object({ run: RunMeta, view: View }) }, 409: Err }
  }, async (c, { params, principal }) => {
    const latest = await current(principal, params.session);
    if (latest.status === 'active' && latest.eventCount > 0) return c.json({ message: 'Finish the current run first.', code: 'runInProgress' }, 409);
    const run = latest.eventCount === 0 && latest.status === 'active' ? latest : await runs.start(ownerOf(principal!));
    return c.json({ run: runMeta(run), view: await runs.view(run.id) });
  });

  // ---- Assessors: read runs and review live conversations (D67) ----

  async function staffRun(principal: Principal | null, runId: string) {
    const run = await repo.getRun(runId);
    if (!run) throw notFound('No such run', 'unknownRun');
    if (!principal || !seesCohort(principal, run.cohortId)) throw forbidden('This run is not in your cohorts.');
    return run;
  }

  routes.add({
    method: 'get', path: '/engine/runs/{runId}', tag: 'assessor', auth: ['assessor', 'cohort_admin'],
    summary: 'A run and its view, for assessors',
    responses: { 200: { description: 'Run and view', schema: z.object({ run: RunMeta, participantId: z.string(), view: View }) }, 403: Err, 404: Err }
  }, async (c, { params, principal }) => {
    const run = await staffRun(principal, params.runId);
    return c.json({ run: runMeta(run), participantId: run.participantId, view: await runs.view(run.id) });
  });

  routes.add({
    method: 'get', path: '/engine/runs/{runId}/records', tag: 'assessor', auth: ['assessor'],
    summary: 'The live conversation records of a run: the ids a review takes, the AI\'s band, the words',
    responses: { 200: { description: 'Records', schema: z.object({ records: z.array(z.record(z.string(), z.unknown())) }) }, 403: Err, 404: Err }
  }, async (c, { params, principal }) => {
    const run = await staffRun(principal, params.runId);
    return c.json({ records: await runs.records(run.id) });
  });

  routes.add({
    method: 'post', path: '/engine/runs/{runId}/review', tag: 'assessor', auth: ['assessor'],
    body: z.object({ recordId: z.string().min(1).max(100), band: Band, skills: z.record(z.string().max(60), Band).optional() }),
    summary: 'Review one live conversation (engine.review)',
    description: 'The assessor\'s band replaces the AI\'s overall and skill bands in the score, badges and the report; consequences already applied stay. Logged in the run\'s event log, so replays apply it too.',
    responses: { 200: { description: 'The run\'s view after the review', schema: View }, 403: Err, 404: Err, 409: Err }
  }, async (c, { params, principal, body }) => {
    const run = await staffRun(principal, params.runId);
    const view = await runs.review(run.id, body, principal!.id);
    return c.json(view);
  });
}
