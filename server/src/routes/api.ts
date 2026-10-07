import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { DEFAULT_SCENARIO } from '../../../src/data/scenario';
import { GroupReport, GroupReportRequest } from '../../../src/engine/groupContract';
import { History } from '../../../src/engine/reportContract';
import type { RunSummary } from '../../../src/engine/report/summary';
import { ThemeConfigSchema } from '../../../src/theme/schema';
import { ExternalId, seesCohort, type Principal } from '../auth/principal';
import type { ServerContext } from '../context';
import { forbidden, HttpError, notFound } from '../http/errors';
import { named } from '../http/route';
import { reportEmail } from '../report/email';
import type { RunRow } from '../store/repo';
import { ownerOf } from './engine';

const Err = { description: 'Error: `{ message, code }`' };
const None = { description: 'None (not an error: the app falls back)' };
const Group = named(GroupReport, 'GroupReport');

/** The app's settings (src/app/types.ts `Settings`). */
export const Settings = z.object({
  text: z.number().int().min(50).max(300), captions: z.boolean(), reduced: z.boolean(), input: z.enum(['text', 'ptt', 'open']), clock: z.boolean(),
  voiceConsent: z.boolean().nullable(), actionsCollapsed: z.boolean().optional()
}).strict();

const LeaderboardResult = z.object({ score: z.number().finite(), conversions: z.number().finite(), capability: z.number().finite() });

/** The report's PDF for a run: rendered once per version of the run (its event count), then served from the cache. */
export async function reportPdf(ctx: ServerContext, run: RunRow): Promise<Buffer> {
  if (!ctx.pdf) throw new HttpError(501, 'pdfOff', 'There is no PDF service here.');
  const version = `${run.eventCount}`;
  const cached = await ctx.repo.getPdf(run.id, version);
  if (cached) return cached;
  // A short session for the renderer, as the participant, then gone.
  const token = randomBytes(32).toString('base64url');
  await ctx.repo.createSession({ id: token, participantId: run.participantId, claims: { sub: run.participantId, roles: ['participant'], storyline: run.storylineId, exp: Math.floor(Date.now() / 1000) + 300, attempt: 'resume' }, expiresAt: new Date(Date.now() + 5 * 60_000).toISOString() });
  try {
    const url = `${ctx.config.appUrl}/report/print?participant=${encodeURIComponent(run.participantId)}`;
    const pdf = await ctx.pdf.render({ url, cookie: { name: ctx.config.SESSION_COOKIE, value: token } });
    await ctx.repo.putPdf(run.id, version, pdf);
    return pdf;
  } finally {
    await ctx.repo.deleteSession(token);
  }
}

/** Privacy deletion: the stored data, and any engine still in memory. */
export async function deleteParticipant(ctx: ServerContext, id: string) {
  for (const r of await ctx.repo.listRuns(id)) ctx.runs.forget(r.id);
  return ctx.repo.deleteParticipant(id);
}

export function registerApi(ctx: ServerContext) {
  const { routes, repo, runs, reports } = ctx;
  const participant = ['participant'] as const;

  const currentRun = (p: Principal | null) => runs.current(ownerOf(p!));

  routes.add({ method: 'get', path: '/api/profile', tag: 'app', auth: participant, summary: 'Who launched the run, for the report header',
    responses: { 200: { description: 'Profile', schema: z.object({ name: z.string().nullable(), cohort: z.string().nullable(), exit: z.string().nullable().describe('Where Exit in the game menu returns to, from the launch (D89)') }) } }
  }, async (c, { principal }) => {
    const me = await repo.getParticipant(principal!.id);
    const cohortId = principal!.cohort ?? me?.cohortId ?? null;
    const cohort = cohortId ? await repo.getCohort(cohortId) : null;
    return c.json({ name: principal!.name ?? me?.name ?? null, cohort: cohort?.name ?? cohortId, exit: principal!.exit });
  });

  routes.add({ method: 'get', path: '/api/theme', tag: 'app', auth: [], summary: 'The client theme JSON (theme-config.json), or 404: the iLead theme',
    responses: { 200: { description: 'Theme', schema: named(ThemeConfigSchema, 'ThemeConfig') }, 404: None }
  }, async (c, { principal }) => {
    const me = principal!.roles.includes('participant') ? await repo.getParticipant(principal!.id) : null;
    const cohortId = principal!.cohort ?? me?.cohortId ?? null;
    const themeId = principal!.theme ?? (cohortId ? (await repo.getCohort(cohortId))?.themeId : null);
    const theme = themeId ? await repo.getTheme(themeId) : null;
    if (!theme) return c.json({ message: 'none', code: 'none' }, 404);
    c.header('Cache-Control', 'private, max-age=300');
    return c.json(theme);
  });

  routes.add({ method: 'get', path: '/api/history', tag: 'app', auth: participant, summary: 'Earlier attempts, oldest first, or 404: none',
    responses: { 200: { description: 'History', schema: named(History, 'History') }, 404: None }
  }, async (c, { principal }) => {
    const entries = await reports.history(principal!.id, await currentRun(principal));
    return entries.length ? c.json(entries) : c.json({ message: 'none', code: 'none' }, 404);
  });

  routes.add({ method: 'post', path: '/api/cohort/leaderboard', tag: 'app', auth: participant,
    body: z.object({ size: z.number().int().min(1).max(100), anonymous: z.boolean(), you: LeaderboardResult }),
    summary: 'The cohort leaderboard: top `size`, plus the caller when outside it',
    responses: { 200: { description: 'Leaderboard', schema: z.object({ entries: z.array(LeaderboardResult.extend({ rank: z.number().int(), name: z.string().nullable(), you: z.boolean() })), total: z.number().int() }) } }
  }, async (c, { principal, body }) => {
    const run = await currentRun(principal);
    if (run.purpose === 'assessment') throw forbidden('There is no leaderboard in an assessment.');
    const me = await repo.getParticipant(principal!.id);
    return c.json(await reports.leaderboard({ participantId: principal!.id, cohortId: run.cohortId ?? me?.cohortId ?? null, current: run, ...body }));
  });

  routes.add({ method: 'get', path: '/api/cohort/{id}/report', tag: 'cohort', auth: ['cohort_admin', 'assessor'], params: { id: ExternalId },
    summary: 'The cohort\'s group report (D77), or 404: no such cohort',
    responses: { 200: { description: 'GroupReport', schema: Group }, 403: Err, 404: None }
  }, async (c, { params, principal }) => {
    if (!seesCohort(principal!, params.id)) throw forbidden('This cohort is not yours.');
    const report = await reports.groupReport(params.id);
    return report ? c.json(report) : c.json({ message: 'No such cohort', code: 'none' }, 404);
  });

  routes.add({ method: 'post', path: '/api/cohort/report', tag: 'cohort', auth: ['cohort_admin'], body: named(GroupReportRequest, 'GroupReportRequest'),
    summary: 'A group report from run summaries the caller sends (for a server that stores only summaries)',
    responses: { 200: { description: 'GroupReport', schema: Group }, 400: Err, 403: Err }
  }, async (c, { body, principal }) => {
    if (!seesCohort(principal!, body.cohort.id)) throw forbidden('This cohort is not yours.');
    return c.json(await reports.groupReportFrom(body as unknown as { cohort: { id: string; name: string; date: string; purpose: 'development' | 'assessment' }; runs: Array<{ name: string; summary: RunSummary }> }));
  });

  routes.add({ method: 'get', path: '/api/report.pdf', tag: 'report', auth: participant,
    summary: 'The participant\'s report as a PDF, rendered by headless Chromium from the print view, cached per run',
    responses: { 200: { description: 'PDF', contentType: 'application/pdf' }, 404: { description: 'No report yet (the run has not ended)' }, 501: { description: 'No PDF service: the app opens its print view' } }
  }, async (c, { principal }) => {
    const run = await currentRun(principal);
    if (run.status !== 'ended') return c.json({ message: 'The report is ready once the run has ended.', code: 'noReport' }, 404);
    const pdf = await reportPdf(ctx, run);
    return c.body(new Uint8Array(pdf), 200, {
      'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${run.purpose}-report.pdf"`, 'Cache-Control': 'private, no-store'
    });
  });

  routes.add({ method: 'post', path: '/api/report/email', tag: 'report', auth: participant, limit: 'email',
    summary: 'Email the report (PDF attached) to the participant\'s work address, once the run has ended',
    responses: { 204: { description: 'Sent' }, 409: Err, 429: Err, 501: { description: 'Email is not configured' } }
  }, async (c, { principal }) => {
    if (!ctx.mailer) throw new HttpError(501, 'emailOff', 'Email is not set up here.');
    const run = await currentRun(principal);
    if (run.status !== 'ended') throw new HttpError(409, 'noReport', 'The report is ready once the run has ended.');
    const me = await repo.getParticipant(principal!.id);
    const to = principal!.email ?? me?.email;
    if (!to) throw new HttpError(409, 'noEmail', 'There is no work address for you. Ask your program team to add it to your launch.');
    const hourAgo = new Date(Date.now() - 3600_000).toISOString();
    if (await repo.countEmails(principal!.id, hourAgo) >= ctx.config.RATE_LIMIT_EMAIL_PER_HOUR) throw new HttpError(429, 'rateLimited', 'The report was emailed several times this hour. Try again later.');
    const pdf = await reportPdf(ctx, run);
    const storyline = (run.config as { name?: string }).name ?? 'iLead';
    const mail = reportEmail({ name: principal!.name ?? me?.name ?? null, storyline, purpose: run.purpose });
    try {
      const sent = await ctx.mailer.send({ to, ...mail, attachments: [{ filename: `${run.purpose}-report.pdf`, content: pdf, contentType: 'application/pdf' }] });
      await repo.logEmail({ participantId: principal!.id, runId: run.id, to, template: `report.${run.purpose}`, status: 'sent', messageId: sent.messageId, error: null });
    } catch (e) {
      await repo.logEmail({ participantId: principal!.id, runId: run.id, to, template: `report.${run.purpose}`, status: 'failed', messageId: null, error: (e as Error).message.slice(0, 500) });
      ctx.log.error('report email failed', { runId: run.id, err: e });
      throw new HttpError(502, 'emailFailed', 'The email could not be sent. Try again later.');
    }
    return c.body(null, 204);
  });

  // ---- The app shell's session and the design prototype's board ----

  routes.add({ method: 'get', path: '/api/scenario', tag: 'app', auth: participant, summary: 'The design prototype\'s fixed scenario (the app shell reads it on load)',
    responses: { 200: { description: 'Scenario', schema: z.record(z.string(), z.unknown()) } }
  }, c => {
    c.header('Cache-Control', 'private, max-age=3600');
    return c.json(DEFAULT_SCENARIO);
  });

  routes.add({ method: 'get', path: '/api/session', tag: 'app', auth: participant, summary: 'Saved settings, or 404: a fresh start',
    responses: { 200: { description: 'SessionSnapshot', schema: z.object({ week: z.number(), day: z.number(), capacity: z.number(), secs: z.number(), styles: z.record(z.string(), z.string()), settings: Settings }) }, 404: None }
  }, async (c, { principal }) => {
    const me = await repo.getParticipant(principal!.id);
    const settings = Settings.safeParse(me?.settings);
    if (!settings.success) return c.json({ message: 'none', code: 'none' }, 404);
    // The engine board keeps its own state; the shell restores the settings and the session clock.
    return c.json({ week: 1, day: 1, capacity: 2.5, secs: 2292, styles: {}, settings: settings.data });
  });

  routes.add({ method: 'put', path: '/api/session/settings', tag: 'app', auth: participant, body: Settings, summary: 'Save the participant\'s settings',
    responses: { 204: { description: 'Saved' }, 400: Err }
  }, async (c, { principal, body }) => {
    await repo.upsertParticipant({ id: principal!.id });
    await repo.saveSettings(principal!.id, body);
    return c.body(null, 204);
  });

  // The prototype board's writes (`?engine=off`): the playable app uses the engine instead.
  for (const [method, path] of [['put', '/api/weeks/{week}/styles/{member}'], ['post', '/api/weeks/{week}/actions'], ['post', '/api/interactions'], ['post', '/api/weeks/{week}/end']] as const) {
    routes.add({ method, path, tag: 'app', auth: participant, summary: 'Design prototype only: not served (the playable app uses the engine)', responses: { 501: Err } },
      c => c.json({ message: 'The design prototype board is not served by this server.', code: 'notImplemented' }, 501));
  }

  // ---- Privacy: the participant's own data ----

  routes.add({ method: 'get', path: '/api/privacy/export', tag: 'privacy', auth: participant, summary: 'Everything stored about me, as JSON',
    responses: { 200: { description: 'Export', schema: z.record(z.string(), z.unknown()) }, 404: None }
  }, async (c, { principal }) => {
    const data = await repo.exportParticipant(principal!.id);
    if (!data) throw notFound('Nothing is stored about you', 'none');
    c.header('Content-Disposition', 'attachment; filename="ilead-data.json"');
    return c.json(data);
  });

  routes.add({ method: 'delete', path: '/api/privacy/me', tag: 'privacy', auth: participant, summary: 'Delete everything stored about me, and sign out',
    responses: { 204: { description: 'Deleted' } }
  }, async (c, { principal }) => {
    await deleteParticipant(ctx, principal!.id);
    await ctx.sessions.close(c);
    ctx.log.info('participant deleted their data', { participantId: principal!.id });
    return c.body(null, 204);
  });
}
