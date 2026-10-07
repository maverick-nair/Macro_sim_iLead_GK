import { randomBytes, timingSafeEqual } from 'node:crypto';
import type { Context, MiddlewareHandler } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import type { Config } from '../config';
import { launchSecrets } from '../config';
import { forbidden, unauthorized } from '../http/errors';
import type { AppEnv } from '../http/types';
import type { Repository } from '../store';
import { verifyLaunchToken } from './launch';
import { ADMIN, hasRole, LaunchClaims, principalOf, type Principal, type Role } from './principal';

/**
 * Sessions are rows in the store, named by a random id in an HTTP only cookie. Server side sessions can
 * be revoked (logout, privacy deletion) and carry no claims a browser could read. Machine callers (an LMS
 * backend, GenieKreator) may instead send `Authorization: Bearer <launch JWT>` on each request; operators
 * send `Authorization: Bearer <ADMIN_TOKEN>`.
 */
export interface Sessions {
  open(c: Context<AppEnv>, claims: LaunchClaims): Promise<Principal>;
  close(c: Context<AppEnv>): Promise<void>;
  middleware: MiddlewareHandler<AppEnv>;
}

const safeEqual = (a: string, b: string) => {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

export function createSessions(config: Config, repo: Repository): Sessions {
  const cookieOpts = () => ({
    httpOnly: true, secure: config.COOKIE_SECURE, sameSite: config.COOKIE_SAMESITE, path: '/', maxAge: config.SESSION_TTL_HOURS * 3600,
    ...(config.COOKIE_DOMAIN ? { domain: config.COOKIE_DOMAIN } : {})
  } as const);

  return {
    async open(c, claims) {
      const id = randomBytes(32).toString('base64url');
      const expiresAt = new Date(Date.now() + config.SESSION_TTL_HOURS * 3600_000).toISOString();
      await repo.createSession({ id, participantId: claims.roles.includes('participant') ? claims.sub : null, claims, expiresAt });
      setCookie(c, config.SESSION_COOKIE, id, cookieOpts());
      return principalOf(claims, 'cookie', id);
    },
    async close(c) {
      const id = getCookie(c, config.SESSION_COOKIE);
      if (id) await repo.deleteSession(id);
      deleteCookie(c, config.SESSION_COOKIE, { path: '/', ...(config.COOKIE_DOMAIN ? { domain: config.COOKIE_DOMAIN } : {}) });
    },
    middleware: async (c, next) => {
      c.set('principal', null);
      const auth = c.req.header('authorization');
      if (auth?.startsWith('Bearer ')) {
        const token = auth.slice(7).trim();
        if (config.ADMIN_TOKEN && safeEqual(token, config.ADMIN_TOKEN)) c.set('principal', ADMIN);
        else {
          try {
            const claims = await verifyLaunchToken(token, launchSecrets(config), { audience: config.LAUNCH_AUDIENCE, issuers: config.LAUNCH_ISSUERS });
            c.set('principal', principalOf(claims, 'bearer', null));
          } catch {
            throw unauthorized('The bearer token is not valid.');
          }
        }
      } else {
        const id = getCookie(c, config.SESSION_COOKIE);
        if (id && id.length < 100) {
          const s = await repo.getSession(id);
          if (s && s.expiresAt > new Date().toISOString()) {
            const claims = LaunchClaims.safeParse(s.claims);
            if (claims.success) c.set('principal', principalOf(claims.data, 'cookie', id));
          }
        }
      }
      await next();
    }
  };
}

/** The caller, or 401. With roles: 403 unless they hold one of them. */
export function requirePrincipal(c: Context<AppEnv>, roles?: readonly Role[]): Principal {
  const p = c.get('principal');
  if (!p) throw unauthorized();
  if (roles?.length && !hasRole(p, ...roles)) throw forbidden();
  return p;
}
