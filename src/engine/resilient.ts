import { EngineError, type EngineClient } from './client';
import type { Intent, IntentResult } from './contract';

/**
 * Save and resume on the client (D86). The server is authoritative and keeps the run; this keeps what
 * the participant has done but the server has not yet confirmed:
 * - Intents go out strictly in order. While the browser is offline, or a request fails on the network,
 *   they wait in a queue (kept in local storage) and go out in order when the connection is back. A
 *   reload sends whatever was left waiting before it asks for the view.
 * - Each intent carries a request id, so a server that already applied one it never answered for can
 *   answer again without applying it twice (`Idempotency-Key`, HANDOFF 2).
 * - Server errors (5xx) are retried a few times with a growing wait, then reported.
 * The mock engine runs in the browser and never fails on the network, but it waits while offline too,
 * so the behavior can be seen and tested without a server.
 */
export interface Pending { id: string; intent: Intent; at: number }
export interface ConnectionState { online: boolean; pending: number; retrying: boolean }

export interface ResilientClient extends EngineClient {
  state(): ConnectionState;
  subscribe(fn: () => void): () => void;
}

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
export interface ResilientOptions {
  /** Where the queue is kept, per participant. */
  storage?: Store | null;
  key?: string;
  /** Whether the browser is online now, and where `online` and `offline` are announced. */
  isOnline?: () => boolean;
  events?: Pick<EventTarget, 'addEventListener' | 'removeEventListener'> | null;
  /** Waits between retries of a server error, in ms. */
  backoff?: number[];
  wait?: (ms: number) => Promise<void>;
  newId?: () => string;
}

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
const uuid = () => globalThis.crypto?.randomUUID?.() ?? `r${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;

export function resilientClient(inner: EngineClient & { sendWithId?: (intent: Intent, requestId: string) => Promise<IntentResult> }, opts: ResilientOptions = {}): ResilientClient {
  const storage = opts.storage === undefined ? safeStorage() : opts.storage;
  const key = opts.key ?? 'ilead.pending';
  const isOnline = opts.isOnline ?? (() => globalThis.navigator?.onLine !== false);
  const events = opts.events === undefined ? (typeof window === 'undefined' ? null : window) : opts.events;
  const backoff = opts.backoff ?? [1000, 3000, 8000];
  const wait = opts.wait ?? sleep;
  const newId = opts.newId ?? uuid;

  const listeners = new Set<() => void>();
  let online = isOnline();
  let retrying = false;
  let queue: Pending[] = read();
  let wake: (() => void) | null = null;
  // One snapshot per change, so React can tell when it moved (useSyncExternalStore).
  let snapshot: ConnectionState = { online, pending: queue.length, retrying };
  const emit = () => {
    if (snapshot.online !== online || snapshot.pending !== queue.length || snapshot.retrying !== retrying) snapshot = { online, pending: queue.length, retrying };
    listeners.forEach(f => f());
  };

  function read(): Pending[] {
    try { const raw = storage?.getItem(key); return raw ? (JSON.parse(raw) as Pending[]) : []; } catch { return []; }
  }
  function write() {
    try { if (queue.length) storage?.setItem(key, JSON.stringify(queue)); else storage?.removeItem(key); } catch { /* storage full or blocked: the queue still lives in memory */ }
  }
  const setOnline = (v: boolean) => { online = v; if (v) wake?.(); emit(); };
  events?.addEventListener('online', () => setOnline(true));
  events?.addEventListener('offline', () => setOnline(false));
  /** Resolves once the browser says it is online again. */
  const untilOnline = () => (online ? Promise.resolve() : new Promise<void>(r => { wake = () => { wake = null; r(); }; }));

  /** Sends one queued intent until it gets an answer: the network waits for a connection, server errors back off. */
  async function deliver(p: Pending): Promise<IntentResult> {
    let serverTries = 0;
    for (;;) {
      await untilOnline();
      try {
        const r = inner.sendWithId ? await inner.sendWithId(p.intent, p.id) : await inner.send(p.intent);
        retrying = false;
        return r;
      } catch (e) {
        if (!(e instanceof EngineError) || !e.retryable) { retrying = false; throw e; }
        if (e.code === 'network') {
          // The connection dropped mid request: wait for it, as if offline.
          retrying = true;
          if (isOnline()) { online = true; await wait(backoff[0] ?? 1000); } else setOnline(false);
          emit();
          continue;
        }
        if (serverTries >= backoff.length) { retrying = false; throw e; }
        retrying = true; emit();
        await wait(backoff[serverTries++]);
      }
    }
  }

  // Intents leave strictly in order: each waits for the one before it.
  let chain: Promise<unknown> = Promise.resolve();
  function enqueue(p: Pending): Promise<IntentResult> {
    const run = chain.then(() => deliver(p)).finally(() => {
      queue = queue.filter(x => x.id !== p.id);
      write();
      emit();
    });
    chain = run.catch(() => undefined);
    return run;
  }

  // Left waiting by an earlier page (a reload while offline): they go out first, in order.
  const leftover = [...queue];
  for (const p of leftover) void enqueue(p).catch(e => console.warn('A saved action could not be sent', e));
  const flushed = chain;

  return {
    async view() {
      await flushed;
      return inner.view();
    },
    send(intent) {
      const p: Pending = { id: newId(), intent, at: Date.now() };
      queue = [...queue, p];
      write();
      emit();
      return enqueue(p);
    },
    streamTurn: (id, turn, signal) => inner.streamTurn(id, turn, signal),
    state: () => snapshot,
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
  };
}

function safeStorage(): Store | null {
  try { return globalThis.localStorage ?? null; } catch { return null; }
}

/**
 * The run this browser last played (D86): the participant id from the launch, kept so a reload or a
 * bookmark without the launch link resumes the same run on the server.
 */
const RUN_KEY = 'ilead.run';
export function rememberRun(participant: string, storage: Store | null = safeStorage()) {
  try { storage?.setItem(RUN_KEY, JSON.stringify({ participant, savedAt: new Date().toISOString() })); } catch { /* blocked */ }
}
export function rememberedRun(storage: Store | null = safeStorage()): string | null {
  try { const raw = storage?.getItem(RUN_KEY); return raw ? (JSON.parse(raw) as { participant?: string }).participant ?? null : null; } catch { return null; }
}
