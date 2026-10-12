import { strFromU8, strToU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import salesElevator from '../engine/storylines/sales-elevator.json';
import { manifest12, manifest2004, ncName } from './manifest';
import { buildPackage, buildPackageFromSite, contentHash, PACKAGE_META, packageIndex, PackageError, storylineJson, type PlayerManifest } from './package';
import { DEFAULT_LMS, lmsSettingsOf, normalizeLms } from './settings';

const ENTRY = '<!doctype html>\n<html lang="en">\n  <head>\n    <meta charset="utf-8" />\n    <title>Simulation</title>\n    <script type="module" src="./assets/player.js"></script>\n  </head>\n  <body><div id="root"></div></body>\n</html>\n';
const PLAYER: PlayerManifest = { format: 1, build: 'b1', base: 'player/', entry: 'player.html', files: ['player.html', 'assets/player.js', 'player.css', 'assets/npc/kent.webp'] };
const FILES: Record<string, Uint8Array> = { 'player.html': strToU8(ENTRY), 'assets/player.js': strToU8('console.log(1)'), 'player.css': strToU8('body{}'), 'assets/npc/kent.webp': new Uint8Array([1, 2, 3]) };
const read = async (f: string) => FILES[f];

/** A well formed XML document: every tag closed in order (the manifests have no comments, CDATA or entities beyond the five). */
function wellFormed(x: string) {
  const stack: string[] = [];
  for (const m of x.replace(/<\?xml[^>]*\?>/, '').matchAll(/<(\/?)([A-Za-z_][\w:.-]*)[^>]*?(\/?)>/g)) {
    if (m[1]) { if (stack.pop() !== m[2]) return false; } else if (!m[3]) stack.push(m[2]);
  }
  return stack.length === 0;
}

describe('settings', () => {
  it('defaults, and reads a storyline\'s lms block defensively in either shape', () => {
    expect(lmsSettingsOf({})).toEqual(DEFAULT_LMS);
    expect(lmsSettingsOf(null)).toEqual(DEFAULT_LMS);
    expect(lmsSettingsOf({ lms: { version: 'scorm12', completion: 'weeks', weeks: 4, pass: 'score', threshold: 75, connected: true } }))
      .toEqual({ version: 'scorm12', completion: { kind: 'weeks', weeks: 4 }, pass: { kind: 'score', min: 75 }, connected: true });
    expect(normalizeLms({ version: 'scorm3', pass: { kind: 'score', min: 400 }, completion: { kind: 'weeks', weeks: 0 } }))
      .toEqual({ version: 'scorm2004', completion: { kind: 'weeks', weeks: 1 }, pass: { kind: 'score', min: 100 }, connected: false });
  });
});

describe('imsmanifest.xml', () => {
  const input = { identifier: '1 bad id', title: 'Sales & <Elevator>', settings: normalizeLms({ version: 'scorm12', pass: { kind: 'score', min: 70 } }), files: ['index.html', 'assets/a b.js'], skills: [{ key: 'coaching', name: 'Coaching' }] };
  it('SCORM 1.2: the 1.2 schemas, one SCO launching index.html, every file, and the mastery score for a score pass', () => {
    const x = manifest12(input);
    expect(wellFormed(x)).toBe(true);
    expect(x).toContain('xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"');
    expect(x).toContain('xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2"');
    expect(x).toContain('<schemaversion>1.2</schemaversion>');
    expect(x).toContain('identifier="_1_bad_id"');
    expect(x).toContain('<title>Sales &amp; &lt;Elevator&gt;</title>');
    expect(x).toMatch(/<resource identifier="sco" type="webcontent" adlcp:scormtype="sco" href="index.html">/);
    expect(x).toContain('<file href="assets/a b.js"/>');
    expect(x).toContain('<adlcp:masteryscore>70</adlcp:masteryscore>');
    expect(manifest12({ ...input, settings: normalizeLms({ version: 'scorm12' }) })).not.toContain('masteryscore');
  });
  it('SCORM 2004 4th edition: its schemas, scormType, content set completion and objectives, one per skill', () => {
    const x = manifest2004({ ...input, settings: normalizeLms({}) });
    expect(wellFormed(x)).toBe(true);
    expect(x).toContain('xmlns="http://www.imsglobal.org/xsd/imscp_v1p1"');
    expect(x).toContain('xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_v1p3"');
    expect(x).toContain('xmlns:imsss="http://www.imsglobal.org/xsd/imsss"');
    expect(x).toContain('<schemaversion>2004 4th Edition</schemaversion>');
    expect(x).toContain('adlcp:scormType="sco" href="index.html"');
    expect(x).toContain('<imsss:primaryObjective objectiveID="leadership_score" satisfiedByMeasure="false"/>');
    expect(x).toContain('<imsss:objective objectiveID="coaching"/>');
    expect(x).toContain('completionSetByContent="true" objectiveSetByContent="true"');
    expect(x).not.toContain('masteryscore');
  });
  it('ids are XML names', () => {
    expect(ncName('sales_elevator-abc')).toBe('sales_elevator-abc');
    expect(ncName('9 lives')).toBe('_9_lives');
  });
});

describe('the package', () => {
  it('holds the player, the storyline, its details, the flagged index.html and the manifest', async () => {
    const built = await buildPackage({ storyline: salesElevator, settings: { version: 'scorm12', pass: { kind: 'score', min: 60 } }, version: 4, player: PLAYER, read, now: new Date('2026-10-09T10:00:00Z'), look: 'light' });
    const files = unzipSync(built.zip);
    expect(Object.keys(files).sort()).toEqual(['assets/npc/kent.webp', 'assets/player.js', 'ilead-package.json', 'imsmanifest.xml', 'index.html', 'player.css', 'storyline.json']);
    expect(built.name).toBe('sales-elevator-innov8-elevators-v4-scorm12.zip');
    const index = strFromU8(files['index.html']);
    expect(index).toContain(`<meta charset="utf-8" />\n    ${PACKAGE_META}`);
    expect(index).toContain('<title>Sales Elevator, Innov8 Elevators</title>');
    // The storyline exactly as exported, and its hash: the same as Preview computes from the same export.
    expect(strFromU8(files['storyline.json'])).toBe(storylineJson(salesElevator));
    const info = JSON.parse(strFromU8(files['ilead-package.json']));
    expect(info).toMatchObject({ title: 'Sales Elevator, Innov8 Elevators', storylineId: 'sales_elevator', version: 4, seed: 1, player: 'b1', look: 'light', settings: { version: 'scorm12', pass: { kind: 'score', min: 60 }, connected: false } });
    expect(info.hash).toBe(await contentHash(storylineJson(salesElevator)));
    expect(info.service).toBeUndefined();
    const manifest = strFromU8(files['imsmanifest.xml']);
    expect(manifest).toContain('<adlcp:masteryscore>60</adlcp:masteryscore>');
    for (const f of Object.keys(files).filter(f => f !== 'imsmanifest.xml')) expect(manifest).toContain(`<file href="${f}"/>`);
  });

  it('connected mode names the service and the package, never a secret', async () => {
    const built = await buildPackage({ storyline: salesElevator, settings: { connected: true }, version: 1, player: PLAYER, read, serviceUrl: 'https://ilead.example.com/' });
    expect(built.info.service).toEqual({ url: 'https://ilead.example.com', packageId: `sales_elevator-${built.info.hash.slice(0, 12)}` });
    expect(built.info.settings.version).toBe('scorm2004');
  });

  it('refuses a storyline that does not play, with its issues', async () => {
    const e = await buildPackage({ storyline: { id: 'x' }, settings: {}, version: 1, player: PLAYER, read }).catch(x => x);
    expect(e).toBeInstanceOf(PackageError);
    expect((e as PackageError).issues.length).toBeGreaterThan(0);
  });

  it('in the browser, reads the player from this site as the build listed it', async () => {
    const seen: string[] = [];
    const fetchImpl = (async (url: URL) => {
      seen.push(url.pathname);
      if (url.pathname === '/player-manifest.json') return new Response(JSON.stringify(PLAYER));
      const f = FILES[url.pathname.replace(/^\/player\//, '')];
      return f ? new Response(f as Uint8Array<ArrayBuffer>) : new Response('no', { status: 404 });
    }) as unknown as typeof fetch;
    const built = await buildPackageFromSite({ storyline: salesElevator, settings: {}, version: 2 }, 'https://ilead.example.com', fetchImpl);
    expect(built.files).toContain('index.html');
    expect(seen).toContain('/player/assets/player.js');
    const missing = await buildPackageFromSite({ storyline: salesElevator, settings: {}, version: 2 }, 'https://ilead.example.com', (async () => new Response('', { status: 404 })) as unknown as typeof fetch).catch(x => x);
    expect((missing as Error).message).toBe('playerMissing');
  });

  it('the index flag goes after the charset, or in the head without one', () => {
    expect(packageIndex('<html><head><title>a</title></head></html>', 'T')).toBe(`<html><head>\n    ${PACKAGE_META}<title>T</title></head></html>`);
  });
});
