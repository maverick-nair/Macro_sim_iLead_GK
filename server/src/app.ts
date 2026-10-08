import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { compress } from 'hono/compress';
import { cors } from 'hono/cors';
import { requestId } from 'hono/request-id';
import { secureHeaders } from 'hono/secure-headers';
import { createSessions } from './auth/session';
import type { Config } from './config';
import type { ServerContext } from './context';
import { RunService } from './engine/runs';
import { Storylines } from './engine/storylines';
import { HttpError, toResponse } from './http/errors';
import { createRateLimiter } from './http/rateLimit';
import { Routes } from './http/route';
import type { AppEnv } from './http/types';
import type { Logger } from './log';
import type { AiPorts } from './ports';
import type { Mailer } from './report/email';
import type { PdfRenderer } from './report/pdf';
import { Reports } from './reports';
import { purge, registerAdmin } from './routes/admin';
import { registerApi } from './routes/api';
import { registerAuthor } from './routes/author';
import { registerCalibrate } from './routes/calibrate';
import { registerEngine } from './routes/engine';
import { registerLaunch } from './routes/launch';
import { registerOps, serveStatic } from './routes/ops';
import { registerSpeech } from './routes/speech';
import type { Repository } from './store';

export interface AppDeps {
  config: Config;
  log: Logger;
  repo: Repository;
  ai: AiPorts;
  pdf?: PdfRenderer | null;
  mailer?: Mailer | null;
}

/**
 * The server as a Hono app, with no listening socket: index.ts serves it, the tests call `app.request`.
 * Paths (the app's adapters point at them with VITE_ILEAD_*_URL, see docs/SERVER.md):
 *   /engine/...    the engine (VITE_ILEAD_ENGINE_URL=/engine)
 *   /api/...       the app API (VITE_ILEAD_API_URL=/api)
 *   /speech/...    transcription (VITE_ILEAD_SPEECH_URL=/speech)
 *   /genie/...     the author chat (VITE_GENIE_URL=/genie)
 *   /launch, /auth/...  sign in;  /healthz, /readyz, /openapi.json  operations
 */
export function createApp(deps: AppDeps) {
  const { config, log, repo, ai } = deps;
  const app = new Hono<AppEnv>();
  const limiter = createRateLimiter({
    ai: { max: config.RATE_LIMIT_AI_PER_MIN, windowMs: 60_000 },
    email: { max: config.RATE_LIMIT_EMAIL_PER_HOUR, windowMs: 3600_000 },
    launch: { max: config.RATE_LIMIT_LAUNCH_PER_MIN, windowMs: 60_000 }
  });
  const routes = new Routes(app, limiter, config.TRUST_PROXY);
  const storylines = new Storylines(repo, config.DEFAULT_STORYLINE);
  const runs = new RunService(repo, storylines, ai, log.child({ component: 'runs' }), config.ENGINE_CACHE_SIZE);
  const reports = new Reports(repo, storylines, log.child({ component: 'reports' }), config.BENCHMARK_MIN_RUNS);
  const sessions = createSessions(config, repo);
  const ctx: ServerContext = { config, log, repo, ai, runs, storylines, reports, sessions, routes, pdf: deps.pdf ?? null, mailer: deps.mailer ?? null };

  const publicOrigin = new URL(config.PUBLIC_URL).origin;
  const origins = new Set([publicOrigin, ...config.CORS_ORIGINS]);

  // Request id and one structured log line per request (no query strings: launch tokens travel in them).
  app.use(requestId({ limitLength: 100 }));
  app.use(async (c, next) => {
    const started = performance.now();
    const rlog = log.child({ requestId: c.get('requestId') });
    c.set('log', rlog);
    await next();
    const path = new URL(c.req.url).pathname;
    if (path === '/healthz') return;
    rlog.info('request', { method: c.req.method, path, status: c.res.status, ms: Math.round(performance.now() - started), principal: c.get('principal')?.id });
  });
  app.onError((err, c) => toResponse(err, c));
  app.notFound(c => c.json({ message: 'Not found', code: 'notFound' }, 404));

  app.use(secureHeaders({
    contentSecurityPolicy: {
      defaultSrc: ["'self'"], scriptSrc: ["'self'"], styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com'], imgSrc: ["'self'", 'data:', 'blob:', 'https:'], mediaSrc: ["'self'", 'blob:'],
      connectSrc: ["'self'", ...config.CORS_ORIGINS], objectSrc: ["'none'"], baseUri: ["'self'"], formAction: ["'self'"],
      frameAncestors: config.FRAME_ANCESTORS.length ? config.FRAME_ANCESTORS : ["'self'"]
    },
    // Embedding in an LMS is governed by frame-ancestors above.
    xFrameOptions: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: 'same-site',
    strictTransportSecurity: config.PUBLIC_URL.startsWith('https://') ? 'max-age=31536000; includeSubDomains' : false,
    permissionsPolicy: { microphone: ['self'], camera: [], geolocation: [] }
  }));
  if (config.CORS_ORIGINS.length) {
    app.use(cors({ origin: config.CORS_ORIGINS, credentials: true, allowHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Request-Id', 'Idempotency-Key'], allowMethods: ['GET', 'POST', 'PUT', 'DELETE'], exposeHeaders: ['X-Request-Id', 'Retry-After'], maxAge: 600 }));
  }
  app.use(compress());

  // Cross site request forgery: a state changing request that carries an Origin must come from the app.
  app.use(async (c, next) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(c.req.method)) {
      const origin = c.req.header('origin');
      const launchPost = c.req.method === 'POST' && new URL(c.req.url).pathname === '/launch';
      if (origin && !launchPost && !origins.has(origin)) throw new HttpError(403, 'badOrigin', 'This request did not come from the app.');
    }
    await next();
  });

  const limit = config.BODY_LIMIT_KB * 1024;
  const audioLimit = config.AUDIO_CHUNK_LIMIT_KB * 1024;
  app.use('*', async (c, next) => {
    const max = new URL(c.req.url).pathname.startsWith('/speech/') ? audioLimit : limit;
    return bodyLimit({ maxSize: max, onError: () => { throw new HttpError(413, 'tooLarge', 'The request is too large.'); } })(c, next);
  });
  app.use('*', sessions.middleware);

  registerOps(ctx);
  registerLaunch(ctx);
  registerEngine(ctx);
  registerApi(ctx);
  registerAuthor(ctx);
  const calibrations = registerCalibrate(ctx);
  const stopSpeech = registerSpeech(ctx);
  registerAdmin(ctx);
  if (config.STATIC_DIR) serveStatic(app, config.STATIC_DIR);

  // Scheduled jobs: benchmarks and retention. Off in tests (the intervals are 0 or the caller closes at once).
  const timers: NodeJS.Timeout[] = [];
  const every = (hours: number, job: () => Promise<unknown>, name: string) => {
    if (hours <= 0) return;
    const t = setInterval(() => void job().catch(e => log.error(`${name} failed`, { err: e })), hours * 3600_000);
    t.unref();
    timers.push(t);
  };

  return {
    app, ctx, calibrations,
    /** Starts the schedules: benchmarks every BENCHMARK_REFRESH_HOURS, retention daily, both once soon after start. */
    schedule() {
      every(config.BENCHMARK_REFRESH_HOURS, () => reports.refreshBenchmarks(), 'benchmark refresh');
      every(24, () => purge(ctx), 'retention');
      const first = setTimeout(() => {
        void purge(ctx).catch(e => log.error('retention failed', { err: e }));
        if (config.BENCHMARK_REFRESH_HOURS > 0) void reports.refreshBenchmarks().catch(e => log.error('benchmark refresh failed', { err: e }));
      }, 15_000);
      first.unref();
      timers.push(first);
    },
    async close() {
      for (const t of timers) clearInterval(t);
      calibrations.close();
      stopSpeech();
      await deps.pdf?.close();
      deps.mailer?.close();
      await repo.close();
    }
  };
}
