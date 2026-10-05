import type { Decorator, Preview } from '@storybook/react-vite';
import { I18nProvider } from '../src/i18n';
import '../src/styles/global.css';

const CLIENT: Record<string, string> = {
  '--client-acc': 'light-dark(oklch(0.5 0.17 0), oklch(0.72 0.17 0))',
  '--client-acc-2': 'light-dark(oklch(0.54 0.15 30), oklch(0.8 0.12 30))',
  '--client-acc-soft': 'light-dark(oklch(0.95 0.025 0), oklch(0.6 0.18 0 / 0.18))',
  '--client-grad': 'linear-gradient(135deg, oklch(0.66 0.19 2), oklch(0.78 0.13 30))'
};

/** Renders every story inside the same themed root the app uses: dark, light or the sample client theme. */
const withTheme: Decorator = (Story, ctx) => {
  const theme = ctx.globals.theme as 'dark' | 'light' | 'client';
  return (
    <div style={{ colorScheme: theme === 'light' ? 'light' : 'dark', ...(theme === 'client' ? CLIENT : null) }}>
      <div className="il-theme" style={{ minHeight: '100vh', padding: 24, background: theme === 'light' ? 'oklch(0.97 0.012 270)' : 'var(--il-color-brand-deep-space)', color: 'var(--il-color-fg-primary)', fontFamily: 'var(--il-font-family-sans)', fontSize: 14 }}>
        <I18nProvider>
          <Story />
        </I18nProvider>
      </div>
    </div>
  );
};

const preview: Preview = {
  decorators: [withTheme],
  globalTypes: {
    theme: {
      description: 'Theme',
      toolbar: { title: 'Theme', icon: 'mirror', items: [{ value: 'dark', title: 'Dark' }, { value: 'light', title: 'Light' }, { value: 'client', title: 'Client: Halden Group' }], dynamicTitle: true }
    }
  },
  initialGlobals: { theme: 'dark' },
  parameters: { layout: 'fullscreen', controls: { expanded: true } }
};

export default preview;
