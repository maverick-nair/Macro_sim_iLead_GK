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

export default defineConfig({
  plugins: [react(), tailwindcss(), preloadFirstView()],
  build: {
    // Browsers with native light-dark(). A lower target makes the CSS minifier rewrite light-dark()
    // into variables that only resolve when color-scheme is set in a stylesheet, and the app sets it
    // at runtime, so every semantic color would break in production.
    cssTarget: ['chrome123', 'edge123', 'firefox120', 'safari17.5']
  },
  server: { port: 5173, host: true }
});
