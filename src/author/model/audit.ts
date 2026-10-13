import type { StorylineInput } from '../../engine/config';
import { ancestors, INTERNAL, patternOf, traceOf } from '../../shared/trace';

/**
 * The export audit (D228): every text a participant can read in the exported storyline, and the GenieKreator field
 * that owns it (the traceability registry, `src/shared/trace.ts`). A text no field owns is a leftover: it came from
 * the drafting template or the bundled sample storyline, and the author can neither see nor change it (the trial's
 * hire candidates, with the sample's names and a rival the authors had removed). Pure.
 *
 * Some participant facing text is the engine's or iLead's own standard wording, the same in every simulation and
 * reviewed as such (`STANDARD_WORDING`): the report's narratives, the people triggers' messages and so on. Anything
 * else no field owns is reported, and a unit test keeps the list of what may be standard wording from growing unseen.
 */

/** Participant facing text GenieKreator does not author, reviewed as standard wording, by registry path, with what it is. */
export const STANDARD_WORDING: Record<string, string> = {
  'money.display': 'How money is written (a symbol)',
  'sponsor.styleLine': 'The line over weekly style setting',
  'members[].profile.skills': 'A profile\'s skills line, worded from the stages in Work process',
  'candidates[].profile.tenure': 'A hired candidate is a New joiner',
  'events[].impactText': 'A drafted event\'s See impact line',
  'events[].label': 'A drafted lens event\'s card label (Blocker, for example)',
  'triggers[]': 'The people triggers\' messages (leave, a role change, a request), iLead\'s wording',
  'report': 'The report\'s narratives, development tips, methodology and reflection questions, iLead\'s wording for the lens'
};

export interface AuditEntry {
  /** The storyline path ("candidates.3.profile.remarks"). */
  path: string;
  /** Its registry pattern ("candidates[].profile.remarks"). */
  pattern: string;
  text: string;
}

export interface Audit {
  /** Texts a GenieKreator field owns. */
  owned: number;
  /** Standard wording, by the reviewed path that covers it, with how many texts. */
  standard: Array<{ pattern: string; what: string; count: number }>;
  /** Texts no field owns and no review covers: leftovers. */
  ownerless: AuditEntry[];
}

/** The reviewed path of standard wording that covers a pattern, if any. */
const standardOf = (pattern: string) => ancestors(pattern).find(a => a in STANDARD_WORDING) ?? null;

/** What kind of internal path a pattern is, by its closest listed ancestor. */
const internalKind = (pattern: string) => ancestors(pattern).map(a => INTERNAL[a]).find(Boolean)?.kind ?? null;

/** Every participant facing text of a storyline, and who owns it. */
export function auditStoryline(storyline: StorylineInput | Record<string, unknown>): Audit {
  let owned = 0;
  const standard = new Map<string, number>();
  const ownerless: AuditEntry[] = [];
  const visit = (v: unknown, path: string) => {
    if (typeof v === 'string') {
      if (!v.trim()) return;
      if (traceOf(path)) { owned++; return; }
      const pattern = patternOf(path);
      const kind = internalKind(pattern);
      // Ids, engine mechanics and the author's own notes are never shown as text.
      if (kind === 'id' || kind === 'mechanics' || kind === 'author') return;
      const std = standardOf(pattern);
      if (std) { standard.set(std, (standard.get(std) ?? 0) + 1); return; }
      ownerless.push({ path, pattern, text: v });
      return;
    }
    if (Array.isArray(v)) v.forEach((x, i) => visit(x, path ? `${path}.${i}` : String(i)));
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) visit(x, path ? `${path}.${k}` : k);
  };
  visit(storyline, '');
  return { owned, standard: [...standard].map(([pattern, count]) => ({ pattern, what: STANDARD_WORDING[pattern], count })), ownerless };
}
