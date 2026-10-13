import type { StorylineInput } from '../../engine/config';
import type { AuthorDraft, CandidateDraft } from './draft';

/**
 * Hire candidates (D228): who the participant interviews when they hire. A new draft has them from the brief and the
 * region, like the team; a draft saved before has none of its own, so they are drafted from its chat until the author
 * edits one, and then kept in the draft. Pure.
 */

type Person = NonNullable<StorylineInput['candidates']>[number];

const genderOf = (p: string): CandidateDraft['gender'] => (p === 'he' ? 'man' : p === 'she' ? 'woman' : 'unstated');
const pronounsFor = (g: CandidateDraft['gender']) => (g === 'man' ? 'he, him' : g === 'woman' ? 'she, her' : 'they, them');

/** A drafted storyline's candidate as the author edits it. */
export function candidateFrom(p: Person): CandidateDraft {
  const [first, ...rest] = p.name.split(' ');
  const gender = genderOf(p.pronoun);
  return {
    id: p.id, first, last: rest.join(' '), gender, pronouns: pronounsFor(gender), title: p.title, stage: p.homeStage, photo: p.portrait ?? '',
    background: p.profile.previous, experience: p.profile.experience, strengths: p.profile.skills, remarks: p.profile.remarks
  };
}

/**
 * The draft's candidates: its own, or for a draft saved before D228 the ones its brief drafts (`draft`, the drafted
 * storyline's), on its own stages by position.
 */
export function candidatesOf(d: AuthorDraft, draft: () => Person[]): CandidateDraft[] {
  if (d.candidates) return d.candidates;
  const stages = d.process.stages.map(s => s.key);
  return draft().map(p => candidateFrom(p)).map((c, i, all) => ({ ...c, stage: stages.includes(c.stage) ? c.stage : stages[Math.min(stages.length - 1, Math.floor((i * stages.length) / Math.max(1, all.length)))] }));
}
