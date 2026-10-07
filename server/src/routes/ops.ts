import fs from 'node:fs';
import path from 'node:path';
import type { Hono } from 'hono';
import { z } from 'zod';
import type { ServerContext } from '../context';
import { ENGINE_VERSION } from '../engine/runs';
import type { AppEnv } from '../http/types';

/** Health (`/healthz`: the process answers) and readiness (`/readyz`: the database answers), and the OpenAPI document. */
export function registerOps(ctx: ServerContext) {
  const { routes } = ctx;
  routes.add({ method: 'get', path: '/healthz', tag: 'ops', auth: 'public', summary: 'Liveness: the process answers',
    responses: { 200: { description: 'OK', schema: z.object({ status: z.literal('ok'), version: z.string() }) } }
  }, c => c.json({ status: 'ok' as const, version: ENGINE_VERSION }));

  routes.add({ method: 'get', path: '/readyz', tag: 'ops', auth: 'public', summary: 'Readiness: the database answers and the AI provider is loaded',
    responses: { 200: { description: 'Ready', schema: z.object({ status: z.string(), checks: z.record(z.string(), z.string()) }) }, 503: { description: 'Not ready' } }
  }, async c => {
    const checks: Record<string, string> = { ai: ctx.ai.provider, pdf: ctx.pdf ? 'on' : 'off', email: ctx.mailer ? 'on' : 'off', speech: ctx.ai.transcriber ? 'on' : 'off' };
    try {
      await ctx.repo.ping();
      checks.database = 'ok';
    } catch (e) {
      checks.database = 'down';
      ctx.log.error('readiness: database down', { err: e });
      return c.json({ status: 'unavailable', checks }, 503);
    }
    return c.json({ status: 'ok', checks });
  });

  let doc: unknown = null;
  routes.add({ method: 'get', path: '/openapi.json', tag: 'ops', auth: 'public', summary: 'This document, generated from the routes\' Zod schemas',
    responses: { 200: { description: 'OpenAPI 3.1' } }
  }, c => {
    doc ??= routes.openapi({ title: 'iLead server', version: ENGINE_VERSION, serverUrl: ctx.config.PUBLIC_URL });
    c.header('Cache-Control', 'public, max-age=300');
    return c.json(doc as object);
  });
}

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8', '.webmanifest': 'application/manifest+json', '.mp3': 'audio/mpeg', '.wav': 'audio/wav'
};

/** Prefixes that are never the app: the SPA fallback leaves them to 404. */
const API = /^\/(api|engine|speech|genie|auth|launch|healthz|readyz|openapi\.json)(\/|$)/;

/**
 * The app's static build (`STATIC_DIR`, normally `dist/`), with the SPA fallback (every route is
 * index.html), long cache on hashed assets and none on index.html. Compression comes from the middleware.
 */
export function serveStatic(app: Hono<AppEnv>, dir: string) {
  const root = path.resolve(dir);
  const index = path.join(root, 'index.html');
  if (!fs.existsSync(index)) throw new Error(`STATIC_DIR ${dir} has no index.html. Build the app first (npm run build:app).`);
  app.get('*', async (c, next) => {
    const p = decodeURIComponent(new URL(c.req.url).pathname);
    if (API.test(p)) return next();
    let file = path.join(root, p);
    if (!file.startsWith(root + path.sep) && file !== root) return next();
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      if (path.extname(p)) return next();
      file = index;
    }
    const type = TYPES[path.extname(file)] ?? 'application/octet-stream';
    const immutable = p.startsWith('/assets/');
    c.header('Content-Type', type);
    c.header('Cache-Control', file === index ? 'no-cache' : immutable ? 'public, max-age=31536000, immutable' : 'public, max-age=3600');
    return c.body(new Uint8Array(await fs.promises.readFile(file)));
  });
}
