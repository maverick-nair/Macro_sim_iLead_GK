import type { Context, Hono } from 'hono';
import { z } from 'zod';
import { requirePrincipal } from '../auth/session';
import type { Principal, Role } from '../auth/principal';
import { badRequest, HttpError } from './errors';
import type { RateLimiter } from './rateLimit';
import type { AppEnv } from './types';

/**
 * Routes are declared once with their Zod schemas: the declaration validates every request (body,
 * query and path) and also writes the OpenAPI document served at /openapi.json, so the two never drift.
 */
type Method = 'get' | 'post' | 'put' | 'delete';
export interface ResponseDef { description: string; schema?: z.ZodType; contentType?: string }

export interface RouteDef<B extends z.ZodType | undefined, Q extends z.ZodType | undefined> {
  method: Method;
  /** OpenAPI style: `/engine/sessions/{session}/view`. */
  path: string;
  tag: string;
  summary: string;
  description?: string;
  /** `public`: no sign in. Otherwise a signed in caller holding one of the roles (any role when empty). */
  auth: 'public' | readonly Role[];
  body?: B;
  /** The request body is raw bytes of this type (audio), not JSON. */
  rawBody?: string;
  query?: Q;
  /** Path parameters, each checked with this pattern. */
  params?: Record<string, z.ZodString>;
  responses: Record<number, ResponseDef>;
  /** Rate limit bucket, keyed by the caller. */
  limit?: 'ai' | 'email' | 'launch';
}

export interface Input<B, Q> {
  body: B;
  query: Q;
  params: Record<string, string>;
  principal: Principal | null;
}

/** Schemas shared by many routes become named components in the OpenAPI document. */
const names = new Map<z.ZodType, string>();
export function named<T extends z.ZodType>(schema: T, name: string): T {
  names.set(schema, name);
  return schema;
}

const PathId = z.string().min(1).max(200);

export class Routes {
  readonly defs: Array<RouteDef<z.ZodType | undefined, z.ZodType | undefined>> = [];
  constructor(private readonly app: Hono<AppEnv>, readonly limiter: RateLimiter, private readonly trustProxy = false) {}

  add<B extends z.ZodType | undefined = undefined, Q extends z.ZodType | undefined = undefined>(
    def: RouteDef<B, Q>,
    handler: (c: Context<AppEnv>, input: Input<B extends z.ZodType ? z.output<B> : undefined, Q extends z.ZodType ? z.output<Q> : undefined>) => Response | Promise<Response>
  ) {
    this.defs.push(def as RouteDef<z.ZodType | undefined, z.ZodType | undefined>);
    const honoPath = def.path.replace(/\{(\w+)\}/g, ':$1');
    this.app.on(def.method.toUpperCase(), honoPath, async c => {
      const principal = def.auth === 'public' ? c.get('principal') : requirePrincipal(c, def.auth);
      if (def.limit) {
        const key = `${def.limit}:${principal?.id ?? clientIp(c, this.trustProxy)}`;
        const r = this.limiter.hit(def.limit, key);
        if (!r.ok) {
          c.header('Retry-After', String(r.retryAfter));
          throw new HttpError(429, 'rateLimited', 'Too many requests. Wait a moment and try again.');
        }
      }
      const params: Record<string, string> = {};
      for (const m of def.path.matchAll(/\{(\w+)\}/g)) {
        const raw = c.req.param(m[1]) ?? '';
        const v = (def.params?.[m[1]] ?? PathId).safeParse(raw);
        if (!v.success) throw badRequest(`The ${m[1]} in the address is not valid`);
        params[m[1]] = v.data;
      }
      let query: unknown = undefined;
      if (def.query) {
        const v = def.query.safeParse(c.req.query());
        if (!v.success) throw badRequest('The query is not valid', { issues: v.error.issues.map(i => ({ path: i.path.join('.'), message: i.message })) });
        query = v.data;
      }
      let body: unknown = undefined;
      if (def.body) {
        let raw: unknown;
        try {
          const text = await c.req.text();
          raw = text ? JSON.parse(text) : undefined;
        } catch {
          throw badRequest('The body is not JSON');
        }
        const v = def.body.safeParse(raw);
        if (!v.success) throw badRequest('The request is not valid', { issues: v.error.issues.slice(0, 20).map(i => ({ path: i.path.join('.'), message: i.message })) });
        body = v.data;
      }
      return handler(c, { body, query, params, principal } as never);
    });
  }

  /** The OpenAPI 3.1 document of every declared route. */
  openapi(info: { title: string; version: string; serverUrl: string }) {
    const components: Record<string, unknown> = {};
    const schemaOf = (s: z.ZodType) => {
      const name = names.get(s);
      const json = z.toJSONSchema(s, { io: 'input', unrepresentable: 'any', target: 'draft-2020-12' }) as Record<string, unknown>;
      delete json.$schema;
      if (!name) return json;
      components[name] ??= json;
      return { $ref: `#/components/schemas/${name}` };
    };
    const paths: Record<string, Record<string, unknown>> = {};
    for (const d of this.defs) {
      const parameters: unknown[] = [...d.path.matchAll(/\{(\w+)\}/g)].map(m => ({ name: m[1], in: 'path', required: true, schema: { type: 'string' } }));
      if (d.query) {
        const q = schemaOf(d.query) as { properties?: Record<string, unknown>; required?: string[] };
        for (const [name, schema] of Object.entries(q.properties ?? {})) parameters.push({ name, in: 'query', required: q.required?.includes(name) ?? false, schema });
      }
      const op: Record<string, unknown> = {
        tags: [d.tag], summary: d.summary, ...(d.description ? { description: d.description } : {}),
        operationId: `${d.method}${d.path.replace(/\{(\w+)\}/g, 'By_$1').replace(/[^A-Za-z0-9_]+(.)?/g, (_, ch: string | undefined) => (ch ? ch.toUpperCase() : ''))}`,
        security: d.auth === 'public' ? [] : [{ session: [] }, { bearer: [] }],
        ...(d.auth !== 'public' && d.auth.length ? { 'x-roles': d.auth } : {}),
        ...(d.limit ? { 'x-rate-limit': d.limit } : {}),
        ...(parameters.length ? { parameters } : {}),
        ...(d.body ? { requestBody: { required: true, content: { 'application/json': { schema: schemaOf(d.body) } } } } : {}),
        ...(d.rawBody ? { requestBody: { required: true, content: { [d.rawBody]: { schema: { type: 'string', format: 'binary' } } } } } : {}),
        responses: Object.fromEntries(Object.entries(d.responses).map(([status, r]) => [status, {
          description: r.description,
          ...(r.schema || r.contentType ? { content: { [r.contentType ?? 'application/json']: { schema: r.schema ? schemaOf(r.schema) : { type: 'string', format: 'binary' } } } } : {})
        }]))
      };
      (paths[d.path] ??= {})[d.method] = op;
    }
    components.Error ??= { type: 'object', required: ['message', 'code'], properties: { message: { type: 'string' }, code: { type: 'string' } } };
    return {
      openapi: '3.1.0',
      info: { title: info.title, version: info.version, description: 'The iLead reference server. Errors are `{ message, code }` with a non 2xx status; 5xx is retryable. See docs/SERVER.md.' },
      servers: [{ url: info.serverUrl }],
      components: {
        securitySchemes: {
          session: { type: 'apiKey', in: 'cookie', name: 'ilead_session', description: 'Set by GET /launch from a signed launch link.' },
          bearer: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description: 'A launch JWT (machine callers) or the ADMIN_TOKEN.' }
        },
        schemas: components
      },
      paths
    };
  }
}

/** The caller's address: the socket's, or the first X-Forwarded-For hop behind a trusted proxy (`TRUST_PROXY`). */
export function clientIp(c: Context<AppEnv>, trustProxy: boolean): string {
  const fwd = trustProxy ? c.req.header('x-forwarded-for')?.split(',')[0]?.trim() : undefined;
  if (fwd) return fwd;
  const env = c.env as { incoming?: { socket?: { remoteAddress?: string } } } | undefined;
  return env?.incoming?.socket?.remoteAddress ?? 'unknown';
}
