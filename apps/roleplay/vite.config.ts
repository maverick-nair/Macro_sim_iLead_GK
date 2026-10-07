import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

// Short commit id shown in the landing footer so anyone can tell which build they are looking at.
function buildId(): string {
  try {
    return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return "dev";
  }
}

// Two products, two entry pages: / is AI RolePlay (practice) and /assess/ is Conversation AI (assessment).
// FIGMA_PUBLIC_URL and PORT keep the Figma Make preview working; locally the dev server runs on 8443.
export default defineConfig({
  base: process.env.FIGMA_PUBLIC_URL ? `${process.env.FIGMA_PUBLIC_URL}/` : "/",
  plugins: [react(), tailwindcss()],
  define: { "import.meta.env.VITE_BUILD": JSON.stringify(buildId()) },
  build: {
    rollupOptions: {
      input: {
        roleplay: fileURLToPath(new URL("./index.html", import.meta.url)),
        assess: fileURLToPath(new URL("./assess/index.html", import.meta.url)),
      },
    },
  },
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  server: {
    host: process.env.FIGMA_DEV_SERVER_HOST || process.env.HOST || "0.0.0.0",
    port: Number(process.env.PORT || 8443),
    watch: { ignored: ["**/.figma/**"] },
    proxy: { "/api": `http://localhost:${process.env.ROLEPLAY_API_PORT || "8787"}` },
  },
  preview: { port: Number(process.env.PORT || 8443) },
});
