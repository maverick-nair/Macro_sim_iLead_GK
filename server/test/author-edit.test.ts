import { afterEach, describe, expect, it } from 'vitest';
import { createAnthropicAuthorEditor, createFakeTransport, settingsFor, silentLogger } from '../../ai/src/index';
import { Brief } from '../../src/api/author';
import { AuthorEditResponse } from '../../src/api/authorEdit';
import { editView } from '../../src/author/model/patch';
import { emptyChat, seedDraft } from '../../src/author/model/seed';
import { mockPorts, type AuthorEditor } from '../src/ports';
import { testServer, type TestServer } from './helpers';

/** POST /genie/author/edit (D127): Ask Kora with a model, behind the author role, the whitelist and a 501 when not offered. */

const draft = seedDraft({ ...emptyChat(), brief: Brief.parse({ industry: 'Healthcare', teamSize: 10 }), primary: 'six_styles' }, 'workspace');
const body = (instruction = 'Make it harder') => ({ instruction, tab: 'process', view: editView(draft, 'process') });
const PATH = '/genie/author/edit';

let s: TestServer;
afterEach(async () => { await s?.close(); s = undefined as unknown as TestServer; });

async function withEditor(editor?: AuthorEditor) {
  s = await testServer({ ai: { ...mockPorts(), ...(editor ? { editor } : {}) } });
  return s.launch({ sub: 'au', roles: ['author'] });
}

describe('Ask Kora on the server', () => {
  it('answers 501 when no model is offered, so the app uses its rules', async () => {
    const cookie = await withEditor();
    expect((await s.req(PATH, { method: 'POST', cookie, json: body() })).status).toBe(501);
    const cookie2 = await withEditor({ edit: async () => null });
    expect((await s.req(PATH, { method: 'POST', cookie: cookie2, json: body() })).status).toBe(501);
  });

  it('validates the request and needs the author role', async () => {
    const cookie = await withEditor({ edit: async () => ({ kind: 'reply', reply: 'Hello.', options: [] }) });
    expect((await s.req(PATH, { method: 'POST', cookie, json: { ...body(), instruction: '   ' } })).status).toBe(400);
    expect((await s.req(PATH, { method: 'POST', cookie, json: { ...body(), tab: 'nowhere' } })).status).toBe(400);
    expect((await s.req(PATH, { method: 'POST', cookie, json: { ...body(), view: { context: {}, fields: { 'process.revenue': { nested: true } } } } })).status).toBe(400);
    const participant = await s.launch({ sub: 'p-1' });
    expect((await s.req(PATH, { method: 'POST', cookie: participant, json: body() })).status).toBe(403);
    expect((await s.req(PATH, { method: 'POST', json: body() })).status).toBe(401);
  });

  it('returns a patch on fields it was given, and refuses one off the whitelist or outside the view (502)', async () => {
    let next: unknown = { kind: 'patch', reply: 'A tougher target.', ops: [{ path: 'process.revenue', value: 300000 }] };
    const cookie = await withEditor({ edit: async () => next as never });
    const ok = await s.json(PATH, { method: 'POST', cookie, json: body() });
    expect(AuthorEditResponse.parse(ok)).toEqual(next);
    for (const ops of [[{ path: 'marks.title', value: 'you' }], [{ path: 'events.budget_cut.body', value: 'x' }], [{ path: 'process.weeks', value: 40 }]]) {
      next = { kind: 'patch', reply: '', ops };
      const r = await s.req(PATH, { method: 'POST', cookie, json: body() });
      expect(r.status).toBe(502);
      expect(await r.json()).toMatchObject({ code: 'badModelOutput' });
    }
  });

  it('a model that fails is a 502 the app falls back from', async () => {
    const cookie = await withEditor({ edit: async () => { throw new Error('overloaded'); } });
    const r = await s.req(PATH, { method: 'POST', cookie, json: body() });
    expect(r.status).toBe(502);
    expect(await r.json()).toMatchObject({ code: 'modelFailed' });
  });

  it('runs the ai/ module\'s editor end to end on a scripted model, and its fallback when the answer stays unusable', async () => {
    const good = JSON.stringify({ kind: 'patch', reply: 'Six weeks.', options: [], ops: [{ path: 'process.weeks', text: null, number: 6, list: null }] });
    const bad = JSON.stringify({ kind: 'patch', reply: '', options: [], ops: [{ path: 'title', text: null, number: 6, list: null }] });
    const transport = createFakeTransport([good, bad, bad]);
    const cookie = await withEditor(createAnthropicAuthorEditor({ transport, settings: settingsFor('author'), logger: silentLogger }));
    expect(await s.json(PATH, { method: 'POST', cookie, json: body('Make it six weeks') })).toEqual({ kind: 'patch', reply: 'Six weeks.', ops: [{ path: 'process.weeks', value: 6 }] });
    expect((await s.req(PATH, { method: 'POST', cookie, json: body('Make it six weeks') })).status).toBe(502);
    expect(transport.requests).toHaveLength(3);
  });

  it('is in the OpenAPI document', async () => {
    await withEditor();
    const doc = await s.json<{ paths: Record<string, unknown>; components: { schemas: Record<string, unknown> } }>('/openapi.json');
    expect(doc.paths[PATH]).toBeDefined();
    expect(Object.keys(doc.components.schemas)).toEqual(expect.arrayContaining(['AuthorEditRequest', 'AuthorEditResponse']));
  });
});
