/**
 * Spanish catalog skeleton (D83), loaded on demand with `?locale=es`. It covers the HUD, time, settings,
 * the inbox, the outcome, the palette, the small screen notice, what neglect costs on the board (D171 to D174:
 * the action drawer's notes, the board's alerts, keeping the sponsor in touch), the preview bar (D191) and the
 * packaged player's own notice (D208), the decision dialog, the week end's and the report's decision lines (D231), plus the engine's copy in `engine.json` (loaded beside the first view,
 * see `../../locales.ts`). Any key left out falls back to English one by one. Keys must exist in the English
 * catalog (src/i18n/catalog.test.ts).
 */
import action from './action.json';
import board from './board.json';
import decision from './decision.json';
import hud from './hud.json';
import inbox from './inbox.json';
import lms from './lms.json';
import metrics from './metrics.json';
import preview from './preview.json';
import report from './report.json';
import settings from './settings.json';
import time from './time.json';
import weekend from './weekend.json';

const es: Record<string, string> = {
  ...action,
  ...board,
  ...decision,
  ...hud,
  ...inbox,
  ...lms,
  ...metrics,
  ...preview,
  ...report,
  ...settings,
  ...time,
  ...weekend,
};
export default es;
