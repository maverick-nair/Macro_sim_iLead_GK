import { createContext, useContext, type ReactNode } from 'react';
import { useI18n } from '../i18n';
import type { Brand } from './types';

/** The client's brand from the theme (D72), or null for the plain iLead theme. */
export const BrandContext = createContext<Brand | null>(null);
export const useBrand = () => useContext(BrandContext);

/**
 * The client's logo, shown before the iLead wordmark wherever the brand mark appears: the HUD,
 * onboarding, the small screen notice and the report header. Renders nothing without a client brand.
 * An image theme shows the image, a text theme its text mark, and a theme with only a name the
 * design's dashed placeholder ("Halden Group logo", frame b15).
 */
export function ClientLogo() {
  const brand = useBrand();
  const { t } = useI18n();
  if (!brand) return null;
  const { logo } = brand;
  if (logo.kind === 'image') {
    const alt = logo.alt ?? (brand.name ? t('hud.clientLogo', { name: brand.name }) : t('hud.clientLogoUnnamed'));
    return <img src={logo.src} alt={alt} className="block h-7 w-auto max-w-40 flex-none object-contain" />;
  }
  if (logo.kind === 'text') return <span className="flex-none text-15 font-800 text-fg-primary">{logo.text}</span>;
  return <span className="flex min-h-7 items-center rounded-6 border border-dashed border-line-strong px-2.5 text-12 text-fg-secondary">{t('hud.clientLogo', { name: logo.name })}</span>;
}

/**
 * The iLead wordmark with the client's logo before it, 10px apart as in the HUD. Without a client
 * brand it renders the wordmark alone, exactly as before (no wrapper), so the default theme's layout
 * does not move.
 */
export function WithClientLogo({ children, className = '' }: { children: ReactNode; className?: string }) {
  const brand = useBrand();
  if (!brand) return children;
  return <div className={`flex items-center gap-2.5 ${className}`}><ClientLogo />{children}</div>;
}
