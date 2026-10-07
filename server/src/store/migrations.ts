import type { Db } from './db';

/**
 * Schema migrations, applied in order at startup (or with `npm run server:migrate`). Append only: never
 * edit a migration that has shipped; add the next one. Each runs in a transaction and is recorded in
 * `schema_migrations`.
 */
export interface Migration { id: number; name: string; sql: string | { sqlite: string; postgres: string } }

const blob = (d: 'sqlite' | 'postgres') => (d === 'sqlite' ? 'BLOB' : 'BYTEA');
const initial = (d: 'sqlite' | 'postgres') => `
CREATE TABLE participants (
  id TEXT PRIMARY KEY,
  name TEXT,
  email TEXT,
  cohort_id TEXT,
  locale TEXT,
  settings TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE cohorts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  storyline_id TEXT,
  purpose TEXT,
  theme_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE storylines (
  id TEXT NOT NULL,
  version INTEGER NOT NULL,
  status TEXT NOT NULL,
  name TEXT NOT NULL,
  config TEXT NOT NULL,
  created_by TEXT,
  created_at TEXT NOT NULL,
  PRIMARY KEY (id, version)
);
CREATE TABLE themes (
  id TEXT PRIMARY KEY,
  config TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE runs (
  id TEXT PRIMARY KEY,
  participant_id TEXT NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  cohort_id TEXT,
  storyline_id TEXT NOT NULL,
  storyline_version INTEGER NOT NULL,
  lens_id TEXT NOT NULL,
  purpose TEXT NOT NULL,
  config TEXT NOT NULL,
  seed BIGINT NOT NULL,
  attempt INTEGER NOT NULL,
  engine_version TEXT NOT NULL,
  status TEXT NOT NULL,
  event_count INTEGER NOT NULL DEFAULT 0,
  score_total REAL,
  conversions INTEGER,
  capability REAL,
  headline TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  ended_at TEXT
);
CREATE INDEX runs_participant ON runs (participant_id, storyline_id, attempt);
CREATE INDEX runs_cohort ON runs (cohort_id);
CREATE TABLE run_events (
  run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  seq INTEGER NOT NULL,
  kind TEXT NOT NULL,
  payload TEXT NOT NULL,
  ai TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (run_id, seq)
);
CREATE TABLE run_summaries (
  run_id TEXT PRIMARY KEY REFERENCES runs(id) ON DELETE CASCADE,
  lens_id TEXT NOT NULL,
  summary TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX run_summaries_lens ON run_summaries (lens_id);
CREATE TABLE reviews (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  record_id TEXT NOT NULL,
  band TEXT NOT NULL,
  skills TEXT,
  reviewer_id TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE benchmarks (
  key TEXT PRIMARY KEY,
  summary TEXT NOT NULL,
  runs INTEGER NOT NULL,
  refreshed_at TEXT NOT NULL
);
CREATE TABLE email_log (
  id TEXT PRIMARY KEY,
  participant_id TEXT REFERENCES participants(id) ON DELETE CASCADE,
  run_id TEXT,
  to_address TEXT NOT NULL,
  template TEXT NOT NULL,
  status TEXT NOT NULL,
  message_id TEXT,
  error TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX email_log_participant ON email_log (participant_id, created_at);
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  participant_id TEXT,
  claims TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX sessions_participant ON sessions (participant_id);
CREATE TABLE pdf_cache (
  run_id TEXT PRIMARY KEY REFERENCES runs(id) ON DELETE CASCADE,
  version TEXT NOT NULL,
  pdf ${blob(d)} NOT NULL,
  created_at TEXT NOT NULL
);
`;

/**
 * The client's `Idempotency-Key` per run (D86, D100): a repeated key is answered with the stored result
 * instead of applying the intent again. Written in the same transaction as the event it answers.
 */
const intentKeys = `
CREATE TABLE intent_keys (
  run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  seq INTEGER NOT NULL,
  result TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (run_id, key)
);
`;

export const MIGRATIONS: Migration[] = [
  { id: 1, name: 'initial', sql: { sqlite: initial('sqlite'), postgres: initial('postgres') } },
  { id: 2, name: 'intent_keys', sql: intentKeys }
];

export async function migrate(db: Db, migrations = MIGRATIONS): Promise<number[]> {
  let rows: Array<{ id: number }>;
  try {
    rows = await db.all<{ id: number }>('SELECT id FROM schema_migrations');
  } catch {
    await db.exec('CREATE TABLE schema_migrations (id INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL)');
    rows = [];
  }
  const done = new Set(rows.map(r => Number(r.id)));
  const applied: number[] = [];
  for (const m of [...migrations].sort((a, b) => a.id - b.id)) {
    if (done.has(m.id)) continue;
    const sql = typeof m.sql === 'string' ? m.sql : m.sql[db.dialect];
    await db.tx(async t => {
      for (const stmt of sql.split(/;\s*\n/).map(s => s.trim()).filter(Boolean)) await t.run(stmt);
      await t.run('INSERT INTO schema_migrations (id, name, applied_at) VALUES (?, ?, ?)', [m.id, m.name, new Date().toISOString()]);
    });
    applied.push(m.id);
  }
  return applied;
}
