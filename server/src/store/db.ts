/**
 * The SQL seam both databases implement. Statements use `?` placeholders and the SQL both SQLite and
 * Postgres accept (`INSERT ... ON CONFLICT ... DO UPDATE`, TEXT, INTEGER, BIGINT); the Postgres adapter
 * numbers the placeholders. JSON is stored as TEXT, times as ISO 8601 TEXT, binary as BLOB or BYTEA.
 */
export type Param = string | number | boolean | null | Uint8Array;
export type Row = Record<string, unknown>;

export interface Db {
  readonly dialect: 'sqlite' | 'postgres';
  all<T extends Row = Row>(sql: string, params?: Param[]): Promise<T[]>;
  run(sql: string, params?: Param[]): Promise<{ changes: number }>;
  /** Several statements with no parameters (migrations). */
  exec(sql: string): Promise<void>;
  /** Runs `fn` in one transaction: all of it or none. */
  tx<T>(fn: (db: Db) => Promise<T>): Promise<T>;
  /** Liveness of the connection, for the readiness check. */
  ping(): Promise<void>;
  close(): Promise<void>;
}

/** A unique key was taken (another request appended the same event first). */
export class ConflictError extends Error {}

/** A simple async mutex: SQLite has one connection, so transactions must not interleave. */
export class Mutex {
  private tail: Promise<void> = Promise.resolve();
  async lock<T>(fn: () => Promise<T>): Promise<T> {
    const prev = this.tail;
    let release!: () => void;
    this.tail = new Promise(r => (release = r));
    await prev;
    try {
      return await fn();
    } finally {
      release();
    }
  }
}
