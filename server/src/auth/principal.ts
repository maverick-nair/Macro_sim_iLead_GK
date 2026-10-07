import { z } from 'zod';

/**
 * Roles (docs/SERVER.md "Auth"):
 * - participant: plays their own runs; reads their own report, history, theme and profile.
 * - assessor: reads runs and reviews live conversations (engine.review) in their cohorts.
 * - cohort_admin: the organization's group report and cohort management for their cohorts.
 * - author: GenieKreator's author chat, storyline drafts and publishing, themes.
 */
export const ROLES = ['participant', 'assessor', 'cohort_admin', 'author'] as const;
export const Role = z.enum(ROLES);
export type Role = z.output<typeof Role>;

/** Ids from the LMS: letters, digits and a few separators, so they are safe in paths and logs. */
export const ExternalId = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:@|-]{0,127}$/, 'an id of letters, digits and . _ : @ | -, up to 128 characters');
export const Purpose = z.enum(['development', 'assessment']);

/**
 * The launch link's claims: an HS256 JWT signed with `LAUNCH_SECRET` by the LMS or GenieKreator
 * (`npm run server:mint` makes one for testing). Short lived: `exp` is required.
 */
export const LaunchClaims = z.object({
  /** The participant (or staff member) id. */
  sub: ExternalId,
  name: z.string().trim().min(1).max(200).optional(),
  /** Work address for the report email. */
  email: z.string().email().max(320).optional(),
  cohort: ExternalId.optional(),
  /** Staff only: every cohort they may see. `*` means all. */
  cohorts: z.array(z.union([ExternalId, z.literal('*')])).max(500).optional(),
  storyline: ExternalId.optional(),
  purpose: Purpose.optional(),
  theme: ExternalId.optional(),
  locale: z.string().regex(/^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/).optional(),
  roles: z.array(Role).min(1).max(4).default(['participant']),
  /** `new` starts a fresh attempt; `resume` (the default) opens the latest one. */
  attempt: z.enum(['resume', 'new']).default('resume'),
  /** Where to land after the launch: a path on this site only. */
  redirect: z.string().max(500).regex(/^\/(?!\/)[^\s\\]*$/, 'a path on this site').optional(),
  exp: z.number(),
  iat: z.number().optional(),
  nbf: z.number().optional(),
  iss: z.string().optional(),
  aud: z.union([z.string(), z.array(z.string())]).optional(),
  jti: z.string().max(200).optional()
});
export type LaunchClaims = z.output<typeof LaunchClaims>;
export type LaunchInput = z.input<typeof LaunchClaims>;

/** Who is calling. */
export interface Principal {
  /** The participant or staff id (`sub`). */
  id: string;
  name: string | null;
  email: string | null;
  cohort: string | null;
  cohorts: string[];
  storyline: string | null;
  purpose: 'development' | 'assessment' | null;
  theme: string | null;
  locale: string | null;
  roles: Role[];
  via: 'cookie' | 'bearer' | 'admin';
  sessionId: string | null;
}

export function principalOf(c: LaunchClaims, via: Principal['via'], sessionId: string | null): Principal {
  return {
    id: c.sub, name: c.name ?? null, email: c.email ?? null, cohort: c.cohort ?? null, cohorts: c.cohorts ?? [], storyline: c.storyline ?? null,
    purpose: c.purpose ?? null, theme: c.theme ?? null, locale: c.locale ?? null, roles: c.roles, via, sessionId
  };
}

/** The operator, from `Authorization: Bearer <ADMIN_TOKEN>`: every role, every cohort. */
export const ADMIN: Principal = { id: 'admin', name: 'Administrator', email: null, cohort: null, cohorts: ['*'], storyline: null, purpose: null, theme: null, locale: null, roles: [...ROLES], via: 'admin', sessionId: null };

export const hasRole = (p: Principal | null, ...roles: Role[]) => !!p && roles.some(r => p.roles.includes(r));

/** Staff see a cohort when it is theirs (`cohort`, `cohorts`) or they hold `*`. */
export const seesCohort = (p: Principal, cohortId: string | null) => p.cohorts.includes('*') || (!!cohortId && (p.cohort === cohortId || p.cohorts.includes(cohortId)));
