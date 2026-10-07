/**
 * Structured JSON logs, one object per line on stdout: `{ time, level, msg, ...fields }`. Request logs
 * carry the request id. Nothing a participant typed or said is logged (privacy): only ids, codes and timings.
 */
export type Level = 'debug' | 'info' | 'warn' | 'error';
const ORDER: Record<Level | 'silent', number> = { debug: 10, info: 20, warn: 30, error: 40, silent: 100 };

export interface Logger {
  debug(msg: string, fields?: Record<string, unknown>): void;
  info(msg: string, fields?: Record<string, unknown>): void;
  warn(msg: string, fields?: Record<string, unknown>): void;
  error(msg: string, fields?: Record<string, unknown>): void;
  child(fields: Record<string, unknown>): Logger;
}

export function createLogger(level: Level | 'silent' = 'info', base: Record<string, unknown> = {}, write: (line: string) => void = l => process.stdout.write(l + '\n')): Logger {
  const min = ORDER[level];
  const out = (lvl: Level) => (msg: string, fields?: Record<string, unknown>) => {
    if (ORDER[lvl] < min) return;
    const f = fields ? Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v instanceof Error ? { name: v.name, message: v.message, stack: v.stack } : v])) : {};
    write(JSON.stringify({ time: new Date().toISOString(), level: lvl, msg, ...base, ...f }));
  };
  return {
    debug: out('debug'), info: out('info'), warn: out('warn'), error: out('error'),
    child: fields => createLogger(level, { ...base, ...fields }, write)
  };
}
