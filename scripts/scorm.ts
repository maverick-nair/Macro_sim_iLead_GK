import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildPackage, PackageError, type PlayerManifest } from '../src/lms/package';
import { lmsSettingsOf, normalizeLms, type LmsSettings } from '../src/lms/settings';

/**
 * `npm run scorm -- <storyline.json> --version scorm12|scorm2004 --out file.zip` (D205): a SCORM package of a
 * storyline file, from the player the last build left in dist (`npm run build` or `npm run build:player`).
 * Options: `--completion finish|weeks:N`, `--pass none|score:N|level:N`, `--package-version N` (the
 * GenieKreator version to record), `--dist <folder>` (default dist), `--connected <service url>`.
 * Without options the storyline's own LMS settings apply, else the defaults.
 */
export interface ScormArgs { storyline: string; out?: string; dist: string; settings: Partial<LmsSettings> & Record<string, unknown>; version: number; service?: string }

export function parseArgs(argv: string[]): ScormArgs {
  const rest: string[] = [];
  const opts: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const [k, v] = a.slice(2).split('=');
      opts[k] = v ?? argv[++i] ?? '';
    } else rest.push(a);
  }
  if (!rest[0]) throw new Error('Name the storyline file: npm run scorm -- <storyline.json> --version scorm2004 --out package.zip');
  const settings: ScormArgs['settings'] = {};
  if (opts.version) {
    if (!['scorm12', 'scorm2004'].includes(opts.version)) throw new Error('--version is scorm12 or scorm2004');
    settings.version = opts.version as LmsSettings['version'];
  }
  if (opts.completion) {
    const [kind, n] = opts.completion.split(':');
    settings.completion = kind === 'weeks' ? { kind: 'weeks', weeks: Number(n) } : { kind: 'finish' };
  }
  if (opts.pass) {
    const [kind, n] = opts.pass.split(':');
    settings.pass = kind === 'score' || kind === 'level' ? { kind, min: Number(n) } : { kind: 'none' };
  }
  if (opts.connected) settings.connected = true;
  return { storyline: rest[0], out: opts.out, dist: opts.dist ?? 'dist', settings, version: Number(opts['package-version'] ?? 1) || 1, service: opts.connected || undefined };
}

export async function scorm(args: ScormArgs) {
  const raw = JSON.parse(fs.readFileSync(args.storyline, 'utf8')) as unknown;
  const manifestPath = path.join(args.dist, 'player-manifest.json');
  if (!fs.existsSync(manifestPath)) throw new Error(`${manifestPath} is missing: run npm run build:player (or npm run build) first`);
  const player = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as PlayerManifest;
  const dir = path.join(args.dist, player.base);
  const settings = normalizeLms({ ...lmsSettingsOf(raw), ...args.settings });
  const built = await buildPackage({ storyline: raw, settings, version: args.version, player, read: async f => new Uint8Array(fs.readFileSync(path.join(dir, f))), serviceUrl: args.service });
  const out = args.out ?? built.name;
  fs.writeFileSync(out, built.zip);
  return { out, ...built };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const r = await scorm(parseArgs(process.argv.slice(2)));
    console.log(`${r.out}: ${r.info.settings.version === 'scorm12' ? 'SCORM 1.2' : 'SCORM 2004 4th edition'}, ${r.info.title}, version ${r.info.version}, ${r.files.length} files, ${(r.zip.length / 1024 / 1024).toFixed(1)} MB, hash ${r.info.hash.slice(0, 12)}`);
  } catch (e) {
    console.error(e instanceof PackageError ? `${e.message}:\n${e.issues.join('\n')}` : (e as Error).message);
    process.exit(1);
  }
}
