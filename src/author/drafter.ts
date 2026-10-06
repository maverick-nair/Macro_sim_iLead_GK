import { AuthorDraftResponse, AuthorTurnResponse, Brief, type AuthorDraftRequest, type AuthorTurnRequest } from '../api/author';
import { extractFramework } from './extract';
import { planQuestions, questionFor } from './questions';
import { recommendLens } from './recommend';
import { draftStoryline, previewOf } from './storyline';

/**
 * Who drafts (D74). `ServerDrafter` asks GenieKreator's server (`POST /author/turn`, `POST /author/draft`,
 * docs/genie/prompts/); `MockDrafter` drafts from rules and templates with no model. A server that does
 * not offer an endpoint (404 or 501) returns null, and the chat falls back to the mock.
 */
export interface Drafter {
  readonly source: 'server' | 'templates';
  turn(req: AuthorTurnRequest): Promise<AuthorTurnResponse | null>;
  draft(req: AuthorDraftRequest): Promise<AuthorDraftResponse | null>;
}

export class MockDrafter implements Drafter {
  readonly source = 'templates' as const;

  async turn(req: AuthorTurnRequest): Promise<AuthorTurnResponse> {
    const brief = Brief.parse(req.brief);
    const plan = planQuestions(brief, req.asked);
    if (plan.next) return { kind: 'question', brief, question: { ...questionFor(plan.next, brief), ...(plan.confirm ? { confirm: plan.confirm } : null) }, progress: { n: plan.n, about: plan.about } };
    return { kind: 'lens', brief, recommendation: recommendLens(brief), framework: brief.framework ? extractFramework(brief.framework) : null };
  }

  async draft(req: AuthorDraftRequest): Promise<AuthorDraftResponse> {
    const storyline = draftStoryline(Brief.parse(req.brief), req.leadership_lens);
    return { storyline: storyline as unknown as Record<string, unknown>, preview: previewOf(storyline) };
  }
}

export class ServerDrafter implements Drafter {
  readonly source = 'server' as const;
  constructor(private readonly baseUrl: string, private readonly fetchImpl: typeof fetch = (...a) => fetch(...a)) {}

  private async post<T>(path: string, body: unknown, schema: { parse(v: unknown): T }): Promise<T | null> {
    const res = await this.fetchImpl(`${this.baseUrl.replace(/\/$/, '')}${path}`, { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify(body) });
    if (res.status === 404 || res.status === 501) return null;
    if (!res.ok) throw new Error(`POST ${path} failed with ${res.status}`);
    return schema.parse(await res.json());
  }

  turn(req: AuthorTurnRequest) { return this.post('/author/turn', req, AuthorTurnResponse); }
  draft(req: AuthorDraftRequest) { return this.post('/author/draft', req, AuthorDraftResponse); }
}

/** The server when `VITE_GENIE_URL` is set, falling back to the templates turn by turn; otherwise the templates. */
export function createDrafters(url = import.meta.env.VITE_GENIE_URL as string | undefined): Drafter[] {
  return url ? [new ServerDrafter(url), new MockDrafter()] : [new MockDrafter()];
}

/** Runs a request on the first drafter that answers it, and says which one did. */
export async function firstAnswer<T>(drafters: Drafter[], call: (d: Drafter) => Promise<T | null>): Promise<{ value: T; source: Drafter['source'] }> {
  for (const d of drafters) {
    try {
      const value = await call(d);
      if (value !== null) return { value, source: d.source };
    } catch (e) {
      if (d === drafters[drafters.length - 1]) throw e;
      console.warn(`The ${d.source} drafter failed; using the next one.`, e);
    }
  }
  throw new Error('No drafter answered');
}
