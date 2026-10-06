/**
 * Context tables the author chat and the mock drafter share: industries, role levels, challenges,
 * regions, work processes and durations. Plain data with keyword lists, so answers and uploads can be
 * read without a model. Every string here may reach a participant, so it follows the copy rules.
 */

export interface Industry {
  id: string;
  label: string;
  keywords: RegExp;
  /** The team's unit of work, singular: "deal", "case". */
  work: string;
  customers: string;
  /** Product line for a fictional company, and what it is. */
  product: string;
  productLine: string;
  companies: string[];
  sponsorTitle: string;
}

export const INDUSTRIES: Industry[] = [
  { id: 'technology', label: 'Technology', keywords: /\b(tech|technology|software|saas|cloud|it services|platform)\b/i, work: 'deal', customers: 'customers', product: 'Atlas Cloud Suite', productLine: 'a cloud platform for growing businesses', companies: ['Northwind Systems', 'Brightline Software', 'Kestrel Cloud'], sponsorTitle: 'Regional Sales Director' },
  { id: 'banking', label: 'Banking and financial services', keywords: /\b(bank|banking|financ\w*|insurance|lending|fintech|wealth)\b/i, work: 'account', customers: 'clients', product: 'Flex Business Account', productLine: 'business banking for small firms', companies: ['Harbour Bank', 'Meridian Finance', 'Crestway Bank'], sponsorTitle: 'Head of Business Banking' },
  { id: 'healthcare', label: 'Healthcare', keywords: /\b(health\w*|hospital\w*|clinic\w*|medical|patient\w*)\b/i, work: 'case', customers: 'patients', product: 'CareFirst Programme', productLine: 'outpatient care programmes', companies: ['Riverside Health', 'Lumen Care', 'Greenfield Hospitals'], sponsorTitle: 'Director of Operations' },
  { id: 'pharma', label: 'Pharma and life sciences', keywords: /\b(pharma\w*|life sciences|biotech|drug)\b/i, work: 'account', customers: 'doctors', product: 'Cardiva', productLine: 'a heart health medicine', companies: ['Helix Pharma', 'Novara Life Sciences', 'Pallas Therapeutics'], sponsorTitle: 'National Sales Manager' },
  { id: 'manufacturing', label: 'Manufacturing', keywords: /\b(manufactur\w*|factory|industrial|plant|engineering|elevator\w*)\b/i, work: 'order', customers: 'buyers', product: 'Levo Lift Series', productLine: 'industrial lifts for new buildings', companies: ['Innov8 Elevators', 'Forge Industries', 'Ironbridge Engineering'], sponsorTitle: 'Regional Sales Director' },
  { id: 'retail', label: 'Retail and consumer goods', keywords: /\b(retail\w*|consumer|fmcg|store\w*|ecommerce|e commerce)\b/i, work: 'order', customers: 'shoppers', product: 'HomeEssentials Range', productLine: 'a home goods range', companies: ['Maple Retail', 'Urban Basket', 'Corner Market Group'], sponsorTitle: 'Area Manager' },
  { id: 'telecom', label: 'Telecom', keywords: /\b(telecom\w*|telco|mobile network|broadband)\b/i, work: 'contract', customers: 'subscribers', product: 'FiberMax Business', productLine: 'business broadband plans', companies: ['Skyline Telecom', 'Pulse Networks', 'Orbit Connect'], sponsorTitle: 'Head of Enterprise Sales' },
  { id: 'consulting', label: 'Consulting and professional services', keywords: /\b(consult\w*|professional services|advisory|audit|legal)\b/i, work: 'engagement', customers: 'clients', product: 'Clarity Advisory', productLine: 'an advisory practice', companies: ['Clearpath Advisory', 'Sterling Partners', 'Bluestone Consulting'], sponsorTitle: 'Practice Lead' }
];

export const GENERIC_INDUSTRY: Industry = { id: 'other', label: 'Other', keywords: /$^/, work: 'deal', customers: 'customers', product: 'Core Service', productLine: 'its main service', companies: ['Summit Group', 'Northstar Company', 'Keystone Group'], sponsorTitle: 'Regional Director' };

export function industryOf(text: string | undefined): Industry {
  if (!text) return GENERIC_INDUSTRY;
  return INDUSTRIES.find(i => i.label.toLowerCase() === text.toLowerCase()) ?? INDUSTRIES.find(i => i.keywords.test(text)) ?? GENERIC_INDUSTRY;
}

/** Role levels the recommendation reads (module step 2). */
export type RoleKind = 'first_time' | 'mid' | 'senior' | 'high_potential' | 'ic_to_leader' | 'other';
export const ROLE_LEVELS: Array<{ kind: RoleKind; label: string; keywords: RegExp }> = [
  { kind: 'first_time', label: 'First time managers', keywords: /\b(first time|first line|new manager\w*|newly promoted|front ?line)\b/i },
  { kind: 'mid', label: 'Mid level managers', keywords: /\b(mid level|middle manag\w*|mid manag\w*|managers of managers)\b/i },
  { kind: 'senior', label: 'Senior leaders', keywords: /\b(senior|executive\w*|director\w*|vp|vice president\w*|cxo|leadership team)\b/i },
  { kind: 'high_potential', label: 'High potentials', keywords: /\b(high potential\w*|hipo\w*|talent pool|future leaders)\b/i },
  { kind: 'ic_to_leader', label: 'Strong individual contributors moving into leadership', keywords: /\b(individual contributor\w*|ics?\b|top performer\w*|moving into leadership|first leadership role)\b/i }
];
export function roleKind(text: string | undefined): RoleKind {
  if (!text) return 'other';
  // Individual contributors first: "top performers becoming first time managers" is the IC case.
  const order: RoleKind[] = ['ic_to_leader', 'high_potential', 'first_time', 'mid', 'senior'];
  for (const k of order) if (ROLE_LEVELS.find(r => r.kind === k)!.keywords.test(text)) return k;
  return 'other';
}

/** Business challenges the recommendation reads, in the module's precedence order. */
export type ChallengeKind = 'delivery_morale' | 'change' | 'agile' | 'one_style' | 'other';
export const CHALLENGES: Array<{ kind: ChallengeKind; label: string; keywords: RegExp }> = [
  { kind: 'delivery_morale', label: 'Hitting targets without burning out the team', keywords: /\b(morale|burn ?out|engagement|attrition|delivery pressure|targets? (and|with|without)|stretch target|retain\w*)\b/i },
  { kind: 'change', label: 'Leading through change or transformation', keywords: /\b(chang\w*|transform\w*|ambigu\w*|restructur\w*|merger|acquisition|digital|new system|reorgani[sz]\w*|uncertain\w*)\b/i },
  { kind: 'agile', label: 'Agile, product or service delivery', keywords: /\b(agile|scrum|product teams?|service teams?|service delivery|squads?|devops)\b/i },
  { kind: 'one_style', label: 'Managers who rely on one style', keywords: /\b(one style|single style|same way with everyone|default style|dominant style|command and control|micromanag\w*)\b/i }
];
export function challengeKind(text: string | undefined): ChallengeKind {
  if (!text) return 'other';
  return CHALLENGES.find(c => c.label.toLowerCase() === text.toLowerCase())?.kind ?? CHALLENGES.find(c => c.keywords.test(text))?.kind ?? 'other';
}
/** Extra challenge chips that do not point at a lens. */
export const OTHER_CHALLENGES = ['Growing a new market', 'Building a new team'];

export interface Region { id: 'global' | 'us' | 'uk' | 'india' | 'singapore' | 'uae' | 'australia'; label: string; locale: string; currency: string; rate: number; keywords: RegExp }
export const REGIONS: Region[] = [
  { id: 'global', label: 'English, global', locale: 'en-US', currency: 'USD', rate: 1, keywords: /\b(global|international|worldwide)\b/i },
  { id: 'us', label: 'English, United States', locale: 'en-US', currency: 'USD', rate: 1, keywords: /(usa|united states|america\w*)/i },
  { id: 'uk', label: 'English, United Kingdom', locale: 'en-GB', currency: 'GBP', rate: 0.8, keywords: /\b(uk|united kingdom|britain|british|england|london)\b/i },
  { id: 'india', label: 'English, India', locale: 'en-IN', currency: 'INR', rate: 80, keywords: /\b(india\w*|mumbai|bengaluru|bangalore|delhi)\b/i },
  { id: 'singapore', label: 'English, Singapore', locale: 'en-SG', currency: 'SGD', rate: 1.3, keywords: /(singapore|southeast asia|apac)/i },
  { id: 'uae', label: 'English, UAE', locale: 'en-AE', currency: 'AED', rate: 3.7, keywords: /\b(uae|dubai|abu dhabi|middle east|gcc)\b/i },
  { id: 'australia', label: 'English, Australia', locale: 'en-AU', currency: 'AUD', rate: 1.5, keywords: /\b(australia\w*|sydney|melbourne)\b/i }
];
export function regionOf(text: string | undefined): Region | null {
  if (!text) return null;
  return REGIONS.find(r => r.label.toLowerCase() === text.toLowerCase()) ?? REGIONS.find(r => r.keywords.test(text)) ?? null;
}

/** Work processes offered as chips. The Sales Elevator funnel is the default. */
export const PROCESSES: Array<{ label: string; stages: string[] }> = [
  { label: 'Sales Elevator funnel', stages: ['Leads', 'Qualify', 'Proposal', 'Negotiation', 'Conversion'] },
  { label: 'Account management', stages: ['Onboard', 'Adopt', 'Expand', 'Renew'] },
  { label: 'Service delivery', stages: ['Intake', 'Diagnose', 'Resolve', 'Review'] },
  { label: 'Product delivery', stages: ['Discover', 'Design', 'Build', 'Test', 'Release'] }
];
export const DEFAULT_PROCESS = PROCESSES[0];

/** Stage names from free text: "Intake, Triage and Resolve" or one per line. 3 to 6, or null. */
export function parseStages(text: string): string[] | null {
  const chip = PROCESSES.find(p => text.toLowerCase().includes(p.label.toLowerCase()));
  if (chip) return [...chip.stages];
  const parts = text.split(/,|;|\n|\band\b|>|→/).map(s => s.replace(/^[\s*•\d.)]+/, '').trim()).filter(Boolean);
  const names = parts.map(p => p.split(/\s+/).slice(0, 3).join(' ')).map(p => p[0].toUpperCase() + p.slice(1));
  return names.length >= 3 && names.length <= 6 && new Set(names.map(n => n.toLowerCase())).size === names.length ? names : null;
}

/** Play modes (iLead 2.0 Design, Pacing): weeks and live conversations per week. */
export const DURATION_MODES = {
  full: { label: 'Full', weeks: 8, liveCap: 2, detail: '8 weeks, about 100 minutes or 2 sittings' },
  standard: { label: 'Standard', weeks: 8, liveCap: 1, detail: '8 weeks, 65 to 75 minutes' },
  lite: { label: 'Lite', weeks: 4, liveCap: 1, detail: '4 weeks, 30 to 35 minutes' }
} as const;

export const TONE_LABELS = { professional: 'Professional', warm: 'Warm and encouraging', direct: 'Direct and brisk' } as const;
