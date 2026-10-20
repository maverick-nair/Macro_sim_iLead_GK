import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { build, type InlineConfig, type Plugin } from 'vite';
import type { PlayerManifest } from '../src/lms/package.ts';

/**
 * The packaged participant player (D200, D205): `player.html` and `src/lms/entry.tsx` built with relative
 * paths into `<out>/player`, and `<out>/player-manifest.json` listing what a SCORM package needs from it.
 * Every `vite build` runs it after the site's own build (`playerBuild()` in vite.config.ts), so the site
 * GenieKreator runs on always serves the player it packages. `npm run build:player` builds it alone.
 */
export const PLAYER_DIR = 'player';

/** Site files the player never shows: the design prototype's PNG backdrops and the TTF copies of the web fonts. */
const EXCLUDE = [/^assets\/before-board\.png$/, /^assets\/bg-\d\.png$/, /^fonts\/.+\.ttf$/, /\.map$/];

/**
 * The site's code names its public files from the site root (`/assets/npc/placeholder.svg`, `/fonts/...`).
 * A package lives in a folder of the LMS, so in the player's build those become relative to its page.
 */
export function relativeSitePaths(): Plugin {
  return {
    name: 'ilead-player-relative-paths',
    enforce: 'pre',
    transform(code, id) {
      if (!/\/src\/.+\.(tsx?|json)$/.test(id.split('?')[0]) || !/["'`(]\/(assets|fonts)\//.test(code)) return null;
      return { code: code.replace(/(["'`(])\/(assets|fonts)\//g, '$1./$2/'), map: null };
    }
  };
}

export function playerConfig(outDir: string, root = process.cwd()): InlineConfig {
  return {
    configFile: false, root, base: './', mode: 'production', logLevel: 'warn',
    // The package never points at an iLead server by build settings: its VITE_ variables stay out (D206).
    envPrefix: 'ILEAD_PLAYER_',
    plugins: [react(), tailwindcss(), relativeSitePaths()],
    build: {
      outDir, emptyOutDir: true,
      // The player's main chunk carries the engine: a package loads from the LMS once, not over a first visit's budget.
      chunkSizeWarningLimit: 1000,
      // As the site's build (vite.config.ts): browsers with native light-dark().
      cssTarget: ['chrome123', 'edge123', 'firefox120', 'safari17.5'],
      rolldownOptions: {
        input: path.join(root, 'player.html'),
        // Stylesheets sit beside the page: a url() in a custom property (the office backdrop) resolves against
        // the page where the property is used, so a relative path must mean the same from both.
        output: { assetFileNames: a => (a.names.some(n => n.endsWith('.css')) ? '[name]-[hash][extname]' : 'assets/[name]-[hash][extname]') }
      }
    }
  };
}

function walk(dir: string, base = dir): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p, base) : [path.relative(base, p).split(path.sep).join('/')];
  });
}

/** Builds the player into `<outRoot>/player` and writes `<outRoot>/player-manifest.json`. */
export async function buildPlayer(outRoot = 'dist', root = process.cwd()): Promise<PlayerManifest> {
  const outDir = path.resolve(root, outRoot, PLAYER_DIR);
  await build(playerConfig(outDir, root));
  const files = walk(outDir).filter(f => !EXCLUDE.some(rx => rx.test(f))).sort();
  const hash = crypto.createHash('sha256');
  for (const f of files) hash.update(f).update(fs.readFileSync(path.join(outDir, f)));
  const manifest: PlayerManifest = { format: 1, build: hash.digest('hex').slice(0, 16), base: `${PLAYER_DIR}/`, entry: 'player.html', files };
  fs.writeFileSync(path.resolve(root, outRoot, 'player-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

/** For vite.config.ts: after the site's build, the player's, into the same output folder. */
export function playerBuild(): Plugin {
  let outDir = 'dist';
  let root = process.cwd();
  return {
    name: 'ilead-player-build',
    apply: 'build',
    configResolved(c) { outDir = c.build.outDir; root = c.root; },
    closeBundle: { sequential: true, order: 'post', async handler() { await buildPlayer(path.relative(root, path.resolve(root, outDir)) || '.', root); } }
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const m = await buildPlayer(process.argv[2] ?? 'dist');
  console.log(`Player ${m.build}: ${m.files.length} files in ${process.argv[2] ?? 'dist'}/${PLAYER_DIR}`);
}
