import { AuthorDraftResponse, AuthorTurnResponse, Brief, type AuthorDraftRequest, type AuthorTurnRequest } from '../api/author';
import { planQuestions, questionFor } from './questions';
import { frameworkOf } from './read';
import { recommendLens } from './recommend';
import { draftStoryline, previewOf } from './storyline';

/**
 * Who drafts (D74). `ServerDrafter` asks GenieKreator's server (`POST /author/turn`, `POST /author/draft`,
 * docs/genie/prompts/); `MockDrafter` drafts from rules and templates with no model. A server that does
 * not offer an endpoint (404 or 501) returns null, and the chat falls back to the mock. A server that
 * does not answer in time (30 seconds a turn, 120 seconds a draft), fails, or is cancelled throws a
 * `DrafterError`, and the chat offers Retry and Continue offline (D148): it never waits for ever.
 */
export interface CallOpts { signal?: AbortSignal }
export interface Drafter {
  readonly source: 'server' | 'templates';
  turn(req: AuthorTurnRequest, opts?: CallOpts): Promise<AuthorTurnResponse | null>;
  draft(req: AuthorDraftRequest, opts?: CallOpts): Promise<AuthorDraftResponse | null>;
}

export const TURN_TIMEOUT_MS = 30_000;
export const DRAFT_TIMEOUT_MS = 120_000;

export class DrafterError extends Error {
  constructor(readonly code: 'timeout' | 'failed' | 'cancelled', message: string) { super(message); this.name = 'DrafterError'; }
}

export class MockDrafter implements Drafter {
  readonly source = 'templates' as const;

  async turn(req: AuthorTurnRequest): Promise<AuthorTurnResponse> {
    const brief = Brief.parse(req.brief);
    const plan = planQuestions(brief, req.asked, req.taken ?? []);
    if (plan.next) return { kind: 'question', brief, question: { ...questionFor(plan.next, brief), ...(plan.confirm ? { confirm: plan.confirm } : null) }, progress: { n: plan.n, about: plan.about } };
    return { kind: 'lens', brief, recommendation: recommendLens(brief), framework: brief.framework ? frameworkOf(brief.framework) : null };
  }

  async draft(req: AuthorDraftRequest): Promise<AuthorDraftResponse> {
    const storyline = draftStoryline(Brief.parse(req.brief), req.leadership_lens);
    return { storyline: storyline as unknown as Record<string, unknown>, preview: previewOf(storyline) };
  }
}

export class ServerDrafter implements Drafter {
  readonly source = 'server' as const;
  constructor(private readonly baseUrl: string, private readonly fetchImpl: typeof fetch = (...a) => fetch(...a), private readonly timeouts = { turn: TURN_TIMEOUT_MS, draft: DRAFT_TIMEOUT_MS }) {}

  private async post<T>(path: string, body: unknown, schema: { parse(v: unknown): T }, ms: number, signal?: AbortSignal): Promise<T | null> {
    const timer = new AbortController();
    const t = setTimeout(() => timer.abort(), ms);
    const onAbort = () => timer.abort();
    signal?.addEventListener('abort', onAbort);
    try {
      const res = await this.fetchImpl(`${this.baseUrl.replace(/\/$/, '')}${path}`, { method: 'POST', credentials: 'include', signal: timer.signal, headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify(body) });
      if (res.status === 404 || res.status === 501) return null;
      if (!res.ok) throw new DrafterError('failed', `Kora's server did not answer (error ${res.status}).`);
      return schema.parse(await res.json());
    } catch (e) {
      if (signal?.aborted) throw new DrafterError('cancelled', 'Stopped.');
      if (timer.signal.aborted) throw new DrafterError('timeout', `Kora's server took longer than ${Math.round(ms / 1000)} seconds.`);
      if (e instanceof DrafterError) throw e;
      throw new DrafterError('failed', 'Kora\'s server could not be reached or gave an answer the app cannot use.');
    } finally {
      clearTimeout(t);
      signal?.removeEventListener('abort', onAbort);
    }
  }

  turn(req: AuthorTurnRequest, opts?: CallOpts) { return this.post('/author/turn', req, AuthorTurnResponse, this.timeouts.turn, opts?.signal); }
  draft(req: AuthorDraftRequest, opts?: CallOpts) { return this.post('/author/draft', req, AuthorDraftResponse, this.timeouts.draft, opts?.signal); }
}

/** Why the server's turn did not come back, in plain words, with the two ways on the chat offers (D148). */
export function failureText(e: unknown): string {
  if (e instanceof DrafterError && e.code === 'timeout') return `${e.message} Retry, or continue offline with Kora's built-in rules.`;
  if (e instanceof DrafterError && e.code === 'cancelled') return 'You stopped Kora. Retry, or continue offline with Kora\'s built-in rules.';
  return 'Kora could not reach the drafter. Retry, or continue offline with Kora\'s built-in rules.';
}

/** The server when `VITE_GENIE_URL` is set, falling back to the templates when it does not offer a call; otherwise the templates. */
export function createDrafters(url = import.meta.env.VITE_GENIE_URL as string | undefined): Drafter[] {
  return url ? [new ServerDrafter(url), new MockDrafter()] : [new MockDrafter()];
}

/**
 * Runs a request on the first drafter that answers it, and says which one did. A drafter that does not offer the
 * call (null) hands it to the next; one that fails, times out or is cancelled throws, so the author chooses (D148).
 */
export async function firstAnswer<T>(drafters: Drafter[], call: (d: Drafter) => Promise<T | null>): Promise<{ value: T; source: Drafter['source'] }> {
  for (const d of drafters) {
    const value = await call(d);
    if (value !== null) return { value, source: d.source };
  }
  throw new DrafterError('failed', 'No drafter answered.');
}
