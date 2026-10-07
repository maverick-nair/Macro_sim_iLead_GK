import { z } from 'zod';
import { guardDraft } from '../../../src/author/copyGuard';
import { parseStoryline } from '../../../src/engine/config';
import { BenchmarkSummary } from '../../../src/engine/groupContract';
import { ThemeConfigSchema } from '../../../src/theme/schema';
import { ExternalId, Purpose, seesCohort, type Principal } from '../auth/principal';
import type { ServerContext } from '../context';
import { badRequest, forbidden, notFound } from '../http/errors';
import { named } from '../http/route';
import { benchmarkKey } from '../reports';
import { deleteParticipant } from './api';
import { runMeta } from './engine';

const Err = { description: 'Error: `{ message, code }`' };
const everything = (p: Principal) => p.cohorts.includes('*');

/**
 * Operations for GenieKreator and program teams: storylines (drafts and published versions), themes,
 * cohorts, benchmarks, privacy requests and retention. Staff roles only; cohort scoped where it applies.
 */
export function registerAdmin(ctx: ServerContext) {
  const { routes, repo } = ctx;

  // ---- Storylines ----
  routes.add({ method: 'get', path: '/api/admin/storylines', tag: 'admin', auth: ['author'], summary: 'Every storyline version (drafts and published)',
    responses: { 200: { description: 'Versions', schema: z.array(z.object({ id: z.string(), version: z.number(), status: z.enum(['draft', 'published']), name: z.string(), createdBy: z.string().nullable(), createdAt: z.string() })) } }
  }, async c => c.json((await repo.listStorylines()).map(({ config: _config, ...s }) => s)));

  routes.add({ method: 'get', path: '/api/admin/storylines/{id}', tag: 'admin', auth: ['author'], params: { id: ExternalId }, query: z.object({ version: z.coerce.number().int().min(1).optional() }),
    summary: 'A storyline: the latest published version, or `?version=`', responses: { 200: { description: 'Storyline version', schema: z.record(z.string(), z.unknown()) }, 404: Err }
  }, async (c, { params, query }) => {
    const s = await repo.getStoryline(params.id, query.version);
    if (!s) throw notFound('No such storyline', 'unknownStoryline');
    return c.json(s);
  });

  routes.add({ method: 'post', path: '/api/admin/storylines', tag: 'admin', auth: ['author'],
    body: z.object({ status: z.enum(['draft', 'published']), config: z.record(z.string(), z.unknown()) }),
    summary: 'Save a storyline as its next version (publish, or keep as a draft)',
    description: 'Checked against the storyline schema (storyline-config.json) and the copy rules. Runs in progress keep the version they started with.',
    responses: { 201: { description: 'Saved', schema: z.object({ id: z.string(), version: z.number(), status: z.string() }) }, 400: Err }
  }, async (c, { body, principal }) => {
    const r = parseStoryline(body.config);
    if (!r.ok) throw badRequest('The storyline does not parse', { issues: r.issues.slice(0, 20) });
    // Author copy rules (D70): no em dashes or dashes as punctuation, no emojis, "skills" never "competency", no
    // certification claims, KNOLSKAPE lens titles only. Hyphenated words are fine: the app's copy rules word them for participants.
    const copy = guardDraft(body.config).filter(i => i.rule !== 'dash');
    if (copy.length) throw badRequest('The storyline breaks the copy rules', { issues: copy.slice(0, 20) });
    if (!ExternalId.safeParse(r.config.id).success) throw badRequest('The storyline id must be letters, digits and . _ : @ | -');
    const saved = await repo.saveStoryline({ id: r.config.id, status: body.status, name: r.config.name, config: body.config, createdBy: principal!.id });
    return c.json({ id: saved.id, version: saved.version, status: saved.status }, 201);
  });

  // ---- Themes ----
  // Comments (`$description`, `$comment`) are allowed in theme files, as the theme loader allows them; they are not stored.
  const ThemeBody = z.preprocess(v => (v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).filter(([k]) => !k.startsWith('$'))) : v), named(ThemeConfigSchema, 'ThemeConfig'));
  routes.add({ method: 'put', path: '/api/admin/themes/{id}', tag: 'admin', auth: ['author', 'cohort_admin'], params: { id: ExternalId }, body: ThemeBody,
    summary: 'Save a client theme (theme-config.json)', responses: { 204: { description: 'Saved' }, 400: Err }
  }, async (c, { params, body }) => {
    await repo.putTheme(params.id, body);
    return c.body(null, 204);
  });

  // ---- Cohorts ----
  const CohortBody = z.object({ name: z.string().trim().min(1).max(200), storylineId: ExternalId.nullable().optional(), purpose: Purpose.nullable().optional(), themeId: ExternalId.nullable().optional() });
  routes.add({ method: 'put', path: '/api/admin/cohorts/{id}', tag: 'admin', auth: ['cohort_admin'], params: { id: ExternalId }, body: CohortBody,
    summary: 'Create or update a cohort: its name, storyline, purpose and theme', responses: { 200: { description: 'Cohort', schema: z.record(z.string(), z.unknown()) }, 403: Err }
  }, async (c, { params, body, principal }) => {
    if (!seesCohort(principal!, params.id)) throw forbidden('This cohort is not yours.');
    return c.json(await repo.upsertCohort({ id: params.id, ...body }));
  });

  routes.add({ method: 'get', path: '/api/admin/cohorts/{id}/runs', tag: 'admin', auth: ['cohort_admin', 'assessor'], params: { id: ExternalId },
    summary: 'The cohort\'s runs: who, which attempt, status and score (for assessors to pick runs to review)',
    responses: { 200: { description: 'Runs', schema: z.array(z.record(z.string(), z.unknown())) }, 403: Err }
  }, async (c, { params, principal }) => {
    if (!seesCohort(principal!, params.id)) throw forbidden('This cohort is not yours.');
    const runs = await repo.listCohortRuns(params.id);
    return c.json(runs.map(r => ({ ...runMeta(r), participantId: r.participantId, name: r.name, score: r.scoreTotal, headline: r.headline })));
  });

  // ---- Benchmarks ----
  routes.add({ method: 'post', path: '/api/admin/benchmarks/refresh', tag: 'admin', auth: ['cohort_admin'],
    summary: 'Recompute the benchmarks from every stored run now (they also refresh every BENCHMARK_REFRESH_HOURS)',
    responses: { 200: { description: 'Per lens: runs read and whether it was stored', schema: z.array(z.object({ lens: z.string(), runs: z.number(), stored: z.boolean() })) }, 403: Err }
  }, async (c, { principal }) => {
    if (!everything(principal!)) throw forbidden('Benchmarks span every cohort.');
    return c.json(await ctx.reports.refreshBenchmarks());
  });

  routes.add({ method: 'get', path: '/api/admin/benchmarks/{lens}', tag: 'admin', auth: ['cohort_admin'], params: { lens: ExternalId },
    summary: 'The benchmark a lens\'s group reports compare with', responses: { 200: { description: 'BenchmarkSummary', schema: named(BenchmarkSummary, 'BenchmarkSummary') }, 404: Err }
  }, async (c, { params }) => {
    const stored = await repo.getBenchmark(benchmarkKey(params.lens));
    const b = await ctx.reports.benchmark(params.lens);
    if (!b) throw notFound('No benchmark for this lens');
    c.header('X-Benchmark-Source', stored ? `stored ${stored.refreshedAt} (${stored.runs} runs)` : 'sample');
    return c.json(b);
  });

  // ---- Privacy and retention ----
  async function staffForParticipant(p: Principal, id: string) {
    const who = await repo.getParticipant(id);
    if (!who) throw notFound('No such participant');
    if (!everything(p) && !seesCohort(p, who.cohortId)) throw forbidden();
    return who;
  }

  routes.add({ method: 'get', path: '/api/admin/participants/{id}/export', tag: 'privacy', auth: ['cohort_admin'], params: { id: ExternalId },
    summary: 'Everything stored about a participant (a data subject request)', responses: { 200: { description: 'Export', schema: z.record(z.string(), z.unknown()) }, 403: Err, 404: Err }
  }, async (c, { params, principal }) => {
    await staffForParticipant(principal!, params.id);
    return c.json(await repo.exportParticipant(params.id));
  });

  routes.add({ method: 'delete', path: '/api/admin/participants/{id}', tag: 'privacy', auth: ['cohort_admin'], params: { id: ExternalId },
    summary: 'Delete a participant and everything stored about them', responses: { 204: { description: 'Deleted' }, 403: Err, 404: Err }
  }, async (c, { params, principal }) => {
    await staffForParticipant(principal!, params.id);
    await deleteParticipant(ctx, params.id);
    ctx.log.info('participant deleted', { participantId: params.id, by: principal!.id });
    return c.body(null, 204);
  });

  routes.add({ method: 'post', path: '/api/admin/retention/run', tag: 'privacy', auth: ['cohort_admin'],
    summary: 'Apply the retention policy now (RETENTION_DAYS; it also runs daily)', responses: { 200: { description: 'What was removed', schema: z.object({ sessions: z.number(), runs: z.number() }) }, 403: Err }
  }, async (c, { principal }) => {
    if (!everything(principal!)) throw forbidden();
    return c.json(await purge(ctx));
  });
}

/** Expired sessions always; runs untouched for RETENTION_DAYS when it is set. */
export async function purge(ctx: ServerContext) {
  const days = ctx.config.RETENTION_DAYS;
  const before = days > 0 ? new Date(Date.now() - days * 86400_000).toISOString() : null;
  const r = await ctx.repo.purge(before);
  if (r.runs) ctx.log.info('retention applied', { ...r, days });
  return r;
}
