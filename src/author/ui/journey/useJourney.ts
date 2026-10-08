import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Brief, type QuestionId } from '../../../api/author';
import type { LensId } from '../../../engine/lens';
import { DEFAULT_PROCESS } from '../../context';
import { createDrafters, failureText, firstAnswer, MockDrafter, type Drafter } from '../../drafter';
import { fitAccepted, fitCheck, fitMessage, FIT_TEXT, SENIOR_NOTE, type FitKind } from '../../fit';
import { LENS_BY_ID } from '../../lenses';
import { changeSummary } from '../../model/deps';
import type { Chat } from '../../model/draft';
import { pressureOf, seedDraft } from '../../model/seed';
import { useAuthor } from '../../model/store';
import { applyAnswer, questionFor, readDocument } from '../../questions';
import { frameworkOf, tookLabel, type TookItem } from '../../read';

/**
 * The co-creator chat's moves (D106), on the draft's `chat`: ask the next question (the server's
 * drafter when configured, else the templates), apply an answer typed or spoken, read an upload, and
 * once the questions are done recommend a lens. Choosing the lens drafts the whole simulation.
 *
 * A long answer or an upload is read whole and said back ("I took these from your brief", D146); an
 * ambiguous answer gets one clarifying question with choices (D147); an answer changed later shows what it
 * changes in the draft before it is applied (D146). The server's turn has a timeout and a Cancel; when it
 * fails the chat offers Retry and Continue offline, and the answer box stays usable (D148).
 */

function readFile(file: File): Promise<{ name: string; text: string | null }> {
  if (!/\.(txt|md|markdown)$/i.test(file.name) && !file.type.startsWith('text/')) return Promise.resolve({ name: file.name, text: null });
  return file.text().then(text => ({ name: file.name, text }));
}

/** "Here is what I took from that", after the challenge: the shape of the draft so far. */
function tookNote(brief: Brief): string {
  const stages = brief.process ?? DEFAULT_PROCESS.stages;
  const keyed = stages.map(n => ({ key: n.toLowerCase(), name: n }));
  const pressure = keyed.find(s => s.key === pressureOf(brief.challenge, keyed))?.name ?? stages[stages.length - 2];
  const words = ['zero', 'one', 'two', 'three', 'four', 'five', 'six'];
  const burnout = /burn ?out|morale|tired/i.test(brief.challenge ?? '');
  return `A ${words[stages.length] ?? stages.length} stage process with **${pressure}** as the pressure point, ${burnout ? 'two new joiners who arrive in week 2, and events about burnout and pricing pressure' : 'and events that test the challenge you described'}. I have started the team and the company.`;
}

/** Everything the author has told Kora so far, for the fit check: answers, the challenge and uploaded text. */
function corpusOf(answers: Record<string, string>, brief: Brief): string {
  return [...Object.values(answers), brief.challenge ?? '', ...brief.documents.map(d => d.text ?? '')].join('\n');
}

/**
 * The fit check on the chat (D133): kinds the brief asks for that iLead cannot play, not raised before, open
 * a note that waits for the author; senior participants get one note that does not wait. Changes `c` in place.
 */
function raiseFit(c: Chat, corpus: string, from: QuestionId | null) {
  const fit = fitCheck(corpus);
  const seen = c.fit?.seen ?? [];
  const fresh = fit.concerns.filter(x => !seen.includes(x.kind));
  if (fresh.length) {
    c.log.push({ kind: 'note', text: fitMessage(fresh), took: false });
    c.fit = { status: 'open', from, kinds: fresh.map(x => x.kind), seen: [...seen, ...fresh.map(x => x.kind)] };
  } else if (fit.senior && !seen.includes('senior') && !fit.concerns.length) {
    c.log.push({ kind: 'note', text: SENIOR_NOTE, took: false });
    c.fit = { status: c.fit?.status ?? 'accepted', from: c.fit?.from ?? null, kinds: c.fit?.kinds ?? [], seen: [...seen, 'senior'] };
  }
}

/** Records what a long answer or an upload gave: the "I took these" entry, and the questions it answered. */
function recordTook(c: Chat, took: TookItem[] | undefined, asked: QuestionId | null) {
  // Only the question asked: the answer itself says it, nothing to say back.
  if (!took?.some(t => t.id !== asked)) return;
  c.log.push({ kind: 'took', items: took.map(t => ({ id: t.id, label: t.label, value: t.value.slice(0, 4000) })) });
  const ids = took.map(t => t.id).filter((id): id is QuestionId => id !== 'stakeholders' && id !== 'objectives' && id !== 'dilemmas' && id !== asked);
  c.taken = [...new Set([...(c.taken ?? []), ...ids])];
}

/** The arguments of a turn, kept so Retry asks the same again. */
type Turn = [Brief, QuestionId[], Record<string, string>, QuestionId[], Drafter[] | undefined];

/** An answer changed after it was given, waiting for Apply or Keep as note only (D146). */
export interface PendingEdit { id: QuestionId; raw: string; brief: Brief; summary: string[] }

export function useJourney(drafters?: Drafter[]) {
  const ds = useMemo(() => drafters ?? createDrafters(), [drafters]);
  const chat = useAuthor(s => s.draft.chat);
  const edit = useAuthor(s => s.edit);
  const replace = useAuthor(s => s.replace);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: QuestionId; preview: boolean } | null>(null);
  const [pending, setPending] = useState<PendingEdit | null>(null);
  const [failure, setFailure] = useState<{ message: string; turn: Turn } | null>(null);
  const [offline, setOffline] = useState(false);
  const running = useRef<AbortController | null>(null);
  const started = useRef(false);

  const setChat = useCallback((f: (c: Chat) => void) => edit(d => f(d.chat)), [edit]);

  const advance = useCallback(async (brief: Brief, asked: QuestionId[], answers: Record<string, string>, taken: QuestionId[], use?: Drafter[]) => {
    running.current?.abort();
    const controller = new AbortController();
    running.current = controller;
    setBusy(true);
    setFailure(null);
    try {
      const { value } = await firstAnswer(use ?? ds, d => d.turn({ brief, asked, answers, taken }, { signal: controller.signal }));
      if (controller.signal.aborted) return;
      setChat(c => {
        c.brief = value.brief;
        if (value.kind === 'question') { c.current = { id: value.question.id, n: value.progress.n, about: value.progress.about, ...(value.question.confirm ? { confirm: value.question.confirm } : null) }; c.clarify = null; }
        else if (value.kind === 'clarify') c.clarify = value.clarify;
        else {
          c.current = null;
          c.clarify = null;
          c.recommendation = value.recommendation;
          c.primary = c.primary ?? value.recommendation.id;
          if (value.framework?.length && !c.clientDimensions.length) c.clientDimensions = value.framework;
        }
      });
    } catch (e) {
      if (running.current !== controller) return;
      // Never waits for ever, and never leaves the author stuck (D148): Retry, or the templates from here on.
      setFailure({ message: failureText(e), turn: [brief, asked, answers, taken, use] });
    } finally {
      if (running.current === controller) { running.current = null; setBusy(false); }
    }
  }, [ds, setChat]);

  // The first question, once, when the chat is fresh.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    // The first question is asked on mount, from the server or the templates (as D78 kept for the old chat).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!chat.current && !chat.recommendation && chat.asked.length === 0) void advance(chat.brief, [], {}, chat.taken ?? []);
  }, [advance, chat]);

  const drafting = offline ? [new MockDrafter()] : undefined;
  // The turn after an answer failed (D148, D166): the answer stands in the chat, and the question it answered is not
  // asked again while Retry and Continue offline wait. The current question only moves when a turn answers.
  const lastQa = [...chat.log].reverse().find(x => x.kind === 'qa');
  const awaiting = !!failure && !busy && !editing && !chat.clarify && !!chat.current && lastQa?.kind === 'qa' && lastQa.id === chat.current.id && chat.asked.includes(chat.current.id);
  const question = chat.current && !awaiting ? { ...questionFor(chat.current.id, chat.brief), confirm: chat.current.confirm } : null;
  const clarify = chat.clarify ?? null;
  const askId = editing?.id ?? clarify?.id ?? (awaiting ? null : chat.current?.id ?? null);

  async function answer(raw: string, voice = false): Promise<boolean> {
    if (!askId || busy) return false;
    if (chat.fit?.status === 'open') { setError('First choose: continue with a team leadership version, or change the brief.'); return false; }
    const clarifying = !editing && !!clarify;
    const r = applyAnswer(chat.brief, askId, raw, { clarified: clarifying && clarify!.choices.some(c => c.value === raw.trim()) });
    if (r.error) { setError(r.error); return false; }
    setError(null);
    const answers = { ...chat.answers, [askId]: raw.trim() };
    const corpus = corpusOf(answers, r.brief);
    if (editing) {
      setEditing(null);
      if (editing.preview && !r.clarify) {
        // Changed later: say what it changes in the draft first, then Apply or Keep as note only (D146).
        const primary = chat.primary ?? chat.recommendation?.id ?? 'readiness_based';
        const summary = changeSummary(seedDraft({ ...chat, primary }, 'chat'), seedDraft({ ...chat, primary, brief: r.brief }, 'chat'));
        setPending({ id: askId, raw: raw.trim(), brief: r.brief, summary });
        return true;
      }
      setChat(c => {
        c.brief = r.brief; c.answers = answers;
        const e = c.log.find(x => x.kind === 'qa' && x.id === askId);
        if (e && e.kind === 'qa') e.answer = raw.trim();
        if (r.note) c.log.push({ kind: 'note', text: r.note, took: false });
        recordTook(c, r.took, askId);
        if (r.clarify) c.clarify = r.clarify;
        raiseFit(c, corpus, askId);
      });
      return true;
    }
    const counts = r.answered !== false;
    const asked = counts && !chat.asked.includes(askId) ? [...chat.asked, askId] : chat.asked;
    const prompt = clarifying ? clarify!.prompt : questionFor(askId, chat.brief).prompt;
    const taken = [...new Set([...(chat.taken ?? []), ...(r.took ?? []).map(t => t.id).filter((id): id is QuestionId => id !== 'stakeholders' && id !== 'objectives' && id !== 'dilemmas' && id !== askId)])];
    setChat(c => {
      c.answers = answers; c.asked = asked; c.brief = r.brief;
      c.log.push({ kind: 'qa', id: askId, prompt: prompt.slice(0, 400), answer: raw.trim(), voice });
      if (r.note) c.log.push({ kind: 'note', text: r.note, took: false });
      recordTook(c, r.took, askId);
      c.clarify = r.clarify ?? null;
      raiseFit(c, corpus, askId);
      if (askId === 'challenge' && counts && c.fit?.status !== 'open' && !r.took?.length) c.log.push({ kind: 'note', text: tookNote(r.brief), took: true });
    });
    if (!r.clarify) await advance(r.brief, asked, answers, taken, drafting);
    return true;
  }

  async function upload(file: File) {
    const doc = await readFile(file);
    const read = readDocument(chat.brief, doc);
    const b = read.brief;
    const note = doc.text === null
      ? `I added ${doc.name}. I read text files here; paste the text if you want me to use it now.`
      : `I read ${doc.name}.${b.framework && !chat.brief.framework ? ' It includes a leadership framework.' : ''} I will skip any question it answers.`;
    const taken = [...new Set([...(chat.taken ?? []), ...read.took.map(t => t.id).filter((id): id is QuestionId => id !== 'stakeholders' && id !== 'objectives' && id !== 'dilemmas')])];
    setChat(c => {
      c.log.push({ kind: 'note', text: note, took: false });
      c.brief = b;
      recordTook(c, read.took, null);
      if (read.clarify) c.clarify = read.clarify;
      if (b.framework) c.clientDimensions = frameworkOf(b.framework);
      raiseFit(c, corpusOf(c.answers, b), null);
    });
    if (chat.current && !read.clarify) await advance(b, chat.asked, chat.answers, taken, drafting);
  }

  /** Applies an answer changed later, as one named step of undo with a version saved first (D146). */
  function applyPending() {
    const p = pending;
    if (!p) return;
    edit(d => {
      const c = d.chat;
      c.brief = p.brief; c.answers = { ...c.answers, [p.id]: p.raw };
      const e = c.log.find(x => x.kind === 'qa' && x.id === p.id);
      if (e && e.kind === 'qa') e.answer = p.raw;
      c.log.push({ kind: 'note', text: `Changed: ${tookLabel(p.id)} is now "${p.raw.slice(0, 200)}".`, took: false });
      raiseFit(c, corpusOf(c.answers, p.brief), p.id);
    }, { label: `Change ${tookLabel(p.id).toLowerCase()} to ${p.raw.slice(0, 40)}`, restorePoint: true });
    setPending(null);
  }

  /** Keeps the changed answer in the chat as a note; the brief stays as it was. */
  function keepPendingAsNote() {
    const p = pending;
    if (!p) return;
    setChat(c => { c.log.push({ kind: 'note', text: `Noted for ${tookLabel(p.id).toLowerCase()}: "${p.raw.slice(0, 400)}". I kept the brief as it was.`, took: false }); });
    setPending(null);
  }

  /** The brief does not fit: go on with the team leadership version, said back in the chat. */
  function continueFit() {
    setChat(c => {
      if (c.fit?.status !== 'open') return;
      c.log.push({ kind: 'note', text: fitAccepted(c.fit.kinds.filter((k): k is FitKind => k in FIT_TEXT).map(k => ({ kind: k, ...FIT_TEXT[k] }))), took: false });
      c.fit = { ...c.fit, status: 'accepted' };
    });
  }

  /** The brief does not fit: answer the question that raised it again; what it raised is checked again then. */
  function changeBrief() {
    const from = chat.fit?.from ?? 'challenge';
    setChat(c => { if (c.fit) c.fit = { status: 'accepted', from: null, kinds: [], seen: c.fit.seen.filter(k => !c.fit!.kinds.includes(k)) }; });
    setEditing(chat.asked.includes(from) ? { id: from, preview: false } : null);
    setError(null);
  }

  function chooseLens(primary: LensId, secondary: LensId | null) {
    edit(d => { d.chat.primary = primary; d.chat.secondary = secondary === primary ? null : secondary; });
  }

  /** Drafts the whole simulation from the chat and shows "First draft ready". */
  function draftNow(primary?: LensId) {
    running.current?.abort();
    const c = structuredClone(chat);
    if (primary) c.primary = primary;
    c.primary ??= c.recommendation?.id ?? 'readiness_based';
    replace(seedDraft(c, 'ready'));
  }

  return {
    chat, question, clarify, askId, busy, error, setError, editing: editing?.id ?? null, pending, failure, offline, awaiting,
    startEdit: (id: QuestionId, preview = true) => { setEditing({ id, preview }); setPending(null); setError(null); },
    cancelEdit: () => setEditing(null),
    answer, upload, chooseLens, draftNow, continueFit, changeBrief, applyPending, keepPendingAsNote,
    /** Stops the turn the server is working on; the chat then offers Retry and Continue offline. */
    cancel: () => running.current?.abort(),
    retry: () => { setError(null); if (failure) void advance(...failure.turn); },
    /** The templates from here on, starting with the turn that failed (D148). */
    continueOffline: () => { setOffline(true); setFailure(null); setError(null); void advance(chat.brief, chat.asked, chat.answers, chat.taken ?? [], [new MockDrafter()]); },
    fitOpen: chat.fit?.status === 'open',
    chooseLensDims: (dims: Chat['clientDimensions']) => setChat(c => { c.clientDimensions = dims; }),
    lensTitle: (id: LensId) => LENS_BY_ID[id].title
  };
}

export type Journey = ReturnType<typeof useJourney>;
