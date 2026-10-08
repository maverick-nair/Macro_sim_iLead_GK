import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Brief, type QuestionId } from '../../../api/author';
import type { LensId } from '../../../engine/lens';
import { DEFAULT_PROCESS } from '../../context';
import { createDrafters, firstAnswer, type Drafter } from '../../drafter';
import { extractFramework } from '../../extract';
import { fitAccepted, fitCheck, fitMessage, FIT_TEXT, SENIOR_NOTE, type FitKind } from '../../fit';
import { LENS_BY_ID } from '../../lenses';
import type { Chat } from '../../model/draft';
import { pressureOf, seedDraft } from '../../model/seed';
import { useAuthor } from '../../model/store';
import { addDocument, applyAnswer, questionFor } from '../../questions';

/**
 * The co-creator chat's moves (D106), on the draft's `chat`: ask the next question (the server's
 * drafter when configured, else the templates), apply an answer typed or spoken, read an upload, and
 * once the questions are done recommend a lens. Choosing the lens drafts the whole simulation.
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

export function useJourney(drafters?: Drafter[]) {
  const ds = useMemo(() => drafters ?? createDrafters(), [drafters]);
  const chat = useAuthor(s => s.draft.chat);
  const edit = useAuthor(s => s.edit);
  const replace = useAuthor(s => s.replace);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<QuestionId | null>(null);
  const started = useRef(false);

  const setChat = useCallback((f: (c: Chat) => void) => edit(d => f(d.chat)), [edit]);

  const advance = useCallback(async (brief: Brief, asked: QuestionId[], answers: Record<string, string>) => {
    setBusy(true);
    try {
      const { value } = await firstAnswer(ds, d => d.turn({ brief, asked, answers }));
      setChat(c => {
        c.brief = value.brief;
        if (value.kind === 'question') c.current = { id: value.question.id, n: value.progress.n, about: value.progress.about, ...(value.question.confirm ? { confirm: value.question.confirm } : null) };
        else {
          c.current = null;
          c.recommendation = value.recommendation;
          c.primary = c.primary ?? value.recommendation.id;
          if (value.framework?.length && !c.clientDimensions.length) c.clientDimensions = value.framework;
        }
      });
    } catch {
      setError('Kora could not reach the drafter. Try again.');
    } finally {
      setBusy(false);
    }
  }, [ds, setChat]);

  // The first question, once, when the chat is fresh.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    // The first question is asked on mount, from the server or the templates (as D78 kept for the old chat).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!chat.current && !chat.recommendation && chat.asked.length === 0) void advance(chat.brief, [], {});
  }, [advance, chat]);

  const question = chat.current ? { ...questionFor(chat.current.id, chat.brief), confirm: chat.current.confirm } : null;
  const askId = editing ?? chat.current?.id ?? null;

  async function answer(raw: string, voice = false): Promise<boolean> {
    if (!askId || busy) return false;
    if (chat.fit?.status === 'open') { setError('First choose: continue with a team leadership version, or change the brief.'); return false; }
    const r = applyAnswer(chat.brief, askId, raw);
    if (r.error) { setError(r.error); return false; }
    setError(null);
    const answers = { ...chat.answers, [askId]: raw.trim() };
    const corpus = corpusOf(answers, r.brief);
    if (editing) {
      setEditing(null);
      setChat(c => {
        c.brief = r.brief; c.answers = answers;
        const e = c.log.find(x => x.kind === 'qa' && x.id === askId);
        if (e && e.kind === 'qa') e.answer = raw.trim();
        if (r.note) c.log.push({ kind: 'note', text: r.note, took: false });
        raiseFit(c, corpus, askId);
      });
      return true;
    }
    const asked = [...chat.asked, askId];
    const prompt = questionFor(askId, chat.brief).prompt;
    setChat(c => {
      c.answers = answers; c.asked = asked;
      c.log.push({ kind: 'qa', id: askId, prompt, answer: raw.trim(), voice });
      if (r.note) c.log.push({ kind: 'note', text: r.note, took: false });
      raiseFit(c, corpus, askId);
      if (askId === 'challenge' && c.fit?.status !== 'open') c.log.push({ kind: 'note', text: tookNote(r.brief), took: true });
    });
    await advance(r.brief, asked, answers);
    return true;
  }

  async function upload(file: File) {
    const doc = await readFile(file);
    const b = addDocument(chat.brief, doc);
    const note = doc.text === null
      ? `I added ${doc.name}. I read text files here; paste the text if you want me to use it now.`
      : `I read ${doc.name}.${b.framework && !chat.brief.framework ? ' It includes a leadership framework.' : ''} I will skip any question it answers.`;
    setChat(c => { c.log.push({ kind: 'note', text: note, took: false }); c.brief = b; if (b.framework) c.clientDimensions = extractFramework(b.framework); raiseFit(c, corpusOf(c.answers, b), null); });
    if (chat.current) await advance(b, chat.asked, chat.answers);
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
    setEditing(chat.asked.includes(from) ? from : null);
    setError(null);
  }

  function chooseLens(primary: LensId, secondary: LensId | null) {
    edit(d => { d.chat.primary = primary; d.chat.secondary = secondary === primary ? null : secondary; });
  }

  /** Drafts the whole simulation from the chat and shows "First draft ready". */
  function draftNow(primary?: LensId) {
    const c = structuredClone(chat);
    if (primary) c.primary = primary;
    c.primary ??= c.recommendation?.id ?? 'readiness_based';
    replace(seedDraft(c, 'ready'));
  }

  return {
    chat, question, askId, busy, error, setError, editing,
    startEdit: (id: QuestionId) => { setEditing(id); setError(null); },
    cancelEdit: () => setEditing(null),
    answer, upload, chooseLens, draftNow, continueFit, changeBrief,
    fitOpen: chat.fit?.status === 'open',
    chooseLensDims: (dims: Chat['clientDimensions']) => setChat(c => { c.clientDimensions = dims; }),
    lensTitle: (id: LensId) => LENS_BY_ID[id].title
  };
}

export type Journey = ReturnType<typeof useJourney>;
