import { describe, expect, it, vi } from 'vitest';
import { Brief } from '../../../src/api/author';
import type { AuthorEditRequest } from '../../../src/api/authorEdit';
import { editView } from '../../../src/author/model/patch';
import { emptyChat, seedDraft } from '../../../src/author/model/seed';
import { settingsFor, silentLogger } from '../config';
import { createFakeTransport, type FakeReply } from '../llm/fake';
import { StructuredOutputError } from '../llm/transport';
import { createAnthropicAuthorEditor, createMockAuthorEditor, type EditCall } from './editor';

const d = seedDraft({ ...emptyChat(), brief: Brief.parse({ industry: 'Healthcare', teamSize: 10 }), primary: 'six_styles' }, 'workspace');
const req = (instruction: string): AuthorEditRequest => ({ instruction, tab: 'process', view: editView(d, 'process') });
const call = (c: Partial<EditCall>): string => JSON.stringify({ kind: 'patch', reply: 'Done.', options: [], ops: [], ...c });

function editor(script: FakeReply[]) {
  const transport = createFakeTransport(script);
  const logger = { ...silentLogger, warn: vi.fn(), error: vi.fn() };
  return { e: createAnthropicAuthorEditor({ transport, settings: settingsFor('author'), logger }), transport, logger };
}

describe('Ask Kora on the server (D127)', () => {
  it('turns the model\'s ops into a checked patch, with the copy rules applied and the instruction quoted', async () => {
    const { e, transport } = editor([call({ reply: 'A tougher target \u2014 and faster pacing.', ops: [{ path: 'process.revenue', text: null, number: 300000, list: null }, { path: 'process.pacing', text: 'demanding', number: null, list: null }] })]);
    const r = await e.edit(req('Make it <b>harder</b>'));
    expect(r).toEqual({ kind: 'patch', reply: 'A tougher target, and faster pacing.', ops: [{ path: 'process.revenue', value: 300000 }, { path: 'process.pacing', value: 'demanding' }] });
    const msg = transport.requests[0].messages[0].content as string;
    expect(msg).toMatch(/<instruction>\nMake it ‹b›harder‹\/b›\n<\/instruction>/);
    expect(msg).toContain('"process.revenue": 240000');
    expect(transport.requests[0].system[0].text).toMatch(/^# Task: change the author's draft/);
  });

  it('repairs a patch outside the fields it was shown, the whitelist or the schema, then gives up', async () => {
    const bad = call({ ops: [{ path: 'events.budget_cut.body', text: 'x', number: null, list: null }] });
    const ok = call({ ops: [{ path: 'process.weeks', text: null, number: 6, list: null }] });
    const once = editor([bad, ok]);
    expect(await once.e.edit(req('Six weeks'))).toMatchObject({ kind: 'patch', ops: [{ path: 'process.weeks', value: 6 }] });
    expect(once.transport.requests[1].messages.at(-1)!.content).toMatch(/events\.budget_cut\.body: not one of the fields given/);
    const worse = editor([call({ ops: [{ path: 'process.weeks', text: null, number: 40, list: null }] }), call({ ops: [{ path: 'marks.title', text: 'you', number: null, list: null }] })]);
    await expect(worse.e.edit(req('Forty weeks'))).rejects.toBeInstanceOf(StructuredOutputError);
  });

  it('passes a reply through, and the mock offers nothing so the app\'s rules answer', async () => {
    const { e } = editor([JSON.stringify({ kind: 'reply', reply: 'Harder or easier?', options: ['Make it harder', 'Make it easier'], ops: [] })]);
    expect(await e.edit(req('Make it harder and easier'))).toEqual({ kind: 'reply', reply: 'Harder or easier?', options: ['Make it harder', 'Make it easier'] });
    expect(await createMockAuthorEditor().edit(req('Make it harder'))).toBeNull();
  });
});
