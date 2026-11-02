// @ts-check
import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

/** Packages that must stay pure and deterministic (CLAUDE.md architecture rule 2). */
const PURE_SOURCES = [
  "packages/schema/src/**/*.ts",
  "packages/seed-ilead/src/**/*.ts",
  "packages/engine/src/**/*.ts",
];

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.next/**",
      "**/coverage/**",
      "packages/schema/generated/**",
      "docs/source/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.node } },
    rules: {
      "@typescript-eslint/consistent-type-imports": ["error", { fixStyle: "inline-type-imports" }],
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", ignoreRestSiblings: true },
      ],
      eqeqeq: ["error", "always"],
      "no-console": "off",
    },
  },
  {
    files: PURE_SOURCES,
    languageOptions: { globals: {} },
    rules: {
      "no-restricted-globals": [
        "error",
        { name: "Date", message: "The engine is deterministic: pass time in as data." },
        { name: "process", message: "No environment access in pure packages." },
        { name: "fetch", message: "No network in pure packages." },
        { name: "setTimeout", message: "No timers in pure packages." },
        { name: "setInterval", message: "No timers in pure packages." },
        { name: "performance", message: "No clocks in pure packages." },
        { name: "crypto", message: "Use the seeded RNG stored in state." },
      ],
      "no-restricted-properties": [
        "error",
        { object: "Math", property: "random", message: "Use the seeded RNG stored in state." },
      ],
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["node:*", "fs", "path", "os", "http", "https", "child_process"],
              message: "No Node APIs in pure packages.",
            },
            { group: ["react", "react-dom", "next", "next/*"], message: "No UI code in pure packages." },
            {
              group: ["@prisma/*", "@gk/db", "@gk/ai", "@anthropic-ai/*"],
              message: "No database or AI adapters in pure packages.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["**/test/**/*.ts"],
    rules: { "@typescript-eslint/no-non-null-assertion": "off" },
  },
);
