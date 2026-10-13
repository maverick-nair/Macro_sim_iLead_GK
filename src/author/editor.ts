import { AuthorEditResponse, type AuthorEditRequest } from '../api/authorEdit';
import type { AuthorDraft, Tab } from './model/draft';
import { charactersIn, eventsIn, understand, type KoraAnswer } from './model/intents';
import { checkOps, editView, type EditOp } from './model/patch';

/**
 * Ask Kora's client (D127). With `VITE_GENIE_URL` set, an instruction goes to the server's model
 * (`POST /author/edit`) with a compact view of the fields it may change; the answer is checked again
 * here against the full draft before it is shown. With no server, or when the model does not answer in
 * time, fails or proposes something the draft refuses, the rules answer (`model/intents.ts`) and the
 * reply says why. The author can cancel a request that is still running.
 */

export const EDIT_TIMEOUT_MS = 30_000;

export interface KoraResult {
  answer: KoraAnswer;
  /** Set when the model was asked and the rules answered instead: why, in plain words. */
  fallback: string | null;
}

export class EditorError extends Error {
  constructor(readonly code: 'timeout' | 'unavailable' | 'failed' | 'invalid', message: string) { super(message); this.name = 'EditorError'; }
}

/** Asks the server's model; throws `EditorError` on anything but a usable answer, AbortError on cancel. */
export async function askModel(baseUrl: string, req: AuthorEditRequest, opts: { signal?: AbortSignal; timeoutMs?: number; fetchImpl?: typeof fetch } = {}): Promise<AuthorEditResponse> {
  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), opts.timeoutMs ?? EDIT_TIMEOUT_MS);
  const onAbort = () => timeout.abort();
  opts.signal?.addEventListener('abort', onAbort);
  try {
    const res = await (opts.fetchImpl ?? fetch)(`${baseUrl.replace(/\/$/, '')}/author/edit`, {
      method: 'POST', credentials: 'include', signal: timeout.signal,
      headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify(req)
    });
    if (res.status === 404 || res.status === 501) throw new EditorError('unavailable', 'Kora\'s model is not available here');
    if (!res.ok) throw new EditorError('failed', `Kora's model did not answer (error ${res.status})`);
    const r = AuthorEditResponse.safeParse(await res.json());
    if (!r.success) throw new EditorError('invalid', 'Kora\'s model gave an answer the app cannot use');
    return r.data;
  } catch (e) {
    if (opts.signal?.aborted) throw Object.assign(new Error('Cancelled'), { name: 'AbortError' });
    if (timeout.signal.aborted) throw new EditorError('timeout', `Kora's model took longer than ${Math.round((opts.timeoutMs ?? EDIT_TIMEOUT_MS) / 1000)} seconds`);
    if (e instanceof EditorError) throw e;
    throw new EditorError('failed', 'Kora\'s model could not be reached');
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener('abort', onAbort);
  }
}

/** The model's answer as Kora's answer, checked against the full draft. Throws `EditorError('invalid')` when the draft refuses it. */
export function fromModel(d: AuthorDraft, req: AuthorEditRequest, res: AuthorEditResponse): KoraAnswer {
  if (res.kind === 'reply') return { kind: 'reply', reply: res.reply, ...(res.options.length ? { options: res.options } : null), source: 'model' };
  const ops: EditOp[] = res.ops.map(o => ({ op: 'set', path: o.path, value: o.value }));
  const checked = checkOps(d, ops, new Set(Object.keys(req.view.fields)));
  if (!checked.ok) throw new EditorError('invalid', 'Kora\'s model proposed a change the draft does not allow');
  if (!checked.ops.length) return { kind: 'reply', reply: res.reply || 'Nothing to change.', source: 'model' };
  return { kind: 'change', reply: res.reply, ops: checked.ops, changes: checked.changes, marks: checked.marks, source: 'model' };
}

/**
 * Kora's answer to an instruction: the model's when a server is set, else (or when it fails) the rules'.
 * `useModel: false` asks the rules directly (another draft of a regenerated item, for example).
 */
export async function askKora(d: AuthorDraft, tab: Tab, instruction: string, opts: { url?: string; signal?: AbortSignal; timeoutMs?: number; fetchImpl?: typeof fetch; variant?: number; useModel?: boolean } = {}): Promise<KoraResult> {
  const url = opts.url ?? (import.meta.env.VITE_GENIE_URL as string | undefined);
  const rules = () => understand(d, tab, instruction, opts.variant ?? 0);
  if (!url || opts.useModel === false) return { answer: rules(), fallback: null };
  const view = editView(d, tab, { characters: charactersIn(d, instruction).map(c => c.id), events: eventsIn(d, instruction).map(e => e.key) });
  const req: AuthorEditRequest = { instruction: instruction.trim().slice(0, 2000), tab, view };
  try {
    return { answer: fromModel(d, req, await askModel(url, req, opts)), fallback: null };
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    const why = e instanceof EditorError ? e.message : 'Kora\'s model did not answer';
    return { answer: rules(), fallback: `${why}, so I used the built-in rules.` };
  }
}
