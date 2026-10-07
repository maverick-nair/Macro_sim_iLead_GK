import { randomUUID } from 'node:crypto';
import { ConflictError, type Db, type Row } from './db';

/**
 * The repository: every read and write the server makes, behind one interface. `SqlRepository` serves
 * both SQLite (the default) and Postgres (`DATABASE_URL`); another store implements this interface.
 */

export interface Participant { id: string; name: string | null; email: string | null; cohortId: string | null; locale: string | null; settings: unknown; createdAt: string; updatedAt: string }
export interface Cohort { id: string; name: string; storylineId: string | null; purpose: 'development' | 'assessment' | null; themeId: string | null; createdAt: string; updatedAt: string }
export interface StorylineRow { id: string; version: number; status: 'draft' | 'published'; name: string; config: unknown; createdBy: string | null; createdAt: string }
export type RunStatus = 'active' | 'ended';
export interface RunRow {
  id: string; participantId: string; cohortId: string | null; storylineId: string; storylineVersion: number; lensId: string;
  purpose: 'development' | 'assessment'; config: unknown; seed: number; attempt: number; engineVersion: string; status: RunStatus; eventCount: number;
  scoreTotal: number | null; conversions: number | null; capability: number | null; headline: string | null;
  createdAt: string; updatedAt: string; endedAt: string | null;
}
export interface RunEvent { seq: number; kind: 'intent' | 'review'; payload: unknown; ai: unknown[]; createdAt: string }
export interface EmailLogRow { id: string; participantId: string | null; runId: string | null; to: string; template: string; status: 'sent' | 'failed'; messageId: string | null; error: string | null; createdAt: string }
export interface SessionRow { id: string; participantId: string | null; claims: unknown; expiresAt: string; createdAt: string }

export interface Repository {
  upsertParticipant(p: { id: string; name?: string | null; email?: string | null; cohortId?: string | null; locale?: string | null }): Promise<Participant>;
  getParticipant(id: string): Promise<Participant | null>;
  saveSettings(id: string, settings: unknown): Promise<void>;
  /** Everything stored about a participant (privacy export). */
  exportParticipant(id: string): Promise<Record<string, unknown> | null>;
  /** Removes the participant and everything stored about them. */
  deleteParticipant(id: string): Promise<boolean>;

  upsertCohort(c: { id: string; name: string; storylineId?: string | null; purpose?: Cohort['purpose']; themeId?: string | null }): Promise<Cohort>;
  getCohort(id: string): Promise<Cohort | null>;
  listCohorts(): Promise<Cohort[]>;

  /** Saves a storyline as the next version of its id. */
  saveStoryline(s: { id: string; status: StorylineRow['status']; name: string; config: unknown; createdBy?: string | null }): Promise<StorylineRow>;
  /** The latest published version, or a given version. */
  getStoryline(id: string, version?: number): Promise<StorylineRow | null>;
  listStorylines(): Promise<StorylineRow[]>;

  putTheme(id: string, config: unknown): Promise<void>;
  getTheme(id: string): Promise<unknown | null>;

  createRun(r: Omit<RunRow, 'eventCount' | 'createdAt' | 'updatedAt' | 'endedAt' | 'status' | 'scoreTotal' | 'conversions' | 'capability' | 'headline'>): Promise<RunRow>;
  getRun(id: string): Promise<RunRow | null>;
  /** A participant's runs of a storyline, oldest attempt first (every storyline when left out). */
  listRuns(participantId: string, storylineId?: string): Promise<RunRow[]>;
  listCohortRuns(cohortId: string): Promise<Array<RunRow & { name: string | null; summary: unknown | null }>>;
  /**
   * Appends an event and updates the run in one transaction, if the run is still at `expectedSeq - 1`
   * events; otherwise ConflictError (another instance wrote first).
   */
  appendEvent(runId: string, event: Omit<RunEvent, 'createdAt'>, patch: Partial<Pick<RunRow, 'status' | 'scoreTotal' | 'conversions' | 'capability' | 'headline' | 'endedAt'>>, summary?: { lensId: string; summary: unknown }): Promise<void>;
  listEvents(runId: string): Promise<RunEvent[]>;
  putSummary(runId: string, lensId: string, summary: unknown): Promise<void>;
  getSummary(runId: string): Promise<unknown | null>;
  /** Run summaries for the benchmark: every run of a lens. */
  listSummaries(lensId: string): Promise<unknown[]>;
  /** The lenses runs have been played with. */
  lensIds(): Promise<string[]>;

  addReview(r: { runId: string; recordId: string; band: string; skills?: unknown; reviewerId: string }): Promise<void>;

  putBenchmark(key: string, summary: unknown, runs: number): Promise<void>;
  getBenchmark(key: string): Promise<{ summary: unknown; runs: number; refreshedAt: string } | null>;

  logEmail(e: Omit<EmailLogRow, 'id' | 'createdAt'>): Promise<void>;
  countEmails(participantId: string, sinceIso: string): Promise<number>;

  createSession(s: Omit<SessionRow, 'createdAt'>): Promise<void>;
  getSession(id: string): Promise<SessionRow | null>;
  deleteSession(id: string): Promise<void>;

  getPdf(runId: string, version: string): Promise<Buffer | null>;
  putPdf(runId: string, version: string, pdf: Uint8Array): Promise<void>;

  /** Retention: deletes expired sessions, and runs (with their events) that ended or went quiet before `beforeIso`. */
  purge(beforeIso: string | null): Promise<{ sessions: number; runs: number }>;
  ping(): Promise<void>;
  close(): Promise<void>;
}

const now = () => new Date().toISOString();
const json = (v: unknown) => (v === undefined ? null : JSON.stringify(v));
const parse = (v: unknown) => (typeof v === 'string' ? JSON.parse(v) : v ?? null);
const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
const str = (v: unknown) => (v === null || v === undefined ? null : String(v));

const participantOf = (r: Row): Participant => ({ id: String(r.id), name: str(r.name), email: str(r.email), cohortId: str(r.cohort_id), locale: str(r.locale), settings: parse(r.settings), createdAt: String(r.created_at), updatedAt: String(r.updated_at) });
const cohortOf = (r: Row): Cohort => ({ id: String(r.id), name: String(r.name), storylineId: str(r.storyline_id), purpose: str(r.purpose) as Cohort['purpose'], themeId: str(r.theme_id), createdAt: String(r.created_at), updatedAt: String(r.updated_at) });
const storylineOf = (r: Row): StorylineRow => ({ id: String(r.id), version: Number(r.version), status: r.status as StorylineRow['status'], name: String(r.name), config: parse(r.config), createdBy: str(r.created_by), createdAt: String(r.created_at) });
const runOf = (r: Row): RunRow => ({
  id: String(r.id), participantId: String(r.participant_id), cohortId: str(r.cohort_id), storylineId: String(r.storyline_id), storylineVersion: Number(r.storyline_version), lensId: String(r.lens_id),
  purpose: r.purpose as RunRow['purpose'], config: parse(r.config), seed: Number(r.seed), attempt: Number(r.attempt), engineVersion: String(r.engine_version), status: r.status as RunStatus,
  eventCount: Number(r.event_count), scoreTotal: num(r.score_total), conversions: num(r.conversions), capability: num(r.capability), headline: str(r.headline),
  createdAt: String(r.created_at), updatedAt: String(r.updated_at), endedAt: str(r.ended_at)
});

const RUN_COLS = 'id, participant_id, cohort_id, storyline_id, storyline_version, lens_id, purpose, config, seed, attempt, engine_version, status, event_count, score_total, conversions, capability, headline, created_at, updated_at, ended_at';

export class SqlRepository implements Repository {
  constructor(readonly db: Db) {}

  async upsertParticipant(p: Parameters<Repository['upsertParticipant']>[0]) {
    const t = now();
    // Fields left out keep what is stored; a launch that names them updates them.
    await this.db.run(
      `INSERT INTO participants (id, name, email, cohort_id, locale, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (id) DO UPDATE SET name = COALESCE(excluded.name, participants.name), email = COALESCE(excluded.email, participants.email),
         cohort_id = COALESCE(excluded.cohort_id, participants.cohort_id), locale = COALESCE(excluded.locale, participants.locale), updated_at = excluded.updated_at`,
      [p.id, p.name ?? null, p.email ?? null, p.cohortId ?? null, p.locale ?? null, t, t]
    );
    return (await this.getParticipant(p.id))!;
  }
  async getParticipant(id: string) {
    const [r] = await this.db.all('SELECT * FROM participants WHERE id = ?', [id]);
    return r ? participantOf(r) : null;
  }
  async saveSettings(id: string, settings: unknown) {
    await this.db.run('UPDATE participants SET settings = ?, updated_at = ? WHERE id = ?', [json(settings), now(), id]);
  }
  async exportParticipant(id: string) {
    const p = await this.getParticipant(id);
    if (!p) return null;
    const runs = await this.listRuns(id);
    const out = [];
    for (const r of runs) {
      const [s] = await this.db.all('SELECT summary FROM run_summaries WHERE run_id = ?', [r.id]);
      const reviews = await this.db.all('SELECT record_id, band, skills, reviewer_id, created_at FROM reviews WHERE run_id = ?', [r.id]);
      out.push({ ...r, config: undefined, events: await this.listEvents(r.id), summary: s ? parse(s.summary) : null, reviews: reviews.map(x => ({ ...x, skills: parse(x.skills) })) });
    }
    const emails = await this.db.all('SELECT to_address, template, status, created_at FROM email_log WHERE participant_id = ? ORDER BY created_at', [id]);
    return { participant: p, runs: out, emails };
  }
  async deleteParticipant(id: string) {
    return this.db.tx(async db => {
      // Foreign keys cascade to runs, events, summaries, reviews, PDFs and the email log; sessions are by id.
      await db.run('DELETE FROM sessions WHERE participant_id = ?', [id]);
      await db.run('DELETE FROM email_log WHERE participant_id = ?', [id]);
      const runIds = (await db.all<{ id: string }>('SELECT id FROM runs WHERE participant_id = ?', [id])).map(r => r.id);
      for (const rid of runIds) {
        for (const t of ['run_events', 'run_summaries', 'reviews', 'pdf_cache']) await db.run(`DELETE FROM ${t} WHERE run_id = ?`, [rid]);
      }
      await db.run('DELETE FROM runs WHERE participant_id = ?', [id]);
      const r = await db.run('DELETE FROM participants WHERE id = ?', [id]);
      return r.changes > 0;
    });
  }

  async upsertCohort(c: Parameters<Repository['upsertCohort']>[0]) {
    const t = now();
    await this.db.run(
      `INSERT INTO cohorts (id, name, storyline_id, purpose, theme_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (id) DO UPDATE SET name = excluded.name, storyline_id = COALESCE(excluded.storyline_id, cohorts.storyline_id),
         purpose = COALESCE(excluded.purpose, cohorts.purpose), theme_id = COALESCE(excluded.theme_id, cohorts.theme_id), updated_at = excluded.updated_at`,
      [c.id, c.name, c.storylineId ?? null, c.purpose ?? null, c.themeId ?? null, t, t]
    );
    return (await this.getCohort(c.id))!;
  }
  async getCohort(id: string) {
    const [r] = await this.db.all('SELECT * FROM cohorts WHERE id = ?', [id]);
    return r ? cohortOf(r) : null;
  }
  async listCohorts() {
    return (await this.db.all('SELECT * FROM cohorts ORDER BY created_at')).map(cohortOf);
  }

  async saveStoryline(s: Parameters<Repository['saveStoryline']>[0]) {
    for (let i = 0; i < 3; i++) {
      try {
        return await this.db.tx(async db => {
          const [m] = await db.all<{ v: number | null }>('SELECT MAX(version) AS v FROM storylines WHERE id = ?', [s.id]);
          const version = Number(m?.v ?? 0) + 1;
          const t = now();
          await db.run('INSERT INTO storylines (id, version, status, name, config, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)', [s.id, version, s.status, s.name, json(s.config), s.createdBy ?? null, t]);
          return { id: s.id, version, status: s.status, name: s.name, config: s.config, createdBy: s.createdBy ?? null, createdAt: t };
        });
      } catch (e) {
        if (!(e instanceof ConflictError)) throw e;
      }
    }
    throw new ConflictError('storyline version taken');
  }
  async getStoryline(id: string, version?: number) {
    const [r] = version === undefined
      ? await this.db.all("SELECT * FROM storylines WHERE id = ? AND status = 'published' ORDER BY version DESC LIMIT 1", [id])
      : await this.db.all('SELECT * FROM storylines WHERE id = ? AND version = ?', [id, version]);
    return r ? storylineOf(r) : null;
  }
  async listStorylines() {
    return (await this.db.all('SELECT * FROM storylines ORDER BY id, version')).map(storylineOf);
  }

  async putTheme(id: string, config: unknown) {
    await this.db.run('INSERT INTO themes (id, config, updated_at) VALUES (?, ?, ?) ON CONFLICT (id) DO UPDATE SET config = excluded.config, updated_at = excluded.updated_at', [id, json(config), now()]);
  }
  async getTheme(id: string) {
    const [r] = await this.db.all('SELECT config FROM themes WHERE id = ?', [id]);
    return r ? parse(r.config) : null;
  }

  async createRun(r: Parameters<Repository['createRun']>[0]) {
    const t = now();
    await this.db.run(
      `INSERT INTO runs (id, participant_id, cohort_id, storyline_id, storyline_version, lens_id, purpose, config, seed, attempt, engine_version, status, event_count, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', 0, ?, ?)`,
      [r.id, r.participantId, r.cohortId, r.storylineId, r.storylineVersion, r.lensId, r.purpose, json(r.config), r.seed, r.attempt, r.engineVersion, t, t]
    );
    return (await this.getRun(r.id))!;
  }
  async getRun(id: string) {
    const [r] = await this.db.all(`SELECT ${RUN_COLS} FROM runs WHERE id = ?`, [id]);
    return r ? runOf(r) : null;
  }
  async listRuns(participantId: string, storylineId?: string) {
    const rows = storylineId === undefined
      ? await this.db.all(`SELECT ${RUN_COLS} FROM runs WHERE participant_id = ? ORDER BY created_at, attempt`, [participantId])
      : await this.db.all(`SELECT ${RUN_COLS} FROM runs WHERE participant_id = ? AND storyline_id = ? ORDER BY attempt`, [participantId, storylineId]);
    return rows.map(runOf);
  }
  async listCohortRuns(cohortId: string) {
    const rows = await this.db.all(
      `SELECT r.id, r.participant_id, r.cohort_id, r.storyline_id, r.storyline_version, r.lens_id, r.purpose, r.config, r.seed, r.attempt, r.engine_version, r.status, r.event_count,
              r.score_total, r.conversions, r.capability, r.headline, r.created_at, r.updated_at, r.ended_at, p.name AS pname, s.summary AS summary
       FROM runs r JOIN participants p ON p.id = r.participant_id LEFT JOIN run_summaries s ON s.run_id = r.id
       WHERE r.cohort_id = ? ORDER BY r.created_at`, [cohortId]);
    return rows.map(r => ({ ...runOf(r), name: str(r.pname), summary: parse(r.summary) }));
  }

  async appendEvent(runId: string, e: Omit<RunEvent, 'createdAt'>, patch: Parameters<Repository['appendEvent']>[2], summary?: { lensId: string; summary: unknown }) {
    await this.db.tx(async db => {
      const t = now();
      await db.run('INSERT INTO run_events (run_id, seq, kind, payload, ai, created_at) VALUES (?, ?, ?, ?, ?, ?)', [runId, e.seq, e.kind, json(e.payload), json(e.ai), t]);
      const sets = ['event_count = ?', 'updated_at = ?'];
      const vals: Array<string | number | null> = [e.seq, t];
      const cols: Record<string, string> = { status: 'status', scoreTotal: 'score_total', conversions: 'conversions', capability: 'capability', headline: 'headline', endedAt: 'ended_at' };
      for (const [k, v] of Object.entries(patch)) if (v !== undefined) { sets.push(`${cols[k]} = ?`); vals.push(v as string | number | null); }
      const r = await db.run(`UPDATE runs SET ${sets.join(', ')} WHERE id = ? AND event_count = ?`, [...vals, runId, e.seq - 1]);
      if (!r.changes) throw new ConflictError(`run ${runId} moved on before event ${e.seq}`);
      if (summary) await this.summaryIn(db, runId, summary.lensId, summary.summary, t);
    });
  }
  private async summaryIn(db: Db, runId: string, lensId: string, summary: unknown, t = now()) {
    await db.run('INSERT INTO run_summaries (run_id, lens_id, summary, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT (run_id) DO UPDATE SET summary = excluded.summary, lens_id = excluded.lens_id, updated_at = excluded.updated_at', [runId, lensId, json(summary), t]);
  }
  async listEvents(runId: string) {
    return (await this.db.all('SELECT seq, kind, payload, ai, created_at FROM run_events WHERE run_id = ? ORDER BY seq', [runId]))
      .map(r => ({ seq: Number(r.seq), kind: r.kind as RunEvent['kind'], payload: parse(r.payload), ai: parse(r.ai) as unknown[], createdAt: String(r.created_at) }));
  }
  async putSummary(runId: string, lensId: string, summary: unknown) {
    await this.summaryIn(this.db, runId, lensId, summary);
  }
  async getSummary(runId: string) {
    const [r] = await this.db.all('SELECT summary FROM run_summaries WHERE run_id = ?', [runId]);
    return r ? parse(r.summary) : null;
  }
  async lensIds() {
    return (await this.db.all<{ lens_id: string }>('SELECT DISTINCT lens_id FROM run_summaries ORDER BY lens_id')).map(r => String(r.lens_id));
  }
  async listSummaries(lensId: string) {
    return (await this.db.all('SELECT summary FROM run_summaries WHERE lens_id = ? ORDER BY run_id', [lensId])).map(r => parse(r.summary));
  }

  async addReview(r: Parameters<Repository['addReview']>[0]) {
    await this.db.run('INSERT INTO reviews (id, run_id, record_id, band, skills, reviewer_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)', [randomUUID(), r.runId, r.recordId, r.band, json(r.skills ?? null), r.reviewerId, now()]);
  }

  async putBenchmark(key: string, summary: unknown, runs: number) {
    await this.db.run('INSERT INTO benchmarks (key, summary, runs, refreshed_at) VALUES (?, ?, ?, ?) ON CONFLICT (key) DO UPDATE SET summary = excluded.summary, runs = excluded.runs, refreshed_at = excluded.refreshed_at', [key, json(summary), runs, now()]);
  }
  async getBenchmark(key: string) {
    const [r] = await this.db.all('SELECT summary, runs, refreshed_at FROM benchmarks WHERE key = ?', [key]);
    return r ? { summary: parse(r.summary), runs: Number(r.runs), refreshedAt: String(r.refreshed_at) } : null;
  }

  async logEmail(e: Omit<EmailLogRow, 'id' | 'createdAt'>) {
    await this.db.run('INSERT INTO email_log (id, participant_id, run_id, to_address, template, status, message_id, error, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [randomUUID(), e.participantId, e.runId, e.to, e.template, e.status, e.messageId, e.error, now()]);
  }
  async countEmails(participantId: string, sinceIso: string) {
    const [r] = await this.db.all<{ n: number }>("SELECT COUNT(*) AS n FROM email_log WHERE participant_id = ? AND created_at >= ? AND status = 'sent'", [participantId, sinceIso]);
    return Number(r?.n ?? 0);
  }

  async createSession(s: Omit<SessionRow, 'createdAt'>) {
    await this.db.run('INSERT INTO sessions (id, participant_id, claims, expires_at, created_at) VALUES (?, ?, ?, ?, ?)', [s.id, s.participantId, json(s.claims), s.expiresAt, now()]);
  }
  async getSession(id: string) {
    const [r] = await this.db.all('SELECT * FROM sessions WHERE id = ?', [id]);
    return r ? { id: String(r.id), participantId: str(r.participant_id), claims: parse(r.claims), expiresAt: String(r.expires_at), createdAt: String(r.created_at) } : null;
  }
  async deleteSession(id: string) {
    await this.db.run('DELETE FROM sessions WHERE id = ?', [id]);
  }

  async getPdf(runId: string, version: string) {
    const [r] = await this.db.all('SELECT pdf FROM pdf_cache WHERE run_id = ? AND version = ?', [runId, version]);
    return r ? Buffer.from(r.pdf as Uint8Array) : null;
  }
  async putPdf(runId: string, version: string, pdf: Uint8Array) {
    await this.db.run('INSERT INTO pdf_cache (run_id, version, pdf, created_at) VALUES (?, ?, ?, ?) ON CONFLICT (run_id) DO UPDATE SET version = excluded.version, pdf = excluded.pdf, created_at = excluded.created_at', [runId, version, pdf, now()]);
  }

  async purge(beforeIso: string | null) {
    const sessions = (await this.db.run('DELETE FROM sessions WHERE expires_at < ?', [now()])).changes;
    let runs = 0;
    if (beforeIso) {
      const old = await this.db.all<{ id: string }>('SELECT id FROM runs WHERE updated_at < ?', [beforeIso]);
      for (const { id } of old) {
        await this.db.tx(async db => {
          for (const t of ['run_events', 'run_summaries', 'reviews', 'pdf_cache']) await db.run(`DELETE FROM ${t} WHERE run_id = ?`, [id]);
          await db.run('DELETE FROM runs WHERE id = ?', [id]);
        });
        runs++;
      }
      await this.db.run('DELETE FROM email_log WHERE created_at < ?', [beforeIso]);
    }
    return { sessions, runs };
  }
  ping() { return this.db.ping(); }
  close() { return this.db.close(); }
}
