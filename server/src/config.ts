import { z } from 'zod';

/**
 * Server configuration, entirely from the environment (`.env.example` documents every variable).
 * Parsed once at startup; a bad value stops the server with a readable message instead of failing later.
 */

const bool = (def: boolean) => z.enum(['true', 'false', '1', '0', 'yes', 'no', '']).optional().transform(v => (v === undefined || v === '' ? def : ['true', '1', 'yes'].includes(v)));
const int = (def: number) => z.coerce.number().int().min(0).default(def);
const list = z.string().optional().transform(v => (v ? v.split(',').map(s => s.trim()).filter(Boolean) : []));

export const ConfigSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: int(8787),
  HOST: z.string().default('0.0.0.0'),
  /** The address participants open, for launch redirects, PDF rendering and links in emails. */
  PUBLIC_URL: z.string().url().default('http://localhost:8787'),
  /** Where the PDF renderer loads the app's print view. Defaults to PUBLIC_URL; set it when the app is on a CDN the server reaches by another name. */
  APP_URL: z.string().url().optional(),
  /** Serve the app's static build (`dist/`) from this folder. Empty: the app is on a CDN. */
  STATIC_DIR: z.string().optional(),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error', 'silent']).default('info'),
  TRUST_PROXY: bool(false),

  // Storage
  DATABASE_URL: z.string().optional(),
  DATABASE_POOL_MAX: int(10),
  SQLITE_PATH: z.string().default('./data/ilead.sqlite'),

  // Auth
  LAUNCH_SECRET: z.string().min(32, 'LAUNCH_SECRET must be at least 32 characters').optional(),
  /** Extra launch secrets still accepted (rotation): comma separated. */
  LAUNCH_SECRET_PREVIOUS: list,
  LAUNCH_ISSUERS: list,
  LAUNCH_AUDIENCE: z.string().default('ilead'),
  SESSION_COOKIE: z.string().default('ilead_session'),
  SESSION_TTL_HOURS: int(12),
  /** Default: on in production, off in development (plain http on localhost). */
  COOKIE_SECURE: z.enum(['true', 'false', '1', '0', 'yes', 'no']).optional().transform(v => (v === undefined ? undefined : ['true', '1', 'yes'].includes(v))),
  COOKIE_SAMESITE: z.enum(['Lax', 'Strict', 'None']).default('Lax'),
  COOKIE_DOMAIN: z.string().optional(),
  /** Where `/launch` sends the participant after signing in, relative to PUBLIC_URL or absolute. */
  LAUNCH_REDIRECT: z.string().default('/'),

  // HTTP
  CORS_ORIGINS: list,
  /** Who may embed the app in a frame (CSP frame-ancestors), for example the LMS origin. Default: this site only. */
  FRAME_ANCESTORS: list,
  RATE_LIMIT_AI_PER_MIN: int(30),
  RATE_LIMIT_EMAIL_PER_HOUR: int(5),
  RATE_LIMIT_LAUNCH_PER_MIN: int(30),
  BODY_LIMIT_KB: int(512),
  AUDIO_CHUNK_LIMIT_KB: int(1024),

  // Engine
  /** Engines kept in memory; others are rebuilt from the event log on their next request. */
  ENGINE_CACHE_SIZE: int(500),
  /** NPC words streamed per second (SSE). 0 sends them as fast as the socket takes them. */
  STREAM_TOKENS_PER_SEC: int(40),
  DEFAULT_STORYLINE: z.string().default('sales_elevator'),

  // Synthetic player calibrations (D115): jobs run in this process, this many at a time, with at most this many waiting.
  CALIBRATION_CONCURRENCY: int(2),
  CALIBRATION_QUEUE: int(20),

  // AI (the ai/ module reads its own tuning variables through configFromEnv: docs/AI.md section 8)
  /** Default: `anthropic` when ANTHROPIC_API_KEY is set, else `mock`. */
  AI_PROVIDER: z.enum(['mock', 'anthropic']).optional(),
  /** The `ai/` module to load. Default: the repository's `ai/` folder. */
  AI_MODULE: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  /** `mock` (scripted), `http` (the ai/ module's HTTP transcriber, to SPEECH_URL) or `off`. Default: `http` when SPEECH_URL is set, else `mock`. */
  SPEECH_PROVIDER: z.enum(['mock', 'http', 'off']).optional(),
  SPEECH_URL: z.string().url().optional(),

  // PDF
  PDF_ENABLED: bool(true),
  CHROMIUM_PATH: z.string().optional(),
  PDF_TIMEOUT_MS: int(30000),
  PDF_CONCURRENCY: int(2),

  // Email
  SMTP_URL: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: int(587),
  SMTP_SECURE: bool(false),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  EMAIL_FROM: z.string().default('iLead <no-reply@example.com>'),
  EMAIL_REPLY_TO: z.string().optional(),

  // Benchmarks and retention
  BENCHMARK_REFRESH_HOURS: int(24),
  BENCHMARK_MIN_RUNS: int(20),
  RETENTION_DAYS: int(0),
  ADMIN_TOKEN: z.string().min(32, 'ADMIN_TOKEN must be at least 32 characters').optional()
});

export type Config = Omit<z.output<typeof ConfigSchema>, 'COOKIE_SECURE' | 'AI_PROVIDER'> & { COOKIE_SECURE: boolean; AI_PROVIDER: 'mock' | 'anthropic'; appUrl: string; dev: boolean };

export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  // An empty variable (`SMTP_URL=` in an env file) means unset.
  const r = ConfigSchema.safeParse(Object.fromEntries(Object.entries(env).filter(([, v]) => v !== '')));
  if (!r.success) {
    const lines = r.error.issues.map(i => `  ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid server configuration:\n${lines}`);
  }
  const c = r.data;
  const dev = c.NODE_ENV !== 'production';
  if (!c.LAUNCH_SECRET && !dev) throw new Error('Invalid server configuration:\n  LAUNCH_SECRET: required in production (32 characters or more)');
  return { ...c, COOKIE_SECURE: c.COOKIE_SECURE ?? !dev, AI_PROVIDER: c.AI_PROVIDER ?? (c.ANTHROPIC_API_KEY ? 'anthropic' : 'mock'), appUrl: (c.APP_URL ?? c.PUBLIC_URL).replace(/\/$/, ''), dev };
}

/** A development only secret, so `npm run server:dev` works with no setup. Never used in production. */
export const DEV_LAUNCH_SECRET = 'development-only-launch-secret-change-me-0000';

export function launchSecrets(c: Config): string[] {
  return [c.LAUNCH_SECRET ?? DEV_LAUNCH_SECRET, ...c.LAUNCH_SECRET_PREVIOUS];
}
