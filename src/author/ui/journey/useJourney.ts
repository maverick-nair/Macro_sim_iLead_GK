import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Brief, type QuestionId } from '../../../api/author';
import type { LensId } from '../../../engine/lens';
import { DEFAULT_PROCESS } from '../../context';
import { createDrafters, firstAnswer, type Drafter } from '../../drafter';
import { extractFramework } from '../../extract';
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
    const r = applyAnswer(chat.brief, askId, raw);
    if (r.error) { setError(r.error); return false; }
    setError(null);
    const answers = { ...chat.answers, [askId]: raw.trim() };
    if (editing) {
      setEditing(null);
      setChat(c => {
        c.brief = r.brief; c.answers = answers;
        const e = c.log.find(x => x.kind === 'qa' && x.id === askId);
        if (e && e.kind === 'qa') e.answer = raw.trim();
      });
      return true;
    }
    const asked = [...chat.asked, askId];
    const prompt = questionFor(askId, chat.brief).prompt;
    setChat(c => {
      c.answers = answers; c.asked = asked;
      c.log.push({ kind: 'qa', id: askId, prompt, answer: raw.trim(), voice });
      if (askId === 'challenge') c.log.push({ kind: 'note', text: tookNote(r.brief), took: true });
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
    setChat(c => { c.log.push({ kind: 'note', text: note, took: false }); c.brief = b; if (b.framework) c.clientDimensions = extractFramework(b.framework); });
    if (chat.current) await advance(b, chat.asked, chat.answers);
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
    answer, upload, chooseLens, draftNow,
    chooseLensDims: (dims: Chat['clientDimensions']) => setChat(c => { c.clientDimensions = dims; }),
    lensTitle: (id: LensId) => LENS_BY_ID[id].title
  };
}

export type Journey = ReturnType<typeof useJourney>;
