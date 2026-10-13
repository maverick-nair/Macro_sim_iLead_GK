import { describe, expect, it, vi } from 'vitest';
import { draftStoryline as storedDraft, DRAFT_KEY } from '../engine/mock';
import { DRAFT_KEY as AUTHOR_KEY } from './model/draft';
import { Brief, LeadershipLensModule } from '../api/author';
import { parseStoryline } from '../engine/config';
import { LENS_IDS, type LensId } from '../engine/lens';
import { createEngine } from '../engine/sim/engine';
import { neededStyles } from '../engine/sim/policies';
import { guardDraft } from './copyGuard';
import { MockDrafter } from './drafter';
import { extractFramework } from './extract';
import { LENS_BY_ID } from './lenses';
import { SAMPLE_FRAMEWORK } from './fixtures';
import { buildModule } from './module';



const brief = (over: Partial<Brief> = {}): Brief => Brief.parse({
  roleLevel: 'First time managers', industry: 'Banking and financial services', challenge: 'Leading through change or transformation',
  client: 'Acme Bank', teamSize: 10, process: ['Leads', 'Qualify', 'Proposal', 'Negotiation', 'Conversion'], duration: 'full',
  region: 'india', language: 'English, India', framework: null, tone: 'professional', ...over
});

const secondaryFor = (id: LensId): LensId | null => (id === 'client_model' ? 'inspire_deliver' : LENS_BY_ID[id].worksWith);

describe('the mock drafter', () => {
  for (const id of LENS_IDS) {
    it(`drafts a storyline the engine accepts for ${LENS_BY_ID[id].title}`, async () => {
      const b = brief(id === 'client_model' ? { framework: SAMPLE_FRAMEWORK } : {});
      const clientDimensions = extractFramework(SAMPLE_FRAMEWORK);
      const secondary = secondaryFor(id);
      const module = LeadershipLensModule.parse(buildModule(b, { primary: id, secondary, clientDimensions }, true));
      const r = await new MockDrafter().draft({ brief: b, leadership_lens: module });
      const parsed = parseStoryline(r.storyline);
      expect(parsed.ok ? [] : parsed.issues).toEqual([]);
      if (!parsed.ok) return;
      const c = parsed.config;
      expect(c.organisation).toBe('Acme Bank');
      expect(c.members).toHaveLength(10);
      expect(c.lens.id).toBe(id);
      expect(c.lens.secondary?.id ?? null).toBe(secondary);
      expect(c.report.skills.filter(s => s.reportOnly).length).toBeGreaterThan(0);
      if (id === 'client_model') expect(c.report.skills.filter(s => !s.reportOnly).map(s => s.name)).toEqual(['Customer Obsession', 'Bold Ownership', 'Growing People']);
      expect(guardDraft(r.storyline)).toEqual([]);
      expect(guardDraft(module)).toEqual([]);
      // It plays: a week with the styles the team needs.
      const engine = createEngine(c, { seed: 1 });
      await engine.dispatch({ type: 'confirmStyles', styles: await neededStyles(engine, c.thresholds.high, c.lens) });
      await engine.dispatch({ type: 'endPeriod' });
      expect(engine.view().clock.period).toBe(1);
    });
  }

  it('sizes the team, keeps 4 weeks for Lite and follows the region and the stages', async () => {
    const b = brief({ teamSize: 12, duration: 'lite', region: 'uk', process: ['Intake', 'Diagnose', 'Resolve', 'Review'], client: null, industry: 'Healthcare' });
    const module = buildModule(b, { primary: 'readiness_based', secondary: null, clientDimensions: [] }, true);
    const r = await new MockDrafter().draft({ brief: b, leadership_lens: module });
    const parsed = parseStoryline(r.storyline);
    expect(parsed.ok ? [] : parsed.issues).toEqual([]);
    if (!parsed.ok) return;
    expect(parsed.config.members).toHaveLength(12);
    expect(parsed.config.time.period.count).toBe(4);
    expect(parsed.config.money.currency).toBe('GBP');
    expect(parsed.config.stages.map(s => s.name)).toEqual(['Intake', 'Diagnose', 'Resolve', 'Review']);
    expect(parsed.config.lens.styles.map(s => s.name)).toEqual(['Directing', 'Guiding', 'Partnering', 'Entrusting']);
    expect(r.preview.dimensions.every(d => !d.reportOnly)).toBe(true);
    expect(guardDraft(r.storyline)).toEqual([]);
  });

  it('renames styles for the tone', async () => {
    const b = brief({ tone: 'warm' });
    const module = buildModule(b, { primary: 'readiness_based', secondary: 'six_styles', clientDimensions: [] }, true);
    const r = await new MockDrafter().draft({ brief: b, leadership_lens: module });
    expect(r.preview.styles.map(s => s.name)).toEqual(['Show the Way', 'Coach Along', 'Work Together', 'Hand Over']);
    expect(r.preview.dimensions.filter(d => d.reportOnly).map(d => d.name)).toEqual(['Style range', 'Contextual fit', 'Team climate impact']);
  });

  it('is deterministic', async () => {
    const b = brief();
    const module = buildModule(b, { primary: 'adaptive', secondary: null, clientDimensions: [] }, true);
    const [a, c] = await Promise.all([new MockDrafter().draft({ brief: b, leadership_lens: module }), new MockDrafter().draft({ brief: b, leadership_lens: module })]);
    expect(JSON.stringify(a)).toBe(JSON.stringify(c));
  });
});

describe('the participant side draft hook', () => {
  it('plays a valid stored draft, and falls back to Sales Elevator with a warning otherwise', async () => {
    expect(AUTHOR_KEY).toBe(DRAFT_KEY);
    const b = brief();
    const r = await new MockDrafter().draft({ brief: b, leadership_lens: buildModule(b, { primary: 'six_styles', secondary: null, clientDimensions: [] }, true) });
    const store = (v: string | null) => ({ getItem: (k: string) => (k === DRAFT_KEY ? v : null) });
    expect(storedDraft([store(JSON.stringify(r.storyline))])?.organisation).toBe('Acme Bank');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(storedDraft([store('{"id":"x"}')])).toBeNull();
    expect(storedDraft([store('not json')])).toBeNull();
    expect(storedDraft([undefined, store(null)])).toBeNull();
    expect(warn).toHaveBeenCalledTimes(3);
    expect(warn.mock.calls[0][0]).toMatch(/^Draft storyline not used, playing Sales Elevator: /);
    warn.mockRestore();
  });
});
