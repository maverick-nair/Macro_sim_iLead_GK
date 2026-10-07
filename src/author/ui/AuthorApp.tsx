import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { Brief, type AuthorDraftResponse, type FrameworkDimension, type LeadershipLensModule, type Question, type QuestionId, type Recommendation } from '../../api/author';
import { parseStoryline } from '../../engine/config';
import type { LensId } from '../../engine/lens';
import { useMediaQuery } from '../../lib/useMediaQuery';
import type { AppliedTheme } from '../../theme/types';
import { guardDraft } from '../copyGuard';
import { createDrafters, firstAnswer, MockDrafter, type Drafter } from '../drafter';
import { extractFramework } from '../extract';
import { LENS_BY_ID } from '../lenses';
import { buildModule, dimensionNames, usesClientModel } from '../module';
import { addDocument, applyAnswer, questionFor } from '../questions';
import { ChatBubble } from './ChatBubble';
import { ChipReplies } from './ChipReplies';
import { ClientFrameworkTable } from './ClientFrameworkTable';
import { LensPicker } from './LensPicker';
import { BUTTON, CARD, FOCUS, Section, Tag } from './parts';
import { PreviewPanel } from './PreviewPanel';
import { SummaryPanel } from './SummaryPanel';

/** Where "Play this draft" leaves the storyline; the participant mock reads it (`src/engine/mock.ts`, DRAFT_KEY). */
export const DRAFT_KEY = 'ilead.author.draft';
export const CHANGE_LENS_WARNING = 'Changing your lens will regenerate your team, events and scoring rubric. Do you want to continue?';

type Entry = { kind: 'qa'; id: QuestionId; prompt: string } | { kind: 'note'; text: string };
interface Draft { response: AuthorDraftResponse; source: Drafter['source']; module: LeadershipLensModule; note: string | null }

const FIELD = `w-full rounded-12 border border-solid border-line-control bg-surface-solid px-3.5 py-2.5 text-15 text-fg-primary placeholder:text-fg-secondary ${FOCUS}`;
const FIELD_OF: Record<QuestionId, keyof Brief> = { role_level: 'roleLevel', industry: 'industry', challenge: 'challenge', client: 'client', team_size: 'teamSize', process: 'process', duration: 'duration', language: 'region', framework: 'framework', tone: 'tone' };
const BRIEF_KEYS = ['roleLevel', 'industry', 'challenge', 'client', 'teamSize', 'process', 'region', 'framework'] as const;

function readFile(file: File): Promise<{ name: string; text: string | null }> {
  // The prototype reads text files only; a PDF keeps its name for the server to read.
  if (!/\.(txt|md|markdown)$/i.test(file.name) && !file.type.startsWith('text/')) return Promise.resolve({ name: file.name, text: null });
  return file.text().then(text => ({ name: file.name, text }));
}

function download(name: string, value: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export interface AuthorAppProps {
  theme?: 'dark' | 'light';
  /** The client theme as the theme loader applied it (D72), and the `?client=` value to pass on to "Play this draft". */
  clientTheme?: AppliedTheme | null;
  client?: string | null;
  /** Tests and stories pass their own; the app uses the server when configured, else the templates. */
  drafters?: Drafter[];
}

/**
 * GenieKreator's author chat prototype (`/author`, D70, D74): a short chat of 5 to 10 questions, the
 * Leadership Lens step, the build preview, then confirm and lock, which outputs the lens module and a
 * drafted storyline the participant app can play. For authors, never participants.
 */
export function AuthorApp({ theme = 'dark', clientTheme = null, client = null, drafters: given }: AuthorAppProps) {
  const drafters = useMemo(() => given ?? createDrafters(), [given]);
  // Two panes from 1180 wide; below, one column with the summary as a panel that opens and closes (D102).
  const wide = useMediaQuery('(min-width: 1180px)');
  /** The conversation's own scroll area: it follows the newest message (D102). */
  const scroller = useRef<HTMLDivElement>(null);
  const [brief, setBrief] = useState<Brief>(() => Brief.parse({}));
  const [asked, setAsked] = useState<QuestionId[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [log, setLog] = useState<Entry[]>([]);
  const [current, setCurrent] = useState<{ question: Question; n: number; about: number } | null>(null);
  const [editing, setEditing] = useState<QuestionId | null>(null);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [inferred, setInferred] = useState<string[]>([]);
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [primary, setPrimary] = useState<LensId | null>(null);
  const [secondary, setSecondary] = useState<LensId | null>(null);
  const [dims, setDims] = useState<FrameworkDimension[] | null>(null);
  const [frameworkText, setFrameworkText] = useState('');
  const [frameworkMissing, setFrameworkMissing] = useState(false);
  const [dimsConfirmed, setDimsConfirmed] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [locked, setLocked] = useState(false);
  const [warn, setWarn] = useState(false);
  const input = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const lensHeading = useRef<HTMLHeadingElement>(null);
  const previewHeading = useRef<HTMLHeadingElement>(null);
  const doneHeading = useRef<HTMLHeadingElement>(null);
  const warnRef = useRef<HTMLDivElement>(null);
  const templates = drafters.length === 1 && drafters[0].source === 'templates';

  /** Asks for the next turn: a question, or the lens step. */
  const advance = useCallback(async (b: Brief, a: QuestionId[], ans: Record<string, string>) => {
    setBusy(true);
    try {
      const { value } = await firstAnswer(drafters, d => d.turn({ brief: b, asked: a, answers: ans }));
      setBrief(value.brief);
      if (value.kind === 'question') {
        setCurrent({ question: value.question, n: value.progress.n, about: value.progress.about });
      } else {
        setCurrent(null);
        setRecommendation(value.recommendation);
        setPrimary(p => p ?? value.recommendation.id);
        setDims(d => d ?? value.framework);
        requestAnimationFrame(() => lensHeading.current?.focus());
      }
    } finally {
      setBusy(false);
    }
  }, [drafters]);

  // The conversation scrolls inside its pane: keep the newest message in view as the chat moves on.
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [log.length, current, busy, error]);

  // The first question is asked on mount (from the server or the templates); D78 keeps this finding.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void advance(Brief.parse({}), [], {}); }, [advance]);
  useEffect(() => { if (current && !busy) input.current?.focus(); }, [current, busy, editing]);

  const noteInferred = (before: Brief, after: Brief) => {
    const keys = BRIEF_KEYS.filter(k => before[k] === undefined && after[k] !== undefined);
    if (keys.length) setInferred(i => [...new Set([...i, ...keys])]);
    return keys;
  };

  /** The brief changed after the draft: the preview and lock no longer hold. */
  const invalidate = () => { if (draft) { setDraft(null); setLocked(false); setLog(l => [...l, { kind: 'note', text: 'Your brief changed, so build the preview again.' }]); } };

  async function answer(value: string) {
    const id = editing ?? current?.question.id;
    if (!id || busy) return;
    const r = applyAnswer(brief, id, value);
    if (r.error) { setError(r.error); return; }
    setError(null); setText('');
    noteInferred({ ...brief, [FIELD_OF[id]]: undefined } as Brief, { ...r.brief, [FIELD_OF[id]]: undefined } as Brief);
    const ans = { ...answers, [id]: value.trim() };
    setAnswers(ans);
    if (editing) {
      setEditing(null);
      setBrief(r.brief);
      invalidate();
      if (!current) await advance(r.brief, asked, ans);
      return;
    }
    const a = [...asked, id];
    setAsked(a);
    setLog(l => [...l, { kind: 'qa', id, prompt: current!.question.prompt }]);
    await advance(r.brief, a, ans);
  }

  async function upload(file: File) {
    const doc = await readFile(file);
    let b = addDocument(brief, doc);
    const keys = noteInferred(brief, b);
    const onFramework = current?.question.id === 'framework' && !editing;
    if (onFramework && b.framework === undefined) b = { ...b, framework: doc.text ?? '' };
    const read = keys.filter(k => k !== 'framework').map(k => ({ roleLevel: 'participants', industry: 'industry', challenge: 'challenge', client: 'client', teamSize: 'team size', process: 'work process', region: 'region' } as Record<string, string>)[k]);
    const note = doc.text === null
      ? `I added ${doc.name}. This prototype reads text files only, so paste the text if you want me to use it.`
      : `I read ${doc.name}.${read.length ? ` It covers the ${read.join(', ')}, so I will skip those questions.` : ''}${b.framework && keys.includes('framework') ? ' It includes a leadership framework.' : ''}`;
    setLog(l => [...l, { kind: 'note', text: note }]);
    invalidate();
    if (onFramework) {
      const ans = { ...answers, framework: `Uploaded ${doc.name}` };
      const a = [...asked, 'framework' as const];
      setAnswers(ans); setAsked(a);
      setLog(l => [...l, { kind: 'qa', id: 'framework', prompt: current!.question.prompt }]);
      await advance(b, a, ans);
    } else if (current) await advance(b, asked, answers);
    else setBrief(b);
  }

  const clientNeeded = !!primary && usesClientModel({ primary, secondary });
  // The framework's dimensions are read once, when the client model needs them (state adjusted while rendering).
  if (clientNeeded && dims === null && brief.framework) setDims(extractFramework(brief.framework));
  const clientReady = !clientNeeded || (dimsConfirmed && (dims?.filter(d => d.name.trim()).length ?? 0) >= 2);

  const selection = { primary: primary!, secondary, clientDimensions: (dims ?? []).filter(d => d.name.trim()) };
  const dimensionsNow = primary ? [
    ...dimensionNames(primary, selection.clientDimensions).map(name => ({ name, reportOnly: false })),
    ...(secondary ? dimensionNames(secondary, selection.clientDimensions).map(name => ({ name, reportOnly: true })) : [])
  ] : [];

  async function buildPreview() {
    if (!primary || !clientReady) return;
    setBusy(true);
    try {
      const module = buildModule(brief, selection, false);
      const { value, source } = await firstAnswer(drafters, d => d.draft({ brief, leadership_lens: module }));
      let response = value, from = source, note: string | null = null;
      const parsed = parseStoryline(response.storyline);
      const issues = guardDraft(response.storyline);
      if (!parsed.ok || issues.length) {
        // The server's draft did not pass the schema or the copy guard: draft from the templates instead.
        response = await new MockDrafter().draft({ brief, leadership_lens: module });
        from = 'templates';
        note = `The server draft had ${parsed.ok ? `${issues.length} copy issues` : `${parsed.issues.length} schema issues`}, so this draft was made from templates.`;
      }
      setDraft({ response, source: from, module, note });
      requestAnimationFrame(() => previewHeading.current?.focus());
    } finally {
      setBusy(false);
    }
  }

  function lock() {
    if (!draft) return;
    setDraft({ ...draft, module: { ...draft.module, locked: true } });
    setLocked(true);
    requestAnimationFrame(() => doneHeading.current?.focus());
  }

  function changeLens() { setWarn(true); requestAnimationFrame(() => warnRef.current?.querySelector('button')?.focus()); }
  function confirmChange() { setWarn(false); setDraft(null); setLocked(false); requestAnimationFrame(() => lensHeading.current?.focus()); }

  function play() {
    if (!draft) return;
    const json = JSON.stringify(draft.response.storyline);
    for (const s of [sessionStorage, localStorage]) { try { s.setItem(DRAFT_KEY, json); } catch { /* storage blocked */ } }
    const q = new URLSearchParams({ storyline: 'draft', start: 'onboarding', participant: 'author_draft' });
    if (theme === 'light') q.set('theme', 'light');
    if (client) q.set('client', client);
    window.open(`/?${q}`, '_blank');
  }

  const storyline = draft?.response.storyline as { organisation?: string; members?: Array<{ name: string; title: string }> } | undefined;
  const summary = (
    <SummaryPanel brief={brief} inferred={inferred} company={storyline?.organisation ?? null} team={storyline?.members?.map(m => ({ name: m.name, title: m.title })) ?? null}
      lens={{ primary: primary && recommendation ? LENS_BY_ID[primary].title : null, secondary: secondary ? LENS_BY_ID[secondary].title : null }} dimensions={draft?.response.preview.dimensions ?? (recommendation ? dimensionsNow : [])} />
  );
  const q = editing ? null : current;
  const editingPrompt = editing ? log.find((e): e is Extract<Entry, { kind: 'qa' }> => e.kind === 'qa' && e.id === editing)?.prompt : null;
  const askId = editing ?? q?.question.id;
  const style: CSSProperties = { colorScheme: theme, background: theme === 'dark' ? 'var(--il-backdrop-office)' : 'var(--il-backdrop-daylight)', ...clientTheme?.vars };

  /** The lens step, the build preview and the locked draft: they scroll with the conversation (D102). */
  const stepsAfterQuestions = (
    <>
          {recommendation && (
            <Section id="lens-step" title="Choose your leadership lens" eyebrow="Leadership lens" headingRef={lensHeading}>
              <LensPicker primary={primary} secondary={secondary} recommendation={recommendation} disabled={!!draft}
                onPrimary={id => { setPrimary(id); if (secondary === id) setSecondary(null); }} onSecondary={setSecondary} />
              {clientNeeded && (
                <div className="flex flex-col gap-3 border-t border-solid border-line-default pt-4">
                  <h3 className="m-0 text-16 font-700">Client Leadership Model</h3>
                  {dims && dims.length > 0 ? (
                    <>
                      <p className="m-0 text-14 text-fg-secondary">I read these dimensions from your framework. Confirm them or edit them. I map each to team behavior, an event type and a scoring dimension.</p>
                      <ClientFrameworkTable dimensions={dims} disabled={!!draft} confirmed={dimsConfirmed} onChange={d => { setDims(d); setDimsConfirmed(false); }} onConfirm={() => setDimsConfirmed(true)} />
                    </>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <p className="m-0 text-14" role={frameworkMissing ? 'alert' : undefined}>{frameworkMissing
                        ? 'I could not find dimensions in that text. Paste the framework with a heading for each dimension and its behaviors as a bullet list.'
                        : 'Paste your leadership framework so I can map it. Use a heading for each dimension and its behaviors as a bullet list.'}</p>
                      <label className="flex flex-col gap-1.5">
                        <span className="text-13 font-600 text-fg-secondary">Framework text</span>
                        <textarea rows={6} className={FIELD} value={frameworkText} onChange={e => setFrameworkText(e.target.value)} />
                      </label>
                      <div><button type="button" className={BUTTON.secondary} onClick={() => { const d = extractFramework(frameworkText); setFrameworkMissing(!d.length); if (d.length) { setDims(d); setBrief(b => ({ ...b, framework: frameworkText })); } }}>Read framework</button></div>
                    </div>
                  )}
                </div>
              )}
              <div className="flex flex-wrap items-center gap-3">
                {!draft
                  ? <button type="button" className={BUTTON.primary} disabled={!primary || !clientReady || busy || !!current} onClick={() => void buildPreview()}>Confirm lens and preview the build</button>
                  : <button type="button" className={BUTTON.secondary} onClick={changeLens}>Change lens</button>}
                {current && <span className="text-13 text-fg-secondary">Finish the questions first.</span>}
              </div>
              {warn && (
                <div ref={warnRef} role="alertdialog" aria-modal="false" aria-labelledby="author-warn" className={`${CARD} flex flex-col gap-3 border-status-attention p-4`}>
                  <p id="author-warn" className="m-0 text-15 font-600">{CHANGE_LENS_WARNING}</p>
                  <div className="flex gap-3">
                    <button type="button" className={BUTTON.primary} onClick={confirmChange}>Continue</button>
                    <button type="button" className={BUTTON.secondary} onClick={() => setWarn(false)}>Cancel</button>
                  </div>
                </div>
              )}
            </Section>
          )}

          {draft && (
            <Section id="preview-step" title="Build preview" eyebrow="Before you lock" headingRef={previewHeading}>
              {draft.note && <p role="note" className="m-0 text-14 text-fg-secondary">{draft.note}</p>}
              {draft.source === 'templates' && <p className="m-0"><Tag tone="muted">Draft made from templates</Tag></p>}
              <PreviewPanel preview={draft.response.preview} lensTitle={LENS_BY_ID[draft.module.primary.id].title} secondaryTitle={draft.module.secondary?.title ?? null} />
              {!locked && <div><button type="button" className={BUTTON.primary} onClick={lock}>Confirm and lock</button></div>}
            </Section>
          )}

          {draft && locked && (
            <Section id="done-step" title="Your draft is ready" eyebrow="Locked" headingRef={doneHeading}>
              <p className="m-0 text-15 text-pretty">The lens is locked and the storyline is drafted: company, sponsor, welcome letter, team, styles, scoring and events. Play it as a participant, or download the config to edit in the workspace.</p>
              <div className="flex flex-wrap gap-3">
                <button type="button" className={BUTTON.primary} onClick={play}>Play this draft</button>
                <button type="button" className={BUTTON.secondary} onClick={() => download(`${String(draft.response.storyline.id ?? 'draft')}.json`, draft.response.storyline)}>Download config</button>
                <button type="button" className={BUTTON.secondary} onClick={() => download('leadership-lens.json', { leadership_lens: draft.module })}>Download lens module</button>
              </div>
              <details className="rounded-14 border border-solid border-line-default p-3">
                <summary className={`cursor-pointer font-700 ${FOCUS}`}>Lens module output</summary>
                <pre role="region" aria-label="Lens module JSON" tabIndex={0} className={`m-0 mt-3 max-h-96 overflow-auto text-12 whitespace-pre-wrap ${FOCUS}`}>{JSON.stringify({ leadership_lens: draft.module }, null, 2)}</pre>
              </details>
            </Section>
          )}
    </>
  );

  return (
    // The page fits the window (D102): the header stays, each pane scrolls on its own, and the composer is always in view.
    <div className="il-theme flex h-dvh flex-col overflow-hidden font-sans text-14 leading-(--il-app-leading) text-fg-primary" style={style}>
      <header className="flex flex-none flex-wrap items-center gap-4 border-b border-solid border-line-default px-6 py-4 max-[900px]:py-3">
        <span className="bg-(image:--il-fill-brand) bg-clip-text text-22 font-700 text-transparent">GenieKreator</span>
        <span className="text-14 text-fg-secondary">iLead Business Simulation, author chat</span>
        <span className="flex-1" />
        {templates && <Tag tone="muted">Draft made from templates</Tag>}
      </header>
      <div className={`mx-auto grid min-h-0 w-full max-w-screen-2xl flex-1 grid-rows-[minmax(0,1fr)] gap-6 p-6 max-[900px]:gap-4 max-[900px]:p-4 ${wide ? 'grid-cols-[minmax(0,1fr)_minmax(0,26rem)]' : 'grid-cols-1'}`}>
        <main className="flex min-h-0 min-w-0 flex-col gap-4">
          <h1 className="m-0 flex-none text-28 font-700 max-[900px]:text-24">What do you want to build?</h1>
          {!wide && (
            <details className={`${CARD} flex-none p-4`}>
              <summary className={`cursor-pointer text-16 font-700 ${FOCUS}`}>Your simulation so far</summary>
              {/* Open, it keeps a share of the height and scrolls, so the conversation and composer stay in view. */}
              <div role="region" aria-label="Your simulation so far" tabIndex={0} className={`relative mt-4 max-h-[40dvh] overflow-y-auto ${FOCUS}`}>{summary}</div>
            </details>
          )}
          {/* The conversation and each step scroll here; the composer below stays put. */}
          <div ref={scroller} role="region" aria-label="Conversation and steps" tabIndex={-1} className="relative flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto overscroll-contain pe-1">
          <div role="log" aria-label="Conversation" aria-live="polite" tabIndex={0} className={`${CARD} flex flex-none flex-col gap-4 p-5 ${FOCUS}`}>
            <ChatBubble from="assistant">Let us draft your iLead simulation. I will ask a few short questions and skip anything your answers or uploads already cover. You can upload a brief or framework at any time.</ChatBubble>
            {log.map((e, i) => e.kind === 'note'
              ? <ChatBubble key={i} from="assistant">{e.text}</ChatBubble>
              : (
                <div key={i} className="flex flex-col gap-3">
                  <ChatBubble from="assistant">{e.prompt}</ChatBubble>
                  <ChatBubble from="author" question={e.prompt} editing={editing === e.id} onEdit={() => { setEditing(e.id); setText(answers[e.id] ?? ''); setError(null); }}>{answers[e.id]}</ChatBubble>
                </div>
              ))}
            {q && (
              <ChatBubble from="assistant">
                {q.question.prompt}
                {q.question.confirm && `\nFrom what you shared: ${q.question.confirm}. Is that right?`}
                {q.question.help && <span className="mt-1 block text-13 text-fg-secondary">{q.question.help}</span>}
              </ChatBubble>
            )}
            {busy && <p className="m-0 text-13 text-fg-secondary">Thinking.</p>}
          </div>

          {/* The steps after the questions, in the same scroll area. */}
          {stepsAfterQuestions}
          </div>

          {askId && (
            <form className={`${CARD} flex flex-none flex-col gap-3 p-5 max-[900px]:p-4`} onSubmit={(e: FormEvent) => { e.preventDefault(); void answer(text); }}>
              <div className="flex flex-wrap items-center gap-3">
                {q && <span className="text-13 font-700 text-accent-secondary">Question {q.n} of about {q.about}</span>}
                {editing && <span className="text-13 font-700 text-accent-secondary">Editing your answer to: {editingPrompt}</span>}
                {editing && <button type="button" className={BUTTON.link} onClick={() => { setEditing(null); setText(''); setError(null); }}>Cancel edit</button>}
              </div>
              <ChipReplies chips={q?.question.chips ?? (editing ? questionFor(editing, brief).chips : [])} disabled={busy}
                onPick={v => void answer(v)} />
              <label className="flex flex-col gap-1.5">
                <span className="text-13 font-600 text-fg-secondary">{editing ? 'Your new answer' : q?.question.confirm ? 'Your answer, or pick a suggestion' : 'Your answer'}</span>
                {askId === 'framework'
                  ? <textarea ref={input} rows={4} className={FIELD} value={text} placeholder="Paste the framework text" onChange={e => setText(e.target.value)} aria-invalid={!!error} aria-describedby={error ? 'author-error' : undefined} />
                  : <input ref={input} className={FIELD} value={text} placeholder={q?.question.placeholder ?? ''} onChange={e => setText(e.target.value)} aria-invalid={!!error} aria-describedby={error ? 'author-error' : undefined} />}
              </label>
              {error && <p id="author-error" role="alert" className="m-0 text-14 font-600 text-status-decline">{error}</p>}
              <div className="flex flex-wrap items-center gap-3">
                <button type="submit" className={BUTTON.primary} disabled={busy}>Send</button>
                <label className={`${BUTTON.secondary} focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent-secondary`}>
                  Upload a file
                  <input type="file" accept=".txt,.md,.pdf,text/plain,text/markdown,application/pdf" className="sr-only" onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void upload(f); }} />
                </label>
                <span className="text-12 text-fg-secondary">.txt, .md or .pdf. The prototype reads text files only.</span>
              </div>
            </form>
          )}

        </main>
        {wide && (
          <aside aria-labelledby="author-summary" className={`${CARD} flex min-h-0 flex-col gap-4 p-5`}>
            <h2 id="author-summary" className="m-0 flex-none text-20 font-700">Your simulation so far</h2>
            {/* The summary scrolls in its own pane, focusable so the keyboard can scroll it (D102). */}
            <div role="region" aria-labelledby="author-summary" tabIndex={0} className={`relative -m-1 min-h-0 flex-1 overflow-y-auto overscroll-contain p-1 ${FOCUS}`}>{summary}</div>
          </aside>
        )}
      </div>
    </div>
  );
}
