import { strToU8, zipSync, type ZipOptions } from 'fflate';
import { parseStoryline } from '../engine/config';
import { imsManifest, ncName } from './manifest';
import { normalizeLms, type LmsSettings } from './settings';

/**
 * The SCORM packager (D200, D205), shared by GenieKreator in the browser and `npm run scorm` in Node: the
 * participant player's files (listed by the build in `player-manifest.json`), the storyline, the package's
 * own details, a package index.html and imsmanifest.xml, zipped. The SCORM runtime adapter is part of the
 * player's code. Nothing secret goes in: connected mode names a package id and the service, and the server
 * decides what that package may do (D206).
 */

/** What the build writes to `dist/player-manifest.json` (scripts/player-build.ts). */
export interface PlayerManifest {
  format: 1;
  /** A fingerprint of the player's files. */
  build: string;
  /** The folder the files are in, from the site root: `player/`. */
  base: string;
  /** The player's page within `base`, which becomes the package's index.html. */
  entry: string;
  /** Every file the participant player needs, within `base`, the entry included. */
  files: string[];
}

/** The package's own details, `ilead-package.json`: what the player reads at launch. */
export interface PackageInfo {
  format: 1;
  title: string;
  storylineId: string;
  /** SHA-256 of storyline.json as packaged: the same storyline in Preview has the same hash. */
  hash: string;
  /** The GenieKreator version the draft was packaged as (D207). */
  version: number;
  settings: LmsSettings;
  /** The engine's seed: a resumed run replays on the same one. */
  seed: number;
  player: string;
  builtAt: string;
  /** Connected mode only (D206). */
  service?: { url: string; packageId: string };
  /** The look the author chose in Brand, when it is not the default. */
  look?: 'light' | 'dark';
}

export const PACKAGE_INFO = 'ilead-package.json';
export const PACKAGE_STORYLINE = 'storyline.json';
/** Marks a page as a packaged player; `src/main.tsx` and the player entry boot package mode on it. */
export const PACKAGE_META = '<meta name="ilead-package" content="scorm">';

const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');

/** The storyline's content hash: SHA-256 of its JSON as packaged. Preview can compute the same to show they match. */
export async function contentHash(storylineJson: string): Promise<string> {
  return hex(await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(storylineJson)));
}

/** The storyline as packaged: compact JSON of exactly what GenieKreator exported. */
export const storylineJson = (storyline: unknown) => JSON.stringify(storyline);

export const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'simulation';

/** The package's index.html: the player's page with the package flag and the storyline's title. */
export function packageIndex(entryHtml: string, title: string): string {
  const esc = title.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const html = entryHtml.replace(/<title>[^<]*<\/title>/, `<title>${esc}</title>`);
  // After the charset, which must come first.
  const at = /<meta charset="utf-8" ?\/?>/i.test(html) ? /<meta charset="utf-8" ?\/?>/i : /<head>/i;
  return html.replace(at, m => `${m}\n    ${PACKAGE_META}`);
}

/** Already compressed formats are stored, the rest deflated. */
const STORED = /\.(png|webp|jpe?g|gif|woff2?|webm|mp4|mp3|zip)$/i;

export interface BuildPackageInput {
  /** The storyline as GenieKreator exports it (`toStoryline(draft).storyline`) or as a storyline file holds it. */
  storyline: unknown;
  settings: Partial<LmsSettings> | LmsSettings;
  version: number;
  player: PlayerManifest;
  /** Reads one of the player's files, by its path within the player's folder. */
  read: (path: string) => Promise<Uint8Array>;
  /** Connected mode: where the iLead service is. */
  serviceUrl?: string;
  look?: 'light' | 'dark';
  now?: Date;
}

export interface BuiltPackage { zip: Uint8Array; info: PackageInfo; name: string; files: string[] }

export class PackageError extends Error {
  constructor(message: string, readonly issues: string[] = []) { super(message); }
}

export async function buildPackage(input: BuildPackageInput): Promise<BuiltPackage> {
  const parsed = parseStoryline(input.storyline);
  if (!parsed.ok) throw new PackageError('The storyline does not play yet', parsed.issues);
  const config = parsed.config;
  const settings = normalizeLms(input.settings);
  const json = storylineJson(input.storyline);
  const hash = await contentHash(json);
  const packageId = `${config.id}-${hash.slice(0, 12)}`;
  const info: PackageInfo = {
    format: 1, title: config.name, storylineId: config.id, hash, version: input.version, settings, seed: 1, player: input.player.build,
    builtAt: (input.now ?? new Date()).toISOString(), ...(input.look ? { look: input.look } : {}),
    ...(settings.connected && input.serviceUrl ? { service: { url: input.serviceUrl.replace(/\/$/, ''), packageId } } : {})
  };
  const out: Record<string, [Uint8Array, ZipOptions]> = {};
  const put = (path: string, data: Uint8Array) => { out[path] = [data, { level: STORED.test(path) ? 0 : 6 }]; };
  const reads = await Promise.all(input.player.files.map(async f => [f, await input.read(f)] as const));
  for (const [f, data] of reads) {
    if (f === input.player.entry) put('index.html', strToU8(packageIndex(new TextDecoder().decode(data), config.name)));
    else put(f, data);
  }
  if (!out['index.html']) throw new PackageError(`The player's page ${input.player.entry} is missing from its file list`);
  put(PACKAGE_STORYLINE, strToU8(json));
  put(PACKAGE_INFO, strToU8(JSON.stringify(info, null, 2)));
  const files = Object.keys(out).sort();
  const skills = config.report.skills.map(s => ({ key: s.key, name: s.name }));
  put('imsmanifest.xml', strToU8(imsManifest({ identifier: ncName(packageId), title: config.name, settings, files: [...files], skills })));
  const zip = zipSync(Object.fromEntries(Object.entries(out).sort(([a], [b]) => (a === 'imsmanifest.xml' ? -1 : b === 'imsmanifest.xml' ? 1 : a.localeCompare(b)))), { mtime: input.now ?? new Date() });
  return { zip, info, files: ['imsmanifest.xml', ...files], name: `${slug(config.name)}-v${input.version}-${settings.version === 'scorm12' ? 'scorm12' : 'scorm2004'}.zip` };
}

/**
 * The browser's packager (GenieKreator): the player's files from this site, as the build listed them in
 * `/player-manifest.json`.
 */
export async function buildPackageFromSite(input: Omit<BuildPackageInput, 'player' | 'read'>, origin = globalThis.location.origin, fetchImpl: typeof fetch = (...a) => fetch(...a)): Promise<BuiltPackage> {
  const res = await fetchImpl(new URL('/player-manifest.json', origin), { cache: 'no-store' }).catch(() => null);
  if (!res?.ok) throw new PackageError('playerMissing');
  const player = await res.json() as PlayerManifest;
  const dir = player.base.replace(/^\/+|\/+$/g, '');
  const base = new URL(dir ? `/${dir}/` : '/', origin);
  const read = async (f: string) => {
    const r = await fetchImpl(new URL(f, base));
    if (!r.ok) throw new PackageError('playerMissing', [f]);
    return new Uint8Array(await r.arrayBuffer());
  };
  return buildPackage({ ...input, player, read });
}
