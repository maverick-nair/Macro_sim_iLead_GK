/**
 * Spanish catalog skeleton (D83), loaded on demand with `?locale=es`. It covers the HUD, time, settings,
 * the inbox, the outcome, the palette, the small screen notice and what neglect costs on the board (D171 to D174:
 * the action drawer's notes, the board's alerts, keeping the sponsor in touch), plus the engine's copy in
 * `engine.json` (loaded beside the first view, see `../../locales.ts`). Any key left out falls back to
 * English one by one. Keys must exist in the English catalog (src/i18n/catalog.test.ts).
 */
import action from './action.json';
import board from './board.json';
import hud from './hud.json';
import inbox from './inbox.json';
import metrics from './metrics.json';
import settings from './settings.json';
import time from './time.json';

const es: Record<string, string> = { ...action, ...board, ...hud, ...inbox, ...metrics, ...settings, ...time };
export default es;
