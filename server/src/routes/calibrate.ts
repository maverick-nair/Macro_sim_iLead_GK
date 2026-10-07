import { z } from 'zod';
import { CalibrationJob, CalibrationRequest, Playthrough, PERSONA_KEYS, type PersonaKey } from '../../../src/author/calibrate/logic/schema';
import { CalibrationJobs } from '../calibration/jobs';
import type { ServerContext } from '../context';
import { named } from '../http/route';

const Err = { description: 'Error: `{ message, code }`' };
const Id = z.string().regex(/^[0-9a-f-]{36}$/);

/**
 * GenieKreator's "Test with synthetic players" (D117, docs/CALIBRATION-SYNTHETIC.md): start a calibration
 * of a draft storyline, poll it, read one playthrough, or cancel it. Behind the author role; the start is
 * rate limited with the AI calls. Jobs run in process (`CALIBRATION_CONCURRENCY`, `CALIBRATION_QUEUE`).
 */
export function registerCalibrate(ctx: ServerContext): CalibrationJobs {
  const { routes } = ctx;
  const jobs = new CalibrationJobs(ctx.ai, ctx.log.child({ component: 'calibration' }), { concurrency: ctx.config.CALIBRATION_CONCURRENCY, queue: ctx.config.CALIBRATION_QUEUE });
  const Job = named(CalibrationJob, 'CalibrationJob');

  routes.add({
    method: 'post', path: '/genie/calibrations', tag: 'author', auth: ['author'], limit: 'ai', body: named(CalibrationRequest, 'CalibrationRequest'),
    summary: 'Start a synthetic player calibration of a draft storyline',
    description: 'Plays the draft with synthetic players at four levels (playthroughs per persona, from `seed`) and, unless `probes` is false, one style and one action probes; then checks that scores rise with proficiency, Experts reach the target tier and Beginners do not, skill ratings match the level, and no single strategy wins. Answers 202 with the job; poll `GET /genie/calibrations/{id}`. With an `Idempotency-Key` header (1 to 200 characters) the same caller and key answer the job already started (200); the same key with another body is 422.',
    responses: { 202: { description: 'Started', schema: Job }, 200: { description: 'Already started with this Idempotency-Key', schema: Job }, 400: Err, 422: Err, 429: Err, 503: Err }
  }, async (c, { body, principal }) => {
    const key = c.req.header('idempotency-key')?.trim();
    if (key !== undefined && (key.length < 1 || key.length > 200)) return c.json({ message: 'Idempotency-Key must be 1 to 200 characters.', code: 'badIdempotencyKey' }, 400);
    const { job, created } = jobs.start(principal!.id, body as { storyline: Record<string, unknown> }, key);
    c.header('Location', `/genie/calibrations/${job.id}`);
    return c.json(job, created ? 202 : 200);
  });

  routes.add({
    method: 'get', path: '/genie/calibrations/{id}', tag: 'author', auth: ['author'], params: { id: Id },
    summary: 'A calibration: status, progress, and the results when done',
    responses: { 200: { description: 'CalibrationJob', schema: Job }, 404: Err }
  }, (c, { params, principal }) => c.json(jobs.get(principal!.id, params.id)));

  routes.add({
    method: 'get', path: '/genie/calibrations/{id}/playthroughs/{persona}/{index}', tag: 'author', auth: ['author'],
    params: { id: Id, persona: z.string().regex(new RegExp(`^(${PERSONA_KEYS.join('|')})$`)), index: z.string().regex(/^\d{1,3}$/) },
    summary: 'One playthrough of a finished calibration, week by week, with each conversation and why it got its rating',
    responses: { 200: { description: 'Playthrough', schema: named(Playthrough, 'Playthrough') }, 404: Err, 409: Err }
  }, (c, { params, principal }) => c.json(jobs.playthrough(principal!.id, params.id, params.persona as PersonaKey, Number(params.index))));

  routes.add({
    method: 'delete', path: '/genie/calibrations/{id}', tag: 'author', auth: ['author'], params: { id: Id },
    summary: 'Cancel a calibration', responses: { 204: { description: 'Cancelled, or already finished' }, 404: Err }
  }, (c, { params, principal }) => {
    jobs.cancel(principal!.id, params.id);
    return c.body(null, 204);
  });

  if (!ctx.ai.synthetic && ctx.ai.provider === 'anthropic') ctx.log.info('calibration: the ai module has no createSyntheticPlayer; synthetic players use the templates');
  return jobs;
}
