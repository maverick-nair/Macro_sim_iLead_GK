import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  framework: { name: '@storybook/react-vite', options: {} },
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  staticDirs: ['../public'],
  core: { disableTelemetry: true },
  // Keep light-dark() native, as in vite.config.ts. Storybook's production build sets its own
  // build target, which would lower light-dark() into variables that never resolve here.
  viteFinal: config => ({ ...config, build: { ...config.build, cssTarget: ['chrome123', 'edge123', 'firefox120', 'safari17.5'] } })
};

export default config;
