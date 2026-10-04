/**
 * English catalog, one JSON file per feature so parallel work does not collide.
 * Add a file, import it here, and spread it into the catalog. Keys must be unique across files
 * (checked by src/i18n/catalog.test.ts).
 */
import action from './action.json';
import actions from './actions.json';
import board from './board.json';
import common from './common.json';
import gamification from './gamification.json';
import hud from './hud.json';
import inbox from './inbox.json';
import live from './live.json';
import liveformats from './liveformats.json';
import liveshell from './liveshell.json';
import member from './member.json';
import metric from './metric.json';
import metrics from './metrics.json';
import outcome from './outcome.json';
import palette from './palette.json';
import profile from './profile.json';
import reason from './reason.json';
import style from './style.json';
import stylesetting from './stylesetting.json';
import team from './team.json';
import time from './time.json';

export const en = { ...action, ...actions, ...board, ...common, ...gamification, ...hud, ...inbox, ...live, ...liveformats, ...liveshell, ...member, ...metric, ...metrics, ...outcome, ...palette, ...profile, ...reason, ...style, ...stylesetting, ...team, ...time };
