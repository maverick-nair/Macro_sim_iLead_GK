import { describe, expect, it } from 'vitest';
import { EngineError, type EngineClient } from './client';
import type { Intent, IntentResult } from './contract';
import { rememberedRun, rememberRun, resilientClient } from './resilient';

/** Save and resume on the client (D86). */
class Events extends EventTarget {
  fire(type: 'online' | 'offline') { this.dispatchEvent(new Event(type)); }
}
function memoryStorage() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), m };
}
const result = (n: number) => ({ n } as unknown as IntentResult);
const intent = (memberId: string): Intent => ({ type: 'openProfile', memberId });

function fake(behaviour: (i: Intent, n: number) => Promise<IntentResult>) {
  const sent: Array<{ intent: Intent; id?: string }> = [];
  let n = 0;
  const client: EngineClient & { sendWithId(i: Intent, id: string): Promise<IntentResult> } = {
    view: async () => ({}) as never,
    send: i => behaviour(i, n++),
    sendWithId: (i, id) => { sent.push({ intent: i, id }); return behaviour(i, n++); },
    streamTurn: async function* () { /* none */ }
  };
  return { client, sent };
}

describe('resilient engine client', () => {
  it('holds intents while offline, says so, and sends them in order on reconnect', async () => {
    const events = new Events();
    let online = false;
    const { client, sent } = fake(async (_i, n) => result(n));
    const storage = memoryStorage();
    const c = resilientClient(client, { storage, key: 'q', isOnline: () => online, events, newId: (() => { let i = 0; return () => `r${++i}`; })() });
    const a = c.send(intent('kent'));
    const b = c.send(intent('beth'));
    await Promise.resolve();
    expect(c.state()).toEqual({ online: false, pending: 2, retrying: false });
    expect(JSON.parse(storage.m.get('q')!)).toHaveLength(2);
    expect(sent).toHaveLength(0);
    online = true;
    events.fire('online');
    expect(await a).toEqual(result(0));
    expect(await b).toEqual(result(1));
    expect(sent.map(s => [s.id, (s.intent as { memberId: string }).memberId])).toEqual([['r1', 'kent'], ['r2', 'beth']]);
    expect(c.state().pending).toBe(0);
    expect(storage.m.has('q')).toBe(false);
  });

  it('a request that fails on the network waits for the connection, then goes again with the same request id', async () => {
    const events = new Events();
    let online = true;
    let fail = true;
    const { client, sent } = fake(async (_i, n) => { if (fail) { fail = false; online = false; throw new EngineError('Network error', 'network', true); } return result(n); });
    const c = resilientClient(client, { storage: null, isOnline: () => online, events, wait: async () => {} });
    const p = c.send(intent('kent'));
    await new Promise(r => setTimeout(r, 0));
    expect(c.state().online).toBe(false);
    online = true;
    events.fire('online');
    await p;
    expect(sent).toHaveLength(2);
    expect(sent[0].id).toBe(sent[1].id);
  });

  it('retries a server error a few times, then reports it; a refusal is reported at once', async () => {
    let calls = 0;
    const { client } = fake(async () => { calls++; throw new EngineError('Down', 'http503', true); });
    const c = resilientClient(client, { storage: null, isOnline: () => true, events: null, backoff: [1, 1], wait: async () => {} });
    await expect(c.send(intent('kent'))).rejects.toMatchObject({ code: 'http503' });
    expect(calls).toBe(3);
    const { client: refusing } = fake(async () => { throw new EngineError('No', 'unknownStyle'); });
    const d = resilientClient(refusing, { storage: null, isOnline: () => true, events: null, wait: async () => {} });
    await expect(d.send(intent('kent'))).rejects.toMatchObject({ code: 'unknownStyle' });
    // The queue moves on after a refusal.
    expect(d.state().pending).toBe(0);
  });

  it('sends what an earlier page left waiting before it reads the view', async () => {
    const storage = memoryStorage();
    storage.setItem('q', JSON.stringify([{ id: 'old', intent: intent('kent'), at: 1 }]));
    const order: string[] = [];
    const { client } = fake(async () => { order.push('intent'); return result(0); });
    client.view = async () => { order.push('view'); return {} as never; };
    const c = resilientClient(client, { storage, key: 'q', isOnline: () => true, events: null });
    await c.view();
    expect(order).toEqual(['intent', 'view']);
    expect(storage.m.has('q')).toBe(false);
  });

  it('remembers the run this browser last played', () => {
    const s = memoryStorage();
    expect(rememberedRun(s)).toBeNull();
    rememberRun('p-123', s);
    expect(rememberedRun(s)).toBe('p-123');
  });
});
