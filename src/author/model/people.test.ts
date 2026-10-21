import { describe, expect, it } from 'vitest';
import { Brief } from '../../api/author';
import type { StorylineInput } from '../../engine/config';
import { draftStoryline } from '../storyline';
import type { AuthorDraft } from './draft';
import { toStoryline } from './export';
import { draftedTeam, draftRequestOf, emptyChat, relationsOf, seedDraft } from './seed';

const chat = (over: Partial<Brief> = {}): AuthorDraft['chat'] => ({
  ...emptyChat(),
  brief: Brief.parse({ roleLevel: 'First time sales managers', industry: 'Healthcare', challenge: 'Deals stall at negotiation and new reps burn out.', client: 'Riverbend Clinics', teamSize: 10, duration: 'standard', ...over }),
  asked: ['role_level', 'industry', 'challenge', 'client'], answers: {}, primary: 'readiness_based'
});
const years = (s: string) => { const n = parseFloat(s); return /month/.test(s) ? n / 12 : n; };

describe('every drafted person has a full profile (D245)', () => {
  for (const teamSize of [6, 10, 12]) {
    it(`drafts a previous role, a career, awareness, responsibilities and relationships for a team of ${teamSize}`, () => {
      const d = seedDraft(chat({ teamSize }), 'workspace');
      for (const c of d.team) {
        expect(c.previousCompany, c.id).toMatch(/^[A-Z].+, .+/);
        expect(c.shown.previousCompany).toBe(true);
        expect(c.awareness.length).toBeGreaterThan(30);
        expect(c.responsibilities).toMatch(/^Owns /);
        expect(c.relationships.length).toBeGreaterThan(0);
        for (const r of c.relationships) expect(d.team.some(o => o.id === r.with && o.id !== c.id)).toBe(true);
        // Time on this team is never longer than the career.
        expect(years(c.tenure)).toBeLessThanOrEqual(years(c.experience));
      }
      // Never the company's name, so a rename never leaves it behind; never a dash.
      const drafted = JSON.stringify(d.team.map(c => [c.previousCompany, c.awareness, c.responsibilities, c.experience, c.tenure]));
      expect(drafted).not.toContain('Riverbend Clinics');
      expect(drafted).not.toMatch(/—|–/);
    });
  }

  it('gives longer careers to the more skilled', () => {
    const d = seedDraft(chat(), 'workspace');
    const sorted = [...d.team].sort((a, b) => a.stats.skill - b.stats.skill);
    expect(years(sorted[0].experience)).toBeLessThanOrEqual(years(sorted[sorted.length - 1].experience));
  });

  it('mentors are well ahead in skill, and those who learned from someone are well behind', () => {
    const d = seedDraft(chat(), 'workspace');
    for (const c of d.team) for (const r of c.relationships) {
      const o = d.team.find(x => x.id === r.with)!;
      if (r.kind === 'Mentors') expect(c.stats.skill - o.stats.skill).toBeGreaterThanOrEqual(15);
      if (r.kind === 'Learned the ropes from') expect(o.stats.skill - c.stats.skill).toBeGreaterThanOrEqual(15);
    }
  });

  it('reaches the participant: awareness, responsibilities, previous role and relationships in the profile', () => {
    const d = seedDraft(chat(), 'workspace');
    const out = toStoryline(d);
    expect(out.issues).toEqual([]);
    for (const m of out.storyline.members) {
      expect(m.profile.awareness).toBeTruthy();
      expect(m.profile.responsibilities).toBeTruthy();
      expect(m.profile.previous).toBeTruthy();
      expect(m.profile.relations).toBeTruthy();
    }
  });
});

describe('a draft from Kora\'s server (D245)', () => {
  const c = chat();
  const template = (): StorylineInput => draftStoryline(c.brief, draftRequestOf(c).leadership_lens);

  it('takes the people the server drafted: names, careers, awareness, relationships and the career goal', () => {
    const sl = template();
    const [a, b] = sl.members;
    a.name = 'Asha Menon';
    b.name = 'Tomas Reyes';
    Object.assign(a.profile, { previous: 'Clinic liaison, a hospital group', experience: '10 years', tenure: '4 years', awareness: 'Sees how the team works, less so her own blind spots.', responsibilities: 'Owns the new clinic accounts.', relations: 'Mentors Tomas; Works closely with Nobody' });
    a.careerGoal = 'Lead the regional team.';
    const d = seedDraft(c, 'ready', sl);
    const asha = d.team[0];
    expect(asha).toMatchObject({ first: 'Asha', last: 'Menon', previousCompany: 'Clinic liaison, a hospital group', experience: '10 years', tenure: '4 years', careerGoal: 'Lead the regional team.', awareness: 'Sees how the team works, less so her own blind spots.', responsibilities: 'Owns the new clinic accounts.' });
    expect(asha.relationships).toEqual([{ with: b.id, kind: 'Mentors' }]);
  });

  it('ignores a server team that is not the template\'s, or one that changes nothing', () => {
    const seeded = seedDraft(c, 'ready');
    const sl = template();
    sl.members = sl.members.slice(1);
    expect(seedDraft(c, 'ready', sl).team).toEqual(seeded.team);
    expect(draftedTeam(c, seeded, sl)).toBeNull();
    expect(draftedTeam(c, seeded, template())).toBeNull();
    const renamed = template();
    renamed.members[0].name = 'Asha Menon';
    expect(draftedTeam(c, seeded, renamed)?.[0].first).toBe('Asha');
  });
});

describe('relationships read from a profile (D245)', () => {
  const sl = draftStoryline(chat().brief, draftRequestOf(chat()).leadership_lens);
  const [a, b, x] = sl.members;
  it('links each to the person it names, by first name, once', () => {
    const first = (m: typeof a) => m.name.split(' ')[0];
    expect(relationsOf(`Mentors ${first(b)}; Often clashes with ${first(x)}; Covers for ${first(b)}`, a, sl.members)).toEqual([{ with: b.id, kind: 'Mentors' }, { with: x.id, kind: 'Often clashes with' }]);
    expect(relationsOf(`Mentors ${first(a)}; Covers for Nobody;`, a, sl.members)).toEqual([]);
  });
});
