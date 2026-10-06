import type { Decorator, Preview } from '@storybook/react-vite';
import { I18nProvider } from '../src/i18n';
import { BrandContext } from '../src/theme/brand';
import { resolveTheme } from '../src/theme/loader';
import brightwater from '../src/theme/samples/brightwater.json';
import halden from '../src/theme/samples/halden.json';
import '../src/styles/global.css';
import './preview.css';

/**
 * Client themes, through the same loader as the app (D71): Halden, the sample client theme, and
 * Brightwater, a deliberately bad palette the loader corrects (its corrections show in the console).
 */
const CLIENTS = { client: resolveTheme(halden), corrected: resolveTheme(brightwater) };
type ThemeGlobal = 'dark' | 'light' | 'client' | 'client-light' | 'corrected' | 'corrected-light';

/** Renders every story inside the same themed root the app uses: dark, light or a client theme in either mode. */
const withTheme: Decorator = (Story, ctx) => {
  const theme = ctx.globals.theme as ThemeGlobal;
  const light = theme.endsWith('light');
  const client = theme.startsWith('corrected') ? CLIENTS.corrected : theme.startsWith('client') ? CLIENTS.client : null;
  return (
    <div style={{ colorScheme: light ? 'light' : 'dark', ...client?.vars }}>
      <div className="il-theme" style={{ minHeight: '100vh', padding: 24, background: light ? 'oklch(0.97 0.012 270)' : 'var(--il-color-brand-deep-space)', color: 'var(--il-color-fg-primary)', fontFamily: 'var(--il-font-family-sans)', fontSize: 14 }}>
        <BrandContext.Provider value={client?.brand ?? null}>
          <I18nProvider>
            <Story />
          </I18nProvider>
        </BrandContext.Provider>
      </div>
    </div>
  );
};

const preview: Preview = {
  decorators: [withTheme],
  globalTypes: {
    theme: {
      description: 'Theme',
      toolbar: {
        title: 'Theme', icon: 'mirror', dynamicTitle: true,
        items: [
          { value: 'dark', title: 'Dark' }, { value: 'light', title: 'Light' },
          { value: 'client', title: 'Client: Halden Group' }, { value: 'client-light', title: 'Client: Halden Group, light' },
          { value: 'corrected', title: 'Client: Brightwater, corrected' }, { value: 'corrected-light', title: 'Client: Brightwater, corrected, light' }
        ]
      }
    }
  },
  initialGlobals: { theme: 'dark' },
  parameters: { layout: 'fullscreen', controls: { expanded: true } }
};

export default preview;
