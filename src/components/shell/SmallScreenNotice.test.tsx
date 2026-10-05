import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { I18nProvider } from '../../i18n';
import { copyViolations } from '../../i18n/copy';
import { SMALL_SCREEN } from '../../lib/useMediaQuery';
import { SmallScreenNotice } from './SmallScreenNotice';

const html = (clientLogo = false) => renderToStaticMarkup(<I18nProvider><SmallScreenNotice link="https://ilead.example/play?participant=p1" clientLogo={clientLogo} /></I18nProvider>);
const text = (m: string) => m.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

describe('the small screen notice (D69)', () => {
  it('is the page: a main landmark named by its heading, the brand mark first', () => {
    const m = html();
    const id = /<h1 id="([^"]+)"/.exec(m)?.[1];
    expect(id).toBeTruthy();
    expect(m).toContain(`<main aria-labelledby="${id}"`);
    expect(text(m).startsWith('iLead iLead works best on a bigger screen')).toBe(true);
    // The laptop and phone icon is decoration: hidden from screen readers.
    expect(m).toMatch(/<svg[^>]*aria-hidden="true"/);
  });

  it('says what to do in the agreed copy, with a Copy link button and a status for the result', () => {
    const m = html();
    expect(text(m)).toContain('Open this link on a laptop, desktop or tablet to play. Your progress is saved, so you can pick up where you left off.');
    expect(text(m)).toContain('Tablets work in portrait and landscape.');
    expect(m).toMatch(/<button type="button"[^>]*>Copy link<\/button>/);
    expect(m).toMatch(/<span role="status"[^>]*><\/span>/);
    expect(copyViolations(text(m))).toEqual([]);
    expect(text(m)).not.toMatch(/phone|competenc/i);
  });

  it('shows the client logo slot in the client theme, as the HUD does', () => {
    expect(text(html(true))).toContain('Halden Group logo');
    expect(text(html(false))).not.toContain('Halden Group logo');
  });

  it('covers phones held either way, and leaves tablets alone', () => {
    // The query is what the app watches: narrow, or short on a touch screen.
    expect(SMALL_SCREEN).toBe('(max-width: 743.98px), (max-height: 499.98px) and (pointer: coarse)');
  });
});
