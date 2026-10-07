import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/** With `--mode server` (`npm run dev:full`) the dev server forwards the server's paths to it, so the app and the server share one origin and its cookie. */
const SERVER_PATHS = ['/api', '/engine', '/speech', '/genie', '/launch', '/auth', '/openapi.json', '/healthz', '/readyz'];

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss()],
  build: {
    // Browsers with native light-dark(). A lower target makes the CSS minifier rewrite light-dark()
    // into variables that only resolve when color-scheme is set in a stylesheet, and the app sets it
    // at runtime, so every semantic color would break in production.
    cssTarget: ['chrome123', 'edge123', 'firefox120', 'safari17.5']
  },
  server: {
    port: 5173, host: true,
    proxy: mode === 'server'
      ? Object.fromEntries(SERVER_PATHS.map(p => [p, { target: process.env.ILEAD_SERVER_URL ?? 'http://localhost:8787', changeOrigin: false }]))
      : undefined
  }
}));
