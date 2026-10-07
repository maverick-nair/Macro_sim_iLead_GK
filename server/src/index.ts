import { serve } from '@hono/node-server';
import { loadAi } from './ai';
import { createApp } from './app';
import { loadConfig } from './config';
import { createLogger } from './log';
import { smtpMailer } from './report/email';
import { chromiumRenderer } from './report/pdf';
import { openRepository } from './store';

// node:sqlite says it is experimental once per process; that one line is noise in the JSON logs.
const emit = process.emitWarning.bind(process);
process.emitWarning = ((warning: string | Error, ...rest: unknown[]) => {
  const text = typeof warning === 'string' ? warning : warning.message;
  if (/SQLite is an experimental feature/.test(text)) return;
  return (emit as (...a: unknown[]) => void)(warning, ...rest);
}) as typeof process.emitWarning;

/** The server's entry point: `npm run server` (production) or `npm run server:dev`. */
async function main() {
  const config = loadConfig();
  const log = createLogger(config.LOG_LEVEL, { service: 'ilead-server' });
  const { repo, applied } = await openRepository({ databaseUrl: config.DATABASE_URL, sqlitePath: config.SQLITE_PATH, poolMax: config.DATABASE_POOL_MAX });
  log.info('database ready', { store: config.DATABASE_URL ? 'postgres' : 'sqlite', migrationsApplied: applied });
  if (process.argv.includes('--migrate-only')) {
    await repo.close();
    return;
  }
  const ai = await loadAi(config, log);
  const pdf = config.PDF_ENABLED ? chromiumRenderer({ executablePath: config.CHROMIUM_PATH, timeoutMs: config.PDF_TIMEOUT_MS, concurrency: config.PDF_CONCURRENCY, log: log.child({ component: 'pdf' }) }) : null;
  const mailer = await smtpMailer(config);
  if (!config.LAUNCH_SECRET) log.warn('LAUNCH_SECRET is not set: using the development secret. Never do this in production.');
  const server = createApp({ config, log, repo, ai, pdf, mailer });
  server.schedule();
  const http = serve({ fetch: server.app.fetch, port: config.PORT, hostname: config.HOST }, info => {
    log.info('listening', { port: info.port, publicUrl: config.PUBLIC_URL, static: config.STATIC_DIR ?? null, ai: ai.provider, pdf: !!pdf, email: !!mailer });
  });
  let closing = false;
  const shutdown = (signal: string) => {
    if (closing) return;
    closing = true;
    log.info('shutting down', { signal });
    http.close(() => void server.close().then(() => process.exit(0)));
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch(e => {
  process.stderr.write(`${JSON.stringify({ time: new Date().toISOString(), level: 'error', msg: 'startup failed', error: (e as Error).message })}\n`);
  process.exit(1);
});
