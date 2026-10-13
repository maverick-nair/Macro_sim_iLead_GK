import { z } from 'zod';
import { AuthorEditRequest, AuthorEditResponse, type AuthorEditOp } from '../../../src/api/authorEdit';
import { checkViewOps } from '../../../src/author/model/patch';
import { sanitizeCopy } from '../../../src/i18n/copy';
import { silentLogger, type ModelSettings } from '../config';
import { js, structuredCall, type LlmTransport } from '../llm/transport';
import { loadPrompt, quoteInput } from '../prompts';
import type { AiLogger, AuthorEditor, CallOptions } from '../types';

/**
 * Ask Kora on the server (D127): the model reads the author's instruction and the fields Kora may change
 * on that tab, and answers with set operations on those paths, or a reply. Its answer is checked before
 * it leaves: every path must be one it was shown and on the whitelist, every value must parse with the
 * draft schema's field (`checkViewOps`), and text goes through the copy rules. A failing answer is
 * repaired once; when it still fails the call throws and the app reads the instruction with its rules.
 * The mock offers nothing (null), so the app's rules answer.
 */

/** What the model answers. One of text, number or list carries each value. */
export const EditCall = z.object({
  kind: z.enum(['patch', 'reply']),
  reply: z.string(),
  options: z.array(z.string()),
  ops: z.array(z.object({ path: z.string(), text: z.string().nullable(), number: z.number().nullable(), list: z.array(z.string()).nullable() }))
});
export type EditCall = z.infer<typeof EditCall>;

export const editCallJsonSchema = js.obj({
  kind: js.enum(['patch', 'reply']),
  reply: js.str('One or two plain sentences for the author'),
  options: js.arr(js.str(), 'For a reply that asks the author to choose: up to 3 short instructions to offer, else empty'),
  ops: js.arr(js.obj({ path: js.str('A path from <fields>, exactly'), text: js.nullable(js.str()), number: js.nullable(js.num()), list: js.nullable(js.arr(js.str())) }), 'Empty for a reply')
});

const clean = (v: AuthorEditOp['value']): AuthorEditOp['value'] => (typeof v === 'string' ? sanitizeCopy(v) : Array.isArray(v) ? v.map(sanitizeCopy) : v);

/** The model's answer as the route's response, with the issues that make it unusable. */
export function toResponse(req: AuthorEditRequest, c: EditCall): { response: AuthorEditResponse | null; issues: string[] } {
  if (c.kind === 'reply') {
    const r = AuthorEditResponse.safeParse({ kind: 'reply', reply: sanitizeCopy(c.reply), options: c.options.slice(0, 3).map(sanitizeCopy) });
    return r.success ? { response: r.data, issues: [] } : { response: null, issues: r.error.issues.map(i => `${i.path.join('.')}: ${i.message}`) };
  }
  const issues: string[] = [];
  const ops: AuthorEditOp[] = [];
  for (const o of c.ops) {
    const given = [o.text, o.number, o.list].filter(v => v !== null);
    if (given.length !== 1) { issues.push(`${o.path}: give exactly one of text, number or list`); continue; }
    ops.push({ path: o.path, value: clean(given[0] as AuthorEditOp['value']) });
  }
  issues.push(...checkViewOps(req.view, ops));
  const r = AuthorEditResponse.safeParse({ kind: 'patch', reply: sanitizeCopy(c.reply), ops });
  if (!r.success) issues.push(...r.error.issues.map(i => `${i.path.join('.')}: ${i.message}`));
  return issues.length ? { response: null, issues } : { response: r.data!, issues: [] };
}

/** The user message: everything the author wrote is quoted, so it reads as material, not instructions. */
export function editMessage(req: AuthorEditRequest): string {
  return [
    `<tab>${req.tab}</tab>`,
    `<context>\n${quoteInput(JSON.stringify(req.view.context, null, 1))}\n</context>`,
    `<fields>\n${quoteInput(JSON.stringify(req.view.fields, null, 1))}\n</fields>`,
    `<instruction>\n${quoteInput(req.instruction)}\n</instruction>`
  ].join('\n');
}

export function createMockAuthorEditor(): AuthorEditor {
  return { provider: 'mock', source: 'rules', edit: async () => null };
}

export interface AnthropicEditorOptions {
  transport: LlmTransport;
  settings: ModelSettings;
  logger?: AiLogger;
  repairRetries?: number;
}

export function createAnthropicAuthorEditor(o: AnthropicEditorOptions): AuthorEditor {
  const log = o.logger ?? silentLogger;
  return {
    provider: 'anthropic',
    source: 'server',
    async edit(input, opts?: CallOptions) {
      const req = AuthorEditRequest.parse(input);
      let response: AuthorEditResponse | null = null;
      await structuredCall(o.transport, {
        label: 'author edit', settings: o.settings, system: [{ text: loadPrompt('author-edit').text, cache: true }], jsonSchema: editCallJsonSchema,
        messages: [{ role: 'user', content: editMessage(req) }]
      }, EditCall, {
        repairs: o.repairRetries ?? 1, repairPrompt: loadPrompt('repair').text, signal: opts?.signal, logger: log,
        check: c => { const r = toResponse(req, c); response = r.response; return r.issues; }
      });
      return response;
    }
  };
}
