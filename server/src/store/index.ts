import type { Db } from './db';
import { migrate } from './migrations';
import { openPostgres } from './postgres';
import { SqlRepository, type Repository } from './repo';
import { openSqlite } from './sqlite';

export type { Repository } from './repo';
export { SqlRepository } from './repo';

/** Postgres when `DATABASE_URL` is set, otherwise SQLite at `SQLITE_PATH` (`:memory:` for tests). Migrates on open. */
export async function openRepository(opts: { databaseUrl?: string; sqlitePath: string; poolMax?: number; migrate?: boolean }): Promise<{ repo: Repository; db: Db; applied: number[] }> {
  const db = opts.databaseUrl ? await openPostgres(opts.databaseUrl, opts.poolMax) : await openSqlite(opts.sqlitePath);
  const applied = opts.migrate === false ? [] : await migrate(db);
  return { repo: new SqlRepository(db), db, applied };
}
