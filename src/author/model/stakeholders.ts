import { z } from 'zod';
import { MAX_STAKEHOLDERS, STAKEHOLDER_INTERACTIONS, type AuthorDraft, type RequestDraft, type StakeholderDraft, type StakeholderEffectDraft, type StakeholderInteractionDraft, type StakeholderOptionDraft } from './draft';
import { freshKey, slugKey } from './seed';

/**
 * Stakeholders outside the team in the author's draft (D160 to D165): new ones from a role, the interactions each
 * kind starts with, what refers to a stakeholder, removing one with everything that refers to it, and the brief's
 * stakeholders when the chat found some. Pure helpers for the Team tab, Kora, the export and the validator.
 */

type Kind = StakeholderDraft['kind'];
type Type = StakeholderInteractionDraft['type'];

export const KIND_LABEL: Record<Kind, string> = {
  manager: 'Your manager', peer: 'A peer in another team', customer: 'A customer', executive: 'An executive', board: 'The board', union: 'A union', partner: 'A partner', other: 'Someone else'
};
export const TYPE_LABEL: Record<Type, string> = { meet: 'Meet', present: 'Present or brief', negotiate: 'Negotiate', email: 'Email' };

export const blankEffect = (over: Partial<StakeholderEffectDraft> = {}): StakeholderEffectDraft =>
  ({ trust: 0, satisfaction: 0, sponsor: 0, revenue: 0, variables: {}, set: [], people: [0, 0, 0], who: 'team', outcome: '', ...over });

/** A new option of a stakeholder decision: changes nothing yet, needs no trust. */
export const blankStakeholderOption = (key: string, label: string): StakeholderOptionDraft =>
  ({ key, label, detail: '', effect: blankEffect(), needsTrust: 0, refusal: '', read: [] });

/** The interactions a stakeholder starts with: all four types, those that suit their kind switched on. */
export function defaultInteractions(kind: Kind, name: string, scoredOn: string[] = []): StakeholderInteractionDraft[] {
  const first = name.split(' ')[0] || 'them';
  const on: Record<Kind, Type[]> = {
    manager: ['meet', 'present'], peer: ['meet', 'negotiate'], customer: ['meet', 'email'], executive: ['present', 'negotiate'],
    board: ['present'], union: ['meet', 'negotiate'], partner: ['meet', 'negotiate'], other: ['meet']
  };
  const goal: Record<Type, string> = {
    meet: `Hear what ${first} needs from your team, and agree what happens next.`,
    present: `Brief ${first} on where your team stands: the numbers, the biggest risk and what you need.`,
    negotiate: `Agree priorities with ${first}: find out what they need, put options on the table and settle what each side gives.`,
    email: `Write to ${first}: be specific, say why it matters and what happens next.`
  };
  return STAKEHOLDER_INTERACTIONS.map(type => ({
    type, enabled: on[kind].includes(type), label: `${TYPE_LABEL[type].split(' ')[0]} ${first}`, goal: goal[type], plays: 'live' as const, cost: 1, from: 1,
    good: blankEffect({ trust: type === 'email' ? 4 : 6, satisfaction: type === 'email' ? 4 : 6 }),
    bad: blankEffect({ trust: -3, satisfaction: -4 }),
    options: [], scoredOn: scoredOn.slice(0, 2)
  }));
}

/** Roles Kora knows by name, for "add a stakeholder" (D165): the role's words, its kind and how it starts. */
export const ROLES: Array<{ re: RegExp; role: string; kind: Kind; name: [string, string]; about: string; start?: { trust: number; satisfaction: number } }> = [
  { re: /\bcfo\b|chief financial|finance director|head of finance/i, role: 'Chief Financial Officer', kind: 'executive', name: ['Helen', 'Brandt'], about: 'Owns the budget. Generous with teams that show the numbers early, hard on those that surprise them.', start: { trust: 45, satisfaction: 50 } },
  { re: /\bcoo\b|chief operating|operations director/i, role: 'Chief Operating Officer', kind: 'executive', name: ['Daniel', 'Osei'], about: 'Runs operations end to end and cares about delivery that holds.' },
  { re: /\bceo\b|chief executive|managing director/i, role: 'Chief Executive Officer', kind: 'executive', name: ['Maria', 'Lindqvist'], about: 'Sets the company\'s direction and wants to hear the truth early.' },
  { re: /\bboard\b/i, role: 'Board member', kind: 'board', name: ['Kwame', 'Asante'], about: 'Asks hard questions about risk and return.' },
  { re: /\b(customer|client|account)\b/i, role: 'Client account lead', kind: 'customer', name: ['Priya', 'Shah'], about: 'Leads the account for your largest client and is judged on what your team delivers.' },
  { re: /\bunion\b|works council/i, role: 'Union representative', kind: 'union', name: ['Tom', 'Gallagher'], about: 'Speaks for the staff on workload and change.' },
  { re: /\b(partner|vendor|supplier|reseller)\b/i, role: 'Partner manager', kind: 'partner', name: ['Lena', 'Park'], about: 'Runs the partner your team depends on.' },
  { re: /\b(manager|boss|line manager|reports to)\b/i, role: 'Your manager', kind: 'manager', name: ['Sam', 'Okafor'], about: 'The person you report to, who wants no surprises.' },
  { re: /\b(peer|head of|director of|delivery|marketing|product|engineering|hr|legal)\b/i, role: 'Head of another team', kind: 'peer', name: ['Elena', 'Ruiz'], about: 'Leads a team your work depends on, with priorities of their own.' }
];

/** A new stakeholder, from a role and optionally a name and kind (the Team tab's Add, Kora, and the brief). */
export function newStakeholder(d: Pick<AuthorDraft, 'stakeholders' | 'team' | 'scoring'>, opts: { name?: string; role?: string; kind?: Kind; about?: string } = {}): StakeholderDraft {
  // The role's words name a preset; failing that, the kind's first preset (an executive starts as the CFO).
  const preset = ROLES.find(r => r.re.test(`${opts.role ?? ''} ${opts.kind ?? ''}`)) ?? (opts.kind ? ROLES.find(r => r.kind === opts.kind) : undefined);
  const kind = opts.kind ?? preset?.kind ?? 'other';
  const taken = new Set([...d.stakeholders.map(s => s.name.toLowerCase()), ...d.team.map(c => `${c.first} ${c.last}`.toLowerCase())]);
  const name = opts.name?.trim() || (preset && !taken.has(preset.name.join(' ').toLowerCase()) ? preset.name.join(' ') : `New stakeholder ${d.stakeholders.length + 1}`);
  // A role given as its short word alone ("cfo", "the client") reads as the preset's full role; any other is kept.
  const given = opts.role?.trim();
  const word = given?.match(preset?.re ?? /$^/)?.[0];
  const short = !!word && given!.replace(/^(the|a|an|our|my)\s+/i, '').trim().toLowerCase() === word.toLowerCase();
  const role = (given && !short ? given : preset?.role) || KIND_LABEL[kind];
  const key = freshKey(slugKey(name.split(' ')[0] || 'stakeholder', 'stakeholder'), [...d.stakeholders.map(s => s.key), ...d.team.map(c => c.id), 'team', 'member', 'sponsor', 'news', 'you', 'target']);
  const skills = d.scoring.skills.filter(s => !s.reportOnly).map(s => s.name);
  return {
    key, name, role, kind, gender: 'unstated', pronouns: 'they, them', photo: '',
    about: opts.about ?? preset?.about ?? '', persona: '', motivatedBy: '', noTopics: '', hiddenConcern: '', concernLine: '',
    voice: { pace: 50, warmth: kind === 'executive' || kind === 'board' ? 35 : 55, formality: kind === 'executive' || kind === 'board' ? 80 : 55, replyLength: 'short' },
    start: preset?.start ?? { trust: 50, satisfaction: 50 }, drift: 2,
    interactions: defaultInteractions(kind, name, skills)
  };
}

/** The kind a relation word in a brief names ("customer", "my boss", "finance"). */
export function kindOf(relation: string, role = ''): Kind {
  const t = `${relation} ${role}`.toLowerCase();
  if (/\b(manager|boss|line manager|report)/.test(t)) return 'manager';
  if (/\b(customer|client)/.test(t)) return 'customer';
  if (/\b(board)/.test(t)) return 'board';
  if (/\b(union|works council)/.test(t)) return 'union';
  if (/\b(partner|vendor|supplier)/.test(t)) return 'partner';
  if (/\b(ceo|cfo|coo|cto|chief|executive|vp|vice president|director)/.test(t)) return 'executive';
  if (/\b(peer|colleague|head of|other team|department)/.test(t)) return 'peer';
  return 'other';
}

/**
 * The stakeholders the brief names (D165), when the chat found some: `brief.stakeholders[]` with a name, a role and
 * how they relate. Read defensively, since a brief saved before that field has none; only those not yet created.
 */
const BriefStakeholders = z.array(z.object({ name: z.string().min(1), role: z.string().default(''), relation: z.string().optional() })).max(20);
export function briefStakeholders(d: Pick<AuthorDraft, 'chat' | 'stakeholders'>): Array<{ name: string; role: string; kind: Kind }> {
  const raw = (d.chat?.brief as Record<string, unknown> | undefined)?.stakeholders;
  const r = BriefStakeholders.safeParse(raw);
  if (!r.success) return [];
  const have = new Set(d.stakeholders.map(s => s.name.trim().toLowerCase()));
  return r.data.filter(s => !have.has(s.name.trim().toLowerCase())).slice(0, MAX_STAKEHOLDERS - d.stakeholders.length)
    .map(s => ({ name: s.name.trim(), role: s.role.trim(), kind: kindOf(s.relation ?? '', s.role) }));
}

/** What refers to a stakeholder: events from them or about them, conditions on them, decisions that move them. */
export function stakeholderUses(d: AuthorDraft, key: string) {
  const from = d.events.filter(e => e.stakeholder === key).map(e => e.title || e.key);
  const moves = d.events.filter(e => e.moves?.[key] || (e.choice?.options ?? []).some(o => o.stakeholders?.[key])).map(e => e.title || e.key);
  const conditions = d.events.filter(e => (e.conditions ?? []).some(c => c.kind === 'stakeholder' && c.stakeholder === key)).map(e => e.title || e.key);
  return { from, moves, conditions, count: from.length + moves.length + conditions.length };
}

/** Removes a stakeholder and every reference to them (D163): their events stop coming from them, moves and conditions go. */
export function removeStakeholder(x: AuthorDraft, key: string) {
  x.stakeholders = x.stakeholders.filter(s => s.key !== key);
  for (const e of x.events) {
    if (e.stakeholder === key) { e.stakeholder = null; e.request = null; }
    if (e.moves?.[key]) delete e.moves[key];
    for (const o of e.choice?.options ?? []) if (o.stakeholders?.[key]) delete o.stakeholders[key];
    if (e.conditions) e.conditions = e.conditions.filter(c => !(c.kind === 'stakeholder' && c.stakeholder === key));
  }
  for (const k of Object.keys(x.marks)) if (k.startsWith(`stakeholders.${key}.`)) delete x.marks[k];
}

/** A meeting request's default answer: the stakeholder's first live interaction that is on. */
export function defaultRequest(s: StakeholderDraft | undefined): RequestDraft {
  const x = s?.interactions.find(i => i.enabled && i.plays === 'live');
  return { kind: x ? 'meeting' : 'message', interaction: x?.type ?? null, within: 2, onTime: { trust: 3, satisfaction: 3 }, ifIgnored: { trust: -6, satisfaction: -8 } };
}

/** Whether a stakeholder has anything the participant can do with them. */
export const hasInteraction = (s: StakeholderDraft) => s.interactions.some(i => i.enabled && (i.plays === 'live' || i.options.length >= 2));
