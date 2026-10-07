import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { EngineView, IntentResult, StreamChunk } from '../../src/engine/contract';
import { readSse } from '../../src/ai/sse';
import { mockPorts, type AiPorts } from '../src/ports';
import { playToEnd, testServer, type TestServer } from './helpers';

let s: TestServer;
afterEach(async () => { await s?.close(); s = undefined as unknown as TestServer; });

const base = '/engine/sessions/p-1';
const send = (cookie: string, intent: unknown) => s.json<IntentResult>(`${base}/intents`, { method: 'POST', cookie, json: intent });
const view = (cookie: string) => s.json<EngineView>(`${base}/view`, { cookie });

/** Styles for everyone, then a 1:1 with Kent: two turns and the end. Returns the interaction id. */
async function aWeek(cookie: string) {
  const v = await view(cookie);
  await send(cookie, { type: 'confirmStyles', styles: Object.fromEntries(v.members.map(m => [m.id, 'G'])), notes: { kent: 'New and unsure' } });
  await send(cookie, { type: 'openProfile', memberId: 'kent' });
  const plan = await send(cookie, { type: 'planAction', action: 'f2f', memberIds: ['kent'] });
  const id = plan.interactionId!;
  const t1 = await send(cookie, { type: 'sendTurn', interactionId: id, text: 'Thanks for making time, I appreciate it. What is on your mind?' });
  await send(cookie, { type: 'interruptTurn', interactionId: id, turnId: t1.turn!.id, shownChars: 12 });
  await send(cookie, { type: 'sendTurn', interactionId: id, text: 'Let us agree one next step by Friday. How would you like to start?' });
  await send(cookie, { type: 'requestHint', interactionId: id });
  const end = await send(cookie, { type: 'endInteraction', interactionId: id });
  expect(end.outcome?.changes.length).toBeGreaterThan(0);
  return id;
}

describe('the engine on the server', () => {
  it('starts a run on first view, applies intents and answers payloads the app parses', async () => {
    s = await testServer();
    const cookie = await s.launch({ sub: 'p-1', cohort: 'c-1' });
    const v = await view(cookie);
    expect(EngineView.safeParse(v).success).toBe(true);
    expect(v.phase).toBe('style');
    const r = await send(cookie, { type: 'confirmStyles', styles: Object.fromEntries(v.members.map(m => [m.id, 'D'])) });
    expect(IntentResult.safeParse(r).success).toBe(true);
    expect(r.view.phase).toBe('board');
    const run = await s.json<{ attempt: number; status: string; events: number }>(`${base}/run`, { cookie });
    expect(run).toMatchObject({ attempt: 1, status: 'active', events: 1 });
  });

  it('refuses an intent with the engine\'s code and changes nothing', async () => {
    s = await testServer();
    const cookie = await s.launch({ sub: 'p-1' });
    const before = await view(cookie);
    const res = await s.req(`${base}/intents`, { method: 'POST', cookie, json: { type: 'planAction', action: 'f2f', memberIds: ['kent'] } });
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ code: expect.any(String), message: expect.any(String) });
    expect(await view(cookie)).toEqual(before);
    expect((await s.ctx.repo.listEvents((await s.ctx.repo.listRuns('p-1'))[0].id))).toHaveLength(0);
  });

  it('streams an NPC turn as server sent events the app reads', async () => {
    s = await testServer();
    const cookie = await s.launch({ sub: 'p-1' });
    const v = await view(cookie);
    await send(cookie, { type: 'confirmStyles', styles: Object.fromEntries(v.members.map(m => [m.id, 'G'])) });
    const plan = await send(cookie, { type: 'planAction', action: 'f2f', memberIds: ['kent'] });
    const t = await send(cookie, { type: 'sendTurn', interactionId: plan.interactionId!, text: 'How are things going this week?' });
    const res = await s.req(`${base}/interactions/${plan.interactionId}/turns/${t.turn!.id}/stream`, { cookie, headers: { accept: 'text/event-stream' } });
    expect(res.headers.get('content-type')).toMatch(/text\/event-stream/);
    const chunks = [];
    for await (const c of readSse(res)) chunks.push(c);
    expect(chunks.every(c => StreamChunk.safeParse(c).success)).toBe(true);
    expect(chunks.at(-1)).toEqual({ type: 'done', turnId: t.turn!.id });
    expect(chunks.filter(c => c.type === 'token').map(c => (c as { text: string }).text).join('')).toBe(t.turn!.text);
    const missing = await s.req(`${base}/interactions/${plan.interactionId}/turns/nope/stream`, { cookie });
    expect(missing.status).toBe(404);
  });

  it('serializes concurrent intents on one run', async () => {
    s = await testServer();
    const cookie = await s.launch({ sub: 'p-1' });
    const v = await view(cookie);
    await send(cookie, { type: 'confirmStyles', styles: Object.fromEntries(v.members.map(m => [m.id, 'G'])) });
    const ids = v.members.map(m => m.id);
    const all = await Promise.all(ids.map(id => s.req(`${base}/intents`, { method: 'POST', cookie, json: { type: 'openProfile', memberId: id } })));
    expect(all.map(r => r.status)).toEqual(ids.map(() => 200));
    const events = await s.ctx.repo.listEvents((await s.ctx.repo.listRuns('p-1'))[0].id);
    expect(events.map(e => e.seq)).toEqual(events.map((_, i) => i + 1));
    expect(events).toHaveLength(1 + ids.length);
  });

  it('replays a run exactly from its event log, with the model answers it recorded', async () => {
    // A model that never says the same thing twice: replay must use the recorded words, not ask again.
    let n = 0;
    const mock = mockPorts();
    const ai: AiPorts = {
      ...mock,
      npc: { reply: async ctx => ({ ...(await mock.npc.reply(ctx)), text: `Line ${++n} at ${Math.random()}` }) },
      evaluator: { evaluate: async input => ({ ...(await mock.evaluator.evaluate(input)), evidence: [`seen ${Math.random()}`] }) }
    };
    s = await testServer({ ai });
    const cookie = await s.launch({ sub: 'p-1' });
    await aWeek(cookie);
    await send(cookie, { type: 'endPeriod' });
    const live = await view(cookie);
    const run = (await s.ctx.repo.listRuns('p-1'))[0];
    s.ctx.runs.forget(run.id);
    const callsBefore = n;
    const replayed = await view(cookie);
    expect(replayed).toEqual(live);
    expect(n).toBe(callsBefore);
  });

  it('resumes after a restart: a new server on the same database picks up the run', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ilead-'));
    const file = path.join(dir, 'ilead.sqlite');
    s = await testServer({ sqlitePath: file });
    const cookie = await s.launch({ sub: 'p-1' });
    await aWeek(cookie);
    const before = await view(cookie);
    await s.close();
    s = await testServer({ sqlitePath: file });
    // The session survives too: it is stored, not in memory.
    const after = await view(cookie);
    expect(after).toEqual(before);
    const r = await send(cookie, { type: 'endPeriod' });
    expect(r.view.phase).toBe('periodEnd');
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('starts a new attempt only after the last one ended, and keeps the earlier one for the history', async () => {
    s = await testServer();
    const cookie = await s.launch({ sub: 'p-1' });
    await send(cookie, { type: 'openProfile', memberId: 'kent' });
    expect((await s.req(`${base}/runs`, { method: 'POST', cookie })).status).toBe(409);
    expect((await s.req('/api/history', { cookie })).status).toBe(404);
    await playToEnd(s, cookie, 'p-1');
    const next = await s.json<{ run: { attempt: number }; view: EngineView }>(`${base}/runs`, { method: 'POST', cookie });
    expect(next.run.attempt).toBe(2);
    expect(next.view.phase).toBe('style');
    const history = await s.json<Array<{ attempt: number; headline: string; summary: { completion: number } }>>('/api/history', { cookie });
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ attempt: 1, summary: { completion: 100 } });
    // A launch that asks for a new attempt on a fresh one does not stack empty runs.
    const again = await s.launch({ sub: 'p-1', attempt: 'new' });
    expect((await s.json<{ attempt: number }>(`${base}/run`, { cookie: again })).attempt).toBe(2);
  });

  it('lets an assessor review a conversation; the review is in the log and survives a replay', async () => {
    s = await testServer();
    const cookie = await s.launch({ sub: 'p-1', cohort: 'c-1', purpose: 'assessment' });
    const assessor = await s.launch({ sub: 'a-1', roles: ['assessor'], cohort: 'c-1' });
    await aWeek(cookie);
    const run = (await s.ctx.repo.listRuns('p-1'))[0];
    const { records } = await s.json<{ records: Array<{ id: string; band: string }> }>(`/engine/runs/${run.id}/records`, { cookie: assessor });
    expect(records).toHaveLength(1);
    const band = records[0].band === 'harmful' ? 'strong' : 'harmful';
    await s.json(`/engine/runs/${run.id}/review`, { method: 'POST', cookie: assessor, json: { recordId: records[0].id, band } });
    const reviewed = (await s.json<{ records: Array<{ band: string; aiBand: string; reviewed: boolean }> }>(`/engine/runs/${run.id}/records`, { cookie: assessor })).records[0];
    expect(reviewed).toMatchObject({ band, aiBand: records[0].band, reviewed: true });
    s.ctx.runs.forget(run.id);
    expect((await s.json<{ records: Array<{ band: string }> }>(`/engine/runs/${run.id}/records`, { cookie: assessor })).records[0].band).toBe(band);
    const unknown = await s.req(`/engine/runs/${run.id}/review`, { method: 'POST', cookie: assessor, json: { recordId: 'r999', band: 'weak' } });
    expect(unknown.status).toBe(409);
  });

  it('plays the storyline and purpose the launch names', async () => {
    s = await testServer();
    const cookie = await s.launch({ sub: 'p-1', storyline: 'sales_elevator_six_styles', purpose: 'assessment' });
    const v = await view(cookie);
    expect(v.lens.id).toBe('six_styles');
    expect(v.lens.styles).toHaveLength(6);
    const run = (await s.ctx.repo.listRuns('p-1'))[0];
    expect(run).toMatchObject({ storylineId: 'sales_elevator_six_styles', purpose: 'assessment', lensId: 'six_styles' });
    const bad = await s.launch({ sub: 'p-2', storyline: 'no_such_storyline' });
    expect((await s.req('/engine/sessions/p-2/view', { cookie: bad })).status).toBe(404);
  });
});
