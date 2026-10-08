import { describe, expect, it } from 'vitest';
import { Brief } from '../api/author';
import { askKora } from './editor';
import { emptyChat, seedDraft } from './model/seed';

const draft = () => seedDraft({ ...emptyChat(), brief: Brief.parse({ industry: 'Healthcare', teamSize: 10 }), primary: 'six_styles' }, 'workspace');
const json = (status: number, body: unknown) => async () => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('Ask Kora\'s client: the model with the rules behind it (D127)', () => {
  it('shows the model\'s patch after checking it against the full draft', async () => {
    const d = draft();
    let sent: { instruction: string; tab: string; view: { fields: Record<string, unknown> } } | null = null;
    const fetchImpl = (async (_url: string, init: RequestInit) => {
      sent = JSON.parse(String(init.body));
      return json(200, { kind: 'patch', reply: 'A tougher target.', ops: [{ path: 'process.revenue', value: 300000 }] })();
    }) as unknown as typeof fetch;
    const r = await askKora(d, 'process', 'Make the target tougher', { url: '/genie', fetchImpl });
    expect(sent!.view.fields['process.revenue']).toBe(240000);
    expect(r).toMatchObject({ fallback: null, answer: { kind: 'change', source: 'model', changes: [{ field: 'Revenue target', before: '240,000', after: '300,000' }] } });
  });

  it('falls back to the rules and says why: not offered, failed, refused by the draft, too slow', async () => {
    const d = draft();
    const cases: Array<[typeof fetch, RegExp]> = [
      [json(501, { code: 'notImplemented' }) as unknown as typeof fetch, /not available here, so I used the built-in rules\.$/],
      [json(502, { code: 'badModelOutput' }) as unknown as typeof fetch, /did not answer \(error 502\)/],
      [json(200, { kind: 'patch', reply: '', ops: [{ path: 'marks.title', value: 'you' }] }) as unknown as typeof fetch, /proposed a change the draft does not allow/],
      [json(200, { kind: 'patch', reply: '', ops: [{ path: 'events.budget_cut.body', value: 'x' }] }) as unknown as typeof fetch, /does not allow/]
    ];
    for (const [fetchImpl, why] of cases) {
      const r = await askKora(d, 'process', 'Make it harder', { url: '/genie', fetchImpl });
      expect(r.fallback).toMatch(why);
      expect(r.answer).toMatchObject({ kind: 'change', source: 'rules' });
    }
    const slow = ((_u: string, init: RequestInit) => new Promise((_, reject) => init.signal!.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))))) as unknown as typeof fetch;
    const late = await askKora(d, 'process', 'Make it harder', { url: '/genie', fetchImpl: slow, timeoutMs: 20 });
    expect(late.fallback).toBe('Kora\'s model took longer than 0 seconds, so I used the built-in rules.');
  });

  it('a cancel stops the request and changes nothing', async () => {
    const ctl = new AbortController();
    const slow = ((_u: string, init: RequestInit) => new Promise((_, reject) => init.signal!.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))))) as unknown as typeof fetch;
    const p = askKora(draft(), 'process', 'Make it harder', { url: '/genie', fetchImpl: slow, signal: ctl.signal });
    ctl.abort();
    await expect(p).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('with no server, the rules answer and nothing says they stood in', async () => {
    expect(await askKora(draft(), 'overview', 'Make it harder', { url: '' })).toMatchObject({ fallback: null, answer: { kind: 'change', source: 'rules' } });
  });
});
