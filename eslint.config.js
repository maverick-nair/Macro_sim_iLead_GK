import js from '@eslint/js';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/** Lint for the app: TypeScript, the rules of hooks, and JSX accessibility. `npm run lint`. */
export default tseslint.config(
  { ignores: ['dist', 'dist-server', 'data', 'storybook-static', 'test-results', 'playwright-report', '.claude', 'project', 'chats', 'docs', 'calibration', '.visual-cache', 'node_modules', 'src/styles/*.generated.*'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    plugins: { 'react-hooks': reactHooks, 'jsx-a11y': jsxA11y },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // React Compiler checks: this build does not run the compiler, so they advise rather than block.
      'react-hooks/refs': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      ...jsxA11y.configs.recommended.rules,
      // Scrollable logs and regions must be focusable so keyboard users can scroll them (WCAG 2.1.1, axe scrollable-region-focusable).
      'jsx-a11y/no-noninteractive-tabindex': ['error', { tags: [], roles: ['log', 'region', 'tabpanel', 'dialog'] }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }]
    }
  }
);
