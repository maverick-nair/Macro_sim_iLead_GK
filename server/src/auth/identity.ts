import type { Hono } from 'hono';
import type { AppEnv } from '../http/types';
import type { LaunchClaims } from './principal';

/**
 * Where identities come from. Today: the signed launch link (`LaunchLinkProvider` in session.ts).
 * LTI 1.3 and SSO plug in here later (docs/SERVER.md "LTI 1.3 and SSO"): a provider mounts the routes
 * its protocol needs and turns a verified assertion into the same `LaunchClaims`, so sessions, roles and
 * everything after the launch stay as they are.
 *
 * LTI 1.3, in short: `mount` adds `GET|POST /lti/login` (OIDC third party login: redirect to the
 * platform's auth endpoint with state and nonce), `POST /lti/launch` (verify the `id_token` against the
 * platform's JWKS, e.g. with `verifyWithJwks` from hono/jwt; check iss, aud, nonce, deployment id) and
 * `GET /.well-known/jwks.json` (the tool's public key, for deep linking and services). The id token maps:
 * `sub` to `sub`, `name`, `email`, the context id to `cohort`, a custom parameter to `storyline` and
 * `purpose`, and LTI roles (Learner to participant, Instructor to assessor and cohort_admin,
 * ContentDeveloper to author).
 *
 * SSO (OIDC) for staff, in short: `mount` adds `/sso/login` and `/sso/callback` (authorization code flow
 * with PKCE), and maps the IdP's groups to roles and cohorts.
 */
export interface IdentityProvider {
  /** For logs: `launch-link`, `lti13`, `oidc`. */
  readonly id: string;
  /** Adds the provider's routes. Each ends by calling `openSession(c, claims)` (session.ts). */
  mount(app: Hono<AppEnv>): void;
}
