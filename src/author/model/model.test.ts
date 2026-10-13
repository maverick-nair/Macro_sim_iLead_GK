import { describe, expect, it } from 'vitest';
import { Brief } from '../../api/author';
import { parseStoryline } from '../../engine/config';
import { LENS_IDS } from '../../engine/lens';
import { AuthorDraft } from './draft';
import { toStoryline } from './export';
import { needsOf } from './needs';
import { effectText, emptyChat, parseEffect, seedDraft } from './seed';

const BRIEF = Brief.parse({
  roleLevel: 'First time sales managers', industry: 'Manufacturing', challenge: 'Deals stall at negotiation and new reps burn out in the first quarter.',
  client: 'Ascent Lifts', teamSize: 10, process: ['Leads', 'Qualify', 'Proposal', 'Negotiation', 'Close'], duration: 'standard', region: 'india', language: 'English, India', framework: null, tone: 'professional'
});
const chat = (primary: (typeof LENS_IDS)[number] = 'readiness_based') => ({ ...emptyChat(), brief: BRIEF, asked: ['role_level', 'industry', 'challenge'] as const, answers: { role_level: BRIEF.roleLevel!, industry: 'Manufacturing', challenge: BRIEF.challenge! }, primary }) as AuthorDraft['chat'];

describe('the author draft (D105)', () => {
  it('seeds a full draft from the chat, deterministic, with marks from the answers', () => {
    const a = seedDraft(chat()), b = seedDraft(chat());
    expect(a).toEqual(b);
    expect(AuthorDraft.safeParse(a).success).toBe(true);
    expect(a.title).toBe('Leading the Negotiation Team');
    expect(a.process.pressure).toBe('negotiation');
    expect(a.marks['brief.participants']).toBe('you');
    expect(a.marks['story.company.about']).toBe('ai');
    expect(a.team).toHaveLength(10);
    expect(needsOf(a).map(n => n.id)).toEqual(['story.product.dealValue', 'scoring.samples']);
  });

  it('exports a storyline the engine parses, for every lens but the client model', () => {
    for (const id of LENS_IDS.filter(l => l !== 'client_model')) {
      const out = toStoryline(seedDraft(chat(id)));
      expect(out.issues, id).toEqual([]);
      expect(parseStoryline(out.storyline).ok).toBe(true);
    }
  });

  it('carries renamed styles, a fifth style, team edits, money and switched off actions into the storyline', () => {
    const d = seedDraft(chat());
    d.lens.styles[0] = { ...d.lens.styles[0], name: 'Instruct', letter: 'I', short: 'Set the task, show how, check in often' };
    d.lens.styles.push({ key: 'challenge', letter: 'C', name: 'Challenge', short: 'Raise the bar together', description: 'You raise the bar together.' });
    for (const n of Object.keys(d.lens.fit) as Array<keyof typeof d.lens.fit>) d.lens.fit[n].challenge = n === 'highSkill_highMorale' ? 0 : 2;
    d.team[0].first = 'Kenneth';
    d.team[0].stats.morale = 15;
    d.story.product.dealValue = 42000;
    d.actions.find(a => a.key === 'fire')!.enabled = false;
    d.actions.find(a => a.key === 'swap')!.enabled = false;
    const { storyline, issues } = toStoryline(d);
    expect(issues).toEqual([]);
    expect(storyline.lens!.styles.map(s => s.name)).toEqual(['Instruct', 'Guiding', 'Partnering', 'Entrusting', 'Challenge']);
    expect(storyline.members[0].name.startsWith('Kenneth ')).toBe(true);
    expect(storyline.members[0].start.morale).toBe(15);
    expect(storyline.money.valuePerConversion).toBe(42000);
    expect(storyline.actions.map(a => a.key)).not.toContain('fire');
    expect(storyline.report!.narratives!.capability!.low).toMatch(/Instruct, Guiding, Partnering, Entrusting or Challenge/);
  });

  it('reads impact cells back as effects', () => {
    expect(effectText([1, 6, -9])).toBe('Skill +1, morale +6, result −9');
    expect(parseEffect('Skill +4, result −3')).toEqual([4, 0, -3]);
    expect(parseEffect('Morale -2')).toEqual([0, -2, 0]);
    expect(parseEffect('a lot')).toBeNull();
  });
});
