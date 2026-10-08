import { Brief } from '../../api/author';
import { applyAnswer, questionFor } from '../questions';
import { recommendLens } from '../recommend';
import type { AuthorDraft, Chat } from '../model/draft';
import { emptyChat, seedDraft } from '../model/seed';
import { MOCK_ANSWERS } from '../voice';

/**
 * Drafts for stories and tests: the canvas's example (Ascent Lifts, first time sales managers, deals
 * stalling at negotiation), at each point of the journey.
 */
const ORDER = ['role_level', 'industry', 'challenge', 'client', 'team_size', 'process', 'duration', 'language', 'framework', 'tone'] as const;

/** The chat after `n` answers, asking the next question; after all ten, at the lens step. */
export function chatAfter(n: number): Chat {
  const c = emptyChat();
  let brief = Brief.parse({});
  for (const id of ORDER.slice(0, n)) {
    const answer = id === 'industry' ? 'Manufacturing' : MOCK_ANSWERS[id];
    brief = applyAnswer(brief, id, answer).brief;
    c.asked.push(id);
    c.answers[id] = answer;
    c.log.push({ kind: 'qa', id, prompt: questionFor(id, brief).prompt, answer, voice: id === 'team_size' });
    if (id === 'challenge') c.log.push({ kind: 'note', took: true, text: 'A five stage process with **Negotiation** as the pressure point, two new joiners who arrive in week 2, and events about burnout and pricing pressure. I have started the team and the company.' });
  }
  c.brief = brief;
  if (n < ORDER.length) c.current = { id: ORDER[n], n: n + 1, about: 10 };
  else { c.recommendation = recommendLens(brief); c.primary = c.recommendation.id; }
  return c;
}

export function journeyDraft(n: number): AuthorDraft {
  return { ...seedDraft(chatAfter(10), 'chat'), chat: chatAfter(n), stage: 'chat' };
}

/** The first draft, as First draft ready shows it. */
export const readyDraft = (): AuthorDraft => seedDraft({ ...chatAfter(10), primary: 'readiness_based' }, 'ready');

/** A draft in the workspace, a few fields already the author's. */
export function workspaceDraft(): AuthorDraft {
  const d = seedDraft({ ...chatAfter(10), primary: 'readiness_based' }, 'workspace');
  d.team[0].persona = 'Five years in lead generation. Expected a promotion that went to someone else.';
  d.marks[`team.${d.team[0].id}.persona`] = 'edited';
  d.lens.styles[0] = { ...d.lens.styles[0], name: 'Instruct', letter: 'I', short: 'Set the task, show how, check in often' };
  d.marks[`lens.styles.${d.lens.styles[0].key}`] = 'edited';
  return d;
}
