import type { Brief, Recommendation } from '../api/author';
import { challengeKind, roleKind, type ChallengeKind, type RoleKind } from './context';
import { LENS_BY_ID } from './lenses';
import type { LensId } from '../engine/lens';

/**
 * The lens recommendation (leadership-lens-module.md step 2, D70 precedence): a client framework
 * first, then the business challenge, then the role level; Readiness Based Leadership when nothing
 * clearly points elsewhere. One sentence that says why.
 */

const BY_CHALLENGE: Record<Exclude<ChallengeKind, 'other'>, { id: LensId; why: string }> = {
  delivery_morale: { id: 'inspire_deliver', why: 'your participants must hit targets and keep the team engaged at the same time' },
  change: { id: 'adaptive', why: 'the challenge is about change, where participants must tell a quick fix from a change people have to make' },
  agile: { id: 'servant', why: 'agile, product and service teams do best when the leader removes blockers instead of taking over' },
  one_style: { id: 'six_styles', why: 'it shows managers who rely on one style what the other styles do for the team' }
};

const BY_ROLE: Record<Exclude<RoleKind, 'other'>, { id: LensId; why: string }> = {
  first_time: { id: 'readiness_based', why: 'first time managers learn fastest by reading what each person needs and adapting' },
  mid: { id: 'readiness_based', why: 'mid level managers lead people at very different stages and must adapt to each' },
  senior: { id: 'five_practices', why: 'senior leaders are judged on vision, example and how they enable others' },
  high_potential: { id: 'five_practices', why: 'high potential programmes look at the full range of leadership practices' },
  ic_to_leader: { id: 'team_amplifier', why: 'strong individual contributors must learn to draw out their team instead of doing the work' }
};

export function recommendLens(brief: Brief): Recommendation {
  if (brief.framework) {
    return { id: 'client_model', rule: 'client_framework', reason: 'We recommend Client Leadership Model because you shared your own leadership framework, so the simulation scores against it.' };
  }
  const c = challengeKind(brief.challenge);
  if (c !== 'other') return { id: BY_CHALLENGE[c].id, rule: 'challenge', reason: `We recommend ${LENS_BY_ID[BY_CHALLENGE[c].id].title} because ${BY_CHALLENGE[c].why}.` };
  const r = roleKind(brief.roleLevel);
  if (r !== 'other') return { id: BY_ROLE[r].id, rule: 'role_level', reason: `We recommend ${LENS_BY_ID[BY_ROLE[r].id].title} because ${BY_ROLE[r].why}.` };
  return { id: 'readiness_based', rule: 'default', reason: 'We recommend Readiness Based Leadership because it suits most teams: participants win by reading each person and adapting.' };
}
