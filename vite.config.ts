import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * The engine contract (Zod) and the engine's English copy are not part of the first load's code: they
 * load beside the first view, which cannot be parsed before it arrives (D87). They are preloaded, so
 * they download with the first load instead of one round trip after it, but nothing compiles them into
 * the first load's long task.
 */
function preloadFirstView(): Plugin {
  const wanted = [/\/src\/engine\/contract\.ts/, /\/src\/i18n\/messages\/en\/engine\.json/];
  return {
    name: 'ilead-preload-first-view',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        if (!ctx.bundle) return;
        const files = new Set<string>();
        for (const chunk of Object.values(ctx.bundle)) {
          if (chunk.type !== 'chunk' || chunk.isEntry) continue;
          if (!Object.keys(chunk.modules).some(id => wanted.some(rx => rx.test(id)))) continue;
          files.add(chunk.fileName);
          for (const dep of chunk.imports) files.add(dep);
        }
        return [...files].filter(f => !html.includes(f)).map(f => ({ tag: 'link', attrs: { rel: 'modulepreload', crossorigin: '', href: `/${f}` }, injectTo: 'head' as const }));
      }
    }
  };
}

/** The engine's base path for index.html's early first view (D87): empty with the mock engine, so the script does nothing. */
function engineUrlInHtml(): Plugin {
  let url = '';
  return {
    name: 'ilead-engine-url-in-html',
    configResolved(c) { url = String(c.env.VITE_ILEAD_ENGINE_URL ?? ''); },
    transformIndexHtml: { order: 'pre', handler: html => html.replace('__ILEAD_ENGINE_URL__', url.replace(/['\\]/g, '')) }
  };
}

/** With `--mode server` (`npm run dev:full`) the dev server forwards the server's paths to it, so the app and the server share one origin and its cookie. */
const SERVER_PATHS = ['/api', '/engine', '/speech', '/genie', '/launch', '/auth', '/openapi.json', '/healthz', '/readyz'];

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(), preloadFirstView(), engineUrlInHtml()],
  build: {
    // Browsers with native light-dark(). A lower target makes the CSS minifier rewrite light-dark()
    // into variables that only resolve when color-scheme is set in a stylesheet, and the app sets it
    // at runtime, so every semantic color would break in production.
    cssTarget: ['chrome123', 'edge123', 'firefox120', 'safari17.5'],
    // Everything the first load imports statically goes in one chunk. Without this, modules the first
    // load shares with the lazy panels, tour and demo (D89 to D94) were split into many small chunks:
    // more requests and less compression on the first load (D101's budget note).
    rolldownOptions: { output: { codeSplitting: { groups: [{ name: 'app', tags: ['$initial'] }] } } }
  },
  server: {
    port: 5173, host: true,
    proxy: mode === 'server'
      ? Object.fromEntries(SERVER_PATHS.map(p => [p, { target: process.env.ILEAD_SERVER_URL ?? 'http://localhost:8787', changeOrigin: false }]))
      : undefined
  }
}));
