import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { inlineScriptHashes } from '../src/routes/ops';
import { testServer, type TestServer } from './helpers';

const early = "\n      (function () { var url = '/engine'; window.__ileadEarlyView = null; })();\n    ";
const html = `<!doctype html><html><head><script>${early}</script><script type="module" src="/assets/index.js"></script></head><body><div id="root"></div></body></html>`;
const sha = (s: string) => `'sha256-${createHash('sha256').update(s, 'utf8').digest('base64')}'`;

function staticDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ilead-csp-'));
  fs.writeFileSync(path.join(dir, 'index.html'), html);
  return dir;
}

describe('the content security policy and index.html', () => {
  let s: TestServer | undefined;
  afterEach(async () => { await s?.close(); s = undefined; });

  it('hashes each inline script exactly as served and skips scripts loaded by src', () => {
    expect(inlineScriptHashes(staticDir())).toEqual([sha(early)]);
  });

  it('has no hashes without a static build', () => {
    expect(inlineScriptHashes(undefined)).toEqual([]);
    expect(inlineScriptHashes(path.join(os.tmpdir(), 'ilead-no-such-dir'))).toEqual([]);
  });

  it('allows index.html\'s inline script by its hash, never by unsafe-inline', async () => {
    s = await testServer({ env: { STATIC_DIR: staticDir() } });
    const res = await s.req('/');
    const csp = res.headers.get('content-security-policy') ?? '';
    const scriptSrc = csp.split(';').map(d => d.trim()).find(d => d.startsWith('script-src')) ?? '';
    expect(scriptSrc).toBe(`script-src 'self' ${sha(early)}`);
    expect(csp).not.toMatch(/script-src[^;]*unsafe-inline/);
  });
});
