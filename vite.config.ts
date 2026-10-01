import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    // Browsers with native light-dark(). A lower target makes the CSS minifier rewrite light-dark()
    // into variables that only resolve when color-scheme is set in a stylesheet, and the app sets it
    // at runtime, so every semantic color would break in production.
    cssTarget: ['chrome123', 'edge123', 'firefox120', 'safari17.5']
  },
  server: { port: 5173, host: true }
});
