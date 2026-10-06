/**
 * English catalog, one JSON file per feature so parallel work does not collide.
 * Add a file, import it here, and spread it into the catalog. Keys must be unique across files
 * (checked by src/i18n/catalog.test.ts).
 *
 * The end screen, report and week end copy is not in the first load: those screens load on demand and
 * register their file when they load (`registerMessages`, D67). Their keys are still typed here.
 */
import action from './action.json';
import actions from './actions.json';
import board from './board.json';
import common from './common.json';
import events from './events.json';
import gamification from './gamification.json';
import hud from './hud.json';
import inbox from './inbox.json';
import live from './live.json';
import liveformats from './liveformats.json';
import liveshell from './liveshell.json';
import member from './member.json';
import metric from './metric.json';
import metrics from './metrics.json';
import onboarding from './onboarding.json';
import outcome from './outcome.json';
import palette from './palette.json';
import profile from './profile.json';
import reason from './reason.json';
import score from './score.json';
import settings from './settings.json';
import smallscreen from './smallscreen.json';
import style from './style.json';
import stylesetting from './stylesetting.json';
import team from './team.json';
import time from './time.json';

export const en = { ...action, ...actions, ...board, ...common, ...events, ...gamification, ...hud, ...inbox, ...live, ...liveformats, ...liveshell, ...member, ...metric, ...metrics, ...onboarding, ...outcome, ...palette, ...profile, ...reason, ...score, ...settings, ...smallscreen, ...style, ...stylesetting, ...team, ...time };

/** Loaded with their screens: './end.json', './report.json', './tablet.json' (the tablet board, D73), './weekend.json'. */
export type LazyMessages = typeof import('./end.json') & typeof import('./report.json') & typeof import('./tablet.json') & typeof import('./weekend.json');
