import fs from 'node:fs';
import path from 'node:path';
import { ConflictError, Mutex, type Db, type Param, type Row } from './db';

// node:sqlite is built into Node 22 (no native module to compile). It prints one ExperimentalWarning on
// first use; the server's entry point filters that one warning.
type SqliteModule = typeof import('node:sqlite');
type DatabaseSync = InstanceType<SqliteModule['DatabaseSync']>;

const conflict = (e: unknown) => e instanceof Error && /UNIQUE constraint failed|constraint failed: .*PRIMARY/i.test(e.message);

/** SQLite on a file (`SQLITE_PATH`), or in memory with `:memory:` (tests). WAL mode, foreign keys on. */
export async function openSqlite(file: string): Promise<Db> {
  const { DatabaseSync } = (await import('node:sqlite')) as SqliteModule;
  if (file !== ':memory:') fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  const raw: DatabaseSync = new DatabaseSync(file);
  raw.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  if (file !== ':memory:') raw.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;');
  const mutex = new Mutex();

  const norm = (params: Param[]) => params.map(p => (typeof p === 'boolean' ? (p ? 1 : 0) : p)) as Array<string | number | null | Uint8Array>;
  const fix = (row: Row): Row => {
    for (const k in row) if (row[k] instanceof Uint8Array && !Buffer.isBuffer(row[k])) row[k] = Buffer.from(row[k] as Uint8Array);
    return row;
  };
  const direct: Db = {
    dialect: 'sqlite',
    async all<T extends Row>(sql: string, params: Param[] = []) {
      return (raw.prepare(sql).all(...norm(params)) as Row[]).map(fix) as T[];
    },
    async run(sql, params = []) {
      try {
        const r = raw.prepare(sql).run(...norm(params));
        return { changes: Number(r.changes) };
      } catch (e) {
        if (conflict(e)) throw new ConflictError((e as Error).message);
        throw e;
      }
    },
    async exec(sql) { raw.exec(sql); },
    tx: fn => fn(direct),
    async ping() { raw.prepare('SELECT 1').get(); },
    async close() { raw.close(); }
  };
  // Outside a transaction every call waits for any open transaction to finish.
  return {
    dialect: 'sqlite',
    all: (sql, params) => mutex.lock(() => direct.all(sql, params)),
    run: (sql, params) => mutex.lock(() => direct.run(sql, params)),
    exec: sql => mutex.lock(() => direct.exec(sql)),
    tx: fn => mutex.lock(async () => {
      raw.exec('BEGIN IMMEDIATE');
      try {
        const out = await fn(direct);
        raw.exec('COMMIT');
        return out;
      } catch (e) {
        raw.exec('ROLLBACK');
        throw e;
      }
    }),
    ping: () => mutex.lock(() => direct.ping()),
    close: () => mutex.lock(() => direct.close())
  };
}

/** A consistent copy of the database to `dest` (backups), while the server runs. */
export async function backupSqlite(file: string, dest: string) {
  const sqlite = (await import('node:sqlite')) as SqliteModule;
  const db = new sqlite.DatabaseSync(file);
  try {
    await sqlite.backup(db, dest);
  } finally {
    db.close();
  }
}
