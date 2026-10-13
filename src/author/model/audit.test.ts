import { describe, expect, it } from 'vitest';
import { Brief } from '../../api/author';
import type { LensId } from '../../engine/lens';
import { auditStoryline, STANDARD_WORDING } from './audit';
import type { AuthorDraft } from './draft';
import { toStoryline } from './export';
import { emptyChat, seedDraft } from './seed';
import { validateDraft } from './validate';

/**
 * The export audit (D228): no text a participant reads in an exported draft is a leftover that no GenieKreator field
 * owns. Drafts across industries, regions, lenses and run lengths; and the HUL trial's case, hire candidates no tab
 * showed, is caught if it comes back.
 */
const draftFor = (industry: string, region: string, lens: LensId, duration: 'lite' | 'standard' | 'full'): AuthorDraft => seedDraft({
  ...emptyChat(), primary: lens,
  brief: Brief.parse({ roleLevel: 'Area sales managers', industry, challenge: 'Secondary sales are flat and the team is tired.', client: 'Kaveri Consumer Products', teamSize: 10, process: ['Beat plan', 'Outlet visit', 'Order booking', 'Distributor billing', 'Secondary sales'], duration, region, tone: 'warm' })
} as AuthorDraft['chat']);
const DRAFTS: Array<[string, string, LensId, 'lite' | 'standard' | 'full']> = [
  ['Retail and consumer goods', 'india', 'readiness_based', 'standard'],
  ['Technology', 'global', 'six_styles', 'full'],
  ['Healthcare', 'uk', 'servant', 'lite'],
  ['Banking and financial services', 'singapore', 'inspire_deliver', 'standard']
];

describe('the export audit (D228)', () => {
  it.each(DRAFTS)('finds no text without an owner in a %s draft (%s, %s, %s)', (industry, region, lens, run) => {
    const a = auditStoryline(toStoryline(draftFor(industry, region, lens, run)).storyline);
    expect(a.ownerless).toEqual([]);
    expect(a.owned).toBeGreaterThan(200);
    // Standard wording is only what was reviewed as such.
    for (const s of a.standard) expect(Object.keys(STANDARD_WORDING)).toContain(s.pattern);
  });

  it('keeps the reviewed standard wording to these paths, so a new one is a decision', () => {
    expect(Object.keys(STANDARD_WORDING).sort()).toEqual(['candidates[].profile.tenure', 'events[].impactText', 'events[].label', 'members[].profile.skills', 'money.display', 'report', 'sponsor.styleLine', 'triggers[]']);
  });

  it('flags text no field owns: an optional profile row from a template, a field the registry does not know', () => {
    const sl = toStoryline(draftFor(...DRAFTS[0])).storyline;
    const leftover = { ...sl, members: sl.members.map((m, i) => (i === 2 ? { ...m, profile: { ...m.profile, awareness: 'Knows the Urban Basket buyers well.' } } : m)), mystery: 'A line from the sample storyline.' };
    expect(auditStoryline(leftover).ownerless).toEqual([
      { path: 'members.2.profile.awareness', pattern: 'members[].profile.awareness', text: 'Knows the Urban Basket buyers well.' },
      { path: 'mystery', pattern: 'mystery', text: 'A line from the sample storyline.' }
    ]);
  });

  it('owns the hire candidates now: drafted from the brief and region, never naming a rival, and edited in Team', () => {
    const d = draftFor(...DRAFTS[0]);
    const sl = toStoryline(d).storyline;
    expect(sl.candidates?.length).toBe(10);
    const rivals = d.story.market.rivals.map(r => r.name);
    for (const c of sl.candidates ?? []) for (const r of rivals) expect(JSON.stringify(c), c.name).not.toContain(r);
    expect(sl.candidates!.map(c => c.name)).toContain('Sandeep Kulkarni');
    expect(new Set(sl.candidates!.map(c => c.name)).size).toBe(10);
    expect(sl.candidates!.some(c => d.team.some(m => `${m.first} ${m.last}` === c.name))).toBe(false);
  });

  it('drafts a stored draft\'s candidates from its brief until the author edits one', () => {
    const d = draftFor(...DRAFTS[0]);
    const before = { ...d, candidates: undefined };
    expect(toStoryline(before).storyline.candidates).toEqual(toStoryline(d).storyline.candidates);
  });

  it('says so in Review and publish: a check that every text has an owner', () => {
    const d = draftFor(...DRAFTS[0]);
    expect(validateDraft(d).advisories.filter(i => i.area === 'trace')).toEqual([]);
  });
});
