import { randomBytes } from 'node:crypto';
import { sign, verify } from 'hono/jwt';
import { LaunchClaims, type LaunchInput } from './principal';

/**
 * Signed launch links: `{PUBLIC_URL}/launch?token=<JWT>`. The LMS or GenieKreator signs the claims with
 * the shared `LAUNCH_SECRET` (HS256). The server checks the signature (any configured secret, for
 * rotation), the expiry, the audience and, when configured, the issuer; then opens a cookie session.
 */
export class LaunchError extends Error {
  readonly code = 'badLaunch';
}

/** The longest a launch link may live, whatever its `exp` says. */
export const MAX_LAUNCH_SECONDS = 7 * 24 * 3600;

export async function mintLaunchToken(claims: Omit<LaunchInput, 'exp' | 'iat'> & { exp?: number }, secret: string, opts: { ttlSeconds?: number; audience?: string; issuer?: string } = {}): Promise<string> {
  const iat = Math.floor(Date.now() / 1000);
  const payload = { ...claims, iat, exp: claims.exp ?? iat + (opts.ttlSeconds ?? 15 * 60), aud: claims.aud ?? opts.audience ?? 'ilead', ...(opts.issuer ? { iss: opts.issuer } : {}), jti: claims.jti ?? randomBytes(9).toString('base64url') };
  return sign(payload as Record<string, unknown>, secret, 'HS256');
}

export async function verifyLaunchToken(token: string, secrets: string[], opts: { audience: string; issuers: string[] }): Promise<LaunchClaims> {
  if (!token || token.length > 8192) throw new LaunchError('The launch link is missing or not valid.');
  let payload: unknown = null;
  let lastError: unknown = null;
  for (const secret of secrets) {
    try {
      payload = await verify(token, secret, { alg: 'HS256', aud: opts.audience });
      break;
    } catch (e) {
      lastError = e;
    }
  }
  if (!payload) {
    const expired = (lastError as Error | null)?.name === 'JwtTokenExpired';
    throw new LaunchError(expired ? 'The launch link has expired. Open the simulation again from your learning platform.' : 'The launch link is not valid.');
  }
  const r = LaunchClaims.safeParse(payload);
  if (!r.success) throw new LaunchError(`The launch link is not valid: ${r.error.issues.map(i => `${i.path.join('.')} ${i.message}`).join('; ')}`);
  const c = r.data;
  if (opts.issuers.length && (!c.iss || !opts.issuers.includes(c.iss))) throw new LaunchError('The launch link comes from an unknown issuer.');
  const now = Math.floor(Date.now() / 1000);
  if (c.exp - (c.iat ?? now) > MAX_LAUNCH_SECONDS) throw new LaunchError('The launch link lives too long.');
  return c;
}
