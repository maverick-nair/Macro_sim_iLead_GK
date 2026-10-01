// tsx probe.ts <frameId> <css selector inside frame> : compares computed styles proto vs app
import fs from 'node:fs'; import path from 'node:path'; import http from 'node:http';
import { chromium } from '@playwright/test'; import { createServer } from 'vite';
const root = '/home/claude/repo', deps = path.join(root, '.visual-cache/deps/node_modules');
const [id, sel, ...props] = process.argv.slice(2);
const srv = http.createServer((q, r) => { const f = path.join(root, 'project', decodeURIComponent(new URL(q.url!, 'http://x').pathname)); fs.existsSync(f) && fs.statSync(f).isFile() ? r.writeHead(200, { 'Content-Type': f.endsWith('.html') ? 'text/html' : f.endsWith('.js') ? 'text/javascript' : f.endsWith('.css') ? 'text/css' : '' }).end(fs.readFileSync(f)) : r.writeHead(404).end(); }).listen(8011);
const vite = await createServer({ root, server: { port: 8012 }, logLevel: 'error' }); await vite.listen();
const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1600, height: 1000 } });
await ctx.route('https://unpkg.com/**', r => { const u = r.request().url(); r.fulfill({ body: fs.readFileSync(path.join(deps, u.includes('react-dom') ? 'react-dom/umd/react-dom.production.min.js' : u.includes('babel') ? '@babel/standalone/babel.min.js' : 'react/umd/react.production.min.js')), contentType: 'text/javascript' }); });
const P = ['display','width','height','padding','font-size','font-weight','line-height','border','background-color','color','cursor','white-space','font-family','letter-spacing', ...props];
async function grab(url: string) { const p = await ctx.newPage(); await p.goto(url); await p.waitForTimeout(3000);
  return p.$$eval(`[id="${id}"] ${sel}`, (els, P) => els.slice(0, 3).map(e => { const cs = getComputedStyle(e); const r = e.getBoundingClientRect(); return { box: `${r.width.toFixed(2)}x${r.height.toFixed(2)}`, pos: `${(r.x - (e.closest(".dv-card") as Element).getBoundingClientRect().x).toFixed(2)},${(r.y - (e.closest(".dv-card") as Element).getBoundingClientRect().y).toFixed(2)}`, ...Object.fromEntries((P as string[]).map(k => [k, cs.getPropertyValue(k)])) }; }), P); }
const a = await grab(`http://localhost:8011/${encodeURIComponent(id.startsWith('z') ? 'iLead States.dc.html' : 'iLead Screens.dc.html')}`);
const c = await grab(`http://localhost:8012/${id.startsWith('z') ? 'states' : 'screens'}`);
for (let i = 0; i < Math.max(a.length, c.length); i++) for (const k of Object.keys(a[i] ?? c[i])) { const x = (a[i] as Record<string,string>)?.[k], y = (c[i] as Record<string,string>)?.[k]; if (x !== y) console.log(i, k, '| proto:', x, '| app:', y); }
console.log('compared', a.length, c.length); await b.close(); await vite.close(); srv.close();
