import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseStoryline, type StorylineConfig } from '../../src/engine/config';
import { configFromEnv } from '../src/env';

/** Shared bits of the quality gate scripts: arguments, the storyline, which providers run. */

export const ROOT = fileURLToPath(new URL('../../', import.meta.url));

export function args(argv = process.argv.slice(2)) {
  const valued = new Set(['--provider', '--only', '--out']);
  const get = (name: string) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : undefined; };
  return {
    storyline: argv.find((a, i) => !a.startsWith('--') && !valued.has(argv[i - 1])) ?? 'sales-elevator',
    provider: (get('provider') ?? 'all') as 'mock' | 'anthropic' | 'all',
    only: get('only')?.split(',').map(s => s.trim()).filter(Boolean),
    out: get('out'),
    verbose: argv.includes('--verbose')
  };
}

export function loadStoryline(id: string): StorylineConfig {
  const parsed = parseStoryline(JSON.parse(readFileSync(`${ROOT}src/engine/storylines/${id}.json`, 'utf8')));
  if (!parsed.ok) throw new Error(`Storyline ${id} does not parse:\n${parsed.issues.join('\n')}`);
  return parsed.config;
}

/** Providers to run: the mock always (unless only anthropic was asked), the real one when a key is set. */
export function providers(which: 'mock' | 'anthropic' | 'all'): Array<'mock' | 'anthropic'> {
  const out: Array<'mock' | 'anthropic'> = [];
  if (which !== 'anthropic') out.push('mock');
  if (which !== 'mock') {
    if (process.env.ANTHROPIC_API_KEY) out.push('anthropic');
    else console.log('Skipping the Anthropic provider: ANTHROPIC_API_KEY is not set. Set it to run this gate against the real model.\n');
  }
  return out;
}

export const env = () => configFromEnv(process.env);

export function save(path: string | undefined, data: unknown) {
  if (path) writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);
}
