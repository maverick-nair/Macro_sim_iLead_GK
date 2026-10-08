import { AuthorDraftResponse, Brief, type AuthorDraftRequest, type AuthorTurnRequest, type AuthorTurnResponse, type Clarify, type FrameworkDimension } from '../../../src/api/author';
import { guardDraft } from '../../../src/author/copyGuard';
import { MockDrafter } from '../../../src/author/drafter';
import { covered, planQuestions, questionFor } from '../../../src/author/questions';
import { frameworkOf, makeDilemma } from '../../../src/author/read';
import { recommendLens } from '../../../src/author/recommend';
import { previewOf } from '../../../src/author/storyline';
import { StorylineConfig, type StorylineInput } from '../../../src/engine/config';
import { sanitizeCopy } from '../../../src/i18n/copy';
import { silentLogger, type ModelSettings } from '../config';
import { isAbort, structuredCall, type LlmTransport } from '../llm/transport';
import { loadPrompt, quoteInput } from '../prompts';
import type { AiLogger, AuthorDrafter, CallOptions } from '../types';
import { BriefReading, briefReadingJsonSchema, DraftCopy, draftCopyJsonSchema, FrameworkReading, frameworkReadingJsonSchema } from './schema';

/**
 * The author drafter on the server. The model does the reading and the writing; rules keep the parts
 * that must not drift: the question policy and order (src/author/questions.ts), the lens recommendation's
 * precedence (src/author/recommend.ts), and the calibrated mechanics of the template draft. Every draft
 * passes the storyline schema and the copy guard, or the templates draft is returned instead.
 */

const mock = new MockDrafter();

export function createMockAuthorDrafter(): AuthorDrafter {
  return { provider: 'mock', source: 'templates', turn: req => mock.turn(req), draft: req => mock.draft(req) };
}

const norm = (s: string) => s.toLowerCase().replace(/[*_`#>]/g, ' ').replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/\s+/g, ' ').trim();

/** Keeps only dimensions, behaviours and levels that appear in the framework text: nothing invented. */
export function groundFramework(text: string, dims: FrameworkDimension[]): { kept: FrameworkDimension[]; dropped: string[] } {
  const src = norm(text);
  const found = (s: string) => s.trim().length > 1 && src.includes(norm(s));
  const dropped: string[] = [];
  const kept: FrameworkDimension[] = [];
  for (const d of dims) {
    if (!found(d.name)) { dropped.push(d.name); continue; }
    const behaviours = d.behaviours.filter(b => found(b) || (dropped.push(b), false));
    const levels = d.levels.filter(l => found(l) || (dropped.push(l), false));
    if (behaviours.length) kept.push({ name: d.name.trim(), behaviours: behaviours.map(b => b.trim()), levels: levels.map(l => l.trim()) });
    else dropped.push(d.name);
  }
  return { kept, dropped };
}

/** Everything the author wrote: a name the model reads must be in it, never invented (D146). */
const sourceOf = (brief: Brief, req: AuthorTurnRequest) => norm([...Object.values(req.answers), ...brief.documents.map(d => d.text ?? '')].join('\n'));

/** Fills brief fields the model read, never overwriting what the brief has. A client or a person not in the text is dropped. */
export function mergeReading(brief: Brief, r: BriefReading, req: AuthorTurnRequest): Brief {
  const next: Brief = { ...brief, documents: [...brief.documents] };
  const text = (v: string | null) => (v && v.trim() ? v.trim().slice(0, 200) : undefined);
  const src = sourceOf(brief, req);
  const inText = (v: string) => src.includes(norm(v));
  if (!next.roleLevel) next.roleLevel = text(r.roleLevel);
  if (!next.industry) next.industry = text(r.industry);
  if (!next.challenge) next.challenge = text(r.challenge);
  if (next.client === undefined) {
    if (r.client.kind === 'fictional') next.client = null;
    else if (r.client.kind === 'named' && text(r.client.name) && inText(r.client.name!)) next.client = text(r.client.name)!.slice(0, 60);
  }
  if (next.teamSize === undefined && r.teamSize !== null && r.teamSize >= 6 && r.teamSize <= 12) next.teamSize = r.teamSize;
  if (!next.process && r.process) { const s = r.process.map(x => x.trim()).filter(Boolean); if (s.length >= 3 && s.length <= 6) next.process = s; }
  if (!next.duration && r.duration) next.duration = r.duration;
  if (!next.region && r.region) { next.region = r.region; next.language = text(r.language) ?? next.language; }
  if (!next.language && r.language) next.language = text(r.language);
  if (!next.tone && r.tone) next.tone = r.tone;
  if (!next.stakeholders?.length && r.stakeholders?.length) {
    const people = r.stakeholders.filter(p => (p.name.trim() ? inText(p.name) : p.role.trim())).map(p => ({ name: p.name.trim().slice(0, 120), role: p.role.trim().slice(0, 200), relation: p.relation.trim().slice(0, 120) || 'stakeholder' }));
    if (people.length) next.stakeholders = people.slice(0, 20);
  }
  if (!next.objectives?.length && r.objectives?.length) { const o = r.objectives.map(x => x.trim().slice(0, 400)).filter(Boolean); if (o.length) next.objectives = o.slice(0, 12); }
  if (!next.dilemmas?.length && r.dilemmas?.length) {
    const ds = r.dilemmas.map(x => makeDilemma(x.a, x.b, x.stake ?? '')).filter((x): x is NonNullable<typeof x> => x !== null);
    if (ds.length) next.dilemmas = ds.slice(0, 12);
  }
  if (next.framework === undefined && r.frameworkDocument) {
    const doc = r.frameworkDocument === 'answers' ? req.answers.framework : next.documents.find(d => d.name === r.frameworkDocument)?.text;
    if (doc && doc.trim()) next.framework = doc;
  }
  // Drop keys left undefined so the brief stays minimal.
  for (const k of Object.keys(next) as Array<keyof Brief>) if (next[k] === undefined) delete next[k];
  return Brief.parse(next);
}

/** The model's clarifying question, kept only for a field the brief does not have and with 2 to 8 choices. */
export function clarifyOf(r: BriefReading, brief: Brief): Clarify | null {
  const c = r.clarify;
  if (!c || covered(brief, c.question)) return null;
  const choices = [...new Set(c.choices.map(x => sanitizeCopy(x.trim()).slice(0, 120)).filter(Boolean))].slice(0, 8);
  const prompt = sanitizeCopy(c.prompt.trim()).slice(0, 400);
  if (choices.length < 2 || !prompt) return null;
  return { id: c.question, prompt, choices: choices.map(x => ({ label: x, value: x })) };
}

function readingMessage(brief: Brief, req: AuthorTurnRequest): string {
  const known = { ...brief, documents: undefined, framework: brief.framework === undefined ? undefined : brief.framework === null ? 'none' : '(shared)' };
  const docs = brief.documents.map(d => `<document name="${quoteInput(d.name)}">\n${d.text === null ? '(not readable as text)' : quoteInput(d.text)}\n</document>`).join('\n');
  const answers = Object.entries(req.answers).map(([k, v]) => `<answer question="${k}">${quoteInput(v)}</answer>`).join('\n');
  return `<brief_so_far>\n${JSON.stringify(known, null, 2)}\n</brief_so_far>\n<answers>\n${answers || '(none)'}\n</answers>\n<documents>\n${docs || '(none)'}\n</documents>`;
}

type Member = StorylineInput['members'][number];

/** The template's copy, as the model sees it. */
function templateView(s: StorylineInput, req: AuthorDraftRequest) {
  return {
    brief: { ...req.brief, documents: undefined },
    lens: { primary: req.leadership_lens.primary.title, secondary: req.leadership_lens.secondary?.title ?? null, scoring: req.leadership_lens.primary.scoring_dimensions, clientDimensions: req.leadership_lens.client_model.confirmed_dimensions },
    template: {
      name: s.name, organisation: s.organisation, sponsor: s.sponsor, intro: s.intro,
      styles: (s.lens?.styles ?? []).map(st => ({ key: st.key, name: st.name, short: st.short, description: st.description })),
      stages: s.stages.map(st => ({ key: st.key, name: st.name })),
      members: s.members.map((m: Member) => ({ id: m.id, pronoun: m.pronoun, stage: m.homeStage, name: m.name, title: m.title, remarks: m.profile.remarks, hiddenConcern: m.hiddenConcern ?? null, concernLine: m.concernLine ?? null })),
      events: (s.events ?? []).map(e => ({ key: e.key, title: e.title, he: e.body.he, she: e.body.she, card: e.card }))
    }
  };
}

const clean = (v: string) => sanitizeCopy(v);

/** The template with the model's copy laid over it, by id and key. Copy is passed through the copy rules. */
export function mergeCopy(template: StorylineInput, c: DraftCopy): StorylineInput {
  const s: StorylineInput = structuredClone(template);
  s.name = clean(c.name);
  s.organisation = clean(c.organisation);
  s.sponsor = { ...s.sponsor, name: clean(c.sponsor.name), title: clean(c.sponsor.title), styleLine: clean(c.sponsor.styleLine) };
  s.intro = { welcome: c.intro.welcome.map(clean), product: c.intro.product.map(clean), targets: c.intro.targets.map(clean) };
  if (s.lens) {
    const letters = new Set<string>();
    s.lens.styles = s.lens.styles.map(st => {
      const n = c.styles.find(x => x.key === st.key);
      if (!n) { letters.add(st.letter.toUpperCase()); return st; }
      const name = clean(n.name);
      const first = name.charAt(0).toUpperCase();
      const letter = first && /\p{L}/u.test(first) && !letters.has(first) ? first : st.letter;
      letters.add(letter.toUpperCase());
      return { ...st, name, short: clean(n.short), description: clean(n.description), letter };
    });
  }
  s.members = s.members.map((m: Member) => {
    const n = c.members.find(x => x.id === m.id);
    if (!n) return m;
    const out: Member = { ...m, name: clean(n.name), title: clean(n.title), profile: { ...m.profile, remarks: clean(n.remarks) } };
    if (m.hiddenConcern && n.hiddenConcern && n.concernLine) {
      out.hiddenConcern = clean(n.hiddenConcern);
      out.concernLine = clean(n.concernLine);
      if (n.careerGoal) out.careerGoal = clean(n.careerGoal);
    }
    return out;
  });
  s.events = (s.events ?? []).map(e => {
    const n = c.events.find(x => x.key === e.key);
    if (!n) return e;
    return { ...e, title: clean(n.title), body: { he: clean(n.he), she: clean(n.she), ...(n.they ? { they: clean(n.they) } : {}) } };
  });
  return s;
}

/** Why a merged draft cannot be used: schema issues, copy guard issues, repeated names. */
export function draftIssues(s: StorylineInput, sample?: { title: string; body: string }): string[] {
  const issues: string[] = [];
  const parsed = StorylineConfig.safeParse(s);
  if (!parsed.success) issues.push(...parsed.error.issues.map(i => `storyline.${i.path.join('.')}: ${i.message}`));
  for (const i of guardDraft(s)) issues.push(`${i.path}: breaks the copy rule ${i.rule} ("${i.text.slice(0, 80)}")`);
  if (sample) for (const i of guardDraft(sample, ['sampleEvent'])) issues.push(`${i.path}: breaks the copy rule ${i.rule}`);
  const names = s.members.map(m => m.name.toLowerCase());
  if (new Set(names).size !== names.length) issues.push('members: every member needs a different name');
  return issues;
}

export interface AnthropicAuthorOptions {
  transport: LlmTransport;
  settings: ModelSettings;
  logger?: AiLogger;
  repairRetries?: number;
}

export function createAnthropicAuthorDrafter(o: AnthropicAuthorOptions): AuthorDrafter {
  const log = o.logger ?? silentLogger;
  const repairs = o.repairRetries ?? 1;
  const system = (task: string) => [{ text: loadPrompt('lens').text }, { text: loadPrompt(task).text, cache: true }];

  async function readFramework(text: string, signal?: AbortSignal): Promise<FrameworkDimension[]> {
    try {
      const out = await structuredCall(o.transport, {
        label: 'author framework', settings: o.settings, system: system('author-framework'), jsonSchema: frameworkReadingJsonSchema,
        messages: [{ role: 'user', content: `<framework>\n${quoteInput(text)}\n</framework>` }]
      }, FrameworkReading, { repairs, repairPrompt: loadPrompt('repair').text, signal, logger: log });
      const g = groundFramework(text, out.value.dimensions);
      if (g.dropped.length) log.warn('author: framework items not found in the text were dropped', { dropped: g.dropped.slice(0, 10) });
      return g.kept.length ? g.kept : frameworkOf(text);
    } catch (e) {
      if (isAbort(e, signal)) throw e;
      log.error('author: framework reading failed; the rules read it', { error: String(e) });
      return frameworkOf(text);
    }
  }

  async function turn(req: AuthorTurnRequest, opts?: CallOptions): Promise<AuthorTurnResponse> {
    let brief = Brief.parse(req.brief);
    const hasText = Object.values(req.answers).some(v => v.trim()) || brief.documents.some(d => d.text);
    if (hasText) {
      try {
        const out = await structuredCall(o.transport, {
          label: 'author turn', settings: o.settings, system: system('author-turn'), jsonSchema: briefReadingJsonSchema,
          messages: [{ role: 'user', content: readingMessage(brief, req) }]
        }, BriefReading, { repairs, repairPrompt: loadPrompt('repair').text, signal: opts?.signal, logger: log });
        brief = mergeReading(brief, out.value, req);
        // One short question when the model reads the text as ambiguous about a field still open (D147).
        const ask = clarifyOf(out.value, brief);
        if (ask) return { kind: 'clarify', brief, clarify: ask };
      } catch (e) {
        if (isAbort(e, opts?.signal)) throw e;
        log.error('author: reading failed; the templates answer this turn', { error: String(e) });
        return mock.turn(req);
      }
    }
    const plan = planQuestions(brief, req.asked, req.taken ?? []);
    if (plan.next) return { kind: 'question', brief, question: { ...questionFor(plan.next, brief), ...(plan.confirm ? { confirm: plan.confirm } : null) }, progress: { n: plan.n, about: plan.about } };
    return { kind: 'lens', brief, recommendation: recommendLens(brief), framework: brief.framework ? await readFramework(brief.framework, opts?.signal) : null };
  }

  async function draft(req: AuthorDraftRequest, opts?: CallOptions): Promise<AuthorDraftResponse> {
    const template = await mock.draft(req);
    const base = template.storyline as unknown as StorylineInput;
    const view = templateView(base, req);
    let merged: StorylineInput | null = null;
    try {
      const out = await structuredCall(o.transport, {
        label: 'author draft', settings: o.settings, system: system('author-draft'),
        jsonSchema: draftCopyJsonSchema({ members: base.members.map(m => m.id), styles: (base.lens?.styles ?? []).map(s => s.key), events: (base.events ?? []).map(e => e.key) }),
        messages: [{ role: 'user', content: `<draft_input>\n${quoteInput(JSON.stringify(view, null, 2))}\n</draft_input>` }]
      }, DraftCopy, {
        repairs, repairPrompt: loadPrompt('repair').text, signal: opts?.signal, logger: log,
        check: copy => { merged = mergeCopy(base, copy); return draftIssues(merged, copy.sampleEvent); }
      });
      const storyline = merged ?? mergeCopy(base, out.value);
      const preview = { ...previewOf(storyline), sampleEvent: { title: clean(out.value.sampleEvent.title), body: clean(out.value.sampleEvent.body) } };
      return AuthorDraftResponse.parse({ storyline, preview });
    } catch (e) {
      if (isAbort(e, opts?.signal)) throw e;
      log.error('author: the drafted copy failed the schema or the copy guard; using the templates draft', { error: String(e) });
      return template;
    }
  }

  return { provider: 'anthropic', source: 'server', turn, draft };
}
