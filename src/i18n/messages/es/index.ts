/**
 * Spanish catalog skeleton (D83), loaded on demand with `?locale=es`. It covers the HUD, time, settings,
 * the inbox, the outcome, the palette and the small screen notice, plus the engine's copy in
 * `engine.json` (loaded beside the first view, see `../../locales.ts`). Any key left out falls back to
 * English one by one. Keys must exist in the English catalog (src/i18n/catalog.test.ts).
 */
import hud from './hud.json';
import inbox from './inbox.json';
import settings from './settings.json';
import time from './time.json';

const es: Record<string, string> = { ...hud, ...inbox, ...settings, ...time };
export default es;
