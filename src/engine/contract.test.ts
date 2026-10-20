import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { IMAGE_BUDGET_BYTES } from './assets';
import { parseStoryline } from './config';
import { EngineView, Intent, IntentResult, MetricChange, Outcome } from './contract';
import { createEngine } from './sim/engine';
import { play } from './sim/policies';
import { neededStyles } from './sim/policies';
import salesElevator from './storylines/sales-elevator.json';

const parsed = parseStoryline(salesElevator);
if (!parsed.ok) throw new Error(parsed.issues.join('\n'));
const config = parsed.config;

const change = {
  subject: 'kent', metric: 'morale', from: 9, to: 17, delta: 8,
  reason: { label: '1:1 went well', cause: 'You listened - and asked for help.', rule: 'Lifts Morale 6-10.', evidence: [{ quote: 'I want to hear what is on your mind', by: 'You', judgedByAI: true }] }
};

describe('engine contract', () => {
  it('sanitizes engine text on the way in', () => {
    const c = MetricChange.parse(change);
    expect(c.reason.cause).toBe('You listened, and asked for help.');
    expect(c.reason.rule).toBe('Lifts Morale 6 to 10.');
  });

  it('rejects a change with no reason', () => {
    const { reason: _, ...bare } = change;
    expect(MetricChange.safeParse(bare).success).toBe(false);
  });

  it('caps what changed at two lines', () => {
    const o = { id: 'o1', actionKey: 'f2f', headline: 'h', reply: 'r', affected: [], reactions: {}, changes: [change], ripple: null, changed: ['a', 'b', 'c'] };
    expect(Outcome.safeParse(o).success).toBe(false);
  });

  it('validates intents', () => {
    expect(Intent.safeParse({ type: 'confirmStyles', styles: { kent: 'G' } }).success).toBe(true);
    // Style keys come from the lens (D70): the contract checks their shape, the engine checks the lens.
    expect(Intent.safeParse({ type: 'confirmStyles', styles: { kent: 'coach' } }).success).toBe(true);
    expect(Intent.safeParse({ type: 'confirmStyles', styles: { kent: 'not a key' } }).success).toBe(false);
    expect(Intent.safeParse({ type: 'confirmStyles', styles: { kent: '' } }).success).toBe(false);
    expect(Intent.safeParse({ type: 'submitInteraction', interactionId: 'i1', text: '' }).success).toBe(false);
  });

  it('accepts everything the engine produces, from first view to the end of a run', async () => {
    const e = createEngine(config, { seed: 1 });
    expect(EngineView.safeParse(e.view()).error?.issues ?? []).toEqual([]);
    const storyline = EngineView.parse(e.view()).storyline;
    expect({ ...storyline, products: storyline.products.map(p => p.code) }).toEqual({ locale: 'en', name: 'Sales Elevator, Innov8 Elevators', organisation: 'Innov8 Elevators', video: null, brand: null, logo: null, office: null, products: ['B10', 'H4', 'P20', 'C30'], screens: [] });
    expect(EngineView.parse(e.view()).sponsor).toMatchObject({ name: 'Paula Jacob', title: 'Regional Sales Director' });
    const styles = await neededStyles(e);
    expect(IntentResult.safeParse(await e.dispatch({ type: 'confirmStyles', styles })).error?.issues ?? []).toEqual([]);
    const a = await e.dispatch({ type: 'planAction', action: 'f2f', memberIds: ['kent'] });
    const r = await e.dispatch({ type: 'submitInteraction', interactionId: a.interactionId!, text: 'Here is the plan, step by step. What is getting in the way?' });
    expect(IntentResult.safeParse(r).error?.issues ?? []).toEqual([]);
    const end = await play(config, 'random', 3);
    expect(EngineView.safeParse(end.view).error?.issues ?? []).toEqual([]);
  });

  it('exposes the storyline\'s brand, logo, office, products and intro screens for the player (D181 to D183)', () => {
    const PIXEL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
    const intro = { welcome: ['Welcome.'], product: ['The product.'], targets: ['The targets.'], screens: [{ key: 'welcome', title: 'Welcome letter', body: ['Welcome.'] }, { key: 'site_visit', title: 'Site visit', body: [] }] };
    const p = parseStoryline({
      ...salesElevator, intro, brand: { name: 'Innov8', colors: { main: '#0B5FFF', second: '#00A3A3' }, logo: PIXEL, font: 'Lato', mode: 'light' },
      world: { office: { image: '/assets/bg-2.webp' }, logo: { image: PIXEL, text: 'I8' }, products: [{ name: 'Glide 3', line: 'A quiet lift.', specs: ['Eight floors'], image: PIXEL }] }
    });
    if (!p.ok) throw new Error(p.issues.join('\n'));
    const v = EngineView.parse(createEngine(p.config, { seed: 1 }).view());
    expect(v.storyline.intro).toEqual({ welcome: ['Welcome.'], product: ['The product.'], targets: ['The targets.'] });
    expect(v.storyline.brand).toEqual({ name: 'Innov8', colors: { main: '#0B5FFF', second: '#00A3A3' }, logo: PIXEL, font: 'Lato', mode: 'light' });
    expect(v.storyline.logo).toEqual({ image: PIXEL, text: 'I8' });
    expect(v.storyline.office).toBe('/assets/bg-2.webp');
    expect(v.storyline.products).toEqual([{
      name: 'Glide 3', line: 'A quiet lift.', specs: ['Eight floors'], image: PIXEL, view: 'photo',
      code: null, kind: null, tagline: null, audience: null, dealValue: null, imageAlt: null, features: []
    }]);
    expect(v.storyline.screens.map(s => s.title)).toEqual(['Welcome letter', 'Site visit']);
  });

  it('refuses an embedded image over the budget, with a clear message', () => {
    const big = `data:image/png;base64,${'A'.repeat(420_000)}`;
    const p = parseStoryline({ ...salesElevator, world: { office: { image: big } } });
    expect(p.ok ? [] : p.issues).toEqual([expect.stringMatching(/^world\.office\.image: The image is \d+ KB, over the 300 KB an uploaded image may be/)]);
  });

  it('carries Sales Elevator\'s portfolio from the canvas: four models, four placed features each, photos on this site within the image budget (D221)', () => {
    const r = parseStoryline(salesElevator);
    if (!r.ok) throw new Error(r.issues.join('\n'));
    const products = r.config.world?.products ?? [];
    expect(products.map(p => [p.code, p.kind, p.dealValue])).toEqual([['B10', 'Commercial', 30000], ['H4', 'Residential', 18000], ['P20', 'Panoramic', 65000], ['C30', 'Service and freight', 42000]]);
    for (const p of products) {
      expect(p.features.map(f => f.title)).toEqual([expect.any(String), expect.any(String), 'Who buys it', 'Winning the deal']);
      expect(p.features.every(f => f.spot && f.spot.x >= 0 && f.spot.x <= 100 && f.spot.y >= 0 && f.spot.y <= 100)).toBe(true);
      // Stand ins on this site: a library path costs the storyline nothing, and each is under what one upload may weigh.
      expect(p.image).toMatch(/^\/assets\/products\/lift-[a-z0-9]+\.jpg$/);
      expect(fs.statSync(`public${p.image}`).size).toBeLessThan(IMAGE_BUDGET_BYTES);
    }
  });
});
