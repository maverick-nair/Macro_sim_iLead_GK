/**
 * The template fit check (D133). iLead plays one shape: the participant leads a team of 6 to 12 direct
 * reports through a staged work process, choosing a style and actions for each person, with events, a
 * sponsor and a revenue or output target. A brief that asks for something else is not quietly turned into
 * that shape: these rules find what the template cannot play yet, so the chat can say so plainly, name the
 * nearest fit and let the author continue with a team leadership version or change the brief.
 *
 * Plain keyword rules, like the rest of the offline chat (extract.ts); a server reads the same brief with the
 * model and should raise the same kinds.
 */

export const FIT_KINDS = ['no_team', 'stakeholders', 'merger', 'negotiation', 'budget'] as const;
export type FitKind = (typeof FIT_KINDS)[number];

export interface FitConcern {
  kind: FitKind;
  /** What iLead cannot play yet, as a phrase after "iLead cannot play". */
  cannot: string;
  /** The nearest fit, as a phrase after "the nearest fit:". */
  nearest: string;
}

export interface FitCheck {
  /** What the template cannot play: the chat waits for the author's choice. */
  concerns: FitConcern[];
  /** Senior participants: iLead gives them their own leadership team, which the chat says once, without stopping. */
  senior: boolean;
}

const TEXT: Record<FitKind, Omit<FitConcern, 'kind'>> = {
  no_team: {
    cannot: 'a role with no team of its own (every iLead participant leads 6 to 12 direct reports)',
    nearest: 'the participant leads a small team of direct reports, as in a first leadership role'
  },
  stakeholders: {
    cannot: 'people outside the team, such as a board, customers or peers, as characters the participant leads or manages',
    nearest: 'the participant leads their own team; the sponsor is the one voice from above, and a board, customers or peers appear only in events'
  },
  merger: {
    cannot: 'a merger or an integration across several functions',
    nearest: 'the participant leads one team through the merger\'s changes: new processes, new colleagues and uncertainty'
  },
  negotiation: {
    cannot: 'negotiations between several parties',
    nearest: 'pressure from a negotiation arrives as events the team must handle'
  },
  budget: {
    cannot: 'budget and spending decisions the participant controls',
    nearest: 'budget pressure arrives as events, such as a cut or a freeze, that the team must absorb'
  }
};

const RULES: Record<FitKind, (t: string) => boolean> = {
  no_team: t =>
    /\b(?:no|without|zero)\s+(?:direct\s+)?reports\b|\bno team\b|\b(?:do|does|don'?t|doesn'?t)\s+(?:not\s+)?(?:have|manage|lead)\s+(?:a team|anyone|people|direct reports)\b|\bnot people managers?\b/i.test(t)
    || /\bindividual contributors?\b(?![^.]*\b(?:moving|becom\w*|promot\w*|into leadership|first (?:team|leadership))\b)/i.test(t),
  stakeholders: t => /\bstakeholders?\b|\bthe board\b|\bboard (?:members?|of directors)\b|\bpeers?\b|\bcross[- ]functional\b|\bmatrix(?:ed)? (?:organi[sz]ation|teams?|structure)\b|\binvestors?\b|\bregulators?\b/i.test(t),
  merger: t => /\b(?:mergers?|merged|merging|acquisitions?|acquired)\b/i.test(t) && /\bintegrat\w*|\bacross (?:the |both |two )?(?:functions|departments|organi[sz]ations?|business units|sites|hospitals|companies)\b|\bcross[- ]functional\b|\bfunctions\b/i.test(t),
  negotiation: t => /\bnegotiat\w*/i.test(t) && /\b(?:unions?|multi[- ]?party|several parties|multiple parties|between (?:the )?parties|stakeholders|payers?|suppliers and)\b/i.test(t),
  budget: t => /\b(?:budgets?|p&l|p and l|capex|opex|spending)\b/i.test(t) && /\b(?:decid\w*|decisions?|allocat\w*|cut\w*|own\w*|set(?:s|ting)?|balanc\w*|prioriti[sz]\w*|trade[- ]?offs?)\b/i.test(t)
};

const SENIOR = /\b(?:senior (?:managers?|leaders?|leadership|executives?)|executives?|vps?|vice presidents?|directors?|c[- ]?suite|cxos?|heads? of)\b/i;

/** What a brief, an answer or an upload asks for that the template cannot play. */
export function fitCheck(text: string): FitCheck {
  const t = text.replace(/\s+/g, ' ');
  return { concerns: FIT_KINDS.filter(k => RULES[k](t)).map(kind => ({ kind, ...TEXT[kind] })), senior: SENIOR.test(t) };
}

const join = (xs: string[], last = 'and') => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join('; ')}; ${last} ${xs[xs.length - 1]}`);

/** What Kora says when the brief does not fit: what it cannot play, the nearest fit, and the two ways on. */
export function fitMessage(concerns: FitConcern[]): string {
  return `Before I go on, a plain word on fit. An iLead simulation is one leader with a team of 6 to 12 direct reports. It cannot play ${join(concerns.map(c => c.cannot))} yet. **The nearest fit:** ${join(concerns.map(c => c.nearest))}. I will not change your brief without asking: continue with a team leadership version, or change the brief?`;
}

/** Kora's line when the author continues with the team leadership version. */
export function fitAccepted(concerns: FitConcern[]): string {
  return `Then I will draft the team leadership version: ${join(concerns.map(c => c.nearest))}. You can change any of it in the workspace.`;
}

/** Kora's note, once, for senior participants. */
export const SENIOR_NOTE = 'A note on fit: iLead puts a senior leader in front of their own team of 6 to 12 direct reports, such as their leadership team. Their wider organization, the board and their peers are not in the simulation yet.';

export const FIT_TEXT = TEXT;
