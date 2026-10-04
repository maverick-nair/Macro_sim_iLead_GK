import { describe, expect, it } from 'vitest';
import { parseStoryline } from '../engine/config';
import { EngineView } from '../engine/contract';
import { createEngine } from '../engine/sim/engine';
import salesElevator from '../engine/storylines/sales-elevator.json';
import { createI18n } from '../i18n';
import { copyViolations } from '../i18n/copy';
import { css } from '../lib/css';
import { engineLetter, engineMembers, initials } from './EngineOnboarding';

const parsed = parseStoryline(salesElevator);
if (!parsed.ok) throw new Error(parsed.issues.join('\n'));
const i18n = createI18n();

describe('onboarding on the engine', () => {
  const engine = createEngine(parsed.config, { seed: 1 });
  const view = EngineView.parse(engine.view());

  it('writes the welcome letter from the storyline, not the design fixture', () => {
    const letter = engineLetter(i18n, view);
    expect(letter.welcome[0]).toBe('Welcome to Innov8 Elevators. I am glad you are here.');
    expect(letter.welcome[1]).toContain('a team of ten');
    expect(letter.product[0]).toContain('five stages: Leads, Qualify, Proposal, Negotiation, and Conversion');
    expect(letter.product[1]).toContain('at most two people');
    expect(letter.targets).toEqual([
      'Reach $240,000 in revenue over eight weeks.',
      'Keep Team Morale and Trust healthy. A burned out team will not hold the number next quarter.',
      'You have five days of your own time each week. Spend them well.'
    ]);
    const all = Object.values(letter).flat();
    expect(all.join(' ')).not.toMatch(/Northwind|Priya|GenieKreator/);
    expect(all.flatMap(p => copyViolations(p))).toEqual([]);
  });

  it('keeps stats hidden until the engine reveals them, and names stages from the funnel', async () => {
    const before = engineMembers(i18n, view);
    expect(before.find(m => m.id === 'kent')).toMatchObject({ name: 'Kent Goldberg', stage: 'Leads', stats: null, read: false });
    await engine.dispatch({ type: 'openProfile', memberId: 'kent' });
    const after = engineMembers(i18n, EngineView.parse(engine.view()));
    expect(after.find(m => m.id === 'kent')).toMatchObject({ read: true, stats: { skill: 30, morale: 22, result: 49 } });
    // Empty profile facts read as unknown rather than blank.
    expect(after.find(m => m.id === 'kent')?.facts.previous).toBe('Not known yet');
  });

  it('makes initials for a sponsor without a portrait', () => {
    expect(initials('Paula Jacob')).toBe('PJ');
    expect(initials('Cher')).toBe('C');
    expect(initials(' Ana  María  López ')).toBe('AL');
  });
});

describe('text size', () => {
  it('scales the ported screens’ pixel font sizes with the app root, and nothing else', () => {
    expect(css('font-size:13px; padding:10px')).toEqual({ fontSize: 'calc(13px * var(--il-text-scale, 1))', padding: '10px' });
    expect(css('font-size:var(--x)')).toEqual({ fontSize: 'var(--x)' });
  });
});
