import type { Pool, PoolClient } from 'pg';
import { ConflictError, type Db, type Param, type Row } from './db';

/** `?` placeholders to `$1, $2, ...` (our SQL never has a literal question mark). */
export const numbered = (sql: string) => {
  let n = 0;
  return sql.replace(/\?/g, () => `$${++n}`);
};

const conflict = (e: unknown) => (e as { code?: string })?.code === '23505';
type Queryable = Pick<Pool, 'query'> | PoolClient;

function over(q: Queryable, tx: Db['tx'], close: () => Promise<void>): Db {
  const norm = (params: Param[]) => params.map(p => (p instanceof Uint8Array && !Buffer.isBuffer(p) ? Buffer.from(p) : p));
  return {
    dialect: 'postgres',
    async all<T extends Row>(sql: string, params: Param[] = []) {
      const r = await q.query(numbered(sql), norm(params));
      return r.rows as T[];
    },
    async run(sql, params = []) {
      try {
        const r = await q.query(numbered(sql), norm(params));
        return { changes: r.rowCount ?? 0 };
      } catch (e) {
        if (conflict(e)) throw new ConflictError((e as Error).message);
        throw e;
      }
    },
    async exec(sql) { await q.query(sql); },
    tx,
    async ping() { await q.query('SELECT 1'); },
    close
  };
}

/** Postgres from a pool (`DATABASE_URL`). Each transaction holds one pooled client. */
export function postgresDb(pool: Pool): Db {
  const tx: Db['tx'] = async fn => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const out = await fn(over(client, () => { throw new Error('nested transaction'); }, async () => undefined));
      await client.query('COMMIT');
      return out;
    } catch (e) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw e;
    } finally {
      client.release();
    }
  };
  return over(pool, tx, () => pool.end());
}

export async function openPostgres(url: string, poolMax = 10): Promise<Db> {
  const pg = await import('pg');
  const Pool = pg.default?.Pool ?? (pg as unknown as { Pool: typeof import('pg').Pool }).Pool;
  // BIGINT columns (seed, sizes) come back as numbers: every one of ours fits in 2^53.
  (pg.default?.types ?? (pg as unknown as typeof import('pg')).types).setTypeParser(20, v => Number(v));
  const pool = new Pool({ connectionString: url, max: poolMax });
  return postgresDb(pool);
}
