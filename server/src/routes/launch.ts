import type { Context } from 'hono';
import { z } from 'zod';
import { launchSecrets } from '../config';
import type { ServerContext } from '../context';
import { LaunchError, verifyLaunchToken } from '../auth/launch';
import { Role, type LaunchClaims } from '../auth/principal';
import type { AppEnv } from '../http/types';
import { ownerOf } from './engine';

/** Where a launch lands: the claim's path, else the participant app (with `?participant=`), the group report or the author chat. */
export function landing(claims: LaunchClaims, base: string): string {
  if (claims.redirect) return claims.redirect;
  if (claims.roles.includes('participant')) {
    const u = new URL(base, 'http://x');
    u.searchParams.set('participant', claims.sub);
    return `${u.pathname}${u.search}`;
  }
  if (claims.roles.includes('cohort_admin') || claims.roles.includes('assessor')) return claims.cohort ? `/group?cohort=${encodeURIComponent(claims.cohort)}` : '/group';
  return '/author';
}

const page = (title: string, body: string) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title></head>
<body style="font-family:system-ui,sans-serif;max-width:560px;margin:15vh auto;padding:0 24px;line-height:1.5"><h1 style="font-size:24px">${title}</h1><p>${body}</p></body></html>`;

/**
 * The launch: the LMS or GenieKreator opens `/launch?token=<JWT>` (or POSTs `token` as a form field).
 * The server checks the link, records the participant (and the cohort), opens a cookie session and
 * redirects into the app. `npm run server:mint` makes links for testing.
 */
export function registerLaunch(ctx: ServerContext) {
  const { routes, config, repo, runs } = ctx;

  async function launch(c: Context<AppEnv>, token: string | undefined) {
    let claims: LaunchClaims;
    try {
      claims = await verifyLaunchToken(token ?? '', launchSecrets(config), { audience: config.LAUNCH_AUDIENCE, issuers: config.LAUNCH_ISSUERS });
    } catch (e) {
      ctx.log.warn('launch refused', { reason: (e as Error).message });
      const msg = e instanceof LaunchError ? e.message : 'The launch link is not valid.';
      return c.html(page('This link does not work', msg.replace(/[<>&]/g, '')), 401);
    }
    if (claims.cohort) {
      const known = await repo.getCohort(claims.cohort);
      if (!known) await repo.upsertCohort({ id: claims.cohort, name: claims.cohort, storylineId: claims.storyline ?? null, purpose: claims.purpose ?? null, themeId: claims.theme ?? null });
    }
    if (claims.roles.includes('participant')) {
      await repo.upsertParticipant({ id: claims.sub, name: claims.name ?? null, email: claims.email ?? null, cohortId: claims.cohort ?? null, locale: claims.locale ?? null });
    }
    const principal = await ctx.sessions.open(c, claims);
    if (claims.roles.includes('participant') && claims.attempt === 'new') {
      const latest = await runs.current(ownerOf(principal));
      if (latest.eventCount > 0) await runs.start(ownerOf(principal));
    }
    ctx.log.info('launch', { participantId: claims.sub, roles: claims.roles, cohort: claims.cohort, storyline: claims.storyline });
    c.header('Cache-Control', 'no-store');
    c.header('Referrer-Policy', 'no-referrer');
    return c.redirect(landing(claims, config.LAUNCH_REDIRECT), 303);
  }

  routes.add({ method: 'get', path: '/launch', tag: 'auth', auth: 'public', limit: 'launch', query: z.object({ token: z.string().max(8192).optional() }),
    summary: 'Open a session from a signed launch link, then redirect into the app',
    responses: { 303: { description: 'Signed in: to the app' }, 401: { description: 'The link is not valid or has expired (an HTML page)' } }
  }, (c, { query }) => launch(c, query.token));

  routes.add({ method: 'post', path: '/launch', tag: 'auth', auth: 'public', limit: 'launch',
    summary: 'The same, for an LMS that POSTs the token as a form field (`token`)',
    responses: { 303: { description: 'Signed in: to the app' }, 401: { description: 'The link is not valid or has expired' } }
  }, async c => {
    const type = c.req.header('content-type') ?? '';
    let token: string | undefined;
    if (type.includes('application/json')) token = ((await c.req.json().catch(() => ({}))) as { token?: string }).token;
    else token = String((await c.req.parseBody().catch(() => ({} as Record<string, unknown>))).token ?? '');
    return launch(c, token);
  });

  routes.add({ method: 'get', path: '/auth/me', tag: 'auth', auth: [], summary: 'Who is signed in',
    responses: { 200: { description: 'The caller', schema: z.object({ id: z.string(), name: z.string().nullable(), roles: z.array(Role), cohort: z.string().nullable(), storyline: z.string().nullable() }) }, 401: { description: 'Not signed in' } }
  }, (c, { principal: p }) => c.json({ id: p!.id, name: p!.name, roles: p!.roles, cohort: p!.cohort, storyline: p!.storyline }));

  routes.add({ method: 'post', path: '/auth/logout', tag: 'auth', auth: 'public', summary: 'End the session', responses: { 204: { description: 'Signed out' } } }, async c => {
    await ctx.sessions.close(c);
    return c.body(null, 204);
  });
}
