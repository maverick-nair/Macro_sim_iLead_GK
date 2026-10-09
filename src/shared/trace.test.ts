import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { StorylineConfig } from '../engine/config';
import { NAV } from '../author/ui/sections';
import { ancestors, INTERNAL, pathsFor, SURFACES, surfacesFor, TRACE, traceOf, type Surface } from './trace';

/** Strips optional, nullable, default and transform wrappers down to the schema that describes the value. */
function unwrap(s: z.ZodType): z.ZodType {
  let at: z.ZodType = s;
  for (let i = 0; i < 12; i++) {
    if (at instanceof z.ZodOptional || at instanceof z.ZodNullable || at instanceof z.ZodDefault) at = at.unwrap() as z.ZodType;
    else if (at instanceof z.ZodPipe) at = at.in as z.ZodType;
    else break;
  }
  return at;
}

/** Every field of the schema, objects walked into, lists of objects as `[]`; records, unions, tuples and scalars are leaves. */
function leaves(s: z.ZodType, path = '', out: string[] = []): string[] {
  const u = unwrap(s);
  if (u instanceof z.ZodObject) for (const [k, v] of Object.entries(u.shape as Record<string, z.ZodType>)) leaves(v, path ? `${path}.${k}` : k, out);
  else if (u instanceof z.ZodArray && unwrap(u.element as z.ZodType) instanceof z.ZodObject) leaves(u.element as z.ZodType, `${path}[]`, out);
  else out.push(path);
  return out;
}

const ALL = leaves(StorylineConfig);
const KNOWN = new Set(ALL.flatMap(ancestors));

describe('traceability registry (D180)', () => {
  it('walks a schema of hundreds of fields', () => {
    expect(ALL.length).toBeGreaterThan(500);
  });

  it('traces every StorylineConfig field, or lists it as internal with a reason', () => {
    const covered = (p: string) => ancestors(p).some(a => a in TRACE || a in INTERNAL);
    expect(ALL.filter(p => !covered(p))).toEqual([]);
    for (const [p, r] of Object.entries(INTERNAL)) expect(r.reason.trim().length, p).toBeGreaterThan(10);
  });

  it('names only paths the schema has, never one both traced and internal', () => {
    expect([...Object.keys(TRACE), ...Object.keys(INTERNAL)].filter(p => !KNOWN.has(p))).toEqual([]);
    expect(Object.keys(TRACE).filter(p => p in INTERNAL)).toEqual([]);
  });

  it('names only GenieKreator sections that exist, and known surfaces with a description', () => {
    const tabs = new Set(NAV.map(n => n.tab));
    expect(Object.entries(TRACE).filter(([, t]) => !tabs.has(t.section)).map(([p]) => p)).toEqual([]);
    expect(Object.entries(TRACE).filter(([, t]) => !t.surfaces.length || t.surfaces.some(s => !(s in SURFACES))).map(([p]) => p)).toEqual([]);
    expect(Object.values(SURFACES).every(d => d.length > 10 && !/[‒-―]/.test(d))).toBe(true);
  });

  it('gives every authoring section a participant impact, and every surface a source', () => {
    for (const s of ['overview', 'brief', 'story', 'process', 'team', 'lens', 'actions', 'events', 'scoring', 'brand', 'publish'] as const) expect(surfacesFor(s).length, s).toBeGreaterThan(0);
    const reached = new Set(Object.values(TRACE).flatMap(t => t.surfaces));
    const sourceless = (Object.keys(SURFACES) as Surface[]).filter(s => !reached.has(s));
    // Defaults the engine words until GenieKreator authors them (PRODUCT.md, trace gaps).
    expect(sourceless.sort()).toEqual(['onboarding.practice', 'onboarding.tour', 'onboarding.video'].sort());
  });

  it('reads concrete paths and patterns, closest entry first', () => {
    expect(traceOf('members.3.portrait')).toMatchObject({ section: 'team', path: 'members[].portrait' });
    expect(traceOf('world.products[].specs')).toMatchObject({ section: 'story', path: 'world.products[]' });
    expect(traceOf('brand.colors.main')).toMatchObject({ section: 'brand', label: 'Main and second colour', surfaces: ['theme.colors'] });
    expect(traceOf('members[].id')).toBeNull();
    expect(traceOf('nothing.here')).toBeNull();
    expect(pathsFor('theme.backdrop')).toEqual(['world.office.image']);
    expect(surfacesFor('publish')).toEqual(['lms.record']);
  });
});
