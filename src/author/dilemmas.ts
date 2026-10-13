import type { Dilemma } from '../api/author';

/**
 * Choice events and business variables seeded from the brief (D153). The chat reads a brief's objectives and
 * dilemmas (D146); the engine plays business variables and decisions with trade offs (D136, D137). This joins them,
 * with rules and no model, for both drafters: the offline draft (`seedDraft`) and the template storyline the model
 * words (`draftStoryline`, `author-draft` version 3), so the two always seed the same mechanics.
 *
 * - **Variables from objectives.** An objective that names a measure becomes a variable: a satisfaction, trust or
 *   service level objective a percent measure that starts a little above the bar it names ("member satisfaction above
 *   85 percent": Member satisfaction, start 88, drifting down a point a week, the bar in what it means); savings a
 *   money measure from zero; quality a points measure. It replaces the default Customer trust when it is the
 *   customer measure. Retention is not a variable: with people dynamics on, people resign when morale stays low.
 * - **Choices from dilemmas.** Each dilemma (up to three) becomes a decision on a card, spread over the run. Its two
 *   sides are read as the business side (revenue, deadlines, delivery, cost, standardising) and the care side
 *   (people, wellbeing, customers, trust, quality); with neither clear, the first side is the business one. The
 *   business option moves the numbers (revenue, result, savings) and costs the care side (morale, or the customer
 *   measure); the care option protects the care side and costs the business (sponsor confidence, the budget, or
 *   customers waiting on a late delivery). Its
 *   leadership read is stronger, so the best business option is never the best read (D137). Nobody deciding takes
 *   the business option, as the default drafts do.
 */

export type SeedFormat = 'money' | 'percent' | 'points';
export interface SeedVariable {
  key: string; name: string; format: SeedFormat; start: number; min: number; max: number; drift: number;
  shown: boolean; weight: number; higherIsBetter: boolean; about: string;
}
export interface SeedSkill { key: string; name: string }
export interface SeedOption {
  key: string; label: string; detail: string; outcome: string;
  skill: number; morale: number; result: number; trust: number; revenue: number; sponsor: number;
  variables: Record<string, number>;
  read: Array<{ skill: SeedSkill; band: 'strong' | 'adequate' | 'weak' }>;
}
export interface SeedChoice { key: string; title: string; body: string; known: string[]; week: number; default: string; options: [SeedOption, SeedOption] }

/** A round number near `n`: two significant figures. */
export const roundish = (n: number) => { const p = 10 ** Math.max(0, Math.floor(Math.log10(Math.max(1, n))) - 1); return Math.round(n / p) * p; };
const slug = (s: string) => { const k = s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 30); return /^[a-z]/.test(k) ? k : `k_${k || 'x'}`; };
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const lower = (s: string) => (/^[A-Z][a-z]/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s);

/** The variables every new draft starts with (D136): a budget a quarter of the target, and customer trust. */
export function defaultSeedVariables(target: number): SeedVariable[] {
  return [
    { key: 'budget', name: 'Budget', format: 'money', start: roundish(target / 4), min: 0, max: roundish(target / 2), drift: 0, shown: true, weight: 0, higherIsBetter: true, about: 'What you can spend this quarter beyond salaries: training, team events and extra help.' },
    { key: 'customer_trust', name: 'Customer trust', format: 'percent', start: 70, min: 0, max: 100, drift: 0, shown: true, weight: 20, higherIsBetter: true, about: 'How much your customers trust the team to keep its promises. It counts in the Business score.' }
  ];
}

const CUSTOMER_WORDS = /\b(customers?|clients?|members?|patients?|users?|guests?|citizens?|students?|policyholders?)\b/i;

/** One objective as a variable, or null when it names no measure the engine can track. */
export function variableFromObjective(objective: string, target: number): (SeedVariable & { customer: boolean }) | null {
  const t = objective.replace(/\s+/g, ' ').trim();
  const pct = /(\d{1,3})\s*(?:%|percent\b|per cent\b)/i.exec(t);
  const bar = pct ? Math.min(100, Number(pct[1])) : null;
  const who = CUSTOMER_WORDS.exec(t)?.[1]?.toLowerCase().replace(/s$/, '') ?? null;
  const percent = (key: string, name: string, what: string, customer: boolean): SeedVariable & { customer: boolean } => ({
    key, name, format: 'percent', start: bar === null ? 75 : Math.min(100, bar + 3), min: 0, max: 100, drift: -1, shown: true, weight: 20, higherIsBetter: true,
    about: `${what}${bar === null ? '' : ` The objective: keep it above ${bar}%.`} It slips a little each week unless the team keeps it up.`, customer
  });
  if (/\b(satisf\w*|nps|csat|net promoter)\b/i.test(t)) {
    const noun = who ?? 'customer';
    return percent(`${slug(noun)}_satisfaction`, `${cap(noun)} satisfaction`, `How satisfied ${noun}s are with the service.`, true);
  }
  if (/\btrust\b/i.test(t) && who) return percent(`${slug(who)}_trust`, `${cap(who)} trust`, `How much ${who}s trust the team to keep its promises.`, true);
  if (/\bservice levels?\b|\bsla\b/i.test(t)) return percent('service_level', 'Service level', 'The share of work done within the promised time.', true);
  if (/\b(savings?|synerg\w*|cost reductions?|cut costs?)\b/i.test(t)) {
    const name = /\bsynerg/i.test(t) ? 'Synergy savings' : 'Cost savings';
    return { key: slug(name), name, format: 'money', start: 0, min: 0, max: roundish(target / 4), drift: 0, shown: true, weight: 10, higherIsBetter: true, about: `${cap(lower(t))}. Savings the team delivers count in the Business score.`, customer: false };
  }
  if (/\b(quality|errors?|defects?|accuracy)\b/i.test(t)) return { key: 'quality', name: 'Quality', format: 'points', start: 60, min: 0, max: 100, drift: -1, shown: true, weight: 10, higherIsBetter: true, about: 'How good the work is when it leaves the team. It slips a little each week unless the team keeps it up.', customer: false };
  return null;
}

/**
 * The draft's business variables: the defaults, with every objective that maps added (up to six), and the customer
 * measure an objective names in place of Customer trust. Weights stay within the 80% the Business pillar allows.
 */
export function variablesFromBrief(objectives: readonly string[], target: number): SeedVariable[] {
  const mapped = objectives.map(o => variableFromObjective(o, target)).filter((v): v is NonNullable<typeof v> => !!v);
  const out: SeedVariable[] = defaultSeedVariables(target).filter(v => !(v.key === 'customer_trust' && mapped.some(m => m.customer)));
  for (const { customer: _c, ...v } of mapped) if (!out.some(x => x.key === v.key) && out.length < 6) out.push(v);
  let room = 80;
  return out.map(v => { const weight = Math.min(v.weight, room); room -= weight; return { ...v, weight }; });
}

type Side = 'revenue' | 'delivery' | 'cost' | 'people' | 'customer';
const SIDES: Array<[Side, RegExp]> = [
  ['revenue', /\b(revenue|sales|deals?|discounts?|growth|targets?|numbers?|quotas?|profits?|margins?|short term)\b/i],
  ['delivery', /\b(deadlines?|delivery|deliver\w*|speed|fast\w*|launch\w*|timelines?|schedules?|output|productivity|go live)\b/i],
  ['cost', /\b(costs?|savings?|synerg\w*|budgets?|standardi[sz]\w*|one process|efficien\w*|consolidat\w*|cuts?)\b/i],
  ['people', /\b(wellbeing|well being|morale|people|team|burnout|health|retention|talent|culture|development|training|best of both|jobs?)\b/i],
  ['customer', /\b(customers?|clients?|members?|patients?|trust|satisfaction|quality|service|reputation)\b/i]
];
const sidesOf = (s: string) => new Set(SIDES.filter(([, re]) => re.test(s)).map(([k]) => k));
const BUSINESS: Side[] = ['revenue', 'delivery', 'cost'];
const lean = (s: Set<Side>) => BUSINESS.filter(k => s.has(k)).length - (s.has('people') ? 1 : 0) - (s.has('customer') ? 1 : 0);

/** Week `w` of an eight week run, mapped onto a run of `weeks`. */
const onRun = (w: number, weeks: number) => (weeks <= 1 ? 1 : Math.min(weeks, Math.max(1, 1 + Math.round(((w - 1) * (weeks - 1)) / 7))));

export interface ChoiceContext {
  weeks: number;
  target: number;
  /** The draft's scored skills, first two used for the leadership read. */
  skills: SeedSkill[];
  variables: SeedVariable[];
  /** Keys already taken by the draft's events. */
  taken?: Iterable<string>;
}

/** Up to three decisions from the brief's dilemmas, each two options that pull against each other. */
export function choicesFromDilemmas(dilemmas: readonly Dilemma[], c: ChoiceContext): SeedChoice[] {
  const used = new Set(c.taken ?? []);
  const [s1, s2] = [c.skills[0], c.skills[1] ?? c.skills[0]];
  const read = (...xs: Array<[SeedSkill | undefined, SeedOption['read'][number]['band']]>) =>
    xs.filter((x): x is [SeedSkill, SeedOption['read'][number]['band']] => !!x[0]).filter(([s], i, arr) => arr.findIndex(([y]) => y.key === s.key) === i).map(([skill, band]) => ({ skill, band }));
  const customer = c.variables.find(v => v.format === 'percent' && v.higherIsBetter);
  const money = c.variables.find(v => v.format === 'money' && v.key !== 'budget' && v.start === 0) ?? c.variables.find(v => v.key === 'budget');
  const budget = c.variables.find(v => v.key === 'budget');
  const deal = roundish(c.target / 16);
  const weeks = [2, 4, 6];
  return dilemmas.filter(d => d.a.trim() && d.b.trim()).slice(0, 3).map((d, i) => {
    const [sa, sb] = [sidesOf(d.a), sidesOf(d.b)];
    const businessFirst = lean(sa) >= lean(sb);
    const [biz, care] = businessFirst ? [d.a, d.b] : [d.b, d.a];
    const [bs, cs] = businessFirst ? [sa, sb] : [sb, sa];
    const careIsCustomer = cs.has('customer') && !cs.has('people');
    let key = `dilemma_${slug(d.title || `${d.a} ${d.b}`)}`.slice(0, 40);
    for (let n = 2; used.has(key); n++) key = `${key.replace(/_\d+$/, '')}_${n}`;
    used.add(key);
    const label = (side: string) => (/^[A-Za-z]+ing\b/.test(side.trim()) ? cap(side.trim()) : `Put ${lower(side.trim())} first`);
    const bizOption: SeedOption = {
      key: 'push', label: label(biz), detail: '', outcome: careIsCustomer ? 'The numbers move this week, and customers feel the difference.' : 'The numbers move this week, and the team feels the strain.',
      skill: 0, morale: careIsCustomer ? 0 : -3, result: bs.has('delivery') ? 4 : 3, trust: 0, revenue: bs.has('revenue') ? deal : 0, sponsor: 0, variables: {},
      read: read([s1, 'adequate'], [s2, 'weak'])
    };
    const careOption: SeedOption = {
      key: 'protect', label: label(care), detail: '', outcome: careIsCustomer ? 'Customers notice you kept faith with them. The numbers wait, and your sponsor notices.' : 'The team notices you put them first. The numbers wait, and your sponsor notices.',
      skill: cs.has('people') ? 1 : 0, morale: careIsCustomer ? 0 : 3, result: 0, trust: 2, revenue: 0, sponsor: -5, variables: {},
      read: read([s1, 'strong'], [s2, 'adequate'])
    };
    // Business variables: savings for a cost side (the budget pays for the care side), the customer measure for a
    // customer side, and customers waiting when a deadline slips.
    if (bs.has('cost') && money) bizOption.variables[money.key] = roundish(c.target / 20);
    if (bs.has('cost') && budget) careOption.variables[budget.key] = -roundish(c.target / 40);
    if (customer && careIsCustomer) { bizOption.variables[customer.key] = -5; careOption.variables[customer.key] = 4; }
    else if (customer && bs.has('delivery')) careOption.variables[customer.key] = -3;
    const known = [d.stake.trim() || `Both matter here: ${lower(d.a)}, and ${lower(d.b)}.`, 'Whatever you choose, the team will see what you put first.'];
    return {
      key, title: d.title || `${cap(lower(d.a))} or ${lower(d.b)}`, week: onRun(weeks[i], c.weeks), default: 'push', known,
      body: `A decision you cannot put off: ${lower(d.a)}, or ${lower(d.b)}. You cannot have both this week.`,
      options: [bizOption, careOption]
    };
  });
}
